# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

The repo root holds `mvp.md` — the full MVP specification for the app and a record of decisions taken during
implementation. Read it before changing behavior; it is the source of truth for intended semantics.

All code lives in `onboard/` (a Next.js 16 app). Run every command below from `onboard/`.

`onboard/AGENTS.md` (imported by `onboard/CLAUDE.md`) warns that this Next.js version differs from training data —
consult `onboard/node_modules/next/dist/docs/` before writing framework code.

## Commands

```bash
docker compose up -d              # Postgres 16 on host port 5434 (5432/5433 taken locally)
npx prisma migrate dev            # apply prisma/schema.prisma
npm run dev                       # http://localhost:3000
npm run lint                      # eslint (flat config)
npm run seed                      # truncate + seed Superadmin only
npm run seed superadmin+leader    # truncate + seed Superadmin and Leader
npm run dump [outfile]            # whole DB as JSON (stdout if no outfile)

npx playwright install chromium   # first time only
npm run test:e2e                  # all E2E tests
npx playwright test tests/onboarding.spec.ts   # a single test file
npx playwright test -g "leader invites"        # a single test by name
```

Playwright starts `npm run dev` itself with `TEST_MODE=1` and reuses an already-running server outside CI — a dev
server you started manually **without** `TEST_MODE=1` will make the deterministic tests fail. Tests run with
`workers: 1`, non-parallel, because each one truncates and reseeds the shared database.

Seeded credentials: `admin@onboard.local` / `admin123`, and `leader@onboard.local` / `leader123` in the
`superadmin+leader` scenario.

## Architecture

Single Next.js App Router app; no separate backend. Server components in `app/*/page.tsx` read the database directly
via Prisma and enforce the role gate (`currentUser()` then `redirect`), then hand data to a `"use client"` child
component that talks to `app/api/*` route handlers. Every route handler re-checks the role server-side — the page
gate is not the authorization boundary.

Roles are `SUPERADMIN` → `/superadmin`, `LEADER` → `/leader`, `MEMBER` → `/onboarding` (see `homeFor()` in
`lib/auth.ts`). A Leader has exactly one `Team`, created automatically when the Superadmin creates the Leader and
named `Team <email>`; deleting a Leader cascades to team, members, invitations, progress and sessions via
`onDelete: Cascade` in the schema.

Auth is a server-side session: an opaque token in the httpOnly `onboard_session` cookie, one `Session` row per login.
Passwords are `scrypt` with the salt stored inline as `<salt-hex>:<hash-hex>`.

Live progress on the Leader dashboard is SSE: `app/api/leader/stream/route.ts` polls the team's members every 300 ms
and enqueues a `data:` frame only when the JSON snapshot changes; `LeaderDashboard` consumes it with `EventSource`.

Email is faked — `lib/email.ts` writes rows to the `Email` table, readable at `/dev/inbox`. Tests (and humans) get
invitation links from there. Invitations are single-use with 24h expiry; re-inviting an email deletes that team's
pending invitation and issues a new one.

### Determinism (the part to be careful with)

The E2E tests assert the **entire** database dump against a literal expected object, so anything nondeterministic
breaks them. Test mode is `TEST_MODE=1` and is checked through `TEST_MODE` exported from `lib/clock.ts`:

- `lib/clock.ts` — never call `new Date()`/`Date.now()` in app code; use `now()`. In test mode time is frozen at
  `2026-01-01T00:00:00Z` plus an in-process offset, advanced via `POST /api/dev/clock` (404s outside test mode).
- `lib/tokens.ts` — invitation and session tokens become `invite-token-N` / `session-token-N` (derived from row
  count) instead of random bytes.
- `lib/password.ts` — fixed salt, so hashes are reproducible.

The clock offset and the deterministic counters live in module/global state inside the dev server process, so they
reset when it restarts.

Note that `scripts/seed.ts` and `tests/helpers.ts` each duplicate the fixed salt and hashing — they run outside the
Next.js module graph. Change `lib/password.ts`'s scheme and all three must be updated together.

`scripts/dump.ts` (`dumpDatabase()`) and `scripts/seed.ts` (`seed()`, `resetDatabase()`) are importable as well as
CLI-callable; the tests shell out to them through `tests/helpers.ts`. Both use `createPrismaClient()` rather than the
shared `prisma` singleton. `dumps/` is gitignored test output.

Prisma 7 requires an explicit driver adapter (`PrismaPg`) — see `lib/db.ts`; the datasource URL comes from
`prisma.config.ts`, not from `schema.prisma`.

### Test data attributes

The dashboard exposes `data-testid` hooks (`invitation-list`, `member-list`, `member-<email>`, `progress-<email>`).
Keep them when editing `LeaderDashboard.tsx`; the specs select on them.
