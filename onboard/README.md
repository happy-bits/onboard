# onboard

A minimal onboarding web app: a Superadmin manages Leaders, Leaders invite
Members by email, and Members work through a three-step onboarding checklist
whose progress the Leader can watch.

Stack: Node + Express + EJS (server-rendered, no client framework), Postgres in
Docker, Playwright for integration and end-to-end tests.

## Running it

```bash
npm install
npm run db:up      # Postgres in Docker (project onboard-r7, host port 5473)
npm run db:reset   # empty database + the Superadmin
npm start          # http://127.0.0.1:3317
```

`npm run build` type-checks nothing (there are no types) but does parse the
server and compile every EJS template, so a broken view fails in a second
instead of surfacing later as a mysterious browser timeout.

### Seeded accounts

`npm run db:reset` leaves only the Superadmin, as specified:

| Role       | Email                | Password          |
| ---------- | -------------------- | ----------------- |
| Superadmin | `admin@onboard.test` | `superadmin-pass` |

Other seeds exist for the tests: `npm run db:reset <seed>` where seed is one of
`base`, `superadmin-and-leader`, `two-leaders-one-with-member`,
`member-two-of-three`, `leader-with-three-members`, `pending-invitation`.
Their contents and credentials are in `src/seed.js`.

## Roles

- **Superadmin** — `/admin/leaders`: create and remove Leaders. Creating a
  Leader also creates that Leader's single team.
- **Leader** — `/team`: invite Members by email address, see each Member's
  onboarding progress (`n/3` plus a per-step breakdown), see pending
  invitations. A Leader has exactly one team in this MVP.
- **Member** — `/onboarding`: three hardcoded checkboxes. Checking or unchecking
  one writes to / deletes from the database immediately.

All pages require a login; sessions are an HttpOnly cookie backed by an
in-process session map.

## Email

`src/email.js` is a **fake** email service: instead of sending, it appends each
message to `var/mail/outbox.json`. Swap the body of `sendEmail` for a real
transport later — nothing else needs to change. Invitation links are the only
mail the app sends.

## Invitations

An invitation token is derived deterministically from `(team, email, nth
invitation for that pair)` rather than drawn at random, so seeds and dumps are
reproducible. Accepting an invitation marks it `accepted` and creates the Member
in a single transaction, so **a link cannot be redeemed twice** even under
concurrent requests; a second visit gets HTTP 410 and an "already been used"
page.

## Deleting a Leader — cascade

Documented decision, exercised by e2e test 3 and
`tests/integration/cascade.spec.js`: removing a Leader **cascade-deletes**
everything the Leader owned — their team, that team's Members, those Members'
onboarding progress, and the team's invitations. Nothing is left as an orphan. The foreign keys in `src/schema.sql` enforce this,
so a plain `DELETE FROM users` is enough.

## Database dumps

`src/dump.js` dumps every table and row, ordered by id:

```bash
npm run dump                 # to stdout
npm run dump -- out.json     # to a file
```

The same dump is served at `GET /__test/dump` when test support is enabled.

## Tests

```bash
npm test   # everything: 17 unit + 93 integration + 5 e2e
```

`pretest` brings Postgres up first, so that one command is enough from cold.

The suite follows a **mixed ("testing trophy") strategy** — weight in the
middle, thin at both ends:

| Layer | Count | What it touches | Runner | Time |
| --- | --- | --- | --- | --- |
| Unit | 17 | Pure functions only. No DB, no HTTP | `node --test` | ~0.3s |
| **Integration** | **93** | **Real Postgres, real HTTP, no browser** | Playwright `request` | **~12s** |
| E2E | 5 | Full user journeys through Chromium | Playwright + browser | ~3s |

The middle layer carries the weight because that is where this app's bugs live:
it is mostly glue between HTTP, templates and SQL, so almost nothing is
algorithmic enough to unit-test, and driving a browser to assert "a short
password leaves the invitation pending" costs 400ms instead of 20ms.

```bash
npm run test:unit          # fastest feedback, no infrastructure
npm run test:integration   # the bulk of the coverage
npm run test:e2e           # the five user journeys
npm run test:ui            # Playwright UI mode: pick tests, watch, time-travel
npm run test:headed        # watch the e2e journeys in a visible browser
```

Everything except `test:unit` needs Postgres up (`npm run db:up`); Playwright
starts the app server itself. Re-running any single test is safe — each one
resets the database to a named seed first.

> **Deviation from `mvp.md`:** the spec said "do not create any unit tests".
> That was later overridden in favour of this mixed strategy. The five mandated
> e2e tests are unchanged.

### What each layer covers

- **Unit** (`tests/unit/`) — `inviteToken` determinism and collision-freedom,
  `hashPassword`/`verifyPassword`, `homePathFor`, the step registry.
- **Integration** (`tests/integration/`) — the full authorization matrix (every
  protected route × every role that must not reach it), login and session
  lifecycle including replay-after-logout and sessions whose user was
  cascade-deleted, leader CRUD and its guards, the invitation lifecycle
  including single-use enforcement, progress idempotency, cascade depth, and
  seed reproducibility.
- **E2E** (`tests/e2e/`) — the five happy-path journeys below.

All Playwright tests run on one worker: they share a database and each resets it
to a named seed first. Playwright starts the server with
`ONBOARD_TEST_SUPPORT=1`, which enables three endpoints that do not exist in a
normal run: `POST /__test/reset?seed=…`, `GET /__test/dump` and
`GET /__test/emails`.

#### Testing the invitation claim

`tests/integration/invitation-claim.spec.js` is worth reading as a cautionary
example. The obvious test — fire two requests at one invite link and assert only
one account appears — **passes even when the `AND status = 'pending'` predicate
is deleted**. The race window is under a millisecond, so the second request
arrives after the first has committed and is caught by the handler's cheap
pre-check rather than by the claim. Ten parallel requests behave the same way.

The claim therefore lives in `claimInvitation()` so a test can drive two
transactions directly and interleave them by hand. That version does fail when
the predicate is removed. The HTTP-level test is kept, but only claims the
user-visible invariant.

### The e2e layer

Every e2e test ends by verifying the whole database twice over: explicit
assertions about the rows that should exist, and a strict comparison of the full dump
against a checked-in file in `tests/expected/`. **A missing expected file fails
the test** — it is never written during a normal run, because a snapshot helper
that records itself on first use passes trivially and proves nothing. Record one
deliberately, then read the diff:

```bash
UPDATE_DUMPS=1 npx playwright test   # writes tests/expected/*.json, then fails
npx playwright test                  # the real comparison
```

The actual dump of each run is also written to `var/dumps/` for inspection.

### Determinism

Seed data uses fixed ids, fixed passwords, content-derived invitation tokens and
one fixed timestamp (`src/clock.js`) — no randomness, no wall clock — so dumps
are byte-identical between runs.

That fixed instant is in the past, and it is confined to database rows on
purpose. It must never reach a value an external client judges for itself
(cookie `Expires`, `Cache-Control`, `Retry-After`), because the client would see
it as already expired and silently discard it. Session cookies therefore carry a
relative `Max-Age`.

One deliberate MVP shortcut: password salts are derived from the email rather
than random, so that seeded password hashes are stable in the dump. A real
deployment should use a random salt and redact the hash from the dump instead.

## Docker

`docker-compose.yml` claims names and a port unlikely to collide with anything
else on the machine: compose project `onboard-r7`, container `onboard-r7-pg`,
volume `onboard-r7-pgdata`, host port **5473**. If you fork this, change all
four together — leftover stacks from earlier attempts collide silently on every
one of them.

```bash
npm run db:up     # docker compose up -d --wait
npm run db:down   # stop (keeps the volume)
```
