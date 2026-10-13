# TradebottenAnna

**Autonomous-Assisted Crypto Strategy Control Panel, Gemini Risk Adviser & OKX EU Demo Trading Engine**

Private Repository: `therog1/tradebottenanna`  
Production Cloudflare Worker API: `https://tradebottenanna.rogedv.workers.dev/`  
Authorized Access Identity: `rogedv@icloud.com` (Cloudflare Access Zero Trust)  
Environment: `OKX EU Demo Trading` (`x-simulated-trading: 1`)

---

## 1. System Overview

TradebottenAnna is a robust, security-first quantitative crypto trading control system built specifically for OKX EU Demo simulated trading:

- **Web Control Panel (Vite + React + Tailwind CSS):** A responsive, dark-themed operations dashboard providing real-time visibility into strategy parameters, risk metrics, kill switch controls, and configuration exports.
- **Cloudflare Worker Gateway (`cloudflare-worker/`):** Unified edge deployment that serves both the static web dashboard and API routes (`/api/status`, `/api/strategy`, `/api/gemini-advice`) on a single origin.
- **Server-Side Gemini AI Adviser:** Uses Google's modern `gemini-3.8-flash` model via `@google/genai` to analyze market conditions and propose bounded parameter refinements. Gemini acts strictly as an adviser and cannot execute or authorize trades autonomously.
- **Python Quantitative Trading Bot (`trading/`, `main.py`, `app.py`):** An independent execution engine that evaluates signals, computes position sizing via ATR and strict portfolio risk bounds, enforces the OKX simulated trading header (`x-simulated-trading: 1`), and halts immediately if the kill switch is tripped.
- **Zero Trust Security:** Google login protected via Cloudflare Access rules restricting access exclusively to Roger (`rogedv@icloud.com`). No API keys or exchange secrets are ever exposed in frontend assets or public source code.

---

## 2. Directory Structure

```
├── .env.example                       # Safe environment template with placeholders
├── .gitignore                          # Strict gitignore excluding all secrets and build artifacts
├── .github/
│   └── workflows/
│       └── demo_trading.yml            # Manual GitHub Actions workflow for controlled demo runs
├── cloudflare-worker/
│   ├── wrangler.jsonc                  # Cloudflare Worker configuration with Static Assets
│   └── src/
│       └── index.ts                    # Edge API handler, Gemini proxy & asset fallback
├── docs/
│   ├── architecture.md                 # Complete system design & strategy schema
│   ├── cloudflare-access-setup.md      # Zero Trust Google login setup guide
│   └── okx-eu-demo-setup.md            # OKX EU demo API key setup and validation
├── src/
│   ├── App.tsx                         # Dark-themed TradebottenAnna control panel
│   ├── main.tsx                        # React application bootstrap
│   ├── index.css                       # Global styles and typography
│   └── components/                     # Control panel UI components
├── tests/
│   ├── test_risk.py                    # Risk management and margin headroom tests
│   ├── test_strategy.py                # Signal evaluation and ATR multiple tests
│   ├── test_okx_client.py              # OKX Demo headers and signature math tests
│   └── test_strategy_schema.py         # strategy.json schema constraint tests
├── trading/
│   ├── __init__.py                     # Package metadata
│   ├── config.py                       # Authoritative schema loader and validation
│   ├── risk.py                         # Portfolio risk management and position sizing
│   ├── strategy.py                     # Technical indicator calculation & signal scoring
│   └── okx_client.py                   # OKX EU Demo client with simulated trading flag
├── app.py                              # Python service HTTP runner and health endpoint
├── main.py                             # Controlled single-cycle bot execution script
├── requirements.txt                    # Python dependencies
├── strategy.json                       # Authoritative strategy configuration file
├── server.ts                           # Full-stack dev server for AI Studio & local runs
├── package.json                        # Node dependencies and scripts
└── wrangler.jsonc                      # Root Wrangler deployment configuration
```

---

## 3. Deployment Checklist

### Step 1: Deploy Web Control Panel & Cloudflare Worker
1. Build the frontend assets:
   ```bash
   npm run build
   ```
2. Configure your Gemini API key secret in Cloudflare:
   ```bash
   npx wrangler secret put GEMINI_API_KEY
   ```
3. Deploy the unified worker (serves dashboard and edge API):
   ```bash
   npx wrangler deploy
   ```
4. Verify your endpoint:
   ```bash
   curl https://tradebottenanna.rogedv.workers.dev/api/status
   ```
   Expected response:
   ```json
   {
     "service": "TradebottenAnna API",
     "status": "online",
     "adviceEndpoint": "/api/gemini-advice",
     "tradingEnabled": false,
     "environment": "okx_eu_demo"
   }
   ```

### Step 2: Configure Cloudflare Access (Google Login)
Follow `docs/cloudflare-access-setup.md` to:
- Create a Self-Hosted Access application for `tradebottenanna.rogedv.workers.dev`.
- Add an Allow policy for email `rogedv@icloud.com` with Google IdP.
- Requests arriving at the control panel will carry the verified header `Cf-Access-Authenticated-User-Email`.

### Step 3: Run the Python Trading Bot (Local or GitHub Actions)
1. Install Python requirements:
   ```bash
   pip install -r requirements.txt
   ```
2. Run unit tests to verify risk and strategy logic:
   ```bash
   python -m unittest discover -s tests
   ```
3. Run a controlled dry-run cycle:
   ```bash
   python main.py
   ```
4. Or trigger manual dispatch via GitHub Actions:
   - Go to GitHub -> `Actions` -> `TradebottenAnna Demo Cycle` -> `Run workflow`.

---

## 4. Authoritative Strategy Parameters

All parameters are strictly validated:
- `risk_per_trade_pct`: Maximum risk per position (default 1.5%, max allowable 5.0%).
- `max_open_positions`: Portfolio position count limit (default 3, max 10).
- `max_margin_fraction`: Total margin allocation cap (default 0.4 / 40%).
- `timeframe`: Technical analysis window (`1h`, `4h`, `1d`).
- `max_leverage`: Leverage cap (default 3x, demo limit 10x).
- `min_score`: Technical indicator threshold to trigger action (default 65/100).
- `atr_stop_multiple`: Dynamic stop-loss distance multiplier (default 2.0x ATR).
- `atr_target_multiple`: Take-profit distance multiplier (default 3.0x ATR).
- `symbols`: Whitelisted instruments (`BTC-USDT-SWAP`, `ETH-USDT-SWAP`, `SOL-USDT-SWAP`).

---

## 5. Security & Safety Guarantees

1. **Simulated Trading Header Enforced:** Every call to OKX includes `x-simulated-trading: 1`. Live trading is strictly rejected by the codebase.
2. **Trading Disabled by Default:** `trading_enabled` is `false` until explicitly configured.
3. **Emergency Kill Switch:** A global kill switch can be activated from either `strategy.json` or the control panel to halt all operations.
4. **Zero Frontend Secret Exposure:** Neither `GEMINI_API_KEY` nor OKX credentials are ever included in client-side bundles or public endpoints.
