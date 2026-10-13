"""
Tests for TradebottenAnna Risk Management Module
"""

import unittest
from trading.config import BotConfig, StrategyParameters, RiskLimits
from trading.risk import RiskManager


class TestRiskManager(unittest.TestCase):
    def setUp(self):
        self.strategy = StrategyParameters(
            risk_per_trade_pct=1.5,
            max_open_positions=3,
            max_margin_fraction=0.4,
            timeframe="1h",
            max_leverage=3,
            min_score=65,
            atr_stop_multiple=2.0,
            atr_target_multiple=3.0,
            symbols=["BTC-USDT-SWAP", "ETH-USDT-SWAP"]
        )
        self.config = BotConfig(
            product="TradebottenAnna",
            version="1.2.0",
            environment="okx_eu_demo",
            trading_enabled=False,
            strategy=self.strategy,
            risk_limits=RiskLimits(
                max_drawdown_stop_pct=5.0,
                kill_switch_active=False,
                enforce_demo_headers=True
            )
        )
        self.risk_manager = RiskManager(self.config)

    def test_trading_disabled_by_default(self):
        """Ensure trading is disallowed by default."""
        status = self.risk_manager.is_trading_allowed()
        self.assertFalse(status["allowed"])
        self.assertIn("disabled by default", status["reason"])

    def test_kill_switch_blocks_trading(self):
        """Ensure kill switch blocks trading even if trading_enabled is True."""
        self.config.trading_enabled = True
        self.config.risk_limits.kill_switch_active = True
        status = self.risk_manager.is_trading_allowed()
        self.assertFalse(status["allowed"])
        self.assertIn("Kill Switch", status["reason"])

    def test_portfolio_capacity_limits(self):
        """Check max open positions enforcement."""
        capacity = self.risk_manager.check_portfolio_capacity(
            current_open_positions=3,
            current_used_margin=100.0,
            account_equity=10000.0
        )
        self.assertFalse(capacity["allowed"])
        self.assertIn("Maximum open positions reached", capacity["reason"])

    def test_max_margin_fraction_enforcement(self):
        """Check margin fraction cap (0.4 * 10000 = 4000)."""
        capacity = self.risk_manager.check_portfolio_capacity(
            current_open_positions=1,
            current_used_margin=4200.0,
            account_equity=10000.0
        )
        self.assertFalse(capacity["allowed"])
        self.assertIn("exceeds maximum limit", capacity["reason"])

    def test_position_sizing_calculation(self):
        """Test position sizing math against 1.5% risk ($150 on $10,000)."""
        # Entry at $60,000, Stop Loss at $58,500 ($1,500 risk per unit)
        # 150 / 1500 = 0.1 units -> Notional = $6,000
        # Required margin at 3x = $2,000 (well within 40% margin limit)
        sizing = self.risk_manager.calculate_position_size(
            account_equity=10000.0,
            entry_price=60000.0,
            stop_loss_price=58500.0,
            current_used_margin=0.0,
            current_open_positions=0
        )
        self.assertTrue(sizing["valid"])
        self.assertEqual(sizing["units"], 0.1)
        self.assertEqual(sizing["notional_usd"], 6000.0)
        self.assertEqual(sizing["dollar_risk"], 150.0)
        self.assertEqual(sizing["risk_pct_of_equity"], 1.5)


if __name__ == "__main__":
    unittest.main()
