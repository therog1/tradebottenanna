# ApexFlash — OKX EU demo trading

This package adds order submission to the previous diagnostic bot. It is configured for **OKX EEA demo only**: `eea.okx.com` and `x-simulated-trading: 1`. It does not contain a live-trading fallback.

## GitHub Actions secrets
Keep these as repository Actions secrets; never paste them into code or chat:
- `OKX_API_KEY`
- `OKX_API_SECRET`
- `OKX_API_PASSPHRASE`
- `GEMINI_API_KEY`

## Run
Open **Actions → ApexFlash OKX EU DEMO TRADING → Run workflow**. The workflow runs tests, then checks the 10 configured symbols. It may open a position only when Gemini returns LONG/SHORT, confidence passes the threshold, stop/target levels validate, there is no existing position for the symbol, and the global position cap is not reached. HOLD or any API/model error means no entry.

The order request attaches stop-loss and take-profit algo instructions to the entry. OKX/CCXT must accept the attached-algo parameters for the specific instrument/account configuration; inspect the action log and verify the resulting order and attached algo orders in the OKX demo interface. Do not assume an order succeeded just because the workflow started.

## Risk defaults
- risk sizing reference: 0.25% of available reported USDT equity
- max two open positions
- max notional cap: 10% of equity × 2 leverage per position
- minimum AI confidence: 72%
- strategy requires at least 5:1 reward/risk

This is experimental software, not a profit guarantee. The workflow is manual-dispatch only; it does not loop all night by itself. Test a single run and inspect exchange-side positions and attached stop/target orders before enabling any schedule.
