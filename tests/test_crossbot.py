"""Cross-bot exposure cap (pure functions, no network)."""
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from trading import crossbot as cb  # noqa: E402

NOW = dt.datetime(2026, 10, 17, 21, 30, tzinfo=dt.timezone.utc)


def feed(fetched="2026-10-17T21:26:00+00:00", ok=True, positions=None):
    return {"lena": {"ok": ok, "fetched_at": fetched, "positions": positions or []}}


def test_peer_exposure_parses_net_positions():
    f = feed(positions=[{"instId": "SUI-USD_UM_XPERP-310404", "pos": 24, "posSide": "net"},
                        {"instId": "SOL-USD_UM_XPERP-310404", "pos": -20, "posSide": "net"},
                        {"instId": "ETH-USD_UM_XPERP-310404", "pos": 0}])
    assert cb.peer_exposure(f, "lena", now=NOW) == [("SUI", True), ("SOL", False)]


def test_peer_exposure_stale_or_missing_is_none():
    assert cb.peer_exposure(feed(fetched="2026-10-17T19:00:00+00:00"), "lena", now=NOW) is None
    assert cb.peer_exposure(feed(ok=False), "lena", now=NOW) is None
    assert cb.peer_exposure({}, "lena", now=NOW) is None
    assert cb.peer_exposure(feed(fetched="garbage"), "lena", now=NOW) is None


def test_same_coin_blocked():
    ok, why = cb.check("ETH", True, own=[], peer=[("ETH", False)])
    assert not ok and why.startswith("CROSS_BOT_SAME_COIN")


def test_direction_cap():
    own = [("BTC", True), ("ETH", True)]
    peer = [("SUI", True), ("XRP", True)]
    ok, why = cb.check("SOL", True, own, peer, max_same_direction=4)
    assert not ok and "LONG=4/4" in why
    assert cb.check("SOL", False, own, peer, max_same_direction=4) == (True, "OK")


def test_feed_unavailable_fail_open_vs_closed():
    assert cb.check("SOL", True, [], None, fail_closed=False)[0] is True
    assert cb.check("SOL", True, [], None, fail_closed=True) == (False, "CROSS_BOT_FEED_UNAVAILABLE")


def test_engine_blocks_entry_when_peer_holds_same_coin(monkeypatch):
    """Integration: run_bot_cycle respekterar taket."""
    import main
    from tests.fake_okx import FakeOKX
    from tests.test_engine_safety import cfg
    assert main.run_bot_cycle(cfg(), client=FakeOKX(), dry_run=True)["results"][0]["action"] == "DRY_RUN"
    monkeypatch.setattr(cb, "load_peer", lambda p, timeout=5.0: [("BTC", True)])
    fake = FakeOKX()
    row = main.run_bot_cycle(cfg(), client=fake, dry_run=False)["results"][0]
    assert row["reason"].startswith("CROSS_BOT_SAME_COIN") and fake.orders == []
