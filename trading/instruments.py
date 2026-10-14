"""
Resolve configured symbols to tradeable OKX instIds.

- Full instIds are used as-is (e.g. "BTC-USD_UM_XPERP-310404", "BTC-USDT-SWAP").
- An instFamily without expiry (e.g. "BTC-USD_UM_XPERP" or "BTC-USD_UM") is
  resolved via /public/instruments?instType=FUTURES&instFamily=... to the live
  contract with the nearest expiry that is at least MIN_DAYS_TO_EXPIRY away.
"""

import re
import time
from typing import Any, Dict, List

MIN_DAYS_TO_EXPIRY = 7
_DATED = re.compile(r"-\d{6}$")


def is_full_inst_id(symbol: str) -> bool:
    return symbol.endswith("-SWAP") or bool(_DATED.search(symbol))


def pick_contract(instruments: List[Dict[str, Any]], now_ms: int, min_days: int = MIN_DAYS_TO_EXPIRY) -> str:
    cutoff = now_ms + min_days * 86_400_000
    live = [i for i in instruments if i.get("state") == "live" and int(i.get("expTime") or 0) >= cutoff]
    if not live:
        raise ValueError("no live contract with enough time to expiry")
    return min(live, key=lambda i: int(i["expTime"]))["instId"]


def resolve_symbol(client, symbol: str, now_ms: int = None) -> str:
    if is_full_inst_id(symbol):
        return symbol
    now_ms = now_ms if now_ms is not None else int(time.time() * 1000)
    return pick_contract(client.get_instruments_by_family(symbol, "FUTURES"), now_ms)
