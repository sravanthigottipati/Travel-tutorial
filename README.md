# AI Travel Planner

A conversational travel-planning app: describe a trip in plain language
and get a structured trip, a day-wise itinerary, a deterministic budget
breakdown, and constraint-aware recommendations — built following the
phased plan in `AI_Travel_Planner_Project_Documentary.docx` (Sections
7–13 describe the architecture this follows).

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS · shadcn/ui ·
Prisma · PostgreSQL (Supabase) · Auth.js · Groq (Qwen3 32B) · Leaflet/
OpenStreetMap · Open-Meteo · Zod · Vitest · Playwright.

## Architecture, in one sentence

The AI handles language understanding and decides which tool to call;
deterministic backend code does every calculation, persists every write,
and validates every AI-generated value before it's trusted — see
`src/lib/ai/tools.ts` for the controlled tool set and
`src/lib/ai/trip-context.ts` for how AI-generated JSON gets validated
field-by-field rather than trusted wholesale.

## Getting started

```bash
npm install
cp .env.example .env   # fill in real values, or leave the placeholders to run in stub mode
npx prisma migrate deploy   # or `prisma db push` for a scratch/dev database
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Running without real credentials

`GROQ_API_KEY` left as the `.env.example` placeholder puts the app in
**stub mode**: chat responses come from a heuristic extractor/responder
instead of a real LLM call, and tool orchestration falls back to
intent + regex-based dispatch instead of Groq function-calling. This
exercises the same persistence, UI, and tool-execution code paths a real
key would — see `src/lib/ai/groq-client.ts` (`isGroqStubbed()`) and
`src/lib/ai/agent.ts`. Every other feature (auth, trips, itineraries,
budgets, weather, maps) needs no credentials beyond a Postgres database.

## Testing

```bash
npm run test       # Vitest — unit tests, no database needed
npm run test:e2e   # Playwright — full app + a throwaway local database, no Supabase needed
```

`test:e2e` provisions its own SQLite database for the run (see
`tests/e2e/global-setup.ts`) and restores your real `prisma/schema.prisma`
and `.env` afterward — safe to run against a working copy with real
Supabase credentials configured.

## Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Vercel + Supabase, mirroring the
documentary's Section 25.1 production checklist.

## Project structure

- `src/lib/planner/` — trip CRUD, the itinerary-generation engine (Section 15.1's pipeline)
- `src/lib/budget/` — deterministic budget calculation (Section 16)
- `src/lib/recommendations/` — rules-based recommendation engine + personalization (Sections 17, Phase 10)
- `src/lib/weather/` — real Open-Meteo integration (Section 18)
- `src/lib/ai/` — chat orchestration, entity extraction, the tool layer, and the agent that decides when to call a tool (Sections 13–14, Phase 9)
- `src/lib/auth/` — Auth.js configuration, split into an edge-safe config (for the proxy) and the full Node config (Prisma/bcrypt)
- `prisma/schema.prisma` — the data model (Section 19)
- `tests/` — Vitest unit tests; `tests/e2e/` — the Playwright suite
