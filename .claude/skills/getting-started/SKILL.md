---
name: getting-started
description: Help a new user get the onboard app running and understand how it's put together. Use when the user is new to the project, asks how to get started, how to run the site, or how to log in.
---


Orient a new user: confirm their environment is healthy, tell them exactly what to run and how to log in, explain how
the pieces fit together, and flag anything about their git state that could bite them. This skill only **informs** —
it never fixes anything, seeds data, or starts the site itself.


## Steps


1. Invoke the `troubleshoot` skill and present its findings first (it already knows how to run and format the
  diagnostic checks — don't duplicate its logic).
2. Check the user's git state and warn if needed:
  - Run `git branch --show-current`. If it isn't `start`, warn the user they're not on the `start` branch and name
    the branch they're actually on.
  - Run `git status --porcelain`. If it isn't empty, warn the user they have uncommitted changes (mention roughly
    how many files).
3. Show the commands to get running, in order, with a one-line reason for each:
  ```bash
  docker compose up -d              # starts Postgres 16 (host port 5434)
  npx prisma migrate dev            # applies prisma/schema.prisma to the database
  npm run seed superadmin+leader    # wipes and reseeds a Superadmin + Leader (+ their team)
  npm run dev                       # starts the app at http://localhost:3000
  ```
  All of these are run from `onboard/`. Skip any step the troubleshoot results already show as satisfied (e.g.
  don't tell them to run `docker compose up -d` if Postgres is already reported running), but still show the full
  sequence so they have the complete picture.
4. Give the login credentials:
  - Superadmin: `admin@onboard.local` / `admin123` → lands on `/superadmin`
  - Leader (only exists after seeding `superadmin+leader`): `leader@onboard.local` / `leader123` → lands on
    `/leader`
5. Briefly explain the shape of the app so the information is educational, not just a command list:
  - It's a single Next.js App Router app (no separate backend) — server components read Postgres directly via
    Prisma and gate access by role, then hand data to client components that call `app/api/*` route handlers.
  - Three roles land on three different home pages: `SUPERADMIN` → `/superadmin`, `LEADER` → `/leader`, `MEMBER` →
    `/onboarding`.
  - A Leader is created by the Superadmin and automatically gets one `Team`; the Superadmin invites members by
    email, and fake "sent" emails (with the invite link) show up at `/dev/inbox` since there's no real mail server.
  - Point them at `mvp.md` in the repo root if they want the full spec and design decisions, and at
    `onboard/CLAUDE.md` / `onboard/AGENTS.md` for framework-specific notes.
6. End by offering to take the next step for them, e.g. "Should I run `npm run dev`?" or "Want me to seed the
  database now?" — but do not run anything until they say yes.
