APEXFLASH GITHUB PAGES SETUP

1. Copy the docs folder into the root of your GitHub repository (merge with any existing files; don't overwrite trading code).
2. On GitHub, open repository Settings -> Pages.
3. Under Build and deployment, choose Deploy from a branch.
4. Select branch main (or your default branch) and folder /docs. Click Save.
5. Wait for GitHub Pages to publish; the URL appears in Settings -> Pages.

This is a static dashboard. It does NOT connect to OKX or place orders. It can download strategy.json, but does not commit it to GitHub automatically. The included symbols selection is exported; confirm your Python trader reads that field before relying on it.

Gemini is optional. The user enters their own Gemini API key at runtime; it is not embedded in this source or saved in localStorage. The request goes directly from that browser to Google's API, so the key is visible to that browser session/devtools and usage may incur costs. Do not enter OKX keys. For a shared public dashboard, use a protected backend instead of client-side API calls.
