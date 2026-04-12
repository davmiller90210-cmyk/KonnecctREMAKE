# Mattermost + Konnecct — operations runbook

Single sign-on, provisioning, branding, and optional UI overrides for the dedicated chat host (`https://chat.konnecct.com` in the default compose setup).

## 1. Unified identity (Clerk OIDC → Mattermost)

### 1.1 Clerk

1. In the Clerk Dashboard, create an **OAuth application** (or use the OIDC / “EASIE” / SAML product that exposes **OpenID Connect** for third-party apps — follow current Clerk docs for “OAuth/OIDC third-party app”).
2. **Redirect URI** (required by Mattermost):  
   `https://<your-chat-host>/signup/openid/complete`  
   Example: `https://chat.konnecct.com/signup/openid/complete`
3. Note the **Discovery (well-known) URL**, **Client ID**, and **Client secret**.

### 1.2 Mattermost environment (docker-compose)

Set in `.env` next to `docker-compose.prod.yml`:

| Variable | Purpose |
|----------|---------|
| `MM_OPENIDSETTINGS_ENABLE` | `true` when IdP is configured |
| `MM_OPENIDSETTINGS_DISCOVERYENDPOINT` | Clerk OIDC discovery URL |
| `MM_OPENIDSETTINGS_ID` | Client ID |
| `MM_OPENIDSETTINGS_SECRET` | Client secret |
| `MM_OPENIDSETTINGS_BUTTONTEXT` | e.g. `Continue with Konnecct` |
| `MM_OPENIDSETTINGS_SCOPE` | Default in compose: `profile openid email` |

**License note:** Mattermost’s documentation groups OpenID Connect (non-GitLab) with paid tiers in some versions. Confirm your **Team Edition** license against [Mattermost pricing/docs](https://docs.mattermost.com/). If OIDC (Other) is not licensed, use a **bridge IdP** (Keycloak, Authentik) trusted by both Clerk (via sync/webhook) and Mattermost.

### 1.3 Disable parallel signup

Compose defaults (override with `MATTERMOST_ENABLE_OPEN_SERVER` / `MATTERMOST_ENABLE_EMAIL_SIGNUP` if needed):

- `MM_TEAMSETTINGS_ENABLEOPENSERVER=false` — no public open server
- `MM_EMAILSETTINGS_ENABLESIGNUPWITHEMAIL=false` — no self-serve email signup

After changing env, restart the `mattermost` container. If settings were persisted in the `mattermost-config` volume, verify **System Console** values match or remove stale overrides.

## 2. User provisioning (Konnecct → Mattermost API)

When `MATTERMOST_ADMIN_TOKEN` and `MATTERMOST_SITE_URL` are set on **crm-server**, Konnecct calls the Mattermost Admin API after a workspace member row is created:

1. Create a **system admin** personal access token in Mattermost (or use a dedicated admin bot account).
2. Set `MATTERMOST_ADMIN_TOKEN` and ensure `MATTERMOST_SITE_URL` matches the public chat base URL (no trailing slash).
3. If `CLERK_SECRET_KEY` is set on crm-server, provisioning sets `auth_service=openid` and `auth_data=<Clerk user id>` so it matches Clerk’s OIDC `sub`.

Provisioning is best-effort: failures are logged and do not block CRM flows.

## 3. Iframe SSO and cookies

OAuth inside a third-party iframe is fragile (cookies, SameSite). The CRM embed includes **Sign in to chat (popup)**, which opens `REACT_APP_MATTERMOST_SSO_ENTRY_PATH` on the chat host (default `/login`) so the user completes SSO in a **first-party** window; when the popup closes, the iframe reloads.

Test in Chrome and Safari with default privacy settings.

## 4. System Console checklist (Mattermost UI)

| Area | Action |
|------|--------|
| **Site configuration** | Site URL = public chat URL; site name / branding → **Konnecct**; upload logo if supported |
| **Email (SMTP)** | Configure real SMTP so “Preview Mode” / email banners are gone |
| **Onboarding / tips** | Disable tutorials and NPS if your version exposes toggles (check *Experimental*, *Onboarding*) |
| **Custom themes** | Optional: set a default dark theme (see JSON below) |

### 4.1 Example dark theme (starting point)

Import or paste in **Account Settings → Display → Theme → Custom Theme** (adjust to match `twenty-ui` tokens):

```json
{
  "sidebarBg": "#191919",
  "sidebarText": "#E5E5E5",
  "sidebarHeaderBg": "#141414",
  "sidebarTeamBarBg": "#0F0F0F",
  "sidebarUnreadText": "#FFFFFF",
  "onlineIndicator": "#4CAF50",
  "awayIndicator": "#FF9800",
  "dndIndicator": "#F44336",
  "mentionBg": "#3D5AFE",
  "mentionColor": "#FFFFFF",
  "centerChannelBg": "#1B1B1B",
  "centerChannelColor": "#E8E8E8",
  "newMessageSeparator": "#3D5AFE",
  "linkColor": "#7C9EFF",
  "buttonBg": "#3D5AFE",
  "buttonColor": "#FFFFFF",
  "errorTextColor": "#FF6B6B",
  "mentionHighlightBg": "#2A2A2A",
  "mentionHighlightLink": "#7C9EFF"
}
```

## 5. Optional: `konnecct-mm-overrides.css` and nginx

Static file is served at:

`https://chat.konnecct.com/konnecct-mm-overrides.css`

To **inject** it into Mattermost HTML responses you can use `sub_filter` in nginx. Caveats:

- **gzip**: `sub_filter` runs on uncompressed bodies; you may need `sub_filter_types text/html;` and to disable gzip for MM HTML, or use `gunzip` (see [nginx sub_filter documentation](http://nginx.org/en/docs/http/ngx_http_sub_module.html)).
- **Upgrades**: Every Mattermost upgrade can change DOM/class names — re-test overrides.

Regression check after upgrade: login, channels, threads, calls plugin, mobile web.

## 6. “FREE EDITION” / Mattermost header label

| Approach | Pros | Cons |
|----------|------|------|
| **Community plugin** | No fork; easier upgrades | Must trust plugin maintainer; may break on MM upgrades |
| **Custom Docker image** (patch static assets) | Full control | High maintenance; merge conflicts on every release |
| **Paid Mattermost tier** | Supported branding | Cost |

**Legal:** Mattermost’s trademarks and edition labels have usage rules; consult Mattermost’s trademark policy before hiding required notices. Prefer supported branding features or a paid tier when compliance matters.
