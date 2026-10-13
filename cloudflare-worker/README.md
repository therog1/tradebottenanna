# TradebottenAnna – Gemini backend setup

## What changed
- The GitHub Pages panel no longer accepts or sends a Gemini API key from the browser.
- The panel calls `https://tradebottenanna.rogedv.workers.dev/api/advice`.
- `cloudflare-worker/index.js` is the Cloudflare Worker API source.
- The API returns suggested strategy settings only. It has no OKX integration and cannot submit orders.
- All visible product branding in the panel is TradebottenAnna.

## Required deployment steps

### 1. Set the Gemini key as a Cloudflare Secret
In Cloudflare Dashboard → Workers & Pages → `tradebottenanna` → Settings → Runtime variables and secrets:
- Add/replace a **Secret** named `GEMINI_API_KEY`.
- Never use a plain-text Variable for this key.
- Rotate the key if it was previously exposed in a screenshot or browser field.

### 2. Deploy the Worker code
Open `tradebottenanna` → Edit code. Replace `worker.js` with the contents of `cloudflare-worker/index.js` (the dashboard may name the file `worker.js`). Deploy.

### 3. Protect the Worker hostname with Cloudflare Access
Create a Self-hosted Access application for:
`tradebottenanna.rogedv.workers.dev`

Add an Allow policy that includes only the Google account you intend to use. Do not add an Everyone or Bypass policy. Keep the existing Access application for the panel.

### 4. Publish the updated panel
Commit the updated `docs/index.html` to the repository's `docs/` folder and let GitHub Pages deploy it. The Worker CORS allowlist currently expects the Pages origin:
`https://therog1.github.io`

If your actual published page uses a different origin, change `ALLOWED_ORIGINS` in the Worker source to the exact origin (scheme + hostname only, no path), then redeploy.

### 5. Use the panel
Open the published panel and sign in to Cloudflare Access if prompted. Click “Be Gemini om råd”. Review the proposal and explicitly click “Använd förslaget” before any slider values are changed. Export `strategy.json` and commit it if you want the bot workflow to use those values.

## Security notes
- The API key is never sent to the browser by this code.
- CORS is not authentication. Cloudflare Access must protect the Worker hostname.
- The Access login cookie and browser third-party-cookie policy can affect cross-origin calls from GitHub Pages. If the API request is blocked after login, use a same-site custom domain or a server-side integration rather than exposing a static bearer token.
- Do not store OKX keys in this UI or in the Gemini Worker.
- This does not guarantee strategy profitability. Keep the bot in demo mode and review all suggestions.
