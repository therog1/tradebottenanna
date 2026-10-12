# ApexFlash — OKX EU Paper Test (v1)

Den här versionen är en **paper-testversion** för att verifiera marknadsdata, Gemini-signaler och grundläggande riskberäkningar. Den **skickar aldrig order** och innehåller ingen autentiserad handelsanslutning. Den ersätter inte en färdig live-/demohandelsbot.

## Funktioner
- Läser publika OKX EU swap-marknader via `eea.okx.com`.
- Analyserar BTC, ETH, SOL, AVAX och SUI med EMA, RSI, ATR, stöd/motstånd och volym.
- Frågar Gemini (`gemini-3.8-flash` som standard) om LONG/SHORT/HOLD.
- Validerar riktning på entry/SL/TP och kräver minst 5:1 reward/risk för en paper-idé.
- Beräknar hypotetisk risk och storlek utifrån antaget paper-saldo; inga pengar flyttas.
- Skriver rapport i GitHub Actions Step Summary.

## Installera på GitHub
1. Ladda ner och packa upp ZIP-filen.
2. Ladda upp/ersätt filerna i repositoryts rot, inklusive mappen `.github/workflows`.
3. I **Settings → Secrets and variables → Actions → Secrets**, behåll/skapa `GEMINI_API_KEY`. Ingen Bybit-nyckel behövs i denna paper-version.
4. Gå till **Actions → ApexFlash OKX EU Paper Test → Run workflow**.

## Viktigt
- Alla workflows är manuella; inget schemalagt körschema är aktiverat.
- `DRY_RUN=true` och `LIVE_TRADING_ENABLED=false` anges uttryckligen.
- Koden anropar inte `create_order`, `create_market_order`, `create_limit_order` eller andra ordermetoder.
- Paper-saldot är endast ett antagande (`PAPER_BALANCE_USDT=1000`), inte ditt verkliga saldo.
- Beräknad hävstång är en grov exponeringsgräns, inte en likvidationsmodell. Ingen verklig position, SL eller TP skapas.
- Gemini kan lämna felaktiga nivåer; ogiltiga nivåer avvisas. Ett HOLD är ett normalt resultat.
- Detta är steg 1. Riktig OKX-demohandel kräver separat verifiering av OKX EEA:s autentiserade API, demokonton, positionsläge, kontraktsspecifikationer och börsbaserade skyddsorder. Livehandel ska inte aktiveras med denna version.

## Lokala tester
`python -m unittest discover -s tests -v`
