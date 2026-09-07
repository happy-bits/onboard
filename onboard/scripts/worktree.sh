#!/usr/bin/env bash
#
# Manage one isolated worktree per agent: its own branch, its own dev-server
# port, and its own database inside the shared Postgres container.
#
#   scripts/worktree.sh add <name>      create (or re-sync) a worktree
#   scripts/worktree.sh list            show every worktree with port + database
#   scripts/worktree.sh remove <name>   delete the worktree and drop its database
#
# Run from the `onboard/` directory. Any number of worktrees can coexist; ports
# are allocated by scanning what existing worktrees already claim.
set -euo pipefail

# The main checkout, regardless of which worktree we were invoked from:
# --git-common-dir points at the shared .git for every linked worktree.
MAIN_ROOT="$(cd "$(dirname "$(git rev-parse --git-common-dir)")" && pwd)"
MAIN_APP="$MAIN_ROOT/onboard"
PARENT="$(dirname "$MAIN_ROOT")"

DB_PORT="${DB_PORT:-5434}"
DB_USER=onboard

compose() { docker compose --project-directory "$MAIN_APP" "$@"; }

slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/_/g; s/^_+|_+$//g'
}

# Every path in `git worktree list --porcelain`, main checkout included.
worktree_paths() {
  git worktree list --porcelain | sed -n 's/^worktree //p'
}

db_exists() {
  [ -n "$(compose exec -T db psql -U "$DB_USER" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='$1'")" ]
}

ensure_db_up() {
  if [ -z "$(compose ps -q db)" ]; then
    echo "==> starting the shared Postgres container"
    compose up -d db
  fi
  # `up -d` returns before Postgres accepts connections; the healthcheck is the
  # thing that knows, so wait on it rather than sleeping a guessed interval.
  local waited=0
  until compose exec -T db pg_isready -U "$DB_USER" -d postgres >/dev/null 2>&1; do
    [ "$waited" -ge 60 ] && { echo "Postgres did not become ready" >&2; exit 1; }
    sleep 1
    waited=$((waited + 1))
  done
}

# Lowest port from 3000 up that no worktree has claimed in its .env and that
# nothing is currently listening on.
allocate_port() {
  local claimed=" "
  local path
  while IFS= read -r path; do
    if [ -f "$path/onboard/.env" ]; then
      local p
      p="$(sed -n 's/^PORT=//p' "$path/onboard/.env" | tr -d '"' | head -1)"
      [ -n "$p" ] && claimed="$claimed$p "
    fi
  done < <(worktree_paths)

  local port=3000
  while [ "$port" -lt 3100 ]; do
    if [[ "$claimed" != *" $port "* ]] &&
       ! lsof -iTCP:"$port" -sTCP:LISTEN -n -P >/dev/null 2>&1; then
      printf '%s' "$port"
      return
    fi
    port=$((port + 1))
  done
  echo "no free port in 3000-3099" >&2
  exit 1
}

cmd_add() {
  local name="${1:?usage: worktree.sh add <name>}"
  local slug wt app db port
  slug="$(slugify "$name")"
  [ -n "$slug" ] && [ "$slug" != "_" ] || { echo "unusable name: $name" >&2; exit 1; }
  wt="${WORKTREE_DIR:-$PARENT/onboard-$slug}"
  app="$wt/onboard"
  db="onboard_$slug"

  ensure_db_up

  if [ -d "$app" ]; then
    echo "==> worktree already exists at $wt — re-syncing"
  elif git show-ref --verify --quiet "refs/heads/$name"; then
    echo "==> adding worktree $wt on existing branch $name"
    git worktree add "$wt" "$name"
  else
    echo "==> adding worktree $wt on new branch $name"
    git worktree add -b "$name" "$wt"
  fi

  # Reuse this worktree's own port if it already has one, so re-running is a
  # no-op rather than a reshuffle.
  if [ -f "$app/.env" ] && grep -q '^PORT=' "$app/.env"; then
    port="$(sed -n 's/^PORT=//p' "$app/.env" | tr -d '"' | head -1)"
  else
    port="$(allocate_port)"
  fi

  if db_exists "$db"; then
    echo "==> database $db already exists"
  else
    echo "==> creating database $db"
    compose exec -T db createdb -U "$DB_USER" "$db"
  fi

  cat > "$app/.env" <<EOF
DATABASE_URL="postgresql://$DB_USER:onboard@localhost:$DB_PORT/$db"
PORT=$port
APP_URL="http://localhost:$port"
EOF

  # node_modules is gitignored, so a fresh worktree has none.
  echo "==> npm install"
  (cd "$app" && npm install --silent)
  # `migrate deploy` does not generate the client the way `migrate dev` does,
  # and there is no postinstall hook — without this the dev server dies on
  # "Cannot find module '.prisma/client/default'".
  echo "==> prisma generate"
  (cd "$app" && npx prisma generate)
  echo "==> prisma migrate deploy"
  (cd "$app" && npx prisma migrate deploy)

  echo
  echo "ready: $app"
  echo "  branch   $name"
  echo "  url      http://localhost:$port"
  echo "  database $db"
  echo
  echo "  cd $app && npm run dev"
}

cmd_list() {
  printf '%-45s %-18s %-7s %s\n' PATH BRANCH PORT DATABASE
  local path
  while IFS= read -r path; do
    local branch port db
    branch="$(git -C "$path" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
    port='-'; db='-'
    if [ -f "$path/onboard/.env" ]; then
      port="$(sed -n 's/^PORT=//p' "$path/onboard/.env" | tr -d '"' | head -1)"
      db="$(sed -n 's|^DATABASE_URL=.*/||p' "$path/onboard/.env" | tr -d '"' | head -1)"
    fi
    printf '%-45s %-18s %-7s %s\n' "$path" "$branch" "${port:--}" "${db:--}"
  done < <(worktree_paths)
}

cmd_remove() {
  local name="${1:?usage: worktree.sh remove <name>}"
  local slug wt db
  slug="$(slugify "$name")"
  wt="${WORKTREE_DIR:-$PARENT/onboard-$slug}"
  db="onboard_$slug"

  [ "$wt" = "$MAIN_ROOT" ] && { echo "refusing to remove the main checkout" >&2; exit 1; }

  echo "This will delete the worktree $wt and DROP the database $db."
  read -r -p "Type the name to confirm: " confirm
  [ "$confirm" = "$name" ] || { echo "aborted"; exit 1; }

  if [ -d "$wt" ]; then
    # Without --force this refuses to discard uncommitted work, which is what
    # we want; re-run with FORCE=1 to override deliberately.
    git worktree remove ${FORCE:+--force} "$wt"
  else
    git worktree prune
  fi

  ensure_db_up
  if db_exists "$db"; then
    compose exec -T db dropdb -U "$DB_USER" "$db"
    echo "dropped $db"
  fi
  echo "removed $wt"
}

case "${1:-}" in
  add)    shift; cmd_add "$@" ;;
  list)   shift; cmd_list ;;
  remove) shift; cmd_remove "$@" ;;
  *) sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
