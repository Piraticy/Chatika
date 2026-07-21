# Free Deployment Paths

## Option A (Best free start)
- Backend API + web app: one Render free Docker service from the root `render.yaml`.
- Database: Supabase Postgres is the recommended persistent free database.
- Alternative web host: Cloudflare Pages free with `web` as the project root.

## Option B (single-vendor with strict limits)
- API + web functions: Cloudflare Workers/Pages (fast edge, request/cpu limits on free plan).

## Option C (experimental)
- Railway Free has low monthly credit; good for demo only.

## Important
- Free tiers change often and are not ideal for heavy production traffic.
- For video quality and stable global calls, you will eventually need paid TURN infra and predictable compute.
- Render free web services sleep after inactivity and local files are ephemeral; do not use SQLite or local media storage for production data.
- Render free Postgres is suitable for short-lived previews only; it expires after 30 days, so use Supabase for a durable free starter database.
