---
name: parallel-tasks-test
description: Run several tasks in parallel worktrees, each with a Playwright test written from a natural-language, step-by-step description the user supplies. Use when the user gives multiple tasks together with a written test/acceptance walkthrough for each, or asks for parallel work that is test-verified.
---

Same fan-out as `parallel-tasks`, with one extra contract: **every task arrives with a natural-language,
step-by-step test, and leaves with exactly one Playwright spec that encodes it.** Nothing gets provisioned until
that contract holds.

## Steps

### 1. Check the input before doing anything else

Split the request into discrete tasks first. Then, for each task, confirm the user supplied **both**:

- a description of what to build, and
- a step-by-step test in plain language — the walkthrough a person would follow to verify it: what they open,
  what they type or click, and what they should see at each step.

`tests/leader-search.story.md` is the shape to aim for. A one-liner like "test that search works" is **not** a
step-by-step test.

If any task is missing its test, or its test is too vague to turn into assertions, **stop**. Do not provision
worktrees, do not spawn subagents. List which tasks are missing what, show the story-file example as the
expected shape, and ask the user to supply it. Wait for their reply, then re-check.

Only when every task has a usable step-by-step test do you continue.

### 2. Run the `parallel-tasks` skill

Invoke the `parallel-tasks` skill and follow it as written — overlap check and plan approval, preconditions,
one worktree per task via `setup-worktree.sh <slug>`, fan-out, report, ask before merging or tearing down.

When the tasks include tests, also flag in the overlap table any two tasks whose specs would touch the **same
existing spec file** — the same conflict risk as two tasks editing one component.

Layer the requirements in steps 3 and 4 below into each subagent prompt. Everything else about `parallel-tasks`
is unchanged; don't reimplement its scripts or its rules.

### 3. What each subagent must deliver

In addition to the standard `parallel-tasks` prompt contents, tell each subagent:

- **Quote the user's step-by-step test verbatim in the prompt.** The subagent has none of this conversation's
  context; the description alone is not enough.
- Write **exactly one new spec file**, `tests/<slug>.spec.ts`, that encodes that walkthrough — one `test(...)`
  block, steps in the same order the user wrote them, with each of the user's steps as a short comment above
  the actions and assertions it turned into. Follow the conventions in the existing specs: `seedDatabase(...)`
  from `./helpers`, role/placeholder/testid selectors, `await expect(...)` for every "she should see".
- **Do not** write a `.story.md` file. The spec is the only artifact.
- **Do not** edit or delete an existing spec unless the task genuinely changes behavior an existing spec
  asserts. If it does, say so explicitly in the report and quote the diff.
- Add `data-testid` hooks to new UI where a role or placeholder selector would be brittle, and keep the
  existing ones (`invitation-list`, `member-list`, `member-<email>`, `progress-<email>`).
- **End with a whole-DB `dumpDatabase()` → `toEqual({...})` assertion only if the task changes what gets
  stored** — a schema change, a new row, a changed field. A read-only or pure-UI task asserts on the UI only
  (`tests/leader-search.spec.ts` is the model). If it does assert the dump, the determinism rules in
  `CLAUDE.md` (`lib/clock.ts`, `lib/tokens.ts`, `lib/password.ts`) are what make the literal reproducible.
- Ordering is the subagent's call — write the spec first and watch it fail, or implement then cover it. Either
  is fine, as long as both exist and pass at the end.
- Commit the spec together with the implementation on the task branch.

### 4. What each subagent must run

Both, in its own worktree, with the port exported:

```bash
npm run lint
PORT=<port> npm run test:e2e
```

The **whole** suite, not just the new spec — a task that breaks `onboarding.spec.ts` must fail here, not at
merge time. Report verbatim failure output; a task whose suite fails is ❌.

A subagent may use `PORT=<port> npx playwright test tests/<slug>.spec.ts` while iterating, but the full suite is
the gate.

### 5. Report, then print the per-task test commands

Report exactly as `parallel-tasks` step 5 says, and add one extra section — the commands the user can run
themselves, per task, copy-pasteable. Fill in the real slug and port from each `READY|...` line:

> **Run the tests yourself**
>
> | Task | Its spec only | Full suite in that worktree |
> |---|---|---|
> | `<slug>` | `cd .claude/worktree/<slug>/onboard && PORT=<port> npx playwright test tests/<slug>.spec.ts` | `cd .claude/worktree/<slug>/onboard && PORT=<port> npm run test:e2e` |
>
> After merging back into `<base-branch>`, run all the new specs together from `onboard/`:
> `npm run test:e2e`

Two reminders worth repeating to the user here:

- `PORT=` must be on every command — `playwright.config.ts` derives both `baseURL` and its `webServer` port
  from it, and without it the run lands on 3000 and collides with their own dev server.
- The worktrees stay up until they say otherwise, so these commands keep working.
