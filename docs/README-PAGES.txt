TradebottenAnna Control Panel (GitHub Pages)

The static dashboard is in docs/index.html. Publish the docs/ folder using GitHub Pages.

Gemini advice now uses a separate Cloudflare Worker backend. Do not put the Gemini API key in the page. Follow cloudflare-worker/README.md to deploy the backend, add GEMINI_API_KEY as a Cloudflare Secret, and protect tradebottenanna.rogedv.workers.dev with Cloudflare Access.

The dashboard does not connect to OKX, start GitHub Actions, or submit orders. It exports strategy.json for a human to commit. Gemini suggestions require human approval.
