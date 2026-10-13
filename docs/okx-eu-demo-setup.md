# OKX EU Demo Trading Setup & Safety Verification

## Strict Safety Principle
TradebottenAnna is architected to operate **exclusively** in the OKX EU Demo (simulated paper trading) environment.
Live trading is rejected by hard assertions in the code.

---

## 1. Creating OKX Demo API Keys
1. Log into your OKX EU account.
2. Toggle the account to **Demo Trading / Simulated Trading** in the OKX header.
3. Navigate to **API Keys** while in Demo Trading mode.
4. Click **Create Demo API Key**:
   - **API Name:** `TradebottenAnna-Demo`
   - **Passphrase:** Enter a strong passphrase (record this securely)
   - **Permissions:** `Read` and `Trade` (Demo only)
   - **IP Whitelist:** Optional for demo, recommended for production runners.
5. Copy your **API Key**, **Secret Key**, and **Passphrase**.

---

## 2. Setting Secrets for GitHub Actions & Local Dev

### In GitHub Repository Secrets (Private Repo `therog1/tradebottenanna`):
Navigate to **Settings** -> **Secrets and variables** -> **Actions** and add:
- `OKX_DEMO_API_KEY`
- `OKX_DEMO_SECRET_KEY`
- `OKX_DEMO_PASSPHRASE`

### In Local Development (`.env`):
```bash
OKX_DEMO_API_KEY="your-demo-api-key"
OKX_DEMO_SECRET_KEY="your-demo-secret-key"
OKX_DEMO_PASSPHRASE="your-passphrase"
DEMO_TRADING_ENABLED="false"
ENVIRONMENT="okx_eu_demo"
```

---

## 3. Protocol Verification
Every request sent to OKX includes the required header:
```http
x-simulated-trading: 1
```
If this header is removed or altered, the Python client raises an immediate fatal error:
`CRITICAL SECURITY ERROR: OKX Demo Client cannot run with enforce_demo=False.`
