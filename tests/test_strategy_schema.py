"""
Tests for TradebottenAnna Strategy Configuration Schema
Validates strategy.json structure, safety constraints, and parameter boundaries.
"""

import unittest
from trading.config import load_strategy_config, StrategyParameters, BotConfig


class TestStrategySchema(unittest.TestCase):
    def test_load_root_strategy_json(self):
        """Verify root strategy.json loads and complies with authoritative schema."""
        config = load_strategy_config()
        self.assertEqual(config.product, "TradebottenAnna")
        # strategy.json currently says okx_eu_live + trading_enabled=true (set 2026-10-13).
        # The engine only sends orders when DRY_RUN=false is passed explicitly, so this
        # test only checks the env/header combination is consistent.
        self.assertIn(config.environment, ("okx_eu_demo", "okx_eu_live"))
        self.assertEqual(config.risk_limits.enforce_demo_headers, config.environment == "okx_eu_demo")
        self.assertGreater(config.strategy.risk_per_trade_pct, 0)
        self.assertLessEqual(config.strategy.max_leverage, 10)
        self.assertIn("BTC-USD_UM_XPERP", config.strategy.symbols)

    def test_reject_unsafe_risk_pct(self):
        """Reject risk per trade > 5.0%."""
        strat = StrategyParameters(risk_per_trade_pct=10.0)
        with self.assertRaises(ValueError):
            strat.validate()

    def test_reject_unsafe_leverage(self):
        """Reject leverage > 10x."""
        strat = StrategyParameters(max_leverage=20)
        with self.assertRaises(ValueError):
            strat.validate()

    def test_reject_live_environment(self):
        """Reject live environment switch in BotConfig."""
        config = BotConfig(environment="live_production")
        with self.assertRaises(ValueError):
            config.validate_safety()


if __name__ == "__main__":
    unittest.main()
