TradebottenAnna OKX EU Paper Test

This ZIP contains the paper-test workflow plus the matching main.py, requirements.txt and risk tests.
It is a paper-analysis build only: it reads public OKX market data and calls Gemini; it does not submit orders.

To install into the repository, upload/replace main.py and requirements.txt in the repository root, upload the tests folder, and upload .github/workflows/tradebottenanna_okx_paper_test.yml under .github/workflows/. Keep GEMINI_API_KEY in GitHub Actions Secrets.
Then open Actions and run "TradebottenAnna OKX EU Paper Test" manually.
