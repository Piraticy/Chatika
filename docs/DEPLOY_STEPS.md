# Deploy Steps (Render + Cloudflare + Supabase)

## Topology
- API: Render Web Service (Docker)
- Database: Supabase Postgres
- Web: Cloudflare Pages
- Redis (optional but recommended): Upstash Redis or Render Redis
- TURN/STUN (recommended for production calls): coturn on a VM (Oracle Always Free starter)

## 1) Supabase setup
1. Create a new Supabase project.
2. Click `Connect` in the Supabase dashboard and select the **Session pooler** connection string.
3. Copy the complete URI, replace `[YOUR-PASSWORD]` with the database password, and URL-encode special characters in that password.
4. Save this as `DATABASE_URL` in Render without changing the pooler hostname or username.

The Render/Supabase URI should have this shape:
```text
postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-<REGION>.pooler.supabase.com:5432/postgres?sslmode=require
```

Use the Session pooler URI on port `5432`, not a manually assembled URL. An error containing
`ENOTFOUND tenant/user` means the pooler hostname and `postgres.<PROJECT_REF>` username do not belong together, or the project is no longer available.

## 2) Render API + web setup
1. In Render dashboard, click `New +` then `Blueprint`.
2. Connect your GitHub repo and select this repository.
3. Apply the root `render.yaml`. It creates:
   - `chatika-api`: Docker FastAPI service from `backend`
   - `chatika-web`: free static site from `web`
4. Add environment variables:
   - `DATABASE_URL` = Supabase connection string
   - `AUTO_CREATE_SCHEMA` = `false`
   - `JWT_SECRET` = long random secret
   - `BACKUP_ENCRYPTION_KEY` = long random secret
   - `REDIS_URL` = your redis URL (optional but recommended)
   - `FORCE_TURN` = `false` initially
   - `ICE_SERVERS` = JSON array (see below)
5. Deploy the blueprint. The web build already points at `https://chatika-api.onrender.com/api/v1`; update `VITE_API_URL` if you rename the API service.

The Render API URL is available at `/api/v1/health`; the static web site gets its own `onrender.com` URL.

### ICE_SERVERS example
Use a JSON array string in Render env var:
```json
[{"urls":["stun:stun.l.google.com:19302"]}]
```

If you add TURN later:
```json
[
  {"urls":["stun:stun.l.google.com:19302"]},
  {"urls":["turn:YOUR_TURN_DOMAIN:3478"],"username":"TURN_USER","credential":"TURN_PASS"}
]
```

## 3) Run database migration
Render Docker command already runs:
```bash
alembic upgrade head
```
No manual DB migration step is needed if deployment command remains unchanged.

## 4) Cloudflare Pages web deploy (alternative)
1. In Cloudflare dashboard, open `Workers & Pages`.
2. Click `Create` then `Pages` then `Connect to Git`.
3. Choose this repository.
4. Configure build:
   - Root directory: `web`
   - Build command: `npm run build`
   - Output directory: `dist`
5. Add environment variable:
   - `VITE_API_URL` = `https://<your-render-service>.onrender.com/api/v1`
6. Deploy.

## 5) Mobile setup
1. In `mobile/.env` set:
   - `EXPO_PUBLIC_API_URL=https://<your-render-service>.onrender.com/api/v1`
2. For production OTA updates, run `eas update:configure`, link the Expo project, and publish updates with the same `runtimeVersion`.
3. Start and test:
```bash
cd mobile
npm install
npm run start
```

## 6) Optional Redis for multi-instance realtime
- Set `REDIS_URL` in Render.
- Redeploy API.
- Websocket fanout across instances becomes active automatically.

## 7) Optional push pipeline
- Keep `PUSH_PROVIDER=none` for now.
- To enable push bridge:
  - `PUSH_PROVIDER=webhook`
  - `PUSH_WEBHOOK_URL=https://<your-push-worker>/send`

## 8) Optional TURN for better call quality
1. Deploy coturn on VM.
2. Open UDP/TCP 3478.
3. Add TURN entry in `ICE_SERVERS`.
4. Set `FORCE_TURN=true` once verified.

## 9) Free-tier caveats
- Render free web services sleep when idle (cold start).
- Supabase free has storage/compute limits.
- Cloudflare Pages free has build/function/request limits.
- Redis free tiers have request/storage caps.
