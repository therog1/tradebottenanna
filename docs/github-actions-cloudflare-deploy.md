# Automatiserad Driftsättning via GitHub Actions

Med denna setup behöver du aldrig köra kommandon i din egen dator. Varje gång kod pushas till `main` i ditt privata GitHub-repository (`therog1/tradebottenanna`), eller när du klickar på **"Run workflow"** i GitHub, byggs och driftsätts hela TradebottenAnna automatiskt till Cloudflare Workers.

---

## 1. Skapa en Cloudflare API Token (1 minut)

1. Logga in på [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Klicka på din profilikon uppe till höger -> **My Profile**.
3. Välj **API Tokens** i vänstermenyn.
4. Klicka på **Create Token**.
5. Hitta mallen **"Edit Cloudflare Workers"** och klicka på **Use template**.
6. Under **Account Resources**, välj ditt Cloudflare-konto.
7. Klicka på **Continue to summary** -> **Create Token**.
8. Kopiera den genererade token-strängen.

Hämta även ditt **Account ID**:
- Gå till Workers & Pages i Cloudflare Dashboard -> Titta i högra sidomenyn under **Account details** -> Kopiera **Account ID**.

---

## 2. Spara hemligheterna i ditt privata GitHub-repo

Gå till ditt repository på GitHub: `https://github.com/therog1/tradebottenanna`

1. Klicka på fliken **Settings**.
2. I vänstermenyn under **Security**, klicka på **Secrets and variables** -> **Actions**.
3. Klicka på **New repository secret** och lägg till dessa tre:

| Namn på Secret | Värde |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Den Cloudflare API Token du skapade ovan |
| `CLOUDFLARE_ACCOUNT_ID` | Ditt Cloudflare Account ID |
| `GEMINI_API_KEY` | Din Gemini API Key från Google AI Studio |

---

## 3. Klart! Automatisk körning

Nu är allt helautomatiskt:
- **Varje gång du pushar kod till `main`:** GitHub Actions kör automatiskt `.github/workflows/deploy_cloudflare.yml`, installerar, bygger och publicerar till `https://tradebottenanna.rogedv.workers.dev/`.
- **Manuell körning med ett klick:** Gå till **Actions** i GitHub -> Välj **"Deploy TradebottenAnna to Cloudflare"** -> Klicka på **Run workflow**.
