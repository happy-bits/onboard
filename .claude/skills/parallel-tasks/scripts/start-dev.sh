#!/usr/bin/env bash
# Usage: start-dev.sh <slug>
# (Re)starts the worktree's dev server in the background on its own port and dev database.
# Log: .claude/worktree/<slug>/.parallel-task/dev.log, pid: .../dev.pid
set -euo pipefail

slug="${1:?usage: start-dev.sh <slug>}"
root="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
wt="$root/.claude/worktree/$slug"
state="$wt/.parallel-task"
[[ -f "$state/env" ]] || { echo "not a parallel-task worktree: $wt" >&2; exit 1; }

if [[ -f "$state/dev.pid" ]] && kill -0 "$(cat "$state/dev.pid")" 2>/dev/null; then
  kill "$(cat "$state/dev.pid")"
  sleep 1
fi

cd "$wt/onboard"
set -a && . "$state/env" && set +a
node scripts/prepare-db.js >/dev/null
nohup node --watch src/server.js > "$state/dev.log" 2>&1 &
echo $! > "$state/dev.pid"

for _ in $(seq 1 30); do
  curl -fsS -o /dev/null "http://localhost:$PORT/login" 2>/dev/null && { echo "http://localhost:$PORT"; exit 0; }
  sleep 0.5
done
echo "dev server did not come up on :$PORT, see $state/dev.log" >&2
exit 1
