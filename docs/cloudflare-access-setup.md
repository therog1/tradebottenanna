# Cloudflare Access (Zero Trust) Setup for TradebottenAnna

## Objective
Protect `https://tradebottenanna.rogedv.workers.dev/` so that only Roger (`rogedv@icloud.com`) can log in using Google OAuth identity through Cloudflare Access.

---

## Step-by-Step Configuration

### 1. Enable Zero Trust Application
1. Log into your [Cloudflare Dashboard](https://dash.cloudflare.com/) and navigate to **Zero Trust**.
2. Go to **Access** -> **Applications**.
3. Click **Add an application** and select **Self-hosted**.
4. Configure application parameters:
   - **Application name:** `TradebottenAnna Control Panel`
   - **Application domain:** `tradebottenanna.rogedv.workers.dev` (or your custom domain)
   - **Session Duration:** 24 hours

### 2. Configure Identity Provider (Google Login)
1. Go to **Zero Trust** -> **Settings** -> **Authentication**.
2. Under **Login methods**, ensure **Google** is added as an IdP.
3. In the Application settings, check **Google** under Identity Providers.

### 3. Add Roger-Only Policy
1. In the application setup, click **Add a policy**:
   - **Policy name:** `Allow Roger Only`
   - **Action:** `Allow`
2. Under **Configure rules**:
   - **Selector:** `Emails`
   - **Value:** `rogedv@icloud.com`
3. Save the policy.

### 4. How Cloudflare Access Injects Identity
When an authenticated request hits the Worker:
- Cloudflare validates the session JWT.
- Cloudflare passes the HTTP header `Cf-Access-Authenticated-User-Email: rogedv@icloud.com`.
- The TradebottenAnna Worker inspects this header and reflects Roger's verified identity in the dashboard header.
- Unauthorized users receive a 403 / Cloudflare Access login challenge before ever reaching the application.
