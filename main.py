"""
TradebottenAnna engine: one controlled execution cycle.

Order of operations (any failure aborts or skips, never guesses):
 1. Load + validate strategy.json.
 2. Read account equity from OKX. If unreadable -> ABORT cycle (no fallback).
 3. Reconcile against OKX: positions, open orders, pending algo (SL) orders.
    If unreadable -> ABORT. Unknown open risk / open orders -> no new entries.
 4. For each symbol: real OKX candles (public), signal, instrument spec (ctVal,
    lotSz, minSz, tickSz), contract sizing capped at 1% risk per trade and
    3% total open risk, and a market order WITH attached stop loss.
 5. Orders are only sent when trading_enabled, kill switch off AND dry-run
    explicitly disabled (DRY_RUN=false). Default is dry-run.
"""

import json
import logging
import os
import sys
from decimal import Decimal
from typing import Any, Dict, List, Optional

from trading.config import BotConfig, load_strategy_config
from trading.okx_client import OKXClient, OKXError
from trading.reconcile import reconcile
from trading.sizing import D, InstrumentSpec, round_price, size_contracts
from trading.strategy import StrategyEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [TradebottenAnna] %(message)s")
logger = logging.getLogger("TradebottenAnna")

# Hard engine caps; strategy.json may be stricter, never looser.
MAX_RISK_PER_TRADE_PCT = Decimal("1.0")
MAX_TOTAL_OPEN_RISK_PCT = Decimal("3.0")

BAR_MAP = {"15m": "15m", "30m": "30m", "1h": "1H", "2h": "2H", "4h": "4H", "1d": "1Dutc"}


def dry_run_from_env() -> bool:
    """Dry-run unless DRY_RUN (or legacy DEMO_DRY_RUN) is explicitly 'false'."""
    val = os.getenv("DRY_RUN", os.getenv("DEMO_DRY_RUN", "true"))
    return str(val).strip().lower() != "false"


def parse_candles(raw: List[list]) -> List[Dict[str, float]]:
    """OKX candles are newest-first [ts,o,h,l,c,vol,volCcy,volCcyQuote,confirm].
    Returns oldest-first, confirmed (closed) candles only."""
    out = []
    for c in reversed(raw):
        if len(c) >= 9 and str(c[8]) != "1":
            continue
        out.append({"ts": int(c[0]), "open": float(c[1]), "high": float(c[2]), "low": float(c[3]), "close": float(c[4])})
    return out


def _abort(reason: str, **extra) -> Dict[str, Any]:
    logger.error(f"CYCLE ABORTED: {reason}")
    return {"status": "aborted", "reason": reason, "orders_sent": 0, **extra}


def run_bot_cycle(config: BotConfig, client: Optional[OKXClient] = None, dry_run: Optional[bool] = None) -> Dict[str, Any]:
    if dry_run is None:
        dry_run = dry_run_from_env()
    may_send = bool(config.trading_enabled and not config.risk_limits.kill_switch_active and not dry_run)
    logger.info(
        f"Cycle start | env={config.environment} trading_enabled={config.trading_enabled} "
        f"kill_switch={config.risk_limits.kill_switch_active} dry_run={dry_run} -> may_send={may_send}"
    )
    if client is None:
        client = OKXClient(trading_enabled=may_send, enforce_demo=config.risk_limits.enforce_demo_headers)
    else:
        client.trading_enabled = may_send

    # 1. Equity -- no fallback.
    try:
        bal = client.get_balance()
        equity = D(bal.get("totalEq") or "0")
    except Exception as e:
        return _abort(f"balance read failed: {e}")
    if equity <= 0:
        return _abort(f"balance not usable (totalEq={bal.get('totalEq')!r})")
    logger.info(f"Equity: {equity:.2f} USD")

    # 2. Reconcile.
    spec_cache: Dict[str, InstrumentSpec] = {}

    def spec_lookup(inst_id: str) -> InstrumentSpec:
        if inst_id not in spec_cache:
            spec_cache[inst_id] = InstrumentSpec.from_okx(client.get_instrument(inst_id))
        return spec_cache[inst_id]

    rec = reconcile(client, spec_lookup)
    for w in rec.warnings:
        logger.warning(f"Reconcile: {w}")
    if not rec.ok:
        return _abort("; ".join(rec.reasons), reconcile=rec.as_dict())
    for r in rec.reasons:
        logger.warning(f"Reconcile blocks new entries: {r}")

    per_trade_pct = min(D(config.strategy.risk_per_trade_pct), MAX_RISK_PER_TRADE_PCT)
    per_trade_cap = equity * per_trade_pct / 100
    total_cap = equity * MAX_TOTAL_OPEN_RISK_PCT / 100
    open_risk = rec.open_risk_usd
    used_margin = rec.used_margin_usd
    open_count = len(rec.instruments_with_position)
    logger.info(
        f"Risk: open={open_risk:.2f} USD / cap {total_cap:.2f} (3%) | per-trade cap {per_trade_cap:.2f} ({per_trade_pct}%)"
    )

    strategy = StrategyEngine(config.strategy)
    bar = BAR_MAP.get(config.strategy.timeframe, "1H")
    leverage = D(min(config.strategy.max_leverage, 10))
    results: List[Dict[str, Any]] = []
    orders_sent = 0

    for symbol in config.strategy.symbols:
        row: Dict[str, Any] = {"symbol": symbol, "action": "SKIP"}
        results.append(row)
        if symbol in rec.instruments_with_position:
            row["reason"] = "position already open"
            continue
        if symbol in rec.instruments_with_pending_orders:
            row["reason"] = "open order exists"
            continue
        try:
            candles = parse_candles(client.get_candles(symbol, bar=bar, limit=100))
        except Exception as e:
            row["reason"] = f"candle fetch failed: {e}"
            logger.warning(f"{symbol}: {row['reason']}")
            continue
        signal = strategy.evaluate_signal(symbol, candles)
        row["signal"] = {k: signal.get(k) for k in ("action", "score", "reason", "current_price", "atr")}
        logger.info(f"{symbol}: {signal['action']} score={signal['score']} ({signal['reason']})")
        if not (signal.get("passed_threshold") and signal["action"] in ("BUY", "SELL")):
            row["reason"] = "no actionable signal"
            continue
        if rec.block_new_entries:
            row["reason"] = "new entries blocked by reconciliation"
            continue
        if open_count >= config.strategy.max_open_positions:
            row["reason"] = "max_open_positions reached"
            continue

        try:
            spec = spec_lookup(symbol)
            last = D(client.get_ticker(symbol).get("last") or "0")
        except Exception as e:
            row["reason"] = f"instrument/ticker read failed: {e}"
            continue
        if last <= 0:
            row["reason"] = "no valid last price"
            continue
        stop_dist = D(signal["atr"]) * D(config.strategy.atr_stop_multiple)
        tgt_dist = D(signal["atr"]) * D(config.strategy.atr_target_multiple)
        long = signal["action"] == "BUY"
        sl = round_price(last - stop_dist if long else last + stop_dist, spec.tick_sz)
        tp = round_price(last + tgt_dist if long else last - tgt_dist, spec.tick_sz)
        if sl <= 0 or (long and sl >= last) or (not long and sl <= last):
            row["reason"] = f"invalid stop loss {sl}"
            continue

        budget = min(per_trade_cap, total_cap - open_risk)
        margin_budget = equity * D(config.strategy.max_margin_fraction) - used_margin
        sizing = size_contracts(spec, last, sl, budget, margin_budget_usd=max(margin_budget, Decimal(0)), leverage=leverage)
        row["sizing"] = {k: (str(v) if isinstance(v, Decimal) else v) for k, v in sizing.items()}
        if not sizing["valid"]:
            row["reason"] = sizing["reason"]
            logger.info(f"{symbol}: sizing rejected: {sizing['reason']}")
            continue

        logger.info(
            f"{symbol}: {signal['action']} {sizing['contracts_str']} ct (ctVal {spec.ct_val}) @~{last} SL {sl} TP {tp} "
            f"risk {sizing['risk_usd']:.2f} USD"
        )
        if not may_send:
            row.update({"action": "DRY_RUN", "reason": "order calculated, not sent", "sl": str(sl), "tp": str(tp)})
            continue
        resp = client.place_order(
            inst_id=symbol,
            side="buy" if long else "sell",
            size_contracts=sizing["contracts_str"],
            sl_trigger_px=str(sl),
            tp_trigger_px=str(tp),
        )
        row["order"] = resp
        if resp.get("success"):
            orders_sent += 1
            open_risk += sizing["risk_usd"]
            used_margin += sizing["notional_usd"] / leverage
            open_count += 1
            row.update({"action": signal["action"], "reason": "order sent with attached SL"})
        else:
            r = resp.get("response") or {}
            s_codes = [(d.get("sCode"), d.get("sMsg")) for d in (r.get("data") or []) if isinstance(d, dict)]
            row["reason"] = f"order rejected: code={r.get('code')} msg={r.get('msg')} sCodes={s_codes}"
            logger.error(f"{symbol}: order not accepted: {resp}")

    return {
        "status": "success",
        "product": config.product,
        "environment": config.environment,
        "dry_run": dry_run,
        "may_send": may_send,
        "equity_usd": float(equity),
        "open_risk_usd": float(open_risk),
        "total_risk_cap_usd": float(total_cap),
        "orders_sent": orders_sent,
        "reconcile": rec.as_dict(),
        "results": results,
    }


def main() -> int:
    try:
        summary = run_bot_cycle(load_strategy_config())
    except Exception as e:
        logger.error(f"Fatal execution error: {e}", exc_info=True)
        return 1
    print("\n=== TradebottenAnna Execution Summary ===")
    print(json.dumps(summary, indent=2, default=str))
    return 0 if summary.get("status") == "success" else 2


if __name__ == "__main__":
    sys.exit(main())
