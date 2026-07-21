# Chatika

A unique, privacy-focused, cross-device chat room platform foundation for Web + Mobile with admin controls, sync, backups, media preferences, and multi-user calling flow support.

## What is already built
- Cross-platform architecture (`backend`, `web`, `mobile`)
- Real-time messaging and presence (`online` + `last seen` enforced server-side)
- Redis-ready multi-instance websocket fanout
- Username-first registration/login with long-lived session model
- Self-service registration with instant access and explicit logout on web/mobile
- Admin approval/removal flow for users
- Admin global user directory with online, approval, and removal controls
- Group-ready call room signaling endpoints
- TURN/STUN delivery endpoint (`/realtime/ice-config`) for call setup
- E2EE-ready payload path (ciphertext + per-user key bundle exchange)
- Push token registration and provider webhook bridge
- Encrypted backup snapshot create/retrieve endpoints
- Media storage preference: `device` or `app`
- Distinct custom brand assets (`web/public/logo.svg`, `web/public/favicon.svg`)
- Mobile-first full-screen friendly UX and PWA standalone mode on web
- Install prompt and service-worker update flow for the web app

## Repository Structure
- `backend/`: FastAPI API and WebSocket realtime server
- `web/`: React + Vite web client (PWA)
- `mobile/`: React Native (Expo) mobile client
- `docs/`: architecture and deployment guidance
  - `docs/DEPLOY_STEPS.md`: step-by-step no-cost starter deployment path

## Local Development

### 1) Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

### 2) Web
```bash
cd web
cp .env.example .env
npm install
npm run dev
```

### 3) Mobile (Expo)
```bash
cd mobile
cp .env.example .env
npm install
npm run start
```

### 4) Run with Docker Compose (API + Web)
```bash
docker compose up --build
```

Open the local web app at `http://localhost:5173`. The API is available at `http://localhost:8000`, with health status at `http://localhost:8000/api/v1/health`.

## API Highlights
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `POST /api/v1/chat/rooms`
- `GET /api/v1/chat/rooms`
- `POST /api/v1/chat/messages`
- `GET /api/v1/chat/rooms/{room_id}/messages`
- `PUT /api/v1/keys/me`
- `GET /api/v1/keys/bundle/{target_user_id}`
- `POST /api/v1/push/register-token`
- `POST /api/v1/push/unregister-token`
- `PUT /api/v1/media/preference`
- `POST /api/v1/media/upload`
- `POST /api/v1/backup/create`
- `GET /api/v1/backup/latest`
- `POST /api/v1/calls/start`
- `POST /api/v1/calls/join`
- `POST /api/v1/admin/approve-user`
- `GET /api/v1/admin/users`
- `POST /api/v1/admin/remove-user`
- `GET /api/v1/realtime/ice-config`
- `WS /api/v1/realtime/ws?token=<access_token>`

## Production Steps Next
1. Swap webhook push bridge to direct FCM/APNs workers.
2. Rotate TURN credentials dynamically (short-lived signed creds).
3. Move one-time prekeys to dedicated table with atomic claim transactions.
4. Add abuse controls: per-user rate limits, spam scoring, audit log.
5. Add formal end-to-end protocol (Double Ratchet) in clients.
6. Add observability stack (Sentry, metrics, traces, alerts).

## Free Hosting

The root `render.yaml` provisions the FastAPI API and the Vite static web app on Render. Use Supabase Postgres for durable free starter storage, set the secrets in Render, and deploy the Blueprint. See `docs/DEPLOY_STEPS.md` for the complete setup.

## Security Notes
- Replace `.env` secrets in production.
- Enforced presence visibility is currently hardcoded (can be changed if policy/legal requirements demand).
- Backups are encrypted at rest using server-side key material; for full privacy, use client-side encryption keys.
