#!/usr/bin/env bash
# Usage: remove-worktree.sh <slug>
# Manual cleanup, never run by the skill itself: stops the dev server, drops the slot's databases
# and removes the worktree. The branch task/<slug> is kept.
set -euo pipefail

slug="${1:?usage: remove-worktree.sh <slug>}"
root="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
wt="$root/.claude/worktree/$slug"
state="$wt/.parallel-task"
[[ -f "$state/env" ]] || { echo "not a parallel-task worktree: $wt" >&2; exit 1; }

[[ -f "$state/dev.pid" ]] && kill "$(cat "$state/dev.pid")" 2>/dev/null || true

slot="$(sed -n 's/^SLOT=//p' "$state/env")"
for name in "onboard_wt$slot" "onboard_wt${slot}_test"; do
  (cd "$root/onboard" && docker compose exec -T -e PGOPTIONS=--client-min-messages=warning db psql -q -U onboard -d postgres \
    -c "DROP DATABASE IF EXISTS \"$name\" WITH (FORCE)")
done

git -C "$root" worktree remove --force "$wt"
echo "Removed $wt (branch task/$slug kept)"
