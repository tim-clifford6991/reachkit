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
# **One run, one database (`--run`, issue #220).** Every suite that reaches
# the substrate begins by dropping and rebuilding `public`, so two runs
# sharing a database delete each other's rows mid-flight: the layout sweep's
# seeded account vanishes and every `/app` address redirects to `/signin`,
# which reads exactly like a broken screen. Passing `--run [id]` gives this
# run its own database — `reachkit_scratch_<id>` — with its own PostgREST,
# its own proxy and its own postgres-meta on ports derived from the id, so
# concurrent runs never share state and no lock is needed.
#
# The id defaults to the basename of the current directory, which on this
# layout is the worktree — so each implementer gets one database and reuses
# it, rather than accumulating one per invocation.
#
# **CI passes no `--run` and is unchanged**: one job, one runner, one
# `postgres:18` service container, and the same ports and database name as
# before.
#
# Writes the generated keys to `$GITHUB_ENV` when running under Actions, and
# prints every binding as an `export` line on **stdout** so a local caller
# can `eval "$(scripts/db-substrate/up.sh --run)"`. Progress goes to stderr,
# so that `eval` sees bindings and nothing else.
set -euo pipefail

# The directory the caller ran this from, captured **before** the `cd` below
# — on this layout that is the worktree, and it is what `--run` names a run
# after. Reading it after the `cd` would name every run `db_substrate`.
CALLER_DIR="$(basename "$PWD")"
# The same directory in full, for the state file: it is what lets `up.sh`
# refuse a second stack for a worktree that already has one, and what lets
# `reap.sh` tell a live worktree from a deleted one (issue #273).
CALLER_PATH="$PWD"
cd "$(dirname "$0")"

# --- The run id ------------------------------------------------------------
#
# `--run` with no value takes the caller's directory name; `--run <id>` takes
# what it is given. No flag at all is the shared substrate CI uses.
RUN_ID=""
if [[ "${1:-}" == "--run" ]]; then
  RUN_ID="${2:-$CALLER_DIR}"
elif [[ $# -gt 0 ]]; then
  echo "db-substrate: unknown argument '$1' (expected --run [id])" >&2
  exit 2
fi

# A stable, filesystem-and-Postgres-safe slug, and a port offset derived from
# it. Deterministic on purpose: re-running for the same id finds the services
# it started last time already listening and leaves them alone, which is what
# makes this idempotent per run rather than only per machine.
if [[ -n "$RUN_ID" ]]; then
  # `printf` and not a here-string: the latter appends a newline, which
  # `tr -c` turns into a trailing `_` and Postgres then carries in the
  # database name for the life of the run.
  RUN_SLUG="$(printf '%s' "$RUN_ID" | tr -c 'a-zA-Z0-9' '_' | tr 'A-Z' 'a-z' | cut -c1-40)"
  # 0-199, doubled and offset so the three ports of one run cannot collide
  # with the three of another, nor with the shared substrate's 3001/3002/8090.
  RUN_OFFSET=$(( $(cksum <<<"$RUN_SLUG" | cut -d' ' -f1) % 200 ))
fi

POSTGREST_IMAGE="postgrest/postgrest:v16.2"
# postgres-meta comes from npm, not from a container: the checked-in
# `src/lib/db/types.generated.ts` was produced by this package, and the
# `supabase/postgres-meta:v0.99.0` image — same version number — emits `Json`
# where the package emits `NonNullable<Json>` for a not-null jsonb column.
# `tests/db/clients.test.ts`'s staleness check diffs those bytes, so the
# generator has to be the same build, not merely the same release.
PGMETA_PACKAGE="@supabase/postgres-meta@0.99.0"
PGMETA_HOME="${PGMETA_HOME:-${RUNNER_TEMP:-/tmp}/reachkit-pgmeta}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-reachkit}"
DB_PASSWORD="${DB_PASSWORD:-reachkit}"
if [[ -n "$RUN_ID" ]]; then
  DB_NAME="${DB_NAME:-reachkit_scratch_${RUN_SLUG}}"
  POSTGREST_PORT="${POSTGREST_PORT:-$(( 3200 + RUN_OFFSET * 3 ))}"
  PROXY_PORT="${PROXY_PORT:-$(( 3201 + RUN_OFFSET * 3 ))}"
  PGMETA_PORT="${PGMETA_PORT:-$(( 3202 + RUN_OFFSET * 3 ))}"
else
  DB_NAME="${DB_NAME:-reachkit_scratch}"
  POSTGREST_PORT="${POSTGREST_PORT:-3002}"
  PROXY_PORT="${PROXY_PORT:-3001}"
  PGMETA_PORT="${PGMETA_PORT:-8090}"
fi

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
ADMIN_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/postgres"

# --- Where a run records what it started (issue #273) -----------------------
#
# One file per run, holding the ports, the database and the pids. It is what
# makes the lifecycle a lifecycle: `down.sh` reads it to stop exactly what
# this run started, and `reap.sh` reads all of them to find stacks whose
# worktree is gone.
#
# **It also fixes what "already answering" meant.** Until #273 this script
# asked `curl` whether *something* answered a port and, if so, left it alone.
# Two things went wrong with that, and both cost the box a day: a **foreign**
# server on a derived port was silently adopted as this run's PostgREST — the
# suite then failed with "PostgREST never picked up the migrated schema",
# which reads like a JWT problem and is not — and a worktree given a second
# run id got a genuinely second stack on different ports, which is how
# issue-247 came to have three. 59 processes held 2.4 GB, 41 of them
# orphaned.
#
# So liveness is no longer the question. The question is whether **this run's
# own** processes are alive, and the answer is a recorded pid.
STATE_DIR="${REACHKIT_SUBSTRATE_STATE:-/tmp/reachkit-substrate}"
STATE_FILE="${STATE_DIR}/${RUN_SLUG:-shared}.state"


# `--network host` inside the docker containers, so 127.0.0.1 means the same
# thing there as it does to `psql` and to vitest.
DOCKER_DB_URL="$DATABASE_URL"

# Progress on stderr, bindings on stdout — see the header on `eval`.
log() { echo "db-substrate: $*" >&2; }

# Answers `$1` (a URL) within `$2` seconds?
wait_for_http() {
  local url="$1" seconds="$2" i
  for ((i = 0; i < seconds * 2; i++)); do
    if curl -s -o /dev/null "$url"; then return 0; fi
    sleep 0.5
  done
  return 1
}

# Is this pid alive and one of ours? Both halves matter: a pid is reused by
# the kernel, so "alive" alone would adopt whatever process inherited the
# number.
ours_and_alive() {
  local pid="$1" pattern="$2"
  [[ -n "$pid" ]] && [[ -d "/proc/$pid" ]] && tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | grep -q "$pattern"
}

# --- 0. Reuse, or refuse — never duplicate (issue #273) ---------------------
#
# A run that already has a live stack prints its bindings and stops. A
# worktree that already has one **under a different id** is refused, because
# the second stack is not a mistake this script can fix by starting a third:
# the caller chose an id, and two ids for one directory is what put 1.66 GB
# of orphans on this box.
mkdir -p "$STATE_DIR"

if [[ -n "$RUN_ID" && -f "$STATE_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$STATE_FILE"
  if ours_and_alive "${STATE_POSTGREST_PID:-}" postgrest; then
    log "run ${RUN_ID} already up — reusing db ${STATE_DB_NAME}, ports ${STATE_POSTGREST_PORT}/${STATE_PROXY_PORT}/${STATE_PGMETA_PORT}"
    cat <<EOF
export REACHKIT_DB_NAME=${STATE_DB_NAME}
export PGMETA_PORT=${STATE_PGMETA_PORT}
export DATABASE_URL=${STATE_DATABASE_URL}
export SUPABASE_URL=http://127.0.0.1:${STATE_PROXY_PORT}
export SUPABASE_ANON_KEY=${STATE_ANON}
export SUPABASE_SERVICE_ROLE=${STATE_SERVICE_ROLE}
export SUPABASE_SERVICE_ROLE_KEY=${STATE_SERVICE_ROLE}
EOF
    exit 0
  fi
  log "run ${RUN_ID} has a stale state file (its processes are gone) — starting fresh"
  rm -f "$STATE_FILE"
fi

if [[ -n "$RUN_ID" ]]; then
  for other in "$STATE_DIR"/*.state; do
    [[ -e "$other" ]] || continue
    [[ "$other" == "$STATE_FILE" ]] && continue
    # shellcheck disable=SC1090
    ( source "$other"
      if [[ "${STATE_CALLER_PATH:-}" == "$CALLER_PATH" ]] && ours_and_alive "${STATE_POSTGREST_PID:-}" postgrest; then
        echo "db-substrate: ${CALLER_PATH} already has a live stack as run '${STATE_RUN_ID}'." >&2
        echo "db-substrate: use it (scripts/db-substrate/up.sh --run ${STATE_RUN_ID}), or stop it first" >&2
        echo "db-substrate: (scripts/db-substrate/down.sh --run ${STATE_RUN_ID}). Two ids for one worktree" >&2
        echo "db-substrate: is what left 41 orphaned processes holding 1.66 GB on 2026-09-07 (#273)." >&2
        exit 3
      fi ) || exit $?
  done
fi

# --- 1. PostgreSQL ---------------------------------------------------------
log "waiting for postgres at ${DB_HOST}:${DB_PORT}"
for ((i = 0; i < 120; i++)); do
  if PGPASSWORD="$DB_PASSWORD" psql "$ADMIN_URL" -Atqc 'select 1' >/dev/null 2>&1; then break; fi
  sleep 0.5
done

# This run's own database, created once and reused. `create database` cannot
# run inside a transaction and has no `if not exists`, so existence is asked
# first — the same shape `shim.sql` uses for its roles. Without `--run` this
# is skipped entirely and the shared `reachkit_scratch` is used, which is
# what CI does.
if [[ -n "$RUN_ID" ]]; then
  if [[ "$(PGPASSWORD="$DB_PASSWORD" psql "$ADMIN_URL" -Atqc "select 1 from pg_database where datname = '${DB_NAME}'")" != "1" ]]; then
    log "creating database ${DB_NAME}"
    PGPASSWORD="$DB_PASSWORD" psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "create database \"${DB_NAME}\";"
  fi
fi

PGPASSWORD="$DB_PASSWORD" psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc 'select version()' >&2

# --- 2. Roles, auth schema, auth.uid()/auth.role() -------------------------
log "applying shim.sql"
PGPASSWORD="$DB_PASSWORD" psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f shim.sql

# --- 3. Keys ---------------------------------------------------------------
KEYS="$(node keys.mjs)"
ANON="$(sed -n 's/^ANON=//p' <<<"$KEYS")"
SERVICE_ROLE="$(sed -n 's/^SERVICE_ROLE=//p' <<<"$KEYS")"
SECRET="$(sed -n 's/^SECRET=//p' <<<"$KEYS")"

# --- 4. PostgREST ----------------------------------------------------------
#
# Docker in CI; a native binary where there is none. The native path exists
# because per-run isolation needs a **second** instance, and the machine this
# substrate was built for has no Docker at all (owner ruling 2026-09-02) —
# so without it `--run` would work in CI and nowhere else, which is the
# opposite of what issue #220 is about. `POSTGREST_BIN` names a binary
# explicitly; otherwise one on `PATH` is used. CI has neither, so CI takes
# the container exactly as before.
POSTGREST_BIN="${POSTGREST_BIN:-$(command -v postgrest || true)}"
CONTAINER_SUFFIX="${RUN_ID:+-$RUN_SLUG}"

if curl -s -o /dev/null "http://127.0.0.1:${POSTGREST_PORT}/"; then
  log "postgrest already answering on :${POSTGREST_PORT}"
elif [[ -n "$POSTGREST_BIN" ]]; then
  log "starting ${POSTGREST_BIN} on :${POSTGREST_PORT}"
  PGRST_DB_URI="$DATABASE_URL" \
  PGRST_DB_SCHEMAS=public \
  PGRST_DB_ANON_ROLE=anon \
  PGRST_DB_POOL=4 \
  PGRST_JWT_SECRET="$SECRET" \
  PGRST_SERVER_HOST=127.0.0.1 \
  PGRST_SERVER_PORT="$POSTGREST_PORT" \
    nohup "$POSTGREST_BIN" > "/tmp/postgrest${CONTAINER_SUFFIX}.log" 2>&1 &
  POSTGREST_PID=$!
  wait_for_http "http://127.0.0.1:${POSTGREST_PORT}/" 60 || {
    log "postgrest did not come up"; tail -40 "/tmp/postgrest${CONTAINER_SUFFIX}.log" >&2; exit 1;
  }
else
  command -v docker >/dev/null || {
    log "nothing answering :${POSTGREST_PORT}, no docker, and no PostgREST binary — set POSTGREST_BIN or put one on PATH"; exit 1;
  }
  log "starting ${POSTGREST_IMAGE} on :${POSTGREST_PORT}"
  docker run -d --name "reachkit-postgrest${CONTAINER_SUFFIX}" --network host \
    -e PGRST_DB_URI="$DOCKER_DB_URL" \
    -e PGRST_DB_SCHEMAS=public \
    -e PGRST_DB_ANON_ROLE=anon \
    -e PGRST_DB_POOL=4 \
    -e PGRST_JWT_SECRET="$SECRET" \
    -e PGRST_SERVER_HOST=127.0.0.1 \
    -e PGRST_SERVER_PORT="$POSTGREST_PORT" \
    "$POSTGREST_IMAGE" >/dev/null
  wait_for_http "http://127.0.0.1:${POSTGREST_PORT}/" 60 || {
    log "postgrest did not come up"; docker logs "reachkit-postgrest${CONTAINER_SUFFIX}" 2>&1 | tail -40 >&2; exit 1;
  }
fi

# --- 5. The /rest/v1 proxy -------------------------------------------------
if curl -s -o /dev/null "http://127.0.0.1:${PROXY_PORT}/"; then
  log "proxy already answering on :${PROXY_PORT}"
else
  log "starting rest-v1-proxy on :${PROXY_PORT}"
  POSTGREST_PORT="$POSTGREST_PORT" PROXY_PORT="$PROXY_PORT" \
    nohup node rest-v1-proxy.mjs > "/tmp/rest-v1-proxy${CONTAINER_SUFFIX}.log" 2>&1 &
  PROXY_PID=$!
  wait_for_http "http://127.0.0.1:${PROXY_PORT}/" 30 || {
    log "proxy did not come up"; cat "/tmp/rest-v1-proxy${CONTAINER_SUFFIX}.log" >&2; exit 1;
  }
fi

# --- 6. postgres-meta ------------------------------------------------------
if curl -s -o /dev/null "http://127.0.0.1:${PGMETA_PORT}/health"; then
  log "postgres-meta already answering on :${PGMETA_PORT}"
else
  SERVER="${PGMETA_HOME}/node_modules/@supabase/postgres-meta/dist/server/server.js"
  if [[ ! -f "$SERVER" ]]; then
    log "installing ${PGMETA_PACKAGE} into ${PGMETA_HOME}"
    mkdir -p "$PGMETA_HOME"
    npm install --no-save --no-audit --no-fund --prefix "$PGMETA_HOME" "$PGMETA_PACKAGE" >/dev/null
  fi
  log "starting postgres-meta on :${PGMETA_PORT}"
  PG_META_PORT="$PGMETA_PORT" PG_META_DB_URL="$DATABASE_URL" \
    nohup node "$SERVER" > "/tmp/pg-meta${CONTAINER_SUFFIX}.log" 2>&1 &
  PGMETA_PID=$!
  wait_for_http "http://127.0.0.1:${PGMETA_PORT}/health" 60 || {
    log "postgres-meta did not come up"; tail -40 "/tmp/pg-meta${CONTAINER_SUFFIX}.log" >&2; exit 1;
  }
fi

# --- 6b. Record what this run started (issue #273) -------------------------
#
# Written last, when every service is up, so a state file's existence means
# a stack that answered rather than one that was attempted. `down.sh` and
# `reap.sh` read exactly this, which is why the pids are recorded rather
# than re-derived from a port: a port says something is listening, and only
# a pid says it is ours.
#
# A run that reused an already-answering service records no pid for it and
# `down.sh` says so rather than killing a process it cannot prove is this
# run's — the same discipline, one level down.
if [[ -n "$RUN_ID" ]]; then
  cat > "$STATE_FILE" <<EOF
STATE_RUN_ID=${RUN_ID}
STATE_CALLER_PATH=${CALLER_PATH}
STATE_DB_NAME=${DB_NAME}
STATE_DATABASE_URL=${DATABASE_URL}
STATE_ADMIN_URL=${ADMIN_URL}
STATE_POSTGREST_PORT=${POSTGREST_PORT}
STATE_PROXY_PORT=${PROXY_PORT}
STATE_PGMETA_PORT=${PGMETA_PORT}
STATE_POSTGREST_PID=${POSTGREST_PID:-}
STATE_PROXY_PID=${PROXY_PID:-}
STATE_PGMETA_PID=${PGMETA_PID:-}
STATE_ANON=${ANON}
STATE_SERVICE_ROLE=${SERVICE_ROLE}
EOF
  log "recorded run ${RUN_ID} in ${STATE_FILE}"
fi

# --- 7. Report -------------------------------------------------------------
# The same bindings, in the shape Actions reads. Identical in content to the
# `export` lines below, so a job that ever passes `--run` needs no second
# edit here; with no `--run` every value is the one CI has always had.
if [[ -n "${GITHUB_ENV:-}" ]]; then
  {
    echo "REACHKIT_DB_NAME=${DB_NAME}"
    echo "PGMETA_PORT=${PGMETA_PORT}"
    echo "DATABASE_URL=${DATABASE_URL}"
    echo "SUPABASE_URL=http://127.0.0.1:${PROXY_PORT}"
    echo "SUPABASE_ANON_KEY=${ANON}"
    echo "SUPABASE_SERVICE_ROLE=${SERVICE_ROLE}"
    echo "SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE}"
  } >> "$GITHUB_ENV"
fi

# Every binding this run needs, as `export` lines a caller can `eval`. The
# database name and the three ports are what differ between runs, so they
# travel here rather than being re-derived by whoever reads them.
cat <<EOF
export REACHKIT_DB_NAME=${DB_NAME}
export PGMETA_PORT=${PGMETA_PORT}
export DATABASE_URL=${DATABASE_URL}
export SUPABASE_URL=http://127.0.0.1:${PROXY_PORT}
export SUPABASE_ANON_KEY=${ANON}
export SUPABASE_SERVICE_ROLE=${SERVICE_ROLE}
export SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE}
EOF

log "up${RUN_ID:+ (run ${RUN_SLUG})} — db ${DB_NAME}, postgrest :${POSTGREST_PORT}, proxy :${PROXY_PORT}, postgres-meta :${PGMETA_PORT}"
