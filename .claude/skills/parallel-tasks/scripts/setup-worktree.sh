#!/usr/bin/env bash
# Usage: setup-worktree.sh <slug>
# Creates .claude/worktree/<slug> on branch task/<slug> (from current HEAD), assigns the lowest
# free slot N, creates fresh databases onboard_wt<N> / onboard_wt<N>_test in the shared Postgres
# container and installs dependencies. Prints the env file on success.
# Run sequentially (one slug at a time) so two worktrees never grab the same slot.
set -euo pipefail

slug="${1:?usage: setup-worktree.sh <slug>}"
[[ "$slug" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "slug must be kebab-case: $slug" >&2; exit 1; }

# Main checkout root, even when called from inside a worktree.
root="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
wt_dir="$root/.claude/worktree"
wt="$wt_dir/$slug"
branch="task/$slug"
app="$root/onboard" # main checkout's app dir: owns the shared docker compose project

[[ -e "$wt" ]] && { echo "worktree already exists: $wt" >&2; exit 1; }
git -C "$root" show-ref --verify --quiet "refs/heads/$branch" && { echo "branch already exists: $branch" >&2; exit 1; }

# Keep worktrees and per-worktree state out of git (info/exclude is shared by all worktrees).
exclude="$(git -C "$root" rev-parse --path-format=absolute --git-common-dir)/info/exclude"
mkdir -p "$(dirname "$exclude")"
for pattern in '/.claude/worktree/' '/.parallel-task/'; do
  grep -qxF "$pattern" "$exclude" 2>/dev/null || echo "$pattern" >> "$exclude"
done

# Lowest slot not used by a kept worktree and whose ports are free.
used=" $( (cat "$wt_dir"/*/.parallel-task/env 2>/dev/null || true) | sed -n 's/^SLOT=//p' | tr '\n' ' ') "
port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
slot=""
for n in $(seq 1 99); do
  [[ "$used" == *" $n "* ]] && continue
  port_busy $((3000 + n)) || port_busy $((3100 + n)) || { slot=$n; break; }
done
[[ -n "$slot" ]] || { echo "no free slot (1-99)" >&2; exit 1; }

# Shared Postgres container (no-op if already running).
(cd "$app" && docker compose up -d --wait >/dev/null 2>&1)

db="onboard_wt$slot"
test_db="${db}_test"
# A free slot may still have databases left over from a removed worktree: start clean.
for name in "$db" "$test_db"; do
  (cd "$app" && docker compose exec -T -e PGOPTIONS=--client-min-messages=warning db psql -q -U onboard -d postgres \
    -c "DROP DATABASE IF EXISTS \"$name\" WITH (FORCE)" -c "CREATE DATABASE \"$name\"")
done

mkdir -p "$wt_dir"
git -C "$root" worktree add -q -b "$branch" "$wt" HEAD

mkdir -p "$wt/.parallel-task"
cat > "$wt/.parallel-task/env" <<EOF
SLOT=$slot
BRANCH=$branch
PORT=$((3000 + slot))
TEST_PORT=$((3100 + slot))
DATABASE_URL=postgres://onboard:onboard@localhost:55432/$db
TEST_DATABASE_URL=postgres://onboard:onboard@localhost:55432/$test_db
SESSION_SECRET=dev-session-secret-wt$slot
EOF

(cd "$wt/onboard" && npm ci --prefer-offline --no-audit --no-fund --loglevel=error >/dev/null)
(cd "$wt/onboard" && set -a && . ../.parallel-task/env && set +a && node scripts/prepare-db.js >/dev/null)

echo "WORKTREE=$wt"
cat "$wt/.parallel-task/env"
