# onboard

Onboarding MVP: Superadmin → Leaders → Members, with a 3-step onboarding checklist.

Stack: Node.js + Express (server-rendered HTML), Postgres in Docker, Playwright for end-to-end tests.

## Run the app

```sh
npm install
npm run dev          # starts Postgres (Docker), creates schema + Superadmin seed, runs app on :3000
```

- App: http://localhost:3000 — log in as `superadmin@onboard.local` / `superadmin`
- Fake mailbox (sent invitation emails): http://localhost:3000/dev/mailbox

## Database

| Command | What it does |
| --- | --- |
| `npm run db:up` / `db:down` | Start / stop Postgres (port 55432) |
| `npm run db:setup` | Create schema; seed Superadmin if the DB is empty |
| `npm run db:reset [-- with-leader]` | Wipe everything and re-seed (`base` = only Superadmin) |
| `npm run db:dump [-- file.json]` | Export all tables and rows to `db-dump.json` |

Seed data is fully deterministic (fixed ids, timestamps and password salts).

## Tests

```sh
npx playwright install chromium   # first time only
npm run test:e2e                  # headless
npm run test:e2e:ui               # Playwright UI mode
```

Tests run against a separate `onboard_test` database on a server at port 3100 (started automatically).
Each test resets the DB to a known seed, runs the flow and compares a full DB dump (attached to the
test report as `db-dump.json`) against the expected rows.

## Email

`src/email.js` contains `FakeEmailService` (in-memory + console log). Replace it with a real
provider by implementing the same `send({ to, subject, text, html })` method in `src/server.js`.
