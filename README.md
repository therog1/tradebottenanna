# TradebottenAnna — komplett repository

Det här paketet innehåller kontrollpanelen, Gemini-rådgivarens Cloudflare Worker och en regelbaserad Python-bot för **OKX EU DEMO**. Standardläget skickar inga order. Ingen API-nyckel ska någonsin läggas i HTML eller committas till Git.

## Kontrollpanel (GitHub Pages)
1. Lägg innehållet i ZIP-filen i roten av ditt privata repo `therog1/tradebottenanna` och committa.
2. GitHub → **Settings → Pages** → **Deploy from a branch** → branch `main` → folder `/docs` → Save.
3. Kontrollpanelen blir normalt `https://therog1.github.io/tradebottenanna/` (om GitHub Pages är aktiverat för repot/kontot). Använd den adressen för sliders; `https://tradebottenanna.rogedv.workers.dev/` är API:t och visar hälsostatus-JSON.

## Gemini-backend (Cloudflare Worker)
1. Cloudflare → Workers & Pages → Worker `tradebottenanna` → **Edit code**.
2. Ersätt worker-koden med `cloudflare-worker/index.js` och Deploy.
3. Settings → Variables and Secrets: skapa **Secret** `GEMINI_API_KEY` med din Gemini-nyckel. Inte en vanlig Variable.
4. Cloudflare Access måste skydda Worker-hostnamnet och endast tillåta ditt Google-konto. CORS är inte autentisering.
5. Worker tillåter Pages-origin `https://therog1.github.io` och endpoint `/api/advice`. Om Pages publiceras på en annan origin måste allowlist ändras och Worker deployas igen.

## Bot / GitHub Actions
- Workflow `TradebottenAnna — safe dry run` körs manuellt via **Actions** och använder endast publik marknadsdata; den har inte OKX-hemligheter och skickar inga order.
- `DEMO_TRADING_ENABLED` är `false` som standard. Ändra inte till `true` förrän OKX-nycklarna är skapade med demo-behörighet och endast demo används. Då krävs GitHub Secrets `OKX_API_KEY`, `OKX_API_SECRET`, `OKX_API_PASSPHRASE` och en separat medveten ändring av workflow.
- Kontrollpanelen exporterar `strategy.json`; ladda ned och committa filen i repo-roten för att boten ska läsa inställningarna. Panelen committar inte automatiskt.

## Gemini-nyckel
Om en nyckel visades i en skärmbild eller lades in som vanlig Cloudflare Variable, återkalla den i Google AI Studio och skapa en ny. Spara den nya endast som Cloudflare **Secret**.

## Viktigt
Det här är ett startpaket, inte en garanti för att allt är driftsatt eller lönsamt. GitHub Pages, Cloudflare Worker och Access är separata tjänster och kräver stegen ovan. Håll orderhandel avstängd tills du själv har verifierat konfigurationen.
