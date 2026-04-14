# Sendbird Chat + Calls — Konnecct runbook

This document covers environment variables, Sendbird dashboard settings, API bases (including EU), and a practical test checklist for the native **`SendbirdCommunicationHub`** (`REACT_APP_CHAT_PROVIDER=sendbird`).

## 1. Security and secrets

- **Never** put `SENDBIRD_API_TOKEN` (or any secondary API token) in the frontend bundle or a public repo. Only the server reads it.
- **Browser exposure:** The SPA needs **`REACT_APP_SENDBIRD_APP_ID`** (or it is injected from `SENDBIRD_APPLICATION_ID` at build/runtime via `generate-front-config` / Docker build args). This is the public application ID, not the API token.
- **Token hygiene:** If an API token was ever pasted into chat, email, or committed to git, **rotate it** in the Sendbird dashboard and update deployment secrets. Prefer a **secondary** token for production automation if Sendbird supports scoped tokens for your use case.
- **Session tokens:** `GET /sendbird/session` returns a short-lived **session token** for the Chat SDK and Calls `authenticate({ accessToken })`. Treat it like an access credential in transit (HTTPS only).

## 2. Environment variables (crm-server)

| Variable | Required | Purpose |
|----------|----------|---------|
| `SENDBIRD_APPLICATION_ID` | Yes | Sendbird application ID (Chat + Calls). |
| `SENDBIRD_API_TOKEN` | Yes | Platform API token (`Api-Token` header) for user upsert and session issue. |
| `SENDBIRD_CHAT_API_BASE` | No | Override Chat Platform API base (default `https://api-{APP_ID}.sendbird.com`). Use if Sendbird documents a regional host for your app. |

Frontend / build (also passed through Docker build args and `generate-front-config` where applicable):

| Variable | Purpose |
|----------|---------|
| `REACT_APP_CHAT_PROVIDER` | Set to `sendbird` for the native hub (default in this repo’s generated config). |
| `REACT_APP_SENDBIRD_APP_ID` | Public app id for client init; falls back to `SENDBIRD_APPLICATION_ID` in `generate-front-config` if unset. |

## 3. EU / Frankfurt and regional hosts

1. In the **Sendbird dashboard**, confirm the region for your application (e.g. EU).
2. Note the documented **Chat REST** base URL pattern (`https://api-{application_id}.sendbird.com` or the EU equivalent if shown).
3. **Calls:** If the dashboard or docs specify dedicated **Calls API** or **WebSocket** hosts, pass them to `SendBirdCall.init(appId, apiHost, websocketHost)` in the client if the default init fails in your region. The current hub uses `SendBirdCall.init(appId)`; extend only if Sendbird requires explicit hosts for your tenant.

Official references:

- [Chat JavaScript SDK overview](https://sendbird.com/docs/chat/sdk/v4/javascript/overview)
- [Calls JavaScript getting started](https://sendbird.com/docs/calls/sdk/v1/javascript/getting-started/make-first-call)
- [Calls `init` reference](https://sendbird.com/docs/calls/sdk/v1/javascript/ref/classes/sendbirdcall.html)

## 4. Dashboard settings

- **Authentication:** Enable settings that require session/token login for production (e.g. deny non-token login per Sendbird’s security docs) so user access matches the server-issued session flow.
- **Chat:** Group channels are used for workspace channels and DMs (`isDistinct` for 1:1). Ensure app limits (members per channel, rate limits) fit your workspace sizes.
- **Profile images:** If user creation fails or nicknames work but avatars do not, check **Settings → Application → (security / filters)** for **profile URL domain allowlists**. The CRM’s `defaultAvatarUrl` host (e.g. Clerk or your CDN) must be allowed, or Sendbird rejects `profile_url` — Konnecct falls back to nickname-only sync and logs a warning server-side.
- **Calls:** Confirm Calls is enabled for the same application ID. Billing is typically by connected minutes; use a staging app with low caps for development.

## 5. Konnecct integration touchpoints

- **Session:** `GET /sendbird/session` — workspace bearer JWT (same pattern as Stream auth). Returns `appId`, `userId`, `sessionToken`, `expiresAt`.
- **Bulk user ensure (optional):** `POST /sendbird/ensure-users` with `{ scopedUserIds: string[] }` (max 100).
- **Chat layout:** Channels and DM threads expose `sendbirdChannelUrl` when provisioned. The hub loads history with `groupChannel.getChannel(url)` and subscribes via `GroupChannelHandler`.
- **Database:** `sendbirdChannelUrl` on channel and DM thread entities; run server migrations after deploy.

## 6. Testing checklist

1. **Config:** `SENDBIRD_*` set on crm-server; `REACT_APP_SENDBIRD_APP_ID` / `REACT_APP_CHAT_PROVIDER=sendbird` on the SPA build or runtime config.
2. **Sign-in:** Open `/chat` in a workspace; confirm no “Sendbird is not configured” error from `/sendbird/session`.
3. **Channel:** Open `#general` (or another workspace channel); messages load and new text messages appear for a second user in the same channel.
4. **DM:** Start a DM from the hub; wait for `sendbirdChannelUrl` if provisioning lags; confirm two-way messaging.
5. **Calls — direct:** From a DM, start a voice call; second browser accepts incoming call; media elements show in the floating dock; end call.
6. **Calls — group:** In a channel, create a group room; copy room id; second user joins with “Join room”; leave room.
7. **Rollback:** Set `REACT_APP_CHAT_PROVIDER=stream` or `mattermost` and rebuild/redeploy if you need the previous hub.

## 7. Deprecation notes

`stream` and `mattermost` chat providers remain available behind `REACT_APP_CHAT_PROVIDER` for rollback. Remove them only after Sendbird is validated in production and stakeholders accept no automatic migration of legacy Stream/Mattermost message history.
