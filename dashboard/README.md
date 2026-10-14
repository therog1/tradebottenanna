# 🤖 Tradebot Command Center v2.3 — Kodarens Handbok & Grok Handoff

Detta är källkoden för **Tradebot Command Center** (read-only). Ursprungligen exporterad från AI Studio; alla AI/LLM-anrop (Gemini) är borttagna enligt kostnadsregeln.

---

## 🛡️ Arkitektur & Säkerhetsmodell: "Noll nycklar i webbläsaren"

Som beslutat i arkitekturen:
1. **Dashboard (GitHub Pages)**:
   - Körs 100% **gratis** och statiskt på GitHub Pages.
   - **INGA** API-nycklar (OKX Secret, Passphrase, GitHub token) lagras eller exponeras någonsin i klientens webbläsare eller kod.
   - Dashboarden är **Read-Only / Telemetry**: Den visar realtidssaldo, öppna positioner, OBI-scanner och historik genom att läsa `./data/status.json`.
2. **Handelsmotor (GitHub Actions)**:
   - All skarp handel med OKX (`eea.okx.com`) sker säkert på GitHubs servrar via schemalagda **GitHub Actions** (`.github/workflows/tradebot-runner.yml`).
   - Alla hemligheter lagras krypterat under **GitHub Repository Secrets**.
   - Efter varje cykel uppdateras `./data/status.json` automatiskt med verifierade saldon och positioner.

---

## 🚀 Snabbstart för Kodaren

### Steg 1: Import (ingen force-push)
Koden importeras under `dashboard/` på branchen `import/dashboard-v2.3` i therog1/tradebottenanna och granskas via en **draft-PR**. Kör aldrig `git init` + `git push --force` mot main.

### Steg 2: Secrets
Dashboarden och dess runner använder **inga OKX-secrets**. Ägarskap: Lena = `OKX_AGGR_*` (Lena-repot), Anna = `OKX_ANNA_*` (Annas motor). Ändra inga secrets för dashboarden.

### Steg 3: Aktivera GitHub Pages
Gå till:  
**Settings** -> **Pages**  
Under **Build and deployment** -> **Source**: Välj **"GitHub Actions"**.

`deploy-pages.yml` körs endast manuellt (`workflow_dispatch`). Pages-inställningar ändras inte i denna PR.

---

## 📈 Aggressiva Lenas Riskparametrar
- **Kapitalallokering**: 35% av USDC-likviditet per trade ($17.50 på $50 subkonto).
- **Hävstång**: 3x–5x dynamisk (baserat på Order Book Imbalance).
- **Max öppna positioner**: 3 st parallellt.
- **Stop-Loss**: -1.8% (läggs direkt som exchange-native skyddsorder på OKX).
- **Trailing Stop**: 0.9% distans från toppnotering.
- **Take-Profit**: +4.0%.

---

## 🛠️ Lokal utveckling & testning
```bash
# Installera beroenden
npm install

# Starta lokal dev-server (port 3000)
npm run dev

# Bygg produktionspaket
npm run build

# Testa schemalagd cykel manuellt
npx tsx scripts/run_trading_cycle.ts
```
