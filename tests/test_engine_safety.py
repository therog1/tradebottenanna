from decimal import Decimal
import json
from unittest import mock

import pytest

from main import run_bot_cycle, parse_candles, MAX_TOTAL_OPEN_RISK_PCT
from trading.config import BotConfig, StrategyParameters, RiskLimits
from trading.okx_client import OKXClient
from trading.reconcile import reconcile
from trading.sizing import InstrumentSpec, size_contracts
from tests.fake_okx import FakeOKX, BTC, make_candles


def cfg(trading=True, risk_pct=1.5, symbols=("BTC-USDT-SWAP",), max_pos=3, margin=0.8, min_score=50):
    return BotConfig(
        environment="okx_eu_demo", trading_enabled=trading,
        strategy=StrategyParameters(risk_per_trade_pct=risk_pct, max_open_positions=max_pos, max_margin_fraction=margin,
                                    min_score=min_score, symbols=list(symbols), max_leverage=3),
        risk_limits=RiskLimits(enforce_demo_headers=True),
    )


SPEC = InstrumentSpec.from_okx(BTC)


# ---------------------------------------------------------------- sizing
def test_sizing_in_contracts_uses_ctval():
    # stop distance 1000 USD/BTC * 0.01 BTC/ct = 10 USD per contract; budget 10 -> 1 contract
    r = size_contracts(SPEC, 60000, 59000, 10)
    assert r["valid"] and r["contracts"] == Decimal("1.00")
    assert r["risk_usd"] == Decimal("10.00")


def test_sizing_rounds_down_to_lot():
    r = size_contracts(SPEC, 60000, 59000, 10.999)
    assert r["contracts"] == Decimal("1.09")
    assert r["risk_usd"] <= Decimal("10.999")


def test_sizing_below_min_size_rejected():
    spec = InstrumentSpec.from_okx({**BTC, "lotSz": "1", "minSz": "1"})
    r = size_contracts(spec, 60000, 59000, 9.99)
    assert not r["valid"] and "minSz" in r["reason"]


def test_sizing_margin_cap():
    # 1 ct notional = 600 USD, lev 3 -> 200 USD margin/ct; margin budget 300 -> 1.5 ct (lotSz 0.01)
    r = size_contracts(SPEC, 60000, 59000, 1000, margin_budget_usd=300, leverage=3)
    assert r["contracts"] == Decimal("1.50") and r["limited_by"] == "margin"


def test_instrument_spec_requires_ctval():
    with pytest.raises(ValueError):
        InstrumentSpec.from_okx({**BTC, "ctVal": ""})


# ------------------------------------------------------------ risk caps
def test_per_trade_risk_capped_at_1pct_even_if_config_says_more():
    fake = FakeOKX(equity="1000")
    out = run_bot_cycle(cfg(risk_pct=1.5), client=fake, dry_run=False)
    assert out["orders_sent"] == 1
    o = fake.orders[0]
    entry, sl, ct = Decimal(fake.last), Decimal(o["sl_trigger_px"]), Decimal(o["size_contracts"])
    risk = abs(entry - sl) * ct * Decimal("0.01")
    assert risk <= Decimal("10.0")  # 1% of 1000
    assert risk > Decimal("9.0")


def test_total_open_risk_cap_3pct_blocks():
    # existing position risking 30 USD (= 3% of 1000) -> no new trade
    fake = FakeOKX(equity="1000",
                   positions=[{"instId": "ETH-USDT-SWAP", "pos": "10", "avgPx": "3000", "imr": "10"}],
                   algos=[{"instId": "ETH-USDT-SWAP", "slTriggerPx": "2970", "ordType": "conditional"}],
                   instruments={"BTC-USDT-SWAP": BTC, "ETH-USDT-SWAP": {**BTC, "instId": "ETH-USDT-SWAP", "ctVal": "0.1"}})
    out = run_bot_cycle(cfg(), client=fake, dry_run=False)
    assert out["open_risk_usd"] == pytest.approx(30.0)
    assert fake.orders == []
    assert "budget" in out["results"][0]["reason"] or "risk" in out["results"][0]["reason"].lower()


def test_total_open_risk_reduces_size():
    # 25 USD open -> only 5 USD left of the 30 USD cap
    fake = FakeOKX(equity="1000",
                   positions=[{"instId": "ETH-USDT-SWAP", "pos": "-5", "avgPx": "3000", "imr": "10"}],
                   algos=[{"instId": "ETH-USDT-SWAP", "slTriggerPx": "3050", "ordType": "oco"}],
                   instruments={"BTC-USDT-SWAP": BTC, "ETH-USDT-SWAP": {**BTC, "instId": "ETH-USDT-SWAP", "ctVal": "0.1"}})
    out = run_bot_cycle(cfg(), client=fake, dry_run=False)
    assert out["orders_sent"] == 1
    assert out["open_risk_usd"] <= float(Decimal("1000") * MAX_TOTAL_OPEN_RISK_PCT / 100) + 1e-9
    assert out["open_risk_usd"] > 25


# ------------------------------------------------------------ SL attachment
def test_engine_always_passes_stop_loss():
    fake = FakeOKX()
    run_bot_cycle(cfg(), client=fake, dry_run=False)
    o = fake.orders[0]
    assert Decimal(o["sl_trigger_px"]) < Decimal(fake.last)  # long -> SL below


def test_client_payload_has_attachalgoords():
    c = OKXClient(api_key="k", secret_key="s", passphrase="p", trading_enabled=True, enforce_demo=True)
    with mock.patch.object(OKXClient, "_http", return_value={"code": "0", "data": [{"sCode": "0"}]}) as h:
        r = c.place_order(inst_id="BTC-USDT-SWAP", side="buy", size_contracts="1", sl_trigger_px="59000", tp_trigger_px="62000")
    body = json.loads(h.call_args[0][2])
    assert r["success"]
    assert body["attachAlgoOrds"][0]["slTriggerPx"] == "59000"
    assert body["attachAlgoOrds"][0]["slOrdPx"] == "-1"
    assert body["sz"] == "1" and body["ordType"] == "market"


def test_client_refuses_order_without_sl():
    c = OKXClient(api_key="k", secret_key="s", passphrase="p", trading_enabled=True)
    with mock.patch.object(OKXClient, "_http") as h:
        r = c.place_order(inst_id="BTC-USDT-SWAP", side="buy", size_contracts="1", sl_trigger_px="")
    assert r["blocked"] and not h.called


def test_client_refuses_when_trading_disabled():
    c = OKXClient(api_key="k", secret_key="s", passphrase="p", trading_enabled=False)
    with mock.patch.object(OKXClient, "_http") as h:
        r = c.place_order(inst_id="BTC-USDT-SWAP", side="buy", size_contracts="1", sl_trigger_px="1")
    assert r["blocked"] and not h.called


def test_dry_run_sends_nothing():
    fake = FakeOKX()
    out = run_bot_cycle(cfg(), client=fake, dry_run=True)
    assert fake.orders == [] and "place_order" not in fake.calls
    assert out["results"][0]["action"] == "DRY_RUN"


# ------------------------------------------------------- balance failure
def test_balance_read_failure_aborts():
    fake = FakeOKX(fail={"balance"})
    out = run_bot_cycle(cfg(), client=fake, dry_run=False)
    assert out["status"] == "aborted" and out["orders_sent"] == 0
    assert fake.calls == ["balance"]  # nothing else attempted


@pytest.mark.parametrize("eq", ["", "0", None])
def test_zero_or_missing_balance_aborts(eq):
    fake = FakeOKX(equity=eq)
    out = run_bot_cycle(cfg(), client=fake, dry_run=False)
    assert out["status"] == "aborted" and fake.orders == []


def test_real_client_without_credentials_has_no_10000_fallback():
    c = OKXClient(api_key="", secret_key="", passphrase="")
    c.api_key = c.secret_key = c.passphrase = ""
    with mock.patch.object(OKXClient, "_http") as h:
        out = run_bot_cycle(cfg(), client=c, dry_run=False)
    assert out["status"] == "aborted" and not h.called


def test_http_error_balance_raises():
    c = OKXClient(api_key="k", secret_key="s", passphrase="p")
    with mock.patch.object(OKXClient, "_http", return_value={"code": "50113", "msg": "Invalid sign"}):
        out = run_bot_cycle(cfg(), client=c, dry_run=False)
    assert out["status"] == "aborted"


# ------------------------------------------------------- reconciliation
def lookup(fake):
    return lambda i: InstrumentSpec.from_okx(fake.get_instrument(i))


def test_reconcile_failure_aborts_cycle():
    for f in ("positions", "pending", "algos", "config"):
        fake = FakeOKX(fail={f})
        out = run_bot_cycle(cfg(), client=fake, dry_run=False)
        assert out["status"] == "aborted" and fake.orders == [], f


def test_reconcile_position_without_sl_blocks_entries():
    fake = FakeOKX(positions=[{"instId": "BTC-USDT-SWAP", "pos": "1", "avgPx": "60000"}])
    rec = reconcile(fake, lookup(fake))
    assert rec.ok and rec.block_new_entries
    fake2 = FakeOKX(positions=[{"instId": "SOL-USDT-SWAP", "pos": "1", "avgPx": "150"}])
    out = run_bot_cycle(cfg(), client=fake2, dry_run=False)
    assert fake2.orders == []


def test_reconcile_computes_open_risk_with_ctval():
    fake = FakeOKX(positions=[{"instId": "BTC-USDT-SWAP", "pos": "2", "avgPx": "60000"}],
                   algos=[{"instId": "BTC-USDT-SWAP", "slTriggerPx": "59000", "ordType": "conditional"}])
    rec = reconcile(fake, lookup(fake))
    assert rec.open_risk_usd == Decimal("20.00")  # 1000 * 2 * 0.01
    assert not rec.block_new_entries


def test_reconcile_skips_symbol_with_open_position():
    fake = FakeOKX(positions=[{"instId": "BTC-USDT-SWAP", "pos": "1", "avgPx": "60000"}],
                   algos=[{"instId": "BTC-USDT-SWAP", "slTriggerPx": "59000"}])
    out = run_bot_cycle(cfg(), client=fake, dry_run=False)
    assert fake.orders == [] and out["results"][0]["reason"] == "position already open"


def test_reconcile_pending_orders_block():
    fake = FakeOKX(pending=[{"instId": "ETH-USDT-SWAP", "ordId": "1"}])
    out = run_bot_cycle(cfg(), client=fake, dry_run=False)
    assert fake.orders == []


def test_reconcile_non_net_mode_blocks():
    fake = FakeOKX(pos_mode="long_short_mode")
    run_bot_cycle(cfg(), client=fake, dry_run=False)
    assert fake.orders == []


def test_orphan_algo_is_warning_only_and_untouched():
    fake = FakeOKX(algos=[{"instId": "ETH-USDT-SWAP", "slTriggerPx": "1"}])
    rec = reconcile(fake, lookup(fake))
    assert rec.warnings and not rec.block_new_entries


# ------------------------------------------------------- market data
def test_parse_candles_oldest_first_confirmed_only():
    raw = make_candles(3)
    raw[0][8] = "0"  # newest still forming
    out = parse_candles(raw)
    assert len(out) == 2 and out[0]["ts"] < out[1]["ts"]


def test_candle_failure_skips_symbol():
    fake = FakeOKX(fail={"candles"})
    out = run_bot_cycle(cfg(), client=fake, dry_run=False)
    assert fake.orders == [] and "candle" in out["results"][0]["reason"]


def test_kill_switch_and_disabled_send_nothing():
    c = cfg(trading=False)
    fake = FakeOKX()
    run_bot_cycle(c, client=fake, dry_run=False)
    assert fake.orders == []
    c = cfg(); c.risk_limits.kill_switch_active = True
    fake = FakeOKX()
    run_bot_cycle(c, client=fake, dry_run=False)
    assert fake.orders == []
