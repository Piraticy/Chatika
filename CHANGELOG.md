# Changelog

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
