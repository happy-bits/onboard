---
name: parallel-tasks
description: Solve several independent tasks at the same time, each in its own git worktree under .claude/worktree/ with its own dev port, test port and Postgres databases in the shared container, one subagent per task. Use when the user gives a list of tasks (inline or as a file) to work on in parallel.
argument-hint: "<task list> | <path/to/tasks.md>"
---

# Parallel tasks

Run each task in its own worktree, with its own subagent, port and databases. Worktrees, branches
and dev servers are **kept** afterwards so the user can review and try each result.

Scripts live in `.claude/skills/parallel-tasks/scripts/` (paths below are relative to the repo root,
the main checkout's top level).

## Per-worktree layout

| Slot N (1-99) | Value |
| --- | --- |
| Worktree | `.claude/worktree/<slug>` |
| Branch | `task/<slug>` from the current `HEAD` |
| Dev server | `http://localhost:30NN` (3000 + N), DB `onboard_wt<N>` |
| E2E tests | port 3100 + N, DB `onboard_wt<N>_test` |
| Env / state | `.claude/worktree/<slug>/.parallel-task/{env,dev.log,dev.pid}` |

Slot 0 (ports 3000/3100, DBs `onboard` / `onboard_test`) belongs to the main checkout. All
databases live in the one shared container from `onboard/docker-compose.yml` (localhost:55432).

## Steps

### 1. Parse the tasks

`$ARGUMENTS` is either a path to an existing file or an inline task list.

- **File**: each top-level heading or top-level bullet/numbered item is one task. Anything nested
  under it is part of that task's description.
- **Inline**: split on numbered items (`1)`, `1.`), bullets, newlines or `;`. When the split is
  ambiguous, ask the user.
- No arguments: ask the user for the tasks.

Give each task a short kebab-case slug (e.g. `add-logout-button`). It must not clash with an
existing directory in `.claude/worktree/` or an existing `task/<slug>` branch.

### 2. Preflight

- Run `git status --porcelain`. Worktrees start from `HEAD`, so uncommitted changes are **not**
  included. If there are any, tell the user and ask whether to continue anyway or commit first.
- Check that Docker is running (`docker info`). The setup script starts the shared container if needed.

### 3. Create the worktrees, one at a time

Run the setup script **sequentially** for each slug, never in parallel, so slots don't collide:

```sh
.claude/skills/parallel-tasks/scripts/setup-worktree.sh <slug>
```

It prints `WORKTREE=...` followed by the env file (SLOT, BRANCH, PORT, TEST_PORT, DATABASE_URL,
TEST_DATABASE_URL). If a setup fails, report it and carry on with the other tasks.

Print the plan as a table (task → slug, branch, dev port, test port, DBs), then go straight to step 4.

### 4. Launch one subagent per task, all in a single message

Use the Agent tool with `subagent_type: "general-purpose"`, one call per task, **all in the same
message** so they run concurrently. Don't pass `isolation`: the worktree already exists. Fill in
this prompt for each agent:

````
You are solving one task in an isolated git worktree. Other agents are working on other tasks in
other worktrees at the same time, so stay inside yours.

TASK:
<full task description>

WORKTREE: <abs worktree path>   (app code is in <abs worktree path>/onboard)
BRANCH:   <branch>  (already checked out)
Your ports and databases (from <abs worktree path>/.parallel-task/env):
  dev   http://localhost:<PORT>        DATABASE_URL=<DATABASE_URL>
  tests port <TEST_PORT>               TEST_DATABASE_URL=<TEST_DATABASE_URL>

Rules:
- Only read and edit files under <abs worktree path>. Never touch the main checkout or other worktrees.
- Shell state does not persist between Bash calls, so start every command that runs the app,
  tests or DB scripts with:
    cd <abs worktree path>/onboard && set -a && . ../.parallel-task/env && set +a && <command>
- Postgres is already running and shared. Never run `npm run db:up`, `db:down`, `test:e2e`, `dev`
  or any `docker` command. Run tests with `npx playwright test`. Only use your own two databases.
- Don't start long-running servers yourself (Playwright starts the test server on TEST_PORT).
- Match the style of the surrounding code.

Workflow:
1. Run `npx playwright test` once before changing anything, and note any tests that already fail.
2. Implement the task.
3. Run `npx playwright test` until it passes. Fix failures your change caused, and update expected
   DB dumps or tests only where the task intentionally changes behaviour.
4. When the suite is green, commit everything on <branch>:
     git -C <abs worktree path> add -A && git -C <abs worktree path> commit -m "<summary>

     Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
   Don't push, merge or rebase.
5. If you can't get the suite green, do NOT commit. Leave the changes uncommitted and explain why.

Finish with a short report: status (DONE / FAILED), what you changed (files), test result
(passed/failed counts, and any failures that were already there in step 1), and the commit hash.
````

Use the attribution line from the current session's system reminder, if there is one.

### 5. As each agent finishes

You get a notification each time a subagent completes. Don't poll. For each finished task:

```sh
.claude/skills/parallel-tasks/scripts/start-dev.sh <slug>
```

This starts the worktree's dev server in the background on its own port and dev DB, and **leaves it
running**. Also verify the agent's claim with `git -C <worktree> log -1 --oneline` and
`git -C <worktree> status --short`.

### 6. Final summary

When every agent has finished, print one table:

| Task | Status | Branch / commit | Dev URL | Worktree |
| --- | --- | --- | --- | --- |

After the table:
- Failed tasks and why (their changes are left uncommitted in the worktree).
- Worktrees, branches, databases and dev servers are all kept. Nothing is merged.
- To review: `git diff HEAD...task/<slug>`. To merge: `git merge task/<slug>`.
- To clean up one worktree later: `.claude/skills/parallel-tasks/scripts/remove-worktree.sh <slug>`
  (stops the server, drops its DBs, removes the worktree and keeps the branch).
- Logs: `.claude/worktree/<slug>/.parallel-task/dev.log`.

Never remove worktrees, branches or databases, or stop dev servers, unless the user asks.
