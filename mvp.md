# Onboarding Project – MVP Specification

A web project called `onboard`, located in a folder named `onboard`.

## Overview

An onboarding system with three user types:

- **Superadmin** – can create and remove Leaders.
- **Leader** – can invite Members to their team and view their onboarding progress. A Leader has exactly one team.
- **Member** – joins a Leader's team via an email invitation and completes an onboarding process.

All users must log in to use the system.

## Tech Stack

- **Framework:** Next.js (full-stack — React frontend, API routes, server-side auth in one app)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (no component library)
- **Database:** Postgres, running in Docker
- **ORM:** Prisma
- **E2E testing:** Playwright

## Authentication

- Email + password login with hashed passwords and server-side sessions (session cookie).
- No self-registration except via invitation links (Members) — Leaders are created by the Superadmin, and the Superadmin is seeded.

## User Flows

### Superadmin

- Logs in and can create and remove Leaders.
- Removing a Leader **cascade deletes** everything belonging to them: their team, Members, invitations, and onboarding progress.

### Leader

- Logs in and can invite Members by entering an email address; an invitation email with a link is sent (via the fake email service).
- Views each Member's onboarding progress on a dashboard.
- Progress updates in **realtime** on the Leader's dashboard using **Server-Sent Events (SSE)** — no manual refresh needed.
- A Leader can have only one team.

### Member

- Follows the invitation link in the email, creates an account (sets a password), and then belongs to the inviting Leader's team.
- When logged in, sees the onboarding page: **three hardcoded checkboxes**.
- Checking checkboxes records progress, which the Leader can see.

## Invitations

- **Single-use** tokens with a **24-hour expiry**.
- Once an account is created from an invitation, its token is consumed and cannot be reused.

## Email

- The email service is **faked** (to be replaced with a real one later).
- Sent emails are **stored in the database** and viewable in a simple **dev inbox page** in the app.
- Playwright tests and humans can open the inbox to read invitation links; emails also appear in the DB dump.

## Time / Injectable Clock

- The app reads time through a **Clock service** rather than calling the system clock directly (needed for invitation expiry while keeping tests deterministic).
- Controlled via **env var + test endpoint**: in test mode the clock starts at a fixed instant (e.g. `2026-01-01T00:00:00Z`), and a dev-only endpoint can advance it.
- In production mode the clock is the real system time.

## Determinism

Determinism is enforced **in test mode only** (behind a TEST flag):

- Sequential/predictable IDs.
- Predictable invitation tokens (e.g. `invite-token-1`).
- Fixed clock (see above).
- Fixed-salt password hashing so hashes are reproducible.

This makes DB dumps byte-identical across test runs. Production code paths use proper randomness.

All seed data is identical every time — no random numbers, no current time.

## Database

- Postgres via Docker.
- The database starts **empty except for a Superadmin user**, created by a **fixed seed script** with hardcoded credentials (e.g. `admin@onboard.local` + fixed password).

### Database dump / verification

- A Node script (also callable from Playwright) reads **all tables via Prisma** and exports the entire database to a **single JSON file** (all tables and rows).
- After each E2E test, the dump is compared against the expected state.

## Testing

- **No unit tests.** Only the following happy-path end-to-end tests, using Playwright.
- Between tests, the database is reset by **truncating all tables and re-running the deterministic seed** for that test's starting state, against the Docker Postgres.

### Test 1

1. Start with an empty database except for the Superadmin account.
2. Log in as the Superadmin and create two Leaders.
3. Verify the database via the JSON dump.

### Test 2

1. Start with a database containing one Superadmin and one Leader.
2. Log in as the Leader and invite two people.
3. One invitee follows the invitation link (read from the dev inbox), creates an account, and sees the onboarding page with the three checkboxes.
4. The Member checks the boxes one by one, and the Leader sees the progress update (via SSE).
5. Verify the database via the JSON dump.

## Docker

- Docker (docker-compose) is used for the Postgres database.

## Decisions taken during implementation

These were open questions; resolved as follows while building:

- **Docker scope:** only Postgres runs in Docker. The Next.js app and Playwright run locally against it. Postgres is published on host port **5434**, because 5432 and 5433 were already taken by local Postgres installations on the dev machine.
- **Re-invite behavior:** re-inviting the same email replaces (deletes) any pending invitation for that team and sends a new one. Inviting an email that already has an account is rejected. A Member belongs to exactly one team.
- **Role views:** minimal. The Superadmin manages Leaders only. The Leader sees their invitations (pending/accepted) and each Member's progress as a count (e.g. `2/3`). The Member sees only their own checklist.
- **Teams:** an explicit `Team` entity, auto-created when the Superadmin creates a Leader, named deterministically as `Team <leader email>`. There is no team-management UI.
