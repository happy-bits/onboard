# Claude Code Course — Summary

A theme-based summary of the Claude Code course material (pages 1–104). Organized by
what each group of features is *for*, not by the order slides appeared in.

---

## 1. Getting set up

Before using Claude Code on a project, the course has you install Docker Desktop,
clone the target repo, install npm packages, copy `.env.example` to `.env`, start
Postgres via `docker compose up -d`, generate the Prisma client, seed the database,
and run the dev server. This is a one-time setup step that must happen **before**
Claude Code itself is installed and used.

To verify Claude Code is installed correctly, you run `claude` from the repo root,
type any prompt, and confirm you get a sensible response. `/exit` returns you to the
plain terminal.

---

## 2. Session basics: model, effort, and CLI hygiene

**Login.** `/login` offers three ways to authenticate:
1. Claude subscription (Pro/Max/Team/Enterprise) via your Claude.ai account
2. Anthropic Console account — pay-as-you-go, billed by API token usage
3. 3rd-party platform (Amazon Bedrock, Microsoft Foundry, Vertex AI) if your org
   already routes AI usage through one of those

**Model.** `/model` (or `/model sonnet`) switches which Claude model is used for new
sessions. Sonnet is described as a good default; Opus or Fable are recommended if a
task needs the model to "think outside the box" and suggest things you didn't
explicitly ask for.

**Effort.** `/effort` sets how much compute the model spends *thinking* per task —
it does **not** change which model you're using. The scale runs low → medium → high →
xhigh → max (with an `ultracode` tier for orchestrated multi-agent workflows). Medium
is the recommended baseline for routine day-to-day feature work and bug fixes; higher
effort trades latency/cost for better judgment on harder problems.

**Status, doctor, theme.** `/status` shows the current model, login method, org,
remaining usage, and MCP server connection state. `/doctor` runs a health check on
the Claude Code installation and flags configuration issues. `/theme` changes the
CLI's visual color scheme only — it has no effect on functionality, and persists
across sessions once set.

**Input mode cheatsheet.** `!` switches to shell mode (run a raw shell command
directly), `/` opens the command palette, `@` references a file path, `/btw` asks a
throwaway side question *without* polluting the main conversation history, double-tap
`Esc` clears the current input, `shift+tab` cycles between modes (e.g., toggling
auto-accept edits on/off), and `ctrl+v` pastes an image from the clipboard. The
course's default recommended mode is **auto mode on**, which minimizes permission
prompts.

**Help.** `/help` opens a reference panel listing all shortcuts and available slash
commands.

---

## 3. Skills: reusable, on-demand instructions

A **skill** is a way to give Claude reusable instructions and abilities without
re-pasting the same prompt every session. Unlike `CLAUDE.md` — which is loaded fully
into every session at startup — skill instructions are loaded **only when needed**,
which keeps context usage smaller.

**Structure.** Every skill is a folder containing a `SKILL.md` file (YAML frontmatter
+ markdown instructions), optionally alongside supporting files (reference docs,
scripts, templates):

```
~/.claude/skills/min-skill/
├── SKILL.md
├── reference.md
└── scripts/
```

**Frontmatter fields:**
- `name` — the skill's identifier
- `description` — what it does and when to use it; this is what Claude reads to
  decide whether to auto-load the skill for a given prompt
- `disable-model-invocation: true` — only the *user* can trigger the skill (via `/`),
  Claude cannot auto-invoke it
- `user-invocable: true` — inverse: only Claude can trigger it, the user can't reach
  it with a `/` command
- `allowed-tools` — restricts which tools may run during that skill invocation (for
  that turn only, not the whole session)
- `context: fork` — runs the skill as an isolated subagent with no access to the
  current conversation; it runs (by default in the background) and returns only its
  final result into the main session. Good for research/analytics/long tasks you
  want isolated from the main thread. This is the *only* valid value for `context` —
  you either write it or omit the line entirely.

Skills can be invoked two ways: **manually** (typing `/skill-name`), or
**automatically** (Claude reads the `description` field and decides on its own
whether the skill applies to the current prompt).

**Discovery order.** Claude searches for skills across four locations: enterprise
skills, personal skills, the current project, and installed plugins. If two skills
share a name, priority is enterprise > personal > project. Plugins have their own
namespace, so they never collide with the others.

**Skills built in the course** (as worked examples, not generic features):
- A **troubleshoot** skill that runs a diagnostic shell script and presents findings
  in a readable checklist (OK/WARN/FAIL), but deliberately never fixes anything
  itself — it only reports, then asks the user whether to proceed with fixes.
- A **getting-started** skill that orients a brand-new developer: it invokes the
  troubleshoot skill first, checks the user's git branch/uncommitted-changes state,
  lists the commands needed to get the app running, and gives login credentials —
  again, informational only, never starting the site or seeding data itself.
- A **grill-me** skill that asks clarifying questions one at a time until the user
  says stop, explicitly instructed not to change any code. The course demonstrates
  asking Claude itself to critique and improve a hand-written skill's frontmatter and
  instructions (a nice recursive use of the tool).

If a newly created skill doesn't show up, `/reload-skills` forces a rescan;
`/skills` lists everything currently discovered.

---

## 4. Verifying your work

**Running tests.** The course's target project uses Playwright end-to-end tests that
truncate and reseed a shared database, so tests must run with `workers: 1`
(non-parallel). Beyond the default run, you can add `--headed` to watch it happen in
real browser windows, or `--ui` to open Playwright's UI and step through actions,
network calls, and assertions frame by frame.

**Dumping state.** A `dump` script exists to serialize the entire database to JSON so
you (or an automated test) can assert on exact application state rather than guessing
from the UI.

**`/diff`** is described as a *cheap* command: it shows the raw git diff of
uncommitted changes so you can decide whether a deeper review is even warranted,
before spending tokens on one.

**`/verify`** actually *exercises* a change's real behavior — driving the affected
flow end-to-end (hitting the running app, calling an API, clicking through the UI) —
rather than just relying on unit tests or type-checking to declare something fine.
This is explicitly contrasted with just reading code: verify proves the behavior
works, it doesn't just infer it.

**`/usage`** shows session cost and limits: total dollar cost for the session, token
usage broken down by model, percentage of your current session/weekly limit
consumed, and when those limits reset. Useful for keeping an eye on spend during
longer agentic workflows.

---

## 5. Planning and shipping non-trivial changes

For anything beyond a small fix, the course teaches a heavier, more deliberate loop:

1. **Set model/effort deliberately** — e.g. `/effort high` with `/model sonnet` for
   a well-balanced main driver.
2. **`/advisor`** lets Claude escalate to a stronger "advisor" model (e.g. Opus) at
   key moments — a complex decision, an ambiguous failure, or when it's circling
   without progress — get guidance, then resume with the original model. This
   consults the advisor server-side and uses extra tokens, but it does **not** block
   or replace the main model's own response.
3. **`/plan`** enables plan mode: Claude can read and explore, but **cannot edit
   code** while in this mode. Claude may spin up an exploratory agent (e.g. a
   general-purpose subagent) to research the codebase before proposing an approach,
   and may ask you clarifying questions along the way (you decide how to answer).
4. Once a plan is written, you're offered several paths: **"Yes, and use auto
   mode"** (execute immediately, hands-off), **"Yes, manually approve edits"**
   (execute but review each change), **"No, refine with Ultraplan on Claude Code on
   the web"** (hand the plan off to a cloud session for remote refinement — your
   local session is *not* blocked while this runs, and you get a link to watch
   progress and iterate in the browser), or **"Tell Claude what to change"** (give
   feedback and have it rewrite the plan locally).
5. Plans are saved as markdown under `~/.claude/plans/` and can be opened directly in
   your editor (`code ~/.claude/plans/<plan-name>.md`) to skim before execution —
   the course specifically recommends reading the **Context** section (why this
   change, what already exists) and the **Verification** section (the exact commands
   that will prove the change worked) before approving.
6. After Ultraplan refinement, you accept the plan with **"Accept and auto mode"**
   and then explicitly tell Claude to **"Implement the plan."**

**TDD.** As a dedicated pattern, the course has you hand Claude a described bug and
instruct it to solve it via test-driven development: write a failing test first,
confirm it fails against the current (buggy) behavior, then change the implementation
until the test passes, and finally confirm the rest of the existing suite still
passes. If Claude's fix creates a brand-new test file where an existing test could
have simply been extended, you can explicitly ask it to merge the change into an
existing test to keep the diff smaller and simpler.

---

## 6. Quality review commands

**`/security-review`** audits the pending (uncommitted) changes on the current
branch specifically for security issues — it needs the changes to exist relative to
a pushed remote branch (`origin/HEAD`) to diff against, and will error out if you
haven't pushed yet. Findings include a severity, category, confidence score, root
cause, and a concrete exploit scenario, plus a recommendation for the fix. You can
then simply tell Claude "fix this" to apply the recommended remediation.

**`/code-review`** is a general-purpose refactoring command that searches for bugs,
oversimplification opportunities, and efficiency problems. Critically, it can be
scoped — e.g. `/code-review working tree changes` — so it reviews *just* the diff, a
single file, or a PR, rather than the whole codebase. It is not focused on security
specifically, but may surface a security issue incidentally. Running it starts a
background subagent so you can keep working while it reviews. The course recommends
running it before committing any significant change to catch logic errors and
inconsistencies that a human skim might miss. You can also ask Claude to label each
finding by type (bug / simplification / security issue / other) to make triage
faster, then instruct it to fix everything found.

---

## 7. Explaining behavior to non-technical audiences

The core idea: **"Documentation can lie. Tests don't."** Since end-to-end tests are
the ground truth for what a system actually does, the course has you convert test
code into a customer-readable **story** — using *only* what's literally exercised
in the test code (including any helper functions like a seed/dump helper), explicitly
avoiding other docs or code that might introduce speculation or drift from what's
actually tested.

From that story, the course explores turning it into a visual artifact and settles on
building **three separate visualizations from the same underlying story data**:
1. A **sequence diagram** — actor swimlanes (e.g. browser/server/database) with each
   test step as an arrow, closest to literally what the test executes.
2. A **storyboard** — one panel per screen/step, styled like a comic strip, aimed at
   a non-technical audience who cares about the user journey rather than mechanics.
3. A **before/after state diagram** — a table-style diff of the underlying data
   store, seed state vs. final state, with changed rows/fields highlighted — good for
   verifying the story matches exactly what the final assertion checks.

These are generated as standalone HTML files (with their own JS/CSS/images as needed)
so they can be opened directly in a browser with no server required.

---

## 8. Navigating session history and working in parallel

This is the most conceptually dense set of commands in the course — five tools that
sound similar but solve distinct problems:

- **`/rewind`** (or double-`Esc`) rolls the **current session** back to an earlier
  point in its own history — undoing messages and, optionally, the actual file edits
  Claude made since that point, using checkpoints taken during the session. This is
  the only one of these commands that can **actually revert code on disk**. Rewind
  offers granular options: restore code *and* conversation, conversation only, code
  only, or just summarize from/up to a point. Caveat: if Claude ran a raw shell
  command that changed/removed/added files (rather than using its file-edit tools),
  that change is **not** tracked by rewind's checkpoints and won't be reverted — so
  you still need to watch your git status. Rewind always frees up context (since it
  discards messages).

- **`/branch <name>`** forks the **conversation only** — it does not touch git or
  files on disk at all. It's for exploring multiple different solutions to the same
  problem sequentially from the same starting point without losing your original
  thread; you can return to the original via `/resume`.

- **`/resume`** lets you pick any past session (in this project or others, including
  branches created via `/branch`) from a list and continue chatting in it. It only
  changes *which transcript/context* you're working from — like `/branch`, it does
  not touch files. Resuming might free up context versus your current session, but
  it can also *fill* context back up if the resumed session was already large.

- **`/fork <prompt>`** copies the current session into a **new background session**
  that works in parallel while you keep working in the foreground on the current
  session. By default, if the fork needs to make code changes, it creates its **own
  git worktree** — so your main working tree stays completely untouched while the
  fork works. You can press the left-arrow key to view a running fork's live
  progress, and once it's done you can review its diff, run its dedicated worktree,
  and if happy, commit inside that worktree and run `git merge <worktree-branch>`
  back on your main worktree.

- **`/subtask <prompt>`** delegates a side task to a subagent, but **the result
  returns into the current conversation thread** rather than staying detached like a
  fork. It's meant for auxiliary work that doesn't need your ongoing attention but
  whose output you *do* want folded back in (e.g., "write unit tests for X while I
  keep working on the UI," or "research how library Y handles streaming"). It runs
  in the same working directory as the main session (no separate worktree). The
  subtask can return a lot of raw findings without polluting your main context,
  since only its final report lands in-thread.

- **`/background`** sends the *entire current session* to the background so you get
  your terminal back while a long-running task (e.g. a test suite) keeps executing.
  `/bg` does the same thing mid-task. Background/subtask work stops if you turn off
  or fully shut down your computer — sleep mode is fine, but persistent execution
  across a full shutdown requires a genuine cloud session (`claude --cloud "..."`).

**Key distinctions to remember:**
| Command | Touches files/git? | Runs in parallel? | Result destination |
|---|---|---|---|
| `/rewind` | Yes (can revert code) | No | Same session, rolled back |
| `/branch` | No | No (sequential) | New session you switch into |
| `/resume` | No | No | Switches active transcript |
| `/fork` | Yes (own worktree) | Yes | Background session, view separately |
| `/subtask` | No (shares main dir) | Somewhat (delegated) | Reports back in-thread |
| `/background` | N/A | Yes (whole session) | Whole session moves to bg |

**Fork vs. branch vs. clear, in one line each:** a fork works in *parallel*; a branch
is *sequential* (you're on one or the other); and you can always just open multiple
separate sessions with `/clear` to run unrelated tasks side by side.
