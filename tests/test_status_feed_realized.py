"""Unit tests for status_feed realized PnL summing (no network, no secrets)."""
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import status_feed as sf  # noqa: E402


def test_sum_realized_pnl_today_and_total_stockholm():
    # 2026-10-14 20:38 Europe/Stockholm = 18:38 UTC
    close_ms = int(dt.datetime(2026, 10, 14, 20, 38, tzinfo=sf.STOCKHOLM).timestamp() * 1000)
    older_ms = int(dt.datetime(2026, 10, 13, 12, 0, tzinfo=sf.STOCKHOLM).timestamp() * 1000)
    rows = [
        {"realizedPnl": "-2.24", "uTime": str(close_ms)},  # Lena XRP close
        {"realizedPnl": "1.50", "uTime": str(older_ms)},
        {"realizedPnl": "", "uTime": str(close_ms)},  # ignored as 0
    ]
    now = dt.datetime(2026, 10, 14, 21, 0, tzinfo=sf.STOCKHOLM)
    today, total = sf.sum_realized_pnl(rows, now=now)
    assert today == -2.24
    assert total == -0.74  # -2.24 + 1.50


def test_sum_realized_pnl_empty():
    assert sf.sum_realized_pnl([]) == (0.0, 0.0)
    assert sf.sum_realized_pnl(None) == (0.0, 0.0)


def test_pos_hist_path_allowlist():
    assert sf.POS_HIST_PATH.match("/api/v5/account/positions-history?instType=FUTURES&limit=100")
    assert sf.POS_HIST_PATH.match("/api/v5/account/positions-history?instType=FUTURES&limit=100&after=1792048256593")
    assert not sf.POS_HIST_PATH.match("/api/v5/account/positions-history?instType=SWAP&limit=100")
    assert not sf.POS_HIST_PATH.match("/api/v5/trade/order")


def test_resanitize_keeps_realized_fields():
    raw = {
        "ok": True,
        "fetched_at": "2026-10-14T18:41:00Z",
        "totalEqUsd": 47.18,
        "realized_pnl": -2.24,
        "realized_pnl_today": -2.24,
        "balances": [],
        "positions": [],
        "open_orders": [],
        "algo_orders": [],
        "recent_fills": [],
        "recent_orders": [],
    }
    out = sf.resanitize(raw, "lena")
    assert out["realized_pnl"] == -2.24
    assert out["realized_pnl_today"] == -2.24
