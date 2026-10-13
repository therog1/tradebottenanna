"""
TradebottenAnna Risk Management Engine
Calculates position sizes, validates portfolio risk constraints, and enforces demo risk limits.
"""

from typing import Dict, Any, Optional
from trading.config import BotConfig, StrategyParameters


class RiskManager:
    def __init__(self, config: BotConfig):
        self.config = config
        self.strategy: StrategyParameters = config.strategy

    def is_trading_allowed(self) -> Dict[str, Any]:
        """Verify whether trading is allowed based on kill switch and configuration."""
        if self.config.risk_limits.kill_switch_active:
            return {
                "allowed": False,
                "reason": "Emergency Kill Switch is ACTIVE in TradebottenAnna."
            }

        if not self.config.trading_enabled:
            return {
                "allowed": False,
                "reason": "Trading is disabled by default in strategy.json (Paper/Dry-Run mode)."
            }

        return {"allowed": True, "reason": "Trading authorized under demo safety guidelines."}

    def check_portfolio_capacity(self, current_open_positions: int, current_used_margin: float, account_equity: float) -> Dict[str, Any]:
        """Check if new positions are permitted given current positions and margin."""
        if current_open_positions >= self.strategy.max_open_positions:
            return {
                "allowed": False,
                "reason": f"Maximum open positions reached ({current_open_positions}/{self.strategy.max_open_positions})."
            }

        if account_equity <= 0:
            return {
                "allowed": False,
                "reason": "Account equity must be positive."
            }

        margin_fraction = current_used_margin / account_equity
        if margin_fraction >= self.strategy.max_margin_fraction:
            return {
                "allowed": False,
                "reason": f"Current margin fraction ({margin_fraction:.1%}) exceeds maximum limit ({self.strategy.max_margin_fraction:.1%})."
            }

        return {"allowed": True, "margin_headroom": (self.strategy.max_margin_fraction * account_equity) - current_used_margin}

    def calculate_position_size(
        self,
        account_equity: float,
        entry_price: float,
        stop_loss_price: float,
        current_used_margin: float = 0.0,
        current_open_positions: int = 0
    ) -> Dict[str, Any]:
        """
        Calculate safe contract/unit position size based on risk_per_trade_pct and ATR stop loss.
        Guarantees that maximum risk does not exceed risk_per_trade_pct of account equity,
        and that required margin respects max_margin_fraction and max_leverage.
        """
        capacity = self.check_portfolio_capacity(current_open_positions, current_used_margin, account_equity)
        if not capacity["allowed"]:
            return {
                "valid": False,
                "size": 0.0,
                "notional": 0.0,
                "margin_required": 0.0,
                "reason": capacity["reason"]
            }

        if entry_price <= 0 or stop_loss_price <= 0:
            return {"valid": False, "size": 0.0, "notional": 0.0, "margin_required": 0.0, "reason": "Prices must be positive"}

        price_risk_per_unit = abs(entry_price - stop_loss_price)
        if price_risk_per_unit == 0:
            return {"valid": False, "size": 0.0, "notional": 0.0, "margin_required": 0.0, "reason": "Stop loss equals entry price"}

        # Capital at risk in USD/quote currency
        allowed_dollar_risk = account_equity * (self.strategy.risk_per_trade_pct / 100.0)

        # Theoretical unit size from stop distance
        raw_units = allowed_dollar_risk / price_risk_per_unit
        raw_notional = raw_units * entry_price

        # Check leverage limits
        effective_leverage = min(self.strategy.max_leverage, 10)
        required_margin = raw_notional / effective_leverage

        # Check margin headroom
        remaining_margin_headroom = capacity["margin_headroom"]
        if required_margin > remaining_margin_headroom:
            # Scale down to available margin headroom
            required_margin = remaining_margin_headroom
            raw_notional = required_margin * effective_leverage
            raw_units = raw_notional / entry_price

        # Final sanity check: notional cannot exceed equity * max_leverage
        max_notional_cap = account_equity * effective_leverage
        if raw_notional > max_notional_cap:
            raw_notional = max_notional_cap
            raw_units = raw_notional / entry_price
            required_margin = raw_notional / effective_leverage

        actual_risk_pct = ((raw_units * price_risk_per_unit) / account_equity) * 100.0

        return {
            "valid": True,
            "units": round(raw_units, 4),
            "notional_usd": round(raw_notional, 2),
            "required_margin_usd": round(required_margin, 2),
            "dollar_risk": round(raw_units * price_risk_per_unit, 2),
            "risk_pct_of_equity": round(actual_risk_pct, 2),
            "leverage_used": effective_leverage,
            "reason": "OK"
        }
