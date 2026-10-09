---
name: getting-started
description: Explain how to start and use the onboard app (commands, logins, first Superadmin login). Use when the user is new to the project, asks how to run the site, or how to log in. Information only; runs the troubleshoot skill first and never fixes or starts anything.
---

# Getting started

Give the user a guided, educational walkthrough of how to run and use the onboard app. **Information only: do not fix problems, start containers, start the dev server, install, migrate or seed.**

## Steps

1. **Run the `troubleshoot` skill first** (via the Skill tool) and show its report. Follow its rules, but in this skill do not apply any fixes even if the user would normally be asked. Just note which fixes are needed, and say they can be run after this walkthrough.

2. **Show how to run the site.** Adapt to the report: mark steps that are already done (e.g. Postgres is already up) and highlight the ones still needed. All commands run from `onboard/`, for example:

   ```bash
   cd onboard
   docker compose up -d        # 1. Postgres 16 on port 5434   ✅ already up
   npx prisma migrate dev      # 2. Create/update the tables   ✅ already applied
   npm run seed                # 3. Seed database              ✅ already applied
   npm run dev                 # 4. Eite running               ✅ already running
   ```

   - Optionally add the E2E test setup (only if the report's `E2E` category shows it is needed): `npx playwright install chromium` (first time only), then `npm run test:e2e`. Mention that tests truncate and reseed the dev database, and that a manually started dev server must have `TEST_MODE=1` (or be stopped so Playwright starts its own).
   - Use `npm run seed superadmin+leader` instead of step 3 to also get a Leader.

3. **Show how to use the app**, with the seeded credentials:

   | Role | Email | Password | Lands on |
   |------|-------|----------|----------|
   | Superadmin | `admin@onboard.local` | `admin123` | `/superadmin` |
   | Leader (only in `superadmin+leader` seed) | `leader@onboard.local` | `leader123` | `/leader` |
   | Member | created by invitation | chosen when accepting | `/onboarding` |

   Verify details against the code (`app/login/page.tsx`, `app/superadmin/`) if unsure; don't guess.

4. **Show a short "Log in as Superadmin" walkthrough** (numbered steps, each saying what the user does and what they should see). Base it on this, adapting URLs/state to the troubleshoot report:

   1. Open http://localhost:3000/. You should see the heading **"Log in to Onboard"** with Email and Password fields.
   2. Enter `admin@onboard.local` / `admin123` from the table above and click **Log in**.
   3. You land on `/superadmin`: a **"Superadmin"** page with a Logout button, a **"Create leader"** form (Email, Password, **Create**) and a **"Leaders"** list (empty: "No leaders yet.", or listing existing leaders with a **Remove** button).

   If troubleshoot reports blockers, say the walkthrough will not work until they are fixed and offer to fix them afterwards. State in one line whether the app is ready to run the E2E tests, based on the `E2E` category. Do not add other sections (no architecture overview, no list of next steps).

## Notes

- Keep the output compact and scannable: headings, a command block, the credentials table, and the login walkthrough.
- If the troubleshoot report shows blockers (e.g. Docker not running), say clearly that the commands in step 2 will fail until they are resolved.
