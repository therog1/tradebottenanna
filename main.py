"""
TradebottenAnna — Python Trading Bot Engine
Controlled single-cycle / demo runner.
Never executes unauthorized trades. Reads strategy.json as single source of truth.
"""

import sys
import json
import logging
from typing import Dict, Any, List
from trading.config import load_strategy_config, BotConfig
from trading.risk import RiskManager
from trading.strategy import StrategyEngine
from trading.okx_client import OKXDemoClient

# Configure clean logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [TradebottenAnna] %(message)s"
)
logger = logging.getLogger("TradebottenAnna")


def run_bot_cycle(config: BotConfig, mock_market_data: bool = True) -> Dict[str, Any]:
    """Execute a single controlled evaluation cycle."""
    logger.info("Initializing TradebottenAnna cycle...")
    logger.info(f"Product: {config.product} | Version: {config.version} | Environment: {config.environment}")
    logger.info(f"Trading Enabled: {config.trading_enabled} | Kill Switch: {config.risk_limits.kill_switch_active}")

    risk_manager = RiskManager(config)
    strategy_engine = StrategyEngine(config.strategy)
    client = OKXDemoClient(
        trading_enabled=config.trading_enabled,
        enforce_demo=config.risk_limits.enforce_demo_headers
    )

    trade_status = risk_manager.is_trading_allowed()
    logger.info(f"Trading Authorization Status: {trade_status['reason']}")

    # Check account equity
    balance_resp = client.get_account_balance()
    account_equity = 10000.0  # Default demo benchmark
    if "data" in balance_resp and balance_resp["data"]:
        account_equity = float(balance_resp["data"][0].get("totalEq", "10000.0"))

    logger.info(f"Demo Account Equity: ${account_equity:,.2f} USDT")

    results: List[Dict[str, Any]] = []

    # Mock candle generator for deterministic demo testing if live market is not queried
    # Realistic test candles with slight upward trend for BTC, range for ETH, pullback for SOL
    sample_candles = {
        "BTC-USDT-SWAP": [
            {"high": 64000 + i*50, "low": 63800 + i*50, "close": 63900 + i*55}
            for i in range(30)
        ],
        "ETH-USDT-SWAP": [
            {"high": 3400 + (i%5)*10, "low": 3380 + (i%5)*10, "close": 3390 + (i%5)*10}
            for i in range(30)
        ],
        "SOL-USDT-SWAP": [
            {"high": 150 - i*0.5, "low": 148 - i*0.5, "close": 149 - i*0.5}
            for i in range(30)
        ]
    }

    for symbol in config.strategy.symbols:
        candles = sample_candles.get(symbol, sample_candles["BTC-USDT-SWAP"])
        signal = strategy_engine.evaluate_signal(symbol, candles)
        logger.info(f"Evaluated {symbol}: Action={signal['action']} | Score={signal['score']}/{config.strategy.min_score} | Reason={signal['reason']}")

        sizing = {"valid": False, "reason": "No actionable signal"}
        order_execution = None

        if signal["passed_threshold"] and signal["action"] in ["BUY", "SELL"]:
            sizing = risk_manager.calculate_position_size(
                account_equity=account_equity,
                entry_price=signal["current_price"],
                stop_loss_price=signal["stop_loss"],
                current_used_margin=0.0,
                current_open_positions=len(results)
            )

            if sizing["valid"]:
                logger.info(
                    f"Position Sizing for {symbol}: Units={sizing['units']} | "
                    f"Notional=${sizing['notional_usd']} | Risk=${sizing['dollar_risk']} ({sizing['risk_pct_of_equity']}%)"
                )

                if config.trading_enabled and not config.risk_limits.kill_switch_active:
                    order_execution = client.place_demo_order(
                        symbol=symbol,
                        side=signal["action"].lower(),
                        order_type="market",
                        size=sizing["units"]
                    )
                    logger.info(f"Demo Order Placed for {symbol}: {order_execution}")
                else:
                    order_execution = {
                        "simulated": True,
                        "status": "DRY_RUN_ONLY",
                        "message": "Trading disabled in strategy.json. Order calculated but not submitted."
                    }

        results.append({
            "symbol": symbol,
            "signal": signal,
            "sizing": sizing,
            "order": order_execution
        })

    summary = {
        "status": "success",
        "product": config.product,
        "trading_enabled": config.trading_enabled,
        "kill_switch_active": config.risk_limits.kill_switch_active,
        "account_equity": account_equity,
        "symbols_scanned": len(config.strategy.symbols),
        "results": results
    }

    return summary


def main():
    try:
        config = load_strategy_config()
        summary = run_bot_cycle(config)
        print("\n=== TradebottenAnna Execution Summary ===")
        print(json.dumps(summary, indent=2))
        return 0
    except Exception as e:
        logger.error(f"Fatal execution error: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
