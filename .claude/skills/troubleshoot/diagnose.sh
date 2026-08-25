#!/usr/bin/env bash
# Diagnostic checks for the onboard app's local dev environment.
# Prints one line per check as STATUS|CHECK NAME|DETAIL (STATUS: OK, WARN, FAIL).
# Never exits non-zero - the output lines ARE the report.


set -uo pipefail


SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ONBOARD_DIR="$(cd "$SCRIPT_DIR/../../../onboard" 2>/dev/null && pwd || true)"


report() { echo "$1|$2|$3"; }


# 1. Docker installed
if command -v docker >/dev/null 2>&1; then
 report OK "Docker installed" "$(docker --version)"
else
 report FAIL "Docker installed" "docker CLI not found in PATH"
fi


# 2. Docker daemon running
DOCKER_UP=0
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
 report OK "Docker daemon running" "daemon responding"
 DOCKER_UP=1
else
 report FAIL "Docker daemon running" "'docker info' failed - daemon not running or not accessible"
fi


# 3. onboard/ directory found
if [ -n "$ONBOARD_DIR" ]; then
 report OK "onboard/ directory found" "$ONBOARD_DIR"
else
 report FAIL "onboard/ directory found" "could not locate onboard/ relative to this skill"
fi


# 4. Compose container state
CID=""
if [ "$DOCKER_UP" = "1" ] && [ -n "$ONBOARD_DIR" ]; then
 CID=$(cd "$ONBOARD_DIR" && docker compose ps -q db 2>/dev/null)
 if [ -z "$CID" ]; then
   report FAIL "Postgres container running" "no 'db' container found (docker compose up -d not run?)"
 else
   STATE=$(docker inspect -f '{{.State.Status}}' "$CID" 2>/dev/null)
   if [ "$STATE" = "running" ]; then
     report OK "Postgres container running" "container ${CID:0:12} is running"
   else
     report FAIL "Postgres container running" "container ${CID:0:12} exists but state is '$STATE'"
   fi
 fi
else
 report WARN "Postgres container running" "skipped - docker unavailable"
fi


# 5. Node installed
if command -v node >/dev/null 2>&1; then
 report OK "Node installed" "$(node --version)"
else
 report FAIL "Node installed" "node not found in PATH"
fi


# 6. Port 3000 (Next.js dev server)
if command -v lsof >/dev/null 2>&1; then
 P3000=$(lsof -nP -iTCP:3000 -sTCP:LISTEN 2>/dev/null | awk 'NR==2{print $1, $2}')
 if [ -n "$P3000" ]; then
   report WARN "Port 3000 free (Next.js)" "in use by: $P3000"
 else
   report OK "Port 3000 free (Next.js)" "free"
 fi
else
 report WARN "Port 3000 free (Next.js)" "lsof not available, skipped"
fi


# 7. Port 5434 (Postgres)
if command -v lsof >/dev/null 2>&1; then
 P5434=$(lsof -nP -iTCP:5434 -sTCP:LISTEN 2>/dev/null | awk 'NR==2{print $1, $2}')
 if [ -n "$P5434" ]; then
   report OK "Port 5434 occupied (Postgres)" "by: $P5434 (expected if the db container owns it)"
 else
   report WARN "Port 5434 occupied (Postgres)" "nothing listening - db container likely not up"
 fi
else
 report WARN "Port 5434 occupied (Postgres)" "lsof not available, skipped"
fi


# 8. .env present with DATABASE_URL
if [ -n "$ONBOARD_DIR" ] && [ -f "$ONBOARD_DIR/.env" ] && grep -q '^DATABASE_URL=' "$ONBOARD_DIR/.env"; then
 report OK ".env / DATABASE_URL present" "$ONBOARD_DIR/.env"
else
 report FAIL ".env / DATABASE_URL present" "onboard/.env missing or has no DATABASE_URL"
fi


# 9. node_modules installed
if [ -n "$ONBOARD_DIR" ] && [ -d "$ONBOARD_DIR/node_modules" ]; then
 report OK "Dependencies installed" "onboard/node_modules present"
else
 report FAIL "Dependencies installed" "onboard/node_modules missing (run npm install)"
fi


# 10. Prisma Client generated and up to date
if [ -n "$ONBOARD_DIR" ] && [ -d "$ONBOARD_DIR/node_modules" ]; then
 if [ ! -d "$ONBOARD_DIR/node_modules/.prisma/client" ]; then
   report FAIL "Prisma Client generated" "node_modules/.prisma/client missing (run npx prisma generate)"
 elif [ -n "$(find "$ONBOARD_DIR/prisma/schema.prisma" -newer "$ONBOARD_DIR/node_modules/.prisma/client" 2>/dev/null)" ]; then
   report WARN "Prisma Client generated" "schema.prisma is newer than the generated client (run npx prisma generate)"
 else
   report OK "Prisma Client generated" "node_modules/.prisma/client is up to date with schema.prisma"
 fi
else
 report WARN "Prisma Client generated" "skipped - node_modules not present"
fi


# 11. Database reachable
DB_OK=0
if [ -n "$CID" ]; then
 if docker exec "$CID" pg_isready -U onboard -d onboard >/dev/null 2>&1; then
   report OK "Database accessible" "pg_isready succeeded"
   DB_OK=1
 else
   report FAIL "Database accessible" "pg_isready failed against container ${CID:0:12}"
 fi
else
 report WARN "Database accessible" "skipped - no running db container"
fi


# 12. Migrations applied
TABLE_COUNT=""
if [ "$DB_OK" = "1" ]; then
 TABLE_COUNT=$(docker exec "$CID" psql -U onboard -d onboard -tAc \
   "select count(*) from information_schema.tables where table_schema='public' and table_name='User';" 2>/dev/null | tr -d '[:space:]')
 if [ "$TABLE_COUNT" = "1" ]; then
   report OK "Migrations applied" "'User' table exists"
 else
   report FAIL "Migrations applied" "'User' table missing (run npx prisma migrate dev)"
 fi
else
 report WARN "Migrations applied" "skipped - database not accessible"
fi


# 13. Seed data present
if [ "$DB_OK" = "1" ] && [ "$TABLE_COUNT" = "1" ]; then
 USERS=$(docker exec "$CID" psql -U onboard -d onboard -tAc \
   "select email || ':' || role from \"User\" order by id;" 2>/dev/null)
 if [ -z "$USERS" ]; then
   report FAIL "Seed data present" "no users found (run npm run seed)"
 else
   SUMMARY=$(echo "$USERS" | paste -sd, -)
   report OK "Seed data present" "$SUMMARY"
 fi
else
 report WARN "Seed data present" "skipped - migrations not confirmed"
fi


