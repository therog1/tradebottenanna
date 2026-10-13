# TradebottenAnna — System Architecture

## Overview
TradebottenAnna is a two-tier crypto quantitative trading and parameter governance system:
1. **Tier 1: Cloudflare Edge Web Control Panel & Adviser API**
   - Single Cloudflare Worker serving the React control panel via Workers Static Assets (`assets: { directory: "./dist" }`).
   - Server-side API endpoints (`/api/status`, `/api/strategy`, `/api/gemini-advice`).
   - Cloudflare Access Zero Trust authentication gatekeeper protecting all web access for Roger (`rogedv@icloud.com`).
   - Server-side Gemini AI adviser integration reading `GEMINI_API_KEY` exclusively from Cloudflare secret storage.
2. **Tier 2: Python Trading Engine & OKX EU Demo Client**
   - Independent Python runtime engine (`trading/`, `main.py`, `app.py`).
   - Consumes the single authoritative `strategy.json` configuration file.
   - Strictly bound to the OKX EU Demo environment with mandatory `x-simulated-trading: 1` header.
   - Global kill switch and hard safety caps preventing live order routing.
   - Triggerable via CLI, local runner, or manual GitHub Actions workflow (`workflow_dispatch`).

---

## Authoritative Strategy Schema
A single authoritative JSON schema defines all parameter names across the UI, JSON configuration, Python bot, and API:

| Parameter | Type | Valid Range | Description |
|-----------|------|-------------|-------------|
| `risk_per_trade_pct` | Float | 0.1% – 5.0% | Max account equity risked on a single trade |
| `max_open_positions` | Integer | 1 – 10 | Max simultaneous open positions |
| `max_margin_fraction` | Float | 0.05 – 0.80 | Max fraction of equity locked as margin |
| `timeframe` | String | 15m, 30m, 1h, 4h, 1d | Candle bar period for analysis |
| `max_leverage` | Integer | 1x – 10x | Conservative leverage limit for demo trades |
| `min_score` | Integer | 50 – 95 | Minimum technical signal score required to act |
| `atr_stop_multiple` | Float | 0.5 – 5.0 | ATR multiplier for stop loss placement |
| `atr_target_multiple` | Float | 1.0 – 10.0 | ATR multiplier for take profit target |
| `symbols` | Array[str] | List of pairs | Allowed OKX swap contracts (e.g., BTC-USDT-SWAP) |

---

## Data Flow & Parameter Governance
1. **Operator Review:** The user inspects current parameters in the TradebottenAnna web control panel.
2. **Gemini Consultation (Optional):** The operator requests advice for specific market volatility conditions. Gemini proposes parameter adjustments with detailed rationale and risk warnings.
3. **Explicit User Approval:** Gemini NEVER modifies parameters or executes trades automatically. The operator reviews diffs and accepts or rejects suggestions.
4. **Configuration Persistence:** The operator saves the verified configuration to `strategy.json`.
5. **Bot Execution:** The Python bot reads `strategy.json`, computes position sizing, verifies risk limits, and executes simulated paper trades if demo trading is enabled.
