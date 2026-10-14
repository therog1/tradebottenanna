# 🤖 Tradebot Command Center v2.3 — Kodarens Handbok & Grok Handoff

Detta är den kompletta källkoden för **Tradebot Command Center** (tradebottenanna & tradebottenaggresivalena), exporterad direkt från Google AI Studio.

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

### Steg 1: Packa upp och initiera Git
```bash
# Skapa projektmapp och packa upp
mkdir -p tradebottenanna
cd tradebottenanna
unzip ../tradebottenanna-v2.3-export.zip

# Initiera git
git init
git add .
git commit -m "feat: Tradebot Command Center v2.3 with zero-key GitHub Pages + Actions engine"
git branch -M main

# Koppla till GitHub-repositoryt
git remote add origin https://github.com/therog1/tradebottenanna.git
git push -u origin main --force
```

### Steg 2: Lägg till Secrets i GitHub Repo
Gå till ditt repository på GitHub:  
**Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**

Lägg till följande hemligheter:
- `OKX_AGGR_KEY`: API-nyckel för Aggressiva Lena (OKX underkonto)
- `OKX_AGGR_SECRET`: Secret Key för Aggressiva Lena
- `OKX_AGGR_PASS`: Passphrase för Aggressiva Lena
- `OKX_ANNA_KEY`: API-nyckel för Tradebotten Anna (OKX underkonto)
- `OKX_ANNA_SECRET`: Secret Key för Tradebotten Anna
- `OKX_ANNA_PASS`: Passphrase för Tradebotten Anna
- `GEMINI_API_KEY`: För AI Optimizer-parametertuning (valfritt)

### Steg 3: Aktivera GitHub Pages
Gå till:  
**Settings** -> **Pages**  
Under **Build and deployment** -> **Source**: Välj **"GitHub Actions"**.

Arbetsflödet `.github/workflows/deploy-pages.yml` kommer nu automatiskt bygga och driftsätta dashboarden helt gratis vid varje push till `main`!

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
