---
name: troubleshoot
description: Diagnose why the onboard app won't run (Docker, Postgres, Node, ports, .env, migrations, seed data, E2E test setup). Use when the user says the site/app doesn't work, can't log in, won't start, or asks to troubleshoot or check the setup. Reports problems only; asks before fixing anything.
---

# Troubleshoot

Diagnose the local onboard setup and present the findings. **Do not fix anything on your own.**

## Steps

1. Run the diagnostic script. It is read-only and prints a single JSON object:

   ```bash
   node .claude/skills/troubleshoot/diagnose.mjs
   ```

   (Run from the repo root. If the working directory is `onboard/`, use `node ../.claude/skills/troubleshoot/diagnose.mjs`.)

2. Parse the JSON and present it as a report, grouped by `category`, in the order given. One line per check:

   - `ok` → ✅ `title`
   - `warn` → ⚠️ `title` — `detail`
   - `fail` → ❌ `title` — `detail`

   For every ⚠️ and ❌, add the suggested `fix` on an indented line starting with `↳`. Skip empty `detail`/`fix`.

   Start with a one-line verdict (e.g. `❌ 3 problems, ⚠️ 1 warning, ✅ 12 OK` from `summary`), or `✅ Everything looks healthy` when `healthy` is true and there are no warnings. Keep the rest compact; no extra commentary.

3. If there are any ❌ or ⚠️ items, **ask the user whether they want them fixed** (use AskUserQuestion, or a plain question). Offer to fix all, fix selected ones, or leave as is. Mention up front when a fix is destructive, e.g. `npm run seed` truncates the whole database.

4. Only run fix commands after the user says yes, and only for the items they approved. Re-run the script afterwards and show the updated report.

## Notes

- Never start containers, install packages, run migrations, or seed before the user approves.
- If the script itself crashes or prints invalid JSON, show the error and say so; don't guess at results.
- The `E2E` category checks that `npm run test:e2e` can run (Playwright installed, Chromium downloaded, specs/config present, no non-TEST_MODE server on :3000). The `db-wipe` entry is only a reminder that tests wipe the database.
- `TEST_MODE` warnings: a dev server running with `TEST_MODE=1` is fine for E2E tests but wrong for normal use, and the reverse breaks the tests.
