#!/usr/bin/env bash
# Remove one parallel-task worktree and its database.
#
#   teardown-worktree.sh <slug> [--delete-branch]
#
# Keeps the branch by default so the task's commits survive. Refuses to run if
# the worktree has uncommitted changes unless --force is given.
set -euo pipefail

SLUG="${1:?usage: teardown-worktree.sh <slug> [--delete-branch] [--force]}"
shift
DELETE_BRANCH=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --delete-branch) DELETE_BRANCH=1 ;;
    --force) FORCE=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 1 ;;
  esac
done

ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
WT="$ROOT/.claude/worktree/$SLUG"
BRANCH="task/$SLUG"
DB="onboard_${SLUG//-/_}"
COMPOSE=(docker compose -f "$ROOT/onboard/docker-compose.yml")

if [ -d "$WT" ] && [ "$FORCE" -eq 0 ]; then
  if [ -n "$(git -C "$WT" status --porcelain)" ]; then
    echo "FAIL|$WT has uncommitted changes; commit them or pass --force" >&2
    exit 1
  fi
fi

if [ -d "$WT" ]; then
  git -C "$ROOT" worktree remove ${FORCE:+--force} "$WT"
  echo "  [$SLUG] removed worktree"
fi
git -C "$ROOT" worktree prune

# Release this slug's port reservation.
for d in "$ROOT/.claude/worktree/.ports"/*; do
  [ -d "$d" ] || continue
  if [ "$(cat "$d/owner" 2>/dev/null)" = "$SLUG" ]; then
    rm -rf "$d"
    echo "  [$SLUG] released port $(basename "$d")"
  fi
done

if [ "$DELETE_BRANCH" -eq 1 ] && git -C "$ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git -C "$ROOT" branch -D "$BRANCH" >/dev/null
  echo "  [$SLUG] deleted branch $BRANCH"
fi

"${COMPOSE[@]}" exec -T db psql -U onboard -d postgres -c "DROP DATABASE IF EXISTS \"$DB\";" >/dev/null 2>&1 \
  && echo "  [$SLUG] dropped database $DB" \
  || echo "  [$SLUG] could not drop $DB (is Postgres running?)"
