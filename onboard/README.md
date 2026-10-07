# Onboard

Onboarding MVP with three roles: Superadmin, Leader, Member.

## Getting started

```bash
cp .env.example .env          # DATABASE_URL for the Docker Postgres
docker compose up -d          # Postgres on localhost:5434
npx prisma migrate dev        # apply the schema
npm run seed                  # Superadmin only
npm run dev                   # http://localhost:3000
```

Seeded credentials: `admin@onboard.local` / `admin123`.
The `superadmin+leader` seed scenario also creates `leader@onboard.local` / `leader123`.

```bash
npm run seed superadmin+leader
```

Postgres is published on host port **5434** to avoid clashing with local
Postgres installations already using 5432/5433.

## What each role can do

- **Superadmin** (`/superadmin`) — create and remove Leaders. Creating a Leader
  automatically creates their single team; removing a Leader cascade deletes the
  team, its members, invitations and progress.
- **Leader** (`/leader`) — invite Members by email and watch their onboarding
  progress update live over SSE.
- **Member** (`/onboarding`) — four hardcoded onboarding checkboxes.

Invitations are single-use and expire after 24 hours. Re-inviting the same email
replaces any pending invitation for that team.

## Fake email service

Emails are not sent anywhere; they are stored in the `Email` table and readable
in the dev inbox at [`/dev/inbox`](http://localhost:3000/dev/inbox). Invitation
links are found there.

## Database dump

```bash
npm run dump                  # print the whole database as JSON
npm run dump dumps/now.json   # or write it to a file
```

## Tests

Playwright end-to-end tests only, no unit tests:

```bash
npx playwright install chromium   # first time only
npm run test:e2e
```

Each test seeds its own starting state (truncate + deterministic seed) and
asserts the full database dump afterwards.

Determinism in test mode (`TEST_MODE=1`) makes those dumps byte-identical
between runs:

- the clock is frozen at `2026-01-01T00:00:00Z` (`lib/clock.ts`), adjustable via
  `POST /api/dev/clock`
- invitation and session tokens are sequential (`invite-token-1`, …)
- password hashing uses a fixed salt

Production paths use the real clock and real randomness.
