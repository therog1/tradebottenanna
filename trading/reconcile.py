"""
Reconciliation of local intent against OKX state (positions, open orders,
pending algo orders). Read-only: never cancels or places anything.

Open risk per position = |avgPx - SL trigger| * |pos| * ctVal, using the
stop loss found in pending algo orders for that instrument. A position
without a readable stop loss has UNKNOWN risk, which blocks new entries.
"""

import logging
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Callable, Dict, List, Optional

from trading.sizing import D, InstrumentSpec

logger = logging.getLogger("TradebottenAnna")


@dataclass
class ReconcileResult:
    ok: bool
    block_new_entries: bool = False
    reasons: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    open_positions: List[Dict[str, Any]] = field(default_factory=list)
    open_risk_usd: Decimal = Decimal(0)
    instruments_with_position: set = field(default_factory=set)
    instruments_with_pending_orders: set = field(default_factory=set)
    used_margin_usd: Decimal = Decimal(0)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "ok": self.ok,
            "block_new_entries": self.block_new_entries,
            "reasons": self.reasons,
            "warnings": self.warnings,
            "open_positions": self.open_positions,
            "open_risk_usd": float(self.open_risk_usd),
            "used_margin_usd": float(self.used_margin_usd),
        }


def _sl_px(algo: Dict[str, Any]) -> Optional[Decimal]:
    v = algo.get("slTriggerPx")
    try:
        return D(v) if v not in (None, "", "0") else None
    except Exception:
        return None


def reconcile(client, spec_lookup: Callable[[str], InstrumentSpec]) -> ReconcileResult:
    """Read OKX state and compute open risk. Any read failure -> ok=False."""
    try:
        acct = client.get_account_config()
        positions = client.get_positions()
        pending = client.get_pending_orders()
        algos = client.get_pending_algo_orders("conditional") + client.get_pending_algo_orders("oco")
    except Exception as e:
        return ReconcileResult(ok=False, block_new_entries=True, reasons=[f"OKX state read failed: {e}"])

    res = ReconcileResult(ok=True)

    pos_mode = acct.get("posMode")
    if pos_mode != "net_mode":
        res.block_new_entries = True
        res.reasons.append(f"Account posMode is {pos_mode!r}; engine supports net_mode only")

    for o in pending:
        res.instruments_with_pending_orders.add(o.get("instId"))
    if pending:
        res.block_new_entries = True
        res.reasons.append(
            f"{len(pending)} unfilled regular order(s) open on OKX ({sorted(res.instruments_with_pending_orders)}); not adding risk"
        )

    algos_by_inst: Dict[str, List[Dict[str, Any]]] = {}
    for a in algos:
        algos_by_inst.setdefault(a.get("instId"), []).append(a)

    for p in positions:
        try:
            qty = D(p.get("pos") or "0")
        except Exception:
            res.block_new_entries = True
            res.reasons.append(f"Unparseable position size for {p.get('instId')}")
            continue
        if qty == 0:
            continue
        inst = p.get("instId")
        res.instruments_with_position.add(inst)
        try:
            res.used_margin_usd += D(p.get("imr") or p.get("margin") or "0")
        except Exception:
            pass
        entry = D(p.get("avgPx") or "0")
        side_long = qty > 0
        sls = [s for s in (_sl_px(a) for a in algos_by_inst.get(inst, [])) if s is not None]
        # protective SL must be on the losing side of entry
        sls = [s for s in sls if (s < entry if side_long else s > entry)]
        info = {"instId": inst, "pos": str(qty), "avgPx": str(entry), "sl": None, "risk_usd": None}
        if not sls or entry <= 0:
            res.block_new_entries = True
            res.reasons.append(f"Position {inst} ({qty}) has no readable stop loss -> open risk unknown")
            res.open_positions.append(info)
            continue
        try:
            spec = spec_lookup(inst)
        except Exception as e:
            res.block_new_entries = True
            res.reasons.append(f"Could not load ctVal for {inst}: {e}")
            res.open_positions.append(info)
            continue
        # worst (furthest) stop counts
        sl = min(sls) if side_long else max(sls)
        risk = abs(entry - sl) * abs(qty) * spec.ct_val
        info.update({"sl": str(sl), "risk_usd": float(risk)})
        res.open_risk_usd += risk
        res.open_positions.append(info)

    for inst, lst in algos_by_inst.items():
        if inst not in res.instruments_with_position:
            res.warnings.append(f"{len(lst)} algo order(s) on {inst} without a position (orphan; not touched)")

    return res
