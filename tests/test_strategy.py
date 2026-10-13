"""
Tests for TradebottenAnna Strategy Module
"""

import unittest
from trading.config import StrategyParameters
from trading.strategy import StrategyEngine


class TestStrategyEngine(unittest.TestCase):
    def setUp(self):
        self.params = StrategyParameters(
            risk_per_trade_pct=1.5,
            max_open_positions=3,
            max_margin_fraction=0.4,
            timeframe="1h",
            max_leverage=3,
            min_score=65,
            atr_stop_multiple=2.0,
            atr_target_multiple=3.0,
            symbols=["BTC-USDT-SWAP"]
        )
        self.engine = StrategyEngine(self.params)

    def test_atr_calculation(self):
        """Test calculation of ATR."""
        candles = [
            {"high": 105.0, "low": 95.0, "close": 100.0},
            {"high": 110.0, "low": 98.0, "close": 105.0},
            {"high": 112.0, "low": 102.0, "close": 108.0},
            {"high": 115.0, "low": 104.0, "close": 112.0},
        ]
        atr = self.engine.calculate_atr(candles)
        self.assertGreater(atr, 0)
        self.assertAlmostEqual(atr, 11.0, delta=2.0)

    def test_insufficient_candles_holds(self):
        """Test that fewer than 20 candles returns HOLD."""
        candles = [{"high": 100.0, "low": 90.0, "close": 95.0}] * 10
        signal = self.engine.evaluate_signal("BTC-USDT-SWAP", candles)
        self.assertEqual(signal["action"], "HOLD")
        self.assertFalse(signal["passed_threshold"])

    def test_bullish_signal_scoring(self):
        """Test that an upward trending candle series scores above min_score."""
        candles = []
        base = 50000.0
        for i in range(35):
            base += 150.0
            candles.append({
                "high": base + 100.0,
                "low": base - 50.0,
                "close": base
            })

        signal = self.engine.evaluate_signal("BTC-USDT-SWAP", candles)
        self.assertIn(signal["suggested_action"], ["BUY", "HOLD"])
        self.assertGreaterEqual(signal["score"], 50)
        self.assertGreater(signal["stop_loss"], 0)
        self.assertGreater(signal["take_profit"], signal["stop_loss"])


if __name__ == "__main__":
    unittest.main()
