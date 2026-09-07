#!/usr/bin/env bash
# scripts/db-substrate/up.sh
#
# Brings up everything the `db` vitest project talks to, against a
# PostgreSQL 18 server that is already listening (a `postgres:18` service
# container in CI; a native cluster on a machine without Docker):
#
#   * the roles, `auth` schema and `auth.uid()`/`auth.role()` shims that
#     live outside `supabase/migrations/` (`shim.sql`)
#   * PostgREST on :3002, with the substrate's generated JWT secret
#   * the `/rest/v1` proxy on :3001 — the documented `SUPABASE_URL`
#   * postgres-meta on :8090, the type generator the staleness check diffs
#
# Idempotent: a service whose port already answers is left alone, so this is
# also the local start script on a box where the substrate is already up.
#
# Writes the generated keys to `$GITHUB_ENV` when running under Actions;
# always prints them as `NAME=value` lines on stdout for `eval`.
set -euo pipefail
cd "$(dirname "$0")"

POSTGREST_IMAGE="postgrest/postgrest:v16.2"
PGMETA_IMAGE="supabase/postgres-meta:v0.99.0"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-reachkit}"
DB_PASSWORD="${DB_PASSWORD:-reachkit}"
DB_NAME="${DB_NAME:-reachkit_scratch}"
POSTGREST_PORT="${POSTGREST_PORT:-3002}"
PROXY_PORT="${PROXY_PORT:-3001}"
PGMETA_PORT="${PGMETA_PORT:-8090}"

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# `--network host` inside the docker containers, so 127.0.0.1 means the same
# thing there as it does to `psql` and to vitest.
DOCKER_DB_URL="$DATABASE_URL"

log() { echo "db-substrate: $*"; }

# Answers `$1` (a URL) within `$2` seconds?
wait_for_http() {
  local url="$1" seconds="$2" i
  for ((i = 0; i < seconds * 2; i++)); do
    if curl -s -o /dev/null "$url"; then return 0; fi
    sleep 0.5
  done
  return 1
}

# --- 1. PostgreSQL ---------------------------------------------------------
log "waiting for postgres at ${DB_HOST}:${DB_PORT}"
for ((i = 0; i < 120; i++)); do
  if PGPASSWORD="$DB_PASSWORD" psql "$DATABASE_URL" -Atqc 'select 1' >/dev/null 2>&1; then break; fi
  sleep 0.5
done
PGPASSWORD="$DB_PASSWORD" psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc 'select version()'

# --- 2. Roles, auth schema, auth.uid()/auth.role() -------------------------
log "applying shim.sql"
PGPASSWORD="$DB_PASSWORD" psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f shim.sql

# --- 3. Keys ---------------------------------------------------------------
KEYS="$(node keys.mjs)"
ANON="$(sed -n 's/^ANON=//p' <<<"$KEYS")"
SERVICE_ROLE="$(sed -n 's/^SERVICE_ROLE=//p' <<<"$KEYS")"
SECRET="$(sed -n 's/^SECRET=//p' <<<"$KEYS")"

# --- 4. PostgREST ----------------------------------------------------------
if curl -s -o /dev/null "http://127.0.0.1:${POSTGREST_PORT}/"; then
  log "postgrest already answering on :${POSTGREST_PORT}"
else
  command -v docker >/dev/null || {
    log "no docker on this host and nothing answering :${POSTGREST_PORT} — start PostgREST natively first"; exit 1;
  }
  log "starting ${POSTGREST_IMAGE} on :${POSTGREST_PORT}"
  docker run -d --name reachkit-postgrest --network host \
    -e PGRST_DB_URI="$DOCKER_DB_URL" \
    -e PGRST_DB_SCHEMAS=public \
    -e PGRST_DB_ANON_ROLE=anon \
    -e PGRST_DB_POOL=4 \
    -e PGRST_JWT_SECRET="$SECRET" \
    -e PGRST_SERVER_HOST=127.0.0.1 \
    -e PGRST_SERVER_PORT="$POSTGREST_PORT" \
    "$POSTGREST_IMAGE" >/dev/null
  wait_for_http "http://127.0.0.1:${POSTGREST_PORT}/" 60 || {
    log "postgrest did not come up"; docker logs reachkit-postgrest 2>&1 | tail -40; exit 1;
  }
fi

# --- 5. The /rest/v1 proxy -------------------------------------------------
if curl -s -o /dev/null "http://127.0.0.1:${PROXY_PORT}/"; then
  log "proxy already answering on :${PROXY_PORT}"
else
  log "starting rest-v1-proxy on :${PROXY_PORT}"
  POSTGREST_PORT="$POSTGREST_PORT" PROXY_PORT="$PROXY_PORT" \
    nohup node rest-v1-proxy.mjs > /tmp/rest-v1-proxy.log 2>&1 &
  wait_for_http "http://127.0.0.1:${PROXY_PORT}/" 30 || {
    log "proxy did not come up"; cat /tmp/rest-v1-proxy.log; exit 1;
  }
fi

# --- 6. postgres-meta ------------------------------------------------------
if curl -s -o /dev/null "http://127.0.0.1:${PGMETA_PORT}/health"; then
  log "postgres-meta already answering on :${PGMETA_PORT}"
else
  command -v docker >/dev/null || {
    log "no docker on this host and nothing answering :${PGMETA_PORT} — start postgres-meta natively first"; exit 1;
  }
  log "starting ${PGMETA_IMAGE} on :${PGMETA_PORT}"
  docker run -d --name reachkit-pg-meta --network host \
    -e PG_META_PORT="$PGMETA_PORT" \
    -e PG_META_DB_URL="$DOCKER_DB_URL" \
    "$PGMETA_IMAGE" >/dev/null
  wait_for_http "http://127.0.0.1:${PGMETA_PORT}/health" 60 || {
    log "postgres-meta did not come up"; docker logs reachkit-pg-meta 2>&1 | tail -40; exit 1;
  }
fi

# --- 7. Report -------------------------------------------------------------
if [[ -n "${GITHUB_ENV:-}" ]]; then
  {
    echo "DATABASE_URL=${DATABASE_URL}"
    echo "SUPABASE_URL=http://127.0.0.1:${PROXY_PORT}"
    echo "SUPABASE_ANON_KEY=${ANON}"
    echo "SUPABASE_SERVICE_ROLE=${SERVICE_ROLE}"
    echo "SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE}"
  } >> "$GITHUB_ENV"
fi

log "up — postgrest :${POSTGREST_PORT}, proxy :${PROXY_PORT}, postgres-meta :${PGMETA_PORT}"
