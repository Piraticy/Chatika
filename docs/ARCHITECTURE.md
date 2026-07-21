# Chatika Architecture (MVP -> Production)

## Core Stack
- Backend: Python + FastAPI + SQLAlchemy
- Web: React + Vite + PWA (standalone full-screen)
- Mobile: React Native (Expo)
- Realtime: WebSocket events + WebRTC signaling hooks

## Feature Coverage in this Foundation
- Username-first registration/login with optional legacy phone data
- Long-lived sessions via refresh tokens (so users do not keep logging in)
- Admin approval channel (approve/remove users)
- Admin global directory (all registered accounts, online status, approve/remove controls)
- Presence tracking (online + last seen)
- Room-based messaging
- Call room signaling (group-capable)
- TURN/STUN ICE config delivery endpoint for clients
- Media storage preference (device or app storage)
- Backup snapshot creation and retrieval (encrypted server-side payload)
- Redis-ready websocket fanout for multi-instance deployments
- E2EE-ready ciphertext message path and key bundle exchange API
- Push token registration API and outbound push webhook bridge

## Why this architecture
- Shared backend supports mobile + web sync.
- Local-first UI with server events improves message speed.
- Token/session model enables "register once, use continuously" experience.

## Scale Path
1. Replace SQLite with PostgreSQL.
2. Add Redis for pub/sub + presence fanout.
3. Add push notifications (FCM/APNs/Web Push).
4. Add TURN/STUN (coturn) for reliable global call quality.
5. Add CDN object storage for media at scale.
6. Move key bundles to one-time prekey relational model + Double Ratchet in clients.
