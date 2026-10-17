"""
TradebottenAnna Strategy Engine
Calculates technical signals, evaluates quality score against min_score,
and derives ATR-based dynamic stops and targets.
"""

from typing import List, Dict, Any, Optional
from trading.config import StrategyParameters


class StrategyEngine:
    def __init__(self, params: StrategyParameters):
        self.params = params

    def calculate_atr(self, candles: List[Dict[str, float]]) -> float:
        """
        Calculate Average True Range from candle list.
        Candle format: {'high': float, 'low': float, 'close': float}
        """
        if len(candles) < 2:
            return 1.0

        true_ranges = []
        for i in range(1, len(candles)):
            high = candles[i]["high"]
            low = candles[i]["low"]
            prev_close = candles[i-1]["close"]
            tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
            true_ranges.append(tr)

        period = min(14, len(true_ranges))
        return sum(true_ranges[-period:]) / period

    @staticmethod
    def _ema(values: List[float], period: int) -> float:
        if len(values) < period:
            return sum(values) / len(values)
        ema = sum(values[:period]) / period
        k = 2.0 / (period + 1)
        for v in values[period:]:
            ema = v * k + ema * (1 - k)
        return ema

    def calculate_indicators(self, closes: List[float]) -> Dict[str, float]:
        """Calculate basic EMAs and RSI without third-party heavy dependencies."""
        if not closes or len(closes) < 14:
            return {"ema_fast": 0.0, "ema_slow": 0.0, "rsi": 50.0}

        # EMA fast (9) and slow (21): seed med SMA av de första N, sedan EMA över hela serien.
        # (Tidigare seedades med SENASTE stängningen och itererades bara över sista N staplarna,
        # vilket drog båda EMA:erna mot nuvarande pris och gjorde korsningen opålitlig.)
        ema_9 = self._ema(closes, 9)
        ema_21 = self._ema(closes, 21)

        # 14-period RSI
        gains = []
        losses = []
        for i in range(len(closes) - 14, len(closes)):
            diff = closes[i] - closes[i-1]
            if diff >= 0:
                gains.append(diff)
                losses.append(0.0)
            else:
                gains.append(0.0)
                losses.append(abs(diff))

        avg_gain = sum(gains) / 14 if gains else 0.0
        avg_loss = sum(losses) / 14 if losses else 0.0001
        rs = avg_gain / (avg_loss if avg_loss > 0 else 0.0001)
        rsi = 100.0 - (100.0 / (1.0 + rs))

        return {
            "ema_fast": round(ema_9, 4),
            "ema_slow": round(ema_21, 4),
            "rsi": round(rsi, 2)
        }

    def evaluate_signal(self, symbol: str, candles: List[Dict[str, float]]) -> Dict[str, Any]:
        """
        Evaluate candle data and generate signal with score.
        Must meet self.params.min_score to trigger.
        """
        if len(candles) < 20:
            return {
                "symbol": symbol,
                "action": "HOLD",
                "score": 0,
                "passed_threshold": False,
                "reason": "Insufficient candle history (<20)"
            }

        closes = [c["close"] for c in candles]
        current_price = closes[-1]
        indicators = self.calculate_indicators(closes)
        atr = self.calculate_atr(candles)

        ema_fast = indicators["ema_fast"]
        ema_slow = indicators["ema_slow"]
        rsi = indicators["rsi"]

        score = 50
        action = "HOLD"
        direction = 0

        # Trend alignment (Fast > Slow = Bullish, Fast < Slow = Bearish)
        if ema_fast > ema_slow and current_price >= ema_fast:
            score += 20
            direction = 1
        elif ema_fast < ema_slow and current_price <= ema_fast:
            score += 20
            direction = -1

        # RSI conditions
        if direction == 1:
            if 45 <= rsi <= 65:  # Healthy bullish momentum
                score += 15
            elif rsi > 75:  # Overbought penalty
                score -= 10
            action = "BUY"
        elif direction == -1:
            if 35 <= rsi <= 55:  # Healthy bearish momentum
                score += 15
            elif rsi < 25:  # Oversold penalty
                score -= 10
            action = "SELL"

        # Volatility check
        if atr / current_price > 0.002:
            score += 5

        score = max(0, min(100, score))
        passed_threshold = score >= self.params.min_score

        # Calculate stops & targets via ATR multiples
        stop_distance = atr * self.params.atr_stop_multiple
        target_distance = atr * self.params.atr_target_multiple

        if action == "BUY":
            stop_loss = round(current_price - stop_distance, 4)
            take_profit = round(current_price + target_distance, 4)
        elif action == "SELL":
            stop_loss = round(current_price + stop_distance, 4)
            take_profit = round(current_price - target_distance, 4)
        else:
            stop_loss = current_price
            take_profit = current_price

        return {
            "symbol": symbol,
            "action": action if passed_threshold else "HOLD",
            "suggested_action": action,
            "score": score,
            "min_score": self.params.min_score,
            "passed_threshold": passed_threshold,
            "current_price": current_price,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "atr": round(atr, 4),
            "indicators": indicators,
            "reason": f"Signal score {score}/100 {'meets' if passed_threshold else 'below'} threshold of {self.params.min_score}"
        }
