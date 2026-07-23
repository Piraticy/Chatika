# Changelog

## v0.4.13 - 2026-07-24

### Changed
- Add a free TURN relay fallback to the default ICE config so calls can connect across restrictive/carrier-grade NATs, not just STUN-reachable networks.
- Auto-detect the push provider by device token type instead of requiring a separate config flag, and fix a VAPID claim format bug - both silently blocked push delivery even with keys configured.
- Show a live last-message preview, relative timestamp, unread badge, and most-recent-first ordering in the conversation list.
- Add an admin-mediated "Forgot password?" flow: a login-screen request queues for review, and admins can set a new password (revoking the user's other sessions).
- Increase touch targets for header icon buttons on mobile to the recommended 44px.

## v0.4.12 - 2026-07-23

### Changed
- Show delivered (2 gray dots) vs read (2 green dots) message status, backed by a new delivery-receipt event.
- Reconnect the realtime socket automatically after a dropped connection instead of going silent until reload; stop reconnecting on every room switch.
- Load the signed-in profile and room list in parallel on startup instead of sequentially.
- Record calls (audio/video, completed or missed, with duration) as messages in the chat.
- Make the in-call speaker toggle actually mute remote audio instead of just lowering its volume.
- Reject a second incoming call with a busy signal while already on a call, instead of stacking the incoming-call UI on top.
- Add automatic reconnect/ICE-restart to screen sharing on connection failure, matching the existing call behavior.

## v0.4.11 - 2026-07-23

### Changed
- Keep signed-in sessions across app restarts with safer refresh-token recovery.
- Open to an unselected conversation dashboard instead of the last chat.
- Add online-user search and privacy-safe country-level nearby discovery.

## v0.1.0 - 2026-05-21

Initial public foundation release of Chatika.

### Added
- Cross-platform stack: FastAPI backend, React web (PWA), React Native mobile scaffold.
- Auth with phone/username registration and long-lived refresh sessions.
- Admin approval/removal/add-user flows.
- Realtime room messaging with websocket transport.
- Presence tracking (online/last seen) synchronized server-side.
- Group call signaling endpoints.
- Media preference (device/app) and media upload endpoint.
- Encrypted backup snapshot create/retrieve endpoints.
- E2EE-ready message payload path and key bundle exchange endpoints.
- Push token registration and provider webhook bridge scaffold.
- TURN/STUN ICE config endpoint for clients.
- Redis-ready multi-instance websocket fanout.
- Alembic migrations and deployment-ready Docker/Render configs.
- Cloudflare + Render + Supabase deployment documentation.

### Notes
- This release is a strong MVP foundation and not full WhatsApp/Telegram parity yet.
- For production scale, next steps include full Double Ratchet E2EE in clients, resilient push workers, and TURN hardening.
