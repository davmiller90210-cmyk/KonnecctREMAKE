# Native chat v1 (locked scope)

Internal workspace chat only (same auth as CRM). Slack-like: **channels** (public/private) + **direct messages**.

## In scope (v1)

- Text messages, channel list + DM list, unread counts on layout poll
- **Realtime:** Server-Sent Events per conversation (`/chat/messages/stream`) with Redis pub/sub fanout for multi-instance
- **Read receipts:** Per-member `lastReadAt` on `chatMessageRead`; `read-updated` events on the conversation stream
- **Typing:** Ephemeral `typing` events via POST `/chat/typing` + Redis publish (no long-term storage)
- **In-app notifications:** Rows in `chatNotification` + `GET /chat/notifications` + mark-read; not browser push in v1
- **CRM:** Record link API (`/chat/record-link`) unchanged; `@mentions` UI can be extended later (composer candidates stub exists)

## Out of scope (later)

- File attachments in native chat, threads, full-text search, email/mobile push, external guests
- Mattermost / dedicated chat host (removed from production compose)

## Environment

- `REDIS_URL` required for realtime fanout (`crm-redis` in Docker). If SSE works but peers never see updates, verify the same Redis URL/DB index/TLS/ACL as the API process that publishes chat events.
- `REACT_APP_CHAT_PROVIDER=native` for front build (Konnecct default)
- Optional `GIPHY_API_KEY` for server-proxied GIF search in native chat (key stays on the server). Production use must follow [GIPHY’s developer terms](https://developers.giphy.com/docs/api/#terms) (attribution/branding as required).
- Core DB: native chat tables use Postgres RLS scoped by transaction-local `app.current_workspace_id` (see migration `1775700000000-core-chat-row-level-security`). Use PgBouncer **transaction** or **session** pooling so `set_config(..., true)` and queries share the same backend transaction/session.

## Manual QA (native chat)

- Two browsers on the same channel: send message, reaction, pin; confirm the other tab updates over SSE without waiting for the quiet poll window.
- GIF: open GIF picker, insert, confirm image renders and message persists after reload.
- Emoji: pick a skin-tone sequence from the full picker; reaction saves and appears for the other viewer.
