# ⚡ ApexFlash - AI Crypto Futures Trading Bot

En helt automatiserad krypto-tradingbot för **Perpetual Futures** (BTC, ETH, SOL, AVAX, SUI) som körs **100% gratis dygnet runt via GitHub Actions** och fattar intelligenta handelsbeslut via **Google Gemini Flash**.

---

## 🔐 Obligatoriska API-nycklar (GitHub Secrets)

Gå till ditt GitHub-repository -> **Settings** -> **Secrets and variables** -> **Actions** -> Klicka på **New repository secret**.

Lägg till dessa tre obligatoriska hemligheter:

| Secret Namn | Var du hittar den | Beskrivning |
|---|---|---|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/) | Gratis API-nyckel för Gemini Flash beslutsfattande. |
| `BYBIT_API_KEY` | Bybit -> API Management | Din Bybit API-nyckel (Behörighet: **Contract / Derivatives - Orders & Positions**). |
| `BYBIT_API_SECRET` | Bybit -> API Management | Din hemliga Bybit Secret Key. |

### Valfria Secrets:

| Secret Namn | Standardvärde | Beskrivning |
|---|---|---|
| `DRY_RUN` | `false` | Sätt till `true` för att provköra utan riktiga pengar. |
| `RISK_PER_TRADE_PCT` | `1.5` | Risk i procent av totalt USDT-saldo per trade (Compounding). |
| `TELEGRAM_BOT_TOKEN` | (Tom) | Bot Token från `@BotFather` för live-notiser i Telegram. |
| `TELEGRAM_CHAT_ID` | (Tom) | Ditt Telegram chat-id för notiser. |
| `USE_TESTNET` | `false` | Sätt till `true` om du använder Bybit Testnet. |

---

## 🎯 Strikta Handelsregler i Boten

1. **Dubbelriktad handel (Long & Short):**
   - **Bounce (LONG):** Studs på tekniskt stöd / EMA-återtagande med stigande momentum.
   - **Dump (SHORT):** Prisras under EMA21/EMA50 med säljstyrka och svagt RSI.
2. **Fast 5:1 Payout-Ratio (Reward-to-Risk):**
   - Varje entry har en fast Take-Profit (TP) och en snabb Stop-Loss (SL) beräknad **före entry**.
   - Målvinsten är exakt **5x** den riskerade förlusten.
3. **Anti-Martingale & Ingen Snittning Neråt:**
   - Om en position redan är öppen i ett par hoppar boten över paret. Inga utfyllnadspositioner!
4. **Dynamisk Compounding Positionsstorlek:**
   - Läser av aktuellt USDT-saldo och anpassar positionsstorleken dynamiskt.
5. **Dynamisk & Säker Hävstång:**
   - Anpassas automatiskt mellan 3x och 10x så att likvidationspriset alltid ligger tryggt bortom Stop-Loss.

---

## 🚀 Kom igång & Provkör

1. Gå till fliken **Actions** i ditt GitHub-repository.
2. Välj **ApexFlash Crypto Futures Bot** i menyn till vänster.
3. Klicka på **Run workflow** (du kan bocka i `Dry Run` för första testen).
4. Boten körs omedelbart, skannar marknaden, beräknar 5:1 R:R nivåer och publicerar en Markdown-rapport i **Step Summary**.
5. Därefter körs boten automatiskt var 15:e minut dygnet runt!
