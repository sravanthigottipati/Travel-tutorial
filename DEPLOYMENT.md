# Deployment

Target: **Vercel** (application) + **Supabase** (PostgreSQL), per the project
documentary's Section 25. This document is the Section 25.1 production
checklist, made concrete for this codebase.

None of the steps below have been run against a real Vercel/Supabase
account — they need your credentials, which this session doesn't have.
Everything on the codebase side (migrations, config, CI) is ready; this
is the remaining manual part.

## 1. Provision Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Copy the **connection string** (Project Settings → Database →
   Connection string → URI). Use the **pooled** connection string (port
   6543, `?pgbouncer=true`) for the app's `DATABASE_URL` if you expect
   concurrent serverless function invocations — Vercel functions are
   short-lived and can exhaust direct Postgres connections quickly
   without a pooler.

## 2. Run the initial migration

The schema has a real migration history (`prisma/migrations/`), not just
`db push` — this is what production deploys should use:

```bash
DATABASE_URL="<your supabase connection string>" npx prisma migrate deploy
```

Run this once before the first deploy, and again after any future schema
change (`prisma migrate dev` locally to create a new migration file first,
then `migrate deploy` against production).

## 3. Set environment variables in Vercel

Project Settings → Environment Variables. See `.env.example` for the full
list; at minimum:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Supabase pooled connection string |
| `AUTH_SECRET` | Generate with `openssl rand -base64 32` — a fresh one, not the local dev value |
| `GROQ_API_KEY` | Leave as the placeholder to keep the app in stub mode, or set a real key to enable actual AI responses (see Section 9) |

`AUTH_URL` / `NEXTAUTH_URL` are **not** needed — `trustHost: true`
(`src/lib/auth/auth.config.ts`) makes Auth.js trust the `X-Forwarded-Host`
header Vercel's edge network sets, so callback URLs resolve to the real
domain automatically. This is safe specifically because Vercel is a
trusted proxy in front of the app; don't rely on `trustHost` if you ever
deploy this somewhere directly exposed to the internet without a proxy.

## 4. Deploy

Connect the GitHub repo in Vercel, or `vercel deploy` from the CLI.
`npm run build` already runs `prisma generate` first (see `package.json`),
so the generated Prisma client matches the schema at build time.

## 5. Post-deploy checklist (Section 25.1)

- [ ] Environment variables set (step 3).
- [ ] Migration applied (step 2) — verify with `GET /api/health`
      (returns `{"status":"ok","database":"ok"}` when the app can reach
      the database).
- [ ] No debug output containing secrets — confirmed clean in Phase 11's
      security audit (no `console.log`/`console.error` calls anywhere in
      `src/`); re-check if that changes.
- [ ] Domain configured in Vercel, and it resolves correctly for
      `/api/auth/*` callback routes (test an actual login).
- [ ] Error monitoring: not wired up. Sentry is listed as optional in
      Section 9 and needs a DSN this project doesn't have — see
      "Error monitoring" below if you want to add it.
- [ ] AI endpoint rate limits: `POST /api/chat` is capped at 20
      requests/minute/user (`src/lib/security/rate-limit.ts`). **This
      limiter is in-memory and per-instance** — on Vercel, each
      serverless function invocation may be a different instance, so the
      limit won't hold precisely across concurrent load. For real
      production traffic, replace it with a shared store (Upstash Redis
      is a natural fit — see "Rate limiting at scale" below).
- [ ] Map/weather API usage: Open-Meteo (weather) and OpenStreetMap tile
      servers (map) are both free, keyless services with fair-use
      policies, not hard rate limits — reasonable for this project's
      scale, but check their current usage policies before high-traffic
      production use:
      [Open-Meteo terms](https://open-meteo.com/en/terms),
      [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
      At meaningful scale, switch to a paid tile provider.
- [ ] End-to-end smoke test: `npm run test:e2e` runs against a throwaway
      local database, so it doesn't smoke-test the actual deployment.
      After deploying, manually walk through: register → describe a trip
      in chat → generate itinerary → view budget, or point
      `PLAYWRIGHT_TEST_BASE_URL` at the deployed URL and adapt the suite
      to run against it with a real (careful — not throwaway) database.

## Rate limiting at scale

`checkRateLimit()` uses an in-memory `Map`, documented in
`src/lib/security/rate-limit.ts` as single-instance only. If/when this
matters (real multi-instance production traffic), swap it for
Upstash Redis (already the documented "optional later-stage component"
in Section 9) — `checkRateLimit`'s signature (key, limit, windowMs) is
designed to be a drop-in swap for a Redis-backed sliding window without
touching any of its callers.

## Error monitoring

Not implemented — Section 9 lists Sentry as optional, and it needs a real
DSN (another credential this project doesn't have, same reasoning as
Groq/Supabase throughout). To add it:

```bash
npx @sentry/wizard@latest -i nextjs
```

Then set `SENTRY_DSN` in Vercel's environment variables. Nothing else in
the codebase needs to change — errors thrown in Route Handlers and Server
Components are already just thrown, not swallowed, so Sentry's Next.js
SDK picks them up automatically once installed.

## CI

`.github/workflows/ci.yml` runs lint, unit tests, build, and the
Playwright E2E suite on every push/PR — all self-contained (placeholder
env vars for the build job, a throwaway SQLite database for E2E), so it
runs without any of the secrets above being configured in GitHub.
