---
name: parallel-tasks
description: Work on several independent tasks at the same time, each in its own git worktree with its own port and database, then report back. Use when the user gives more than one task at once, or asks to do things in parallel / concurrently / at the same time.
---

Run N tasks concurrently. Each task gets an isolated worktree under `.claude/worktree/<slug>`, its own branch,
its own port, and its own Postgres database, so the tasks cannot see or corrupt each other's state. Nothing is
merged and nothing is deleted without asking.

Scripts in this skill directory do the provisioning; don't reimplement them inline.

## Steps

### 1. Split the request into tasks and show the plan

Turn whatever the user gave you into discrete tasks — a numbered list, or a sentence like "speed up the dashboard
and fix the invite flow". Give each a kebab-case slug (`dashboard-perf`, `invite-flow`).

Then check for **overlap** before provisioning anything. For each task, reason about which files it will touch and
flag collisions:

- Two tasks editing the same file (e.g. both in `components/LeaderDashboard.tsx`) — they'll merge-conflict.
- **Two tasks adding a Prisma migration** — near-guaranteed conflict, and the migration folder names collide.
- Two tasks changing `package.json`/`package-lock.json` — fine in isolation, conflicts on merge.

Present the plan as a table — task, slug, one-line scope, branch, and any overlap warning — and **ask before
provisioning**. Offer: run all in parallel anyway / run the colliding ones sequentially in one worktree / drop one.
Get a yes before touching the filesystem.

### 2. Check preconditions

- `git status --porcelain` in the repo root must be empty. If it isn't, stop and tell the user — the worktrees
  branch from current `HEAD` and a dirty tree makes the base ambiguous.
- Postgres must be up: `docker compose up -d` from `onboard/` if not.
- Note the current branch (`git branch --show-current`) — that's the base and the merge-back target.
- Run `npx prisma generate` once in `onboard/`. The main checkout's generated client can drift from the committed
  schema, and every worktree is cloned from it — regenerating up front avoids a confusing `ColumnNotFound` at seed
  time.

### 3. Provision one worktree per task

```bash
.claude/skills/parallel-tasks/setup-worktree.sh <slug>
```

Run these **in parallel** (background them and wait, or one Bash call per task in a single message). Each prints
progress and ends with `READY|<slug>|<app-dir>|<branch>|<port>|<database>`. Record that line — the subagent needs
all of it. Optional args: `setup-worktree.sh <slug> [base-ref] [seed-scenario]` (defaults `HEAD` and
`superadmin+leader`).

The script branches from `HEAD` as `task/<slug>`, allocates the first free port from 3100 up, creates database
`onboard_<slug>` in the shared container on 5434, writes a per-worktree `.env`, clone-copies `node_modules` from the
main checkout (APFS copy-on-write — seconds, ~0 disk, but a genuinely independent tree), then runs
`prisma migrate deploy`, `prisma generate` and the seed.

Takes ~15s per worktree. If provisioning fails for one task, tear that one down and continue with the rest —
report the failure at the end.

### 4. Fan out the subagents

Spawn one subagent per task, **all in a single message** so they run concurrently. Each prompt must contain:

- The task, stated completely — the subagent has none of this conversation's context.
- `cd` into its own app dir (`.claude/worktree/<slug>/onboard`) and **never** touch files outside it. No
  `git checkout`, no `git worktree`, no edits in the main checkout.
- **`PORT=<port>` must be exported on every command that starts a server.** `next dev` and `playwright.config.ts`
  do *not* read `PORT` from `.env` — without the prefix everything silently lands on 3000 and collides with the
  other tasks. So: `PORT=<port> npm run dev` and `PORT=<port> npm run test:e2e`. Its `DATABASE_URL` and `APP_URL`
  *are* read from `.env` and need no prefix. The app is at `http://localhost:<port>`.
- Read `CLAUDE.md` and `onboard/AGENTS.md` first — this Next.js version differs from training data, and the E2E
  suite asserts the whole DB dump, so determinism rules (`lib/clock.ts`, `lib/tokens.ts`, `lib/password.ts`) matter.
- Verify with `npm run lint` and `PORT=<port> npm run test:e2e` in its own worktree. Both are parallel-safe:
  `playwright.config.ts` derives `baseURL` and its `webServer` port from `PORT`, and `tests/helpers.ts` exports
  `APP_URL` so the expected DB dump follows the port instead of hardcoding 3000.
- Commit the work on its branch when done, with a message describing the change.
- Report back: what changed, files touched, lint/test results (verbatim failures if any), and anything left undone.

Don't run any of the tasks yourself while the subagents work.

### 5. Report and ask

When all subagents return, **leave every worktree, branch and database intact** — the user may want to inspect or
run them. Report per task:

- ✅ / ❌ and a one-line outcome
- files changed and the commit
- lint + E2E results (quote real failure output, don't paraphrase a pass)
- its branch, port, database, and the URL to poke at it
- anything the subagent flagged as incomplete

Faithfully report failures — a task whose tests failed is a ❌, not a "done with a caveat".

Then ask what to do next, offering:

- merge specific branches back into the base branch (do them one at a time, stop and report on the first conflict)
- tear down some or all of them:
  ```bash
  .claude/skills/parallel-tasks/teardown-worktree.sh <slug> [--delete-branch]
  ```
  It refuses to remove a worktree with uncommitted changes and keeps the branch unless `--delete-branch` is passed.
- leave everything as-is

Never merge or tear down without an explicit yes.

## Isolation caveats

Worth stating to the user when relevant:

- **`node_modules` must not be a symlink.** Turbopack refuses one pointing outside the project root, and the dev
  server dies at startup. The clone-copy is what makes this work; don't "optimize" it back to `ln -s`.
- **One Postgres server, many databases.** Separate `onboard_<slug>` databases isolate data, but
  `docker compose down -v` from any checkout destroys all of them.
- **Everything defaults to port 3000** if `PORT` isn't exported, including a stray `npm run dev` — which will then
  fight the user's own server. Always prefix.
- **Frozen-clock state is per dev-server process**, so it's already isolated — each worktree runs its own server.
- `.claude/worktrees/` (plural) belongs to Claude Code's built-in worktree tool. This skill owns `.claude/worktree/`
  (singular) only.
