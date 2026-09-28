#!/usr/bin/env bash
# Usage: test-ui-all.sh [slug...]
# Opens Playwright UI mode for every parallel-task worktree (or only the given slugs), all at once.
# Each run uses its worktree's own TEST_PORT and TEST_DATABASE_URL. Ctrl-C closes them all.
set -euo pipefail

root="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
if (( $# )); then slugs=("$@"); else
  slugs=()
  for d in "$root"/.claude/worktree/*/; do [[ -f "$d.parallel-task/env" ]] && slugs+=("$(basename "$d")"); done
fi
(( ${#slugs[@]} )) || { echo "no parallel-task worktrees found" >&2; exit 1; }

pids=()
trap 'kill ${pids[@]+"${pids[@]}"} 2>/dev/null; wait' INT TERM EXIT

for slug in "${slugs[@]}"; do
  wt="$root/.claude/worktree/$slug"
  [[ -f "$wt/.parallel-task/env" ]] || { echo "not a parallel-task worktree: $wt" >&2; continue; }
  (
    cd "$wt/onboard"
    set -a && . ../.parallel-task/env && set +a
    echo "== $slug: tests on :$TEST_PORT, DB ${TEST_DATABASE_URL##*/}"
    exec npx playwright test --ui
  ) &
  pids+=($!)
done

wait
