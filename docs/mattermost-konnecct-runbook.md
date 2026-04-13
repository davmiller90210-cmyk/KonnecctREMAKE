# Mattermost + Konnecct — operations runbook

Single sign-on, provisioning, branding, and UI overrides for the dedicated chat host (`https://chat.konnecct.com` in the default compose setup).

## 0. What you can (and cannot) get with an iframe

- **Embedding Mattermost’s own webapp** (`/chat` → iframe → `chat.*`) means you are still running **Mattermost’s React app**. CSS injection can **hide branding**, force a **dark palette**, and reduce banners — but it **cannot** make the product **identical** to Twenty’s components (`twenty-ui`), typography, and layouts.
- **One sign-in for CRM + chat** requires **OIDC/SAML** (or a bridge IdP) so Mattermost never uses a **second password**. That is **server configuration**, not a front-end swap.
- If you need **native Twenty UI only**, use **`REACT_APP_CHAT_PROVIDER=stream`** and Stream’s keys: the app uses **`CommunicationHub`** (same design system as the rest of Konnecct). That is **not** Mattermost feature parity.

**This repo’s default:** nginx injects `konnecct-mm-overrides.css` into Mattermost HTML, and compose sets `MM_TEAMSETTINGS_SITENAME` and disables the email preview banner.

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

**Multi-tenant product behavior:** End users should never need to paste Mattermost credentials. Automatic per-user vault tokens require a **provisioning token** on **crm-server** (for example `MATTERMOST_ADMIN_TOKEN`, `MATTERMOST_PROVISIONING_TOKEN`, or `MATTERMOST_ADMIN_TOKEN_FILE` — see `mattermost-provision-token.util.ts`). Without that, chat returns a generic unavailable message while operators fix configuration using this runbook and server logs.

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

## 7. Native Konnecct chat (Twenty UI + BFF)

When `REACT_APP_CHAT_PROVIDER=mattermost`, the CRM uses **MattermostHub** (Twenty UI) instead of embedding the full Mattermost webapp. Traffic flow:

1. Browser keeps the normal **workspace CRM JWT** and calls **`GET /chat/mattermost/session`** and **`POST /chat/mattermost/forward`** on the **app** host (proxied to `crm-server`).
2. **crm-server** validates the JWT, loads or creates an **encrypted Mattermost PAT** per CRM user (`core.mattermostUserCredential`), and proxies allowed **`/api/v4/*`** requests to `MATTERMOST_SITE_URL` with that PAT.
3. The browser may open a **WebSocket** to **`wss://<chat-host>/api/v4/websocket`** using the PAT from the session endpoint (same host as Mattermost).
4. **CRM @mentions** are stored in post text as markdown links, e.g. `[@Acme](/object/company/…)` or full `https://app…/object/…` URLs, and rendered as in-app links in the hub.

### 7.1 Requirements

| Item | Notes |
|------|--------|
| **API** | `MATTERMOST_SITE_URL`, `MATTERMOST_ADMIN_TOKEN` on **crm-server** (same as provisioning). Run **core DB migrations** so `mattermostUserCredential` exists. |
| **CORS** | If the browser talks to **chat.*** directly (WebSocket/session token), set **`MM_SERVICESETTINGS_ALLOWCORSFROM`** to your CRM origin (e.g. `https://app.konnecct.com`). Compose defaults this in `docker-compose.prod.yml`. |
| **Calls iframe** | MVP **GlobalMattermostCallShell** iframes the channel URL on **chat.***. Set **`MM_SERVICESETTINGS_FRAMEANCESTORS`** so **app.*** may frame **chat.*** (compose default: `https://app.konnecct.com`). If the iframe stays blank, check Mattermost **Content Security Policy** / **X-Frame-Options** in System Console and align with your public URLs. |
| **REST via BFF only** | `POST /chat/mattermost/forward` is restricted by an **allow-list** in `MattermostBridgeService` (specific `GET` paths, `POST /api/v4/posts`, `POST /api/v4/reactions`, `DELETE …/reactions/{emoji}`). **`POST /chat/mattermost/files`** uploads one multipart file to `POST /api/v4/files?channel_id=…` with the user’s PAT. Extend the allow-list when adding features. WebSocket still hits **chat.*** unless you add a server-side relay. |

### 7.2 SSO note

OIDC into Mattermost (sections 1–3) remains how users avoid a second password. The PAT is created server-side after the CRM user exists; users should complete **at least one** Mattermost login via SSO if your server requires it before API tokens work as expected.

### 7.3 Iframe embed (legacy)

`MattermostChatEmbed` remains in the repo for troubleshooting or rollback; **KonnecctChatPage** uses **MattermostHub** when the chat provider is `mattermost`.
