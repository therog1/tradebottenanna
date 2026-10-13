# ApexFlash — Rule-based OKX EU demo trader (No AI)

This version makes **zero AI/API model calls**. Python calculates EMA(9/21/50), RSI(14), ATR(14), and a 5-point trend/momentum/volume score for the 10-symbol watchlist. Signals require `MIN_SCORE` (default 4/5).

## Only workflow retained
- `.github/workflows/trading_bot.yml` — the single manual demo-trading workflow.
- No scheduled workflows, Gemini workflows, market diagnostics, or read-only diagnostic workflows are included.

## Safety and execution
- Uses the OKX EEA endpoint `eea.okx.com` and `x-simulated-trading: 1` for authenticated demo requests.
- `DEMO_TRADING_ENABLED=false` by default. The GitHub manual trading workflow enables it explicitly.
- 0.25% equity risk per trade by default; capped exposure, maximum two open positions, no duplicate position per symbol.
- Entries use market orders with attached exchange TP/SL. Verify their status in the OKX EU demo interface.
- Manual `workflow_dispatch` only. No schedule and no live trading path.
- All symbols are screened before any orders are submitted. A market-data error aborts the run before the order phase. Any order-phase error stops later order submissions.

## Install / GitHub
Keep `OKX_API_KEY`, `OKX_API_SECRET`, and `OKX_API_PASSPHRASE` in GitHub Actions Secrets. Do not add credentials to files. Upload the package contents to the repository root, replacing `main.py`, `requirements.txt`, `.env.example`, `README.md`, and `.github/workflows/trading_bot.yml`.

Run: Actions → **ApexFlash OKX EU DEMO — No AI** → Run workflow. Start with demo funds and inspect the resulting log and positions.

## Strategy is not proven profitable
The rules are a transparent baseline, not a validated edge. Backtest with fees, funding, slippage and realistic execution before relying on results.
