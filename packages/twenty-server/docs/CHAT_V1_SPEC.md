# Native chat v1 (locked scope)

Internal workspace chat only (same auth as CRM). Slack-like: **channels** (public/private) + **direct messages**.

## In scope (v1)

- Text messages; **channel + DM list** lives in the main CRM navigation drawer under **Communications** (not a second column on `/chat`). Unread badge on that section; mobile chat still uses a full-width conversation list overlay from the thread header.
- `GET /chat/channels/:channelId/roster` and `GET /chat/dm/:dmThreadId/roster` return `{ members: [{ userWorkspaceId, firstName, lastName, avatarUrl }] }` for the Details panel (same auth as layout; caller must be able to read the conversation).
- **Realtime:** Server-Sent Events per conversation (`/chat/messages/stream`) with Redis pub/sub fanout for multi-instance
- **Read receipts:** Per-member `lastReadAt` on `chatMessageRead`; `read-updated` events on the conversation stream
- **Typing:** Ephemeral `typing` events via POST `/chat/typing` + Redis publish (no long-term storage)
- **In-app notifications:** Rows in `chatNotification` + `GET /chat/notifications` + mark-read; **browser tab:** when permission is granted, `notification-updated` inbox SSE triggers a `Notification` if the document is hidden (see `chat-desktop-notify.ts`).
- **CRM @mentions:** Message body may include `[@Label](twenty://record/<object>/<id>)`. On `POST /chat/messages`, the server parses links, verifies **record read** for the sender, persists **immutable snapshots** per mention in `chatMessageCrmMention` (migration `1775900000000-add-chat-message-crm-mention`), and returns `crmMentionSnapshots` on list/create/patch. Viewers without read access get **restricted** DTOs (no title/owner/image). **Audit:** each mention row stores `actorUserWorkspaceId`, `messageId`, record ref, and JSON snapshot at send time.
- **CRM ↔ chat:** `POST /chat/record-link` creates an explicit `chatRecordLink` row. `GET /chat/record-links?objectNameSingular=&recordId=` lists linked conversations the viewer can read. `POST /chat/records/discussion-channel` creates a **private** channel named from the record snapshot, links it to the record, and writes a **timeline** morph activity (`record.chat-linked`). `POST /chat/records/dm-with-owner` resolves a **workspace member** owner (`accountOwnerId`, `ownerId`, `assigneeId`, or `createdBy.workspaceMemberId`), opens or reuses a **1:1 DM** with that member, and links the thread to the record (same read rules as mentions). Mentioning a record in a message inserts `record.chat-mentioned` timeline rows on each mentioned record (best-effort, async-safe).
- **Workflows / integrations:** After each native `POST /chat/messages`, the server emits `WorkspaceEventEmitter.emitCustomBatchEvent('chat_message_created', …)` with `messageId`, conversation ids, sender, `bodyPreview`, and `crmMentionSnapshots` for downstream consumers (Twenty workflow wiring can subscribe to this batch name).
- **Edit / delete (own text messages):** `PATCH /chat/messages/:messageId` with `{ body }`; `DELETE /chat/messages/:messageId` soft-deletes (clears body, sets `deletedAt`, removes reactions and pins). Responses and list payloads include optional `editedAt`, `isDeleted`. Realtime: `message-updated` on the conversation SSE stream (clients refresh thread).
- **Schema:** `chatMessage.editedAt`, `chatMessage.deletedAt` (nullable timestamptz) — migration `1775800000000-add-chat-message-edited-deleted`.

## Out of scope (later)

- File attachments in native chat, threads, full-text search, email/mobile push, external guests
- Mattermost / dedicated chat host (removed from production compose)

## Environment

- `REDIS_URL` required for realtime fanout (`crm-redis` in Docker). If SSE works but peers never see updates, verify the same Redis URL/DB index/TLS/ACL as the API process that publishes chat events.
- **Multi-process:** Every `crm-server` and `crm-worker` instance that handles chat must use the **same** `REDIS_URL`; otherwise pub/sub fanout only reaches clients connected to the instance that published.
- **Reverse proxy (nginx):** For `GET /chat/messages/stream` and `GET /chat/notifications/stream`, disable buffering and allow long-lived connections, for example:
  - `proxy_buffering off;`
  - `proxy_read_timeout` / `proxy_send_timeout` well above the 25s heartbeat interval (e.g. 3600s)
  - `proxy_http_version 1.1` and `Connection` upgrade handling as appropriate for your setup  
  Without this, SSE may appear to connect but deliver no events or disconnect early.
- `REACT_APP_CHAT_PROVIDER=native` for front build (Konnecct default)
- Optional `GIPHY_API_KEY` for server-proxied GIF search in native chat (key stays on the server). Production use must follow [GIPHY’s developer terms](https://developers.giphy.com/docs/api/#terms) (attribution/branding as required).
- Core DB: native chat tables use Postgres RLS scoped by transaction-local `app.current_workspace_id` (see migration `1775700000000-core-chat-row-level-security`). Use PgBouncer **transaction** or **session** pooling so `set_config(..., true)` and queries share the same backend transaction/session.

## Manual QA (native chat)

- **Mentions:** Send `[@Acme](twenty://record/company/<uuid>)` from a user who can read the company; another reader sees the same card fields after refresh; a user **without** read sees “Restricted”. Edit the company name in CRM; historical message card still shows the snapshot label.
- **Record page:** From a record, open the chat menu — start a discussion channel, **message record owner** (company/account owner, opportunity owner, task assignee, or person `createdBy` workspace member), pick **Post to channel** (layout-driven list), confirm navigation with `recordObjectName` / `recordId` / optional `messageDraft`. Use “Share snippet” with text selected; confirm `messageDraft` prefills the composer and param is stripped.
- **Linked list:** `GET /chat/record-links` returns only conversations the viewer can access.
- **Timeline:** After linking or mentioning, confirm new timeline rows on the CRM record (titles `record.chat-linked` / `record.chat-mentioned`).
- **Desktop notify:** Grant notification permission; background the tab; have another user post in a DM/channel you receive notifications for; a system notification should appear (tagged `konnecct-chat`).
- Two browsers on the same channel: send message, reaction, pin; confirm the other tab updates over SSE without waiting for the quiet poll window.
- GIF: open GIF picker, insert, confirm image renders and message persists after reload.
- Emoji: pick a skin-tone sequence from the full picker; reaction saves and appears for the other viewer.
- **Communications:** expand section in CRM drawer, open a channel/DM, confirm main `/chat` thread updates; Details shows members with avatars (no raw UUIDs in UI).
- **Mobile:** open chat, use header list icon to browse conversations, then return to thread.
- **Edit/delete:** send a message, edit from the message menu, confirm text and “edited” label; delete and confirm placeholder + pin removed if pinned.
- **Composer draft:** type in composer, switch channel, return — draft should restore; send clears stored draft.
- **Tab title:** with unread counts, document title should show `(n) …` while on chat; leaving chat removes the prefix.
