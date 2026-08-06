---
name: troubleshoot
description: Diagnose why the onboard app isn't running (Docker, Postgres, migrations, seed data, ports, dependencies) and present the results. Use when the user says the site/app isn't working, won't start, or asks to troubleshoot/diagnose it.
---


Run the diagnostic script and present its findings. This skill only **diagnoses** — it never fixes anything on its own.


## Steps


1. Run `diagnose.sh` (paths are relative to the repo root; the script locates `onboard/` itself).
2. Parse its output: each line is `STATUS|CHECK NAME|DETAIL`, where STATUS is `OK`, `WARN`, or `FAIL`.
3. Present the results as a readable checklist, grouped by status, most severe first (FAIL, then WARN, then OK):
  - `FAIL` → ❌
  - `WARN` → ⚠️
  - `OK` → ✅
  Show the check name and detail for each line.
4. Write a one-line summary at the top (e.g. "3 problems found" or "Everything looks fine").
5. Do **not** attempt to fix anything, run any remediation commands, or modify files/containers.
6. If any `FAIL` or `WARN` checks were found, ask the user whether they'd like you to fix them. Only proceed with fixes if they say yes.
