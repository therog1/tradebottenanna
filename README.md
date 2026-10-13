# TradebottenAnna Control Panel — GitHub Pages + OKX EU DEMO

This repository includes a static visual strategy panel at `docs/index.html`, suitable for GitHub Pages. It provides sliders for strategy parameters, saves settings in the current browser, exports `strategy.json`, and offers optional Gemini advice with a key entered by the user at runtime.

## Publish on GitHub Pages
1. Copy/commit the `docs/` folder to the root of the repository.
2. Open **Settings → Pages** on GitHub.
3. Select **Deploy from a branch**, choose your default branch and folder **`/docs`**, then save.
4. Open the URL shown by GitHub Pages after deployment.

No terminal, Python install, or server is required for the Pages dashboard.

## How to use
- Adjust the sliders and choose markets.
- Optionally enter your own Gemini API key and request a proposal. Review the returned values before clicking **Använd förslaget**.
- Click **Ladda ner strategy.json** and commit that file to the repository root if you want to update the bot configuration.
- Run the demo trading workflow manually in GitHub Actions.

## Important limitations
- This static page does not connect to OKX, start GitHub Actions, or submit orders.
- It cannot automatically commit settings to GitHub; it exports a JSON file for you to commit.
- The markets selection is exported, but the Python trader must be explicitly coded to read the `symbols` field before that selection affects trading.
- Gemini calls are made directly from the user's browser using a key entered at runtime. The key is not embedded in the page or stored by the app, but is available to that browser session/devtools and usage may cost money. Never enter OKX credentials here. For a shared/public interface, move Gemini calls to an authenticated backend.
- The strategy is not proven profitable. Verify the Python trading logic and demo execution separately.


## Gemini backend and secure setup
See [`cloudflare-worker/README.md`](cloudflare-worker/README.md) for the Cloudflare Worker source, Secret setup, Access protection, and GitHub Pages integration steps.
