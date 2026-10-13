# TradebottenAnna Gemini API Worker

- Endpoint: `POST /api/advice`
- Secret: `GEMINI_API_KEY` (Cloudflare Secret, aldrig vanlig variable)
- Allowed frontend origin: `https://therog1.github.io`
- Advice only: ingen OKX-anslutning och ingen orderfunktion.

Cloudflare Dashboard → Workers & Pages → `tradebottenanna` → Edit code. Klistra in `index.js`, Deploy. Lägg till `GEMINI_API_KEY` under Settings → Variables and Secrets som Secret. Skydda hostnamnet med Cloudflare Access och tillåt endast ditt eget Google-konto.

CORS är inte autentisering. Om Access-cookies blockeras i cross-origin-anrop från GitHub Pages, använd en egen domän/same-site-lösning; lägg aldrig en bearer token eller API-nyckel i HTML.
