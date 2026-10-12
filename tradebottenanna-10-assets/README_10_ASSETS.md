# ApexFlash — 10 asset paper build

## What changed
- Watchlist expanded from 5 to 10: BTC, ETH, SOL, AVAX, SUI, XRP, DOGE, LINK, ADA, LTC.
- Each exact CCXT symbol is checked against the loaded OKX EU market list.
- If a symbol is unavailable or inactive, the bot logs a safe skip instead of guessing another instrument.
- Paper-only mode remains in force. This build does not call order-placement or order-cancellation methods.
- Existing risk tests and workflows are retained.

## Install
Unzip this archive. Upload/replace the contents of the extracted repository folder into the existing `therog1/tradebottenanna` repository, preserving the `.github/workflows/` directory structure. Commit to the same branch as before.

Do not delete existing GitHub Secrets. The paper workflow needs `GEMINI_API_KEY`; OKX private keys are not needed by this paper build.

## Run
GitHub → Actions → ApexFlash OKX Paper Test → Run workflow.
Review the logs for each symbol. Any symbol not present/active on OKX EU is safely skipped and shown as an error/hold row.

## Safety
This is not a live trading build and does not execute demo orders. Do not enable live trading. The separate authenticated read-only demo test remains separate.
