"""
Contract-based position sizing for OKX SWAP instruments.

OKX sizes SWAP orders in *contracts*. One contract = ``ctVal`` units of the
base currency (e.g. BTC-USDT-SWAP ctVal=0.01 BTC). Sizes must be a multiple
of ``lotSz`` and at least ``minSz``. All maths uses Decimal and always rounds
DOWN so the realised risk never exceeds the budget.
"""

from dataclasses import dataclass
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP
from typing import Any, Dict, Optional


def D(x: Any) -> Decimal:
    return Decimal(str(x))


@dataclass
class InstrumentSpec:
    inst_id: str
    ct_val: Decimal
    lot_sz: Decimal
    min_sz: Decimal
    tick_sz: Decimal
    ct_val_ccy: str = ""
    settle_ccy: str = ""
    ct_type: str = "linear"
    state: str = "live"

    @classmethod
    def from_okx(cls, d: Dict[str, Any]) -> "InstrumentSpec":
        for key in ("instId", "ctVal", "lotSz", "minSz", "tickSz"):
            if not d.get(key):
                raise ValueError(f"Instrument data missing {key}")
        spec = cls(
            inst_id=d["instId"],
            ct_val=D(d["ctVal"]),
            lot_sz=D(d["lotSz"]),
            min_sz=D(d["minSz"]),
            tick_sz=D(d["tickSz"]),
            ct_val_ccy=d.get("ctValCcy", ""),
            settle_ccy=d.get("settleCcy", ""),
            ct_type=d.get("ctType", "linear"),
            state=d.get("state", "live"),
        )
        if spec.ct_val <= 0 or spec.lot_sz <= 0 or spec.min_sz <= 0 or spec.tick_sz <= 0:
            raise ValueError(f"Instrument {spec.inst_id} has non-positive spec values")
        return spec


def round_to_step(value: Decimal, step: Decimal, rounding=ROUND_DOWN) -> Decimal:
    return (value / step).quantize(Decimal("1"), rounding=rounding) * step


def round_price(px: Decimal, tick: Decimal) -> Decimal:
    return round_to_step(px, tick, ROUND_HALF_UP)


def risk_per_contract(entry: Decimal, stop: Decimal, ct_val: Decimal) -> Decimal:
    return abs(entry - stop) * ct_val


def size_contracts(
    spec: InstrumentSpec,
    entry_price: Any,
    stop_price: Any,
    risk_budget_usd: Any,
    margin_budget_usd: Optional[Any] = None,
    leverage: Any = 1,
) -> Dict[str, Any]:
    """Return the largest valid contract count whose SL risk <= risk_budget_usd.

    Linear USDT-margined swaps only (ctType=linear, settle USDT/USDC).
    """
    if spec.ct_type != "linear":
        return {"valid": False, "reason": f"Unsupported ctType {spec.ct_type} (linear only)"}
    if spec.state != "live":
        return {"valid": False, "reason": f"Instrument state is {spec.state}"}
    entry, stop, budget = D(entry_price), D(stop_price), D(risk_budget_usd)
    if entry <= 0 or stop <= 0:
        return {"valid": False, "reason": "Prices must be positive"}
    if budget <= 0:
        return {"valid": False, "reason": "No risk budget left"}
    rpc = risk_per_contract(entry, stop, spec.ct_val)
    if rpc <= 0:
        return {"valid": False, "reason": "Stop loss equals entry"}

    contracts = round_to_step(budget / rpc, spec.lot_sz)
    limited_by = "risk"
    if margin_budget_usd is not None:
        lev = D(leverage)
        if lev <= 0:
            return {"valid": False, "reason": "Leverage must be positive"}
        margin_per_contract = entry * spec.ct_val / lev
        max_by_margin = round_to_step(D(margin_budget_usd) / margin_per_contract, spec.lot_sz) if margin_per_contract > 0 else Decimal(0)
        if max_by_margin < contracts:
            contracts, limited_by = max_by_margin, "margin"

    if contracts < spec.min_sz:
        return {
            "valid": False,
            "reason": f"Size {contracts} below minSz {spec.min_sz} (risk/contract {rpc:.4f} USD, budget {budget:.2f} USD)",
        }
    risk = contracts * rpc
    notional = contracts * spec.ct_val * entry
    return {
        "valid": True,
        "contracts": contracts,
        "contracts_str": format(contracts.normalize(), "f"),
        "risk_usd": risk,
        "notional_usd": notional,
        "risk_per_contract": rpc,
        "limited_by": limited_by,
        "reason": "OK",
    }


def choose_leverage_and_size(spec, entry_price, stop_price, risk_budget_usd, margin_budget_usd, min_leverage, max_leverage):
    """Lowest whole leverage in [min_leverage..max_leverage] at which the margin cap no longer
    shrinks the risk-based size. Per-trade risk is unchanged; leverage only frees margin.
    Falls back to max_leverage (best possible) if margin still limits there."""
    lo, hi = int(min_leverage), int(max_leverage)
    if lo < 1 or hi < lo:
        return {"valid": False, "reason": f"Bad leverage range {lo}..{hi}"}, lo
    last = None
    for lev in range(lo, hi + 1):
        last = size_contracts(spec, entry_price, stop_price, risk_budget_usd, margin_budget_usd=margin_budget_usd, leverage=lev)
        if last["valid"] and last["limited_by"] == "risk":
            return last, lev
    return last, hi
