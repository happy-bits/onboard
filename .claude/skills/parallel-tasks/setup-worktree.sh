#!/usr/bin/env bash
# Provision one isolated worktree for a parallel task.
#
#   setup-worktree.sh <slug> [base-ref] [seed-scenario]
#
# Creates .claude/worktree/<slug> on branch task/<slug>, allocates a free port,
# creates database onboard_<slug> inside the shared Postgres container, writes a
# per-worktree .env, symlinks node_modules from the main checkout, migrates and
# seeds.
#
# On success the last line of stdout is a shell-sourceable summary:
#   READY|<slug>|<worktree-app-dir>|<branch>|<port>|<database>
set -euo pipefail

SLUG="${1:?usage: setup-worktree.sh <slug> [base-ref] [seed-scenario]}"
BASE_REF="${2:-HEAD}"
SEED_SCENARIO="${3:-superadmin+leader}"

if ! [[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "FAIL|slug must be lowercase kebab-case: $SLUG" >&2
  exit 1
fi

ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
MAIN_APP="$ROOT/onboard"
WT="$ROOT/.claude/worktree/$SLUG"
APP="$WT/onboard"
BRANCH="task/$SLUG"
DB="onboard_${SLUG//-/_}"
COMPOSE=(docker compose -f "$MAIN_APP/docker-compose.yml")

say() { echo "  [$SLUG] $*"; }

# --- preconditions ---------------------------------------------------------
if ! "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx db; then
  echo "FAIL|Postgres is not running. Run 'docker compose up -d' from onboard/ first." >&2
  exit 1
fi

if [ -e "$WT" ]; then
  echo "FAIL|worktree already exists: $WT (tear it down first)" >&2
  exit 1
fi

if git -C "$ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "FAIL|branch $BRANCH already exists" >&2
  exit 1
fi

# --- port ------------------------------------------------------------------
# First free TCP port at or above 3100. Two setups launched at the same moment
# will both see 3100 as free, so the port is claimed with `mkdir`, which is
# atomic — the loser moves on to the next port. Reservations outlive the run and
# are released by teardown-worktree.sh (or reclaimed here if the owner is gone).
RESERVE="$ROOT/.claude/worktree/.ports"
mkdir -p "$RESERVE"
PORT=3100
while :; do
  [ "$PORT" -gt 3200 ] && { echo "FAIL|no free port in 3100-3200" >&2; exit 1; }
  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    PORT=$((PORT + 1)); continue
  fi
  if mkdir "$RESERVE/$PORT" 2>/dev/null; then
    echo "$SLUG" > "$RESERVE/$PORT/owner"
    break
  fi
  # Already claimed. Reclaim only if the owner's worktree is gone AND the
  # reservation is stale (>5 min) — a sibling setup running right now holds a
  # fresh reservation whose worktree directory does not exist yet.
  OWNER="$(cat "$RESERVE/$PORT/owner" 2>/dev/null || echo "")"
  if [ -n "$OWNER" ] && [ ! -d "$ROOT/.claude/worktree/$OWNER" ] \
     && [ -n "$(find "$RESERVE/$PORT" -maxdepth 0 -mmin +5 2>/dev/null)" ]; then
    echo "$SLUG" > "$RESERVE/$PORT/owner"
    break
  fi
  PORT=$((PORT + 1))
done
# Release the reservation if provisioning fails partway through.
trap 'rm -rf "$RESERVE/$PORT"' ERR
say "port $PORT"

# --- worktree --------------------------------------------------------------
mkdir -p "$ROOT/.claude/worktree"
git -C "$ROOT" worktree add -b "$BRANCH" "$WT" "$BASE_REF" >/dev/null
say "worktree $WT on $BRANCH (from $(git -C "$ROOT" rev-parse --short "$BASE_REF"))"

# --- dependencies ----------------------------------------------------------
# NOT a symlink: Turbopack rejects a node_modules symlink that points outside
# the project root ("Symlink [project]/node_modules is invalid"). `cp -c` uses
# APFS clonefile, so this is copy-on-write — a few seconds and ~0 real disk,
# while still giving each worktree an independent, writable tree.
if ! cp -Rc "$MAIN_APP/node_modules" "$APP/node_modules" 2>/dev/null; then
  say "clone copy unavailable (non-APFS?), falling back to npm ci"
  (cd "$APP" && npm ci >/dev/null)
fi
say "node_modules cloned from main checkout"

# --- env -------------------------------------------------------------------
cat > "$APP/.env" <<EOF
DATABASE_URL="postgresql://onboard:onboard@localhost:5434/$DB"
PORT=$PORT
APP_URL="http://localhost:$PORT"
EOF
say "wrote .env"

# --- database --------------------------------------------------------------
"${COMPOSE[@]}" exec -T db psql -U onboard -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS \"$DB\";" -c "CREATE DATABASE \"$DB\";" >/dev/null
say "created database $DB"

(cd "$APP" && npx prisma migrate deploy >/dev/null)
say "migrations applied"

# The cloned client may predate this branch's schema; regenerate inside the
# worktree so it matches the migrations that were just applied.
(cd "$APP" && npx prisma generate >/dev/null 2>&1)
say "prisma client generated"

(cd "$APP" && npm run seed "$SEED_SCENARIO" >/dev/null)
say "seeded ($SEED_SCENARIO)"

echo "READY|$SLUG|$APP|$BRANCH|$PORT|$DB"
