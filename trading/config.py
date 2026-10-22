"""
TradebottenAnna Strategy Configuration Schema & Loader
Maintains single authoritative schema consistent across UI, JSON, and Python bot.
"""

import json
import os
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class StrategyParameters:
    risk_per_trade_pct: float = 1.5
    max_open_positions: int = 3
    max_margin_fraction: float = 0.4
    timeframe: str = "1h"
    max_leverage: int = 3
    min_leverage: int = 3
    short_only: bool = True  # Roger 2026-10-22: bara short-entries
    min_score: int = 65
    atr_stop_multiple: float = 2.0
    atr_target_multiple: float = 3.0
    symbols: List[str] = field(default_factory=lambda: ["BTC-USDT-SWAP", "ETH-USDT-SWAP", "SOL-USDT-SWAP"])

    def validate(self):
        errors = []
        if not (0.1 <= self.risk_per_trade_pct <= 5.0):
            errors.append(f"risk_per_trade_pct ({self.risk_per_trade_pct}) must be between 0.1 and 5.0%")
        if not (1 <= self.max_open_positions <= 10):
            errors.append(f"max_open_positions ({self.max_open_positions}) must be between 1 and 10")
        if not (0.05 <= self.max_margin_fraction <= 0.8):
            errors.append(f"max_margin_fraction ({self.max_margin_fraction}) must be between 0.05 and 0.80")
        if self.timeframe not in ["15m", "30m", "1h", "2h", "4h", "1d"]:
            errors.append(f"timeframe ({self.timeframe}) is not supported")
        if not (1 <= self.max_leverage <= 10):
            errors.append(f"max_leverage ({self.max_leverage}) must be between 1 and 10 (conservative demo cap)")
        if not (1 <= self.min_leverage <= self.max_leverage):
            errors.append(f"min_leverage ({self.min_leverage}) must be between 1 and max_leverage")
        if not (50 <= self.min_score <= 95):
            errors.append(f"min_score ({self.min_score}) must be between 50 and 95")
        if not (0.5 <= self.atr_stop_multiple <= 5.0):
            errors.append(f"atr_stop_multiple ({self.atr_stop_multiple}) must be between 0.5 and 5.0")
        if not (1.0 <= self.atr_target_multiple <= 10.0):
            errors.append(f"atr_target_multiple ({self.atr_target_multiple}) must be between 1.0 and 10.0")
        if not self.symbols or not isinstance(self.symbols, list):
            errors.append("symbols must be a non-empty list of instruments")
        if errors:
            raise ValueError("Strategy parameter validation errors:\n" + "\n".join(errors))


@dataclass
class RiskLimits:
    max_drawdown_stop_pct: float = 5.0
    kill_switch_active: bool = False
    enforce_demo_headers: bool = True


@dataclass
class BotConfig:
    product: str = "TradebottenAnna"
    version: str = "1.2.0"
    environment: str = "okx_eu_demo"
    trading_enabled: bool = False
    strategy: StrategyParameters = field(default_factory=StrategyParameters)
    risk_limits: RiskLimits = field(default_factory=RiskLimits)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def validate_safety(self):
        """Environment/header consistency checks.

        - okx_eu_demo  -> x-simulated-trading header must be enforced.
        - okx_eu_live  -> demo header must be off (EEA live gateway).
        Anything else is rejected. Whether orders are actually sent is decided
        separately (trading_enabled, kill switch, dry-run flag in main.py).
        """
        if self.environment == "okx_eu_demo":
            if not self.risk_limits.enforce_demo_headers:
                raise ValueError("Security Alert: enforce_demo_headers must remain True for okx_eu_demo.")
        elif self.environment == "okx_eu_live":
            if self.risk_limits.enforce_demo_headers:
                raise ValueError("Config conflict: okx_eu_live with enforce_demo_headers=True.")
        else:
            raise ValueError(f"Security Alert: unknown environment '{self.environment}'.")
        self.strategy.validate()


def load_strategy_config(file_path: Optional[str] = None) -> BotConfig:
    """Load and validate strategy config from strategy.json."""
    if not file_path:
        # Default to root strategy.json
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        file_path = os.path.join(base_dir, "strategy.json")

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Strategy file not found at: {file_path}")

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    strat_data = data.get("strategy", {})
    strategy = StrategyParameters(
        risk_per_trade_pct=float(strat_data.get("risk_per_trade_pct", 1.5)),
        max_open_positions=int(strat_data.get("max_open_positions", 3)),
        max_margin_fraction=float(strat_data.get("max_margin_fraction", 0.4)),
        timeframe=str(strat_data.get("timeframe", "1h")),
        max_leverage=int(strat_data.get("max_leverage", 3)),
        min_leverage=int(strat_data.get("min_leverage", 3)),
        short_only=bool(strat_data.get("short_only", True)),
        min_score=int(strat_data.get("min_score", 65)),
        atr_stop_multiple=float(strat_data.get("atr_stop_multiple", 2.0)),
        atr_target_multiple=float(strat_data.get("atr_target_multiple", 3.0)),
        symbols=list(strat_data.get("symbols", ["BTC-USDT-SWAP", "ETH-USDT-SWAP", "SOL-USDT-SWAP"])),
    )

    risk_data = data.get("risk_limits", {})
    risk_limits = RiskLimits(
        max_drawdown_stop_pct=float(risk_data.get("max_drawdown_stop_pct", 5.0)),
        kill_switch_active=bool(risk_data.get("kill_switch_active", False)),
        enforce_demo_headers=bool(risk_data.get("enforce_demo_headers", True)),
    )

    config = BotConfig(
        product=str(data.get("product", "TradebottenAnna")),
        version=str(data.get("version", "1.2.0")),
        environment=str(data.get("environment", "okx_eu_demo")),
        trading_enabled=bool(data.get("trading_enabled", False)),
        strategy=strategy,
        risk_limits=risk_limits,
        metadata=data.get("metadata", {}),
    )

    config.validate_safety()
    return config
