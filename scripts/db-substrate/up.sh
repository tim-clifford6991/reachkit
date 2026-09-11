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
#     — plus its admin app, which the package binds on :8091 and which no
#     setting can move (see the port block below)
#
# Idempotent **by recorded pid, never by liveness** (issue #296). Re-running
# for the same run finds its own services through the state file and returns
# their bindings; a port answered by anything else stops the script and names
# what holds it. "Something answers, so it must be mine" is the assumption
# that had one run reading and dropping another run's schema, and it is gone
# from every probe in this file.
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
# `down.sh --orphans` tell a live worktree from a deleted one (issue #273).
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
  RUN_OFFSET=$(( $(cksum <<<"$RUN_SLUG" | cut -d' ' -f1) % 200 ))
fi

# How wide one run's block of ports is.
#
# **Four, not three** (issue #296). The stack binds four ports, not the three
# it used to reserve: `postgres-meta` listens on `PG_META_PORT` *and* starts
# an admin app on `PG_META_PORT + 1`, hard-coded in the package —
# `const adminPort = PG_META_PORT + 1` in `dist/server/server.js`, with no
# environment binding to move it. Reserving three put that fourth port on the
# *next* offset's PostgREST, so every pair of adjacent offsets collided by
# construction. That is not a hash collision to be made rarer; it is an
# under-reservation, and it was deterministic: `issue-291` (offset 117) bound
# 3554 and `issue-244` (offset 118) reserved it.
#
# 200 offsets x 4 ports from 3200 is 3200-3999, which is what the block below
# stays inside.
PORTS_PER_RUN=4

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
  RUN_PORT_BASE=$(( 3200 + RUN_OFFSET * PORTS_PER_RUN ))
  DB_NAME="${DB_NAME:-reachkit_scratch_${RUN_SLUG}}"
  POSTGREST_PORT="${POSTGREST_PORT:-$(( RUN_PORT_BASE + 0 ))}"
  PROXY_PORT="${PROXY_PORT:-$(( RUN_PORT_BASE + 1 ))}"
  PGMETA_PORT="${PGMETA_PORT:-$(( RUN_PORT_BASE + 2 ))}"
else
  DB_NAME="${DB_NAME:-reachkit_scratch}"
  POSTGREST_PORT="${POSTGREST_PORT:-3002}"
  PROXY_PORT="${PROXY_PORT:-3001}"
  PGMETA_PORT="${PGMETA_PORT:-8090}"
fi
# postgres-meta's admin app. Derived rather than chosen, because the package
# derives it: naming it here is what lets this run reserve it, refuse a
# foreigner on it, and record it — the fourth port is a port of this run's
# like the other three, and the run block is sized so it lands on
# `RUN_PORT_BASE + 3` rather than on the next run's PostgREST.
PGMETA_ADMIN_PORT=$(( PGMETA_PORT + 1 ))

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
ADMIN_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/postgres"

# --- Where a run records what it started (issue #273) -----------------------
#
# One file per run, holding the ports, the database and the pids. It is what
# makes the lifecycle a lifecycle: `down.sh` reads it to stop exactly what
# this run started, and `down.sh --orphans` reads all of them to find stacks whose
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

# The pid listening on `$1`, or nothing. `ss` is iproute2, which is on the CI
# runner and on this box; where it is missing the answer is simply unknown and
# the refusal below still refuses — it just cannot name the holder.
listener_pid() {
  ss -lptnH "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2
}

# The run whose state file claims `$1`, or nothing. Answers the only question
# a human then has: *whose* stack is on my port.
run_claiming_port() {
  local port="$1" file
  for file in "$STATE_DIR"/*.state; do
    [[ -e "$file" ]] || continue
    if grep -qE "^STATE_(POSTGREST|PROXY|PGMETA|PGMETA_ADMIN)_PORT=${port}\$" "$file"; then
      sed -n 's/^STATE_RUN_ID=//p' "$file"
      return 0
    fi
  done
}

# Refuse a port this run does not own — issue #296, and the half of #273 that
# was left undone.
#
# By the time this is called, step 0 has already proved that this run has no
# live stack of its own: a recorded pid that answered would have exited there,
# printing its bindings. So a listener here is *somebody else's*, and the two
# things that used to happen instead were both wrong. Adopting it pointed
# every read in this run at another worktree's database — one run silently
# reading and dropping another's schema, which is the exact failure `--run`
# exists to prevent. Starting beside it fails on `EADDRINUSE` deep inside a
# service's own log, which reads like anything but a port clash.
refuse_if_held() {
  local port="$1" service="$2" override="$3" pid claim
  curl -s -o /dev/null --max-time 2 "http://127.0.0.1:${port}/" || return 0
  pid="$(listener_pid "$port")"
  claim="$(run_claiming_port "$port")"
  log "port ${port} is this run's ${service}, and something else is already answering it."
  log "  held by: ${pid:-an unidentified process}"
  if [[ -n "$claim" ]]; then
    log "  claimed by: run '${claim}' — stop it with scripts/db-substrate/down.sh --run ${claim}"
  else
    log "  claimed by: no run's state file — a stack from before #273, or something"
    log "              else entirely. Stop it by hand${pid:+ (kill ${pid})}; this will not adopt it."
  fi
  log "  or pass ${override} to move this run off it."
  log "  Adopting a listener nobody can prove is ours is what put one run's reads on"
  log "  another run's database (#273, #296), so this refuses rather than guesses."
  exit 4
}

# --- What this attempt has started, so a failure leaves none of it ---------
#
# Issue #296: `up.sh` used to exit non-zero having already started PostgREST
# and the proxy, with the state file written last and so naming neither.
# `down.sh` could not see them and a human had to `kill` by pid.
# Everything started is remembered here and stopped by the exit trap unless
# the script reaches its end.
STARTED_PIDS=()
STARTED_NAMES=()
STARTED_CONTAINERS=()
remember_started() { STARTED_NAMES+=("$1"); STARTED_PIDS+=("$2"); }

on_exit() {
  local status=$? i
  (( status == 0 )) && return 0
  (( ${#STARTED_PIDS[@]} + ${#STARTED_CONTAINERS[@]} == 0 )) && return 0
  log "start failed — stopping what this attempt had already started"
  for i in "${!STARTED_PIDS[@]}"; do
    if kill "${STARTED_PIDS[$i]}" 2>/dev/null; then
      log "  stopped ${STARTED_NAMES[$i]} (pid ${STARTED_PIDS[$i]})"
    fi
  done
  for i in "${!STARTED_CONTAINERS[@]}"; do
    docker rm -f "${STARTED_CONTAINERS[$i]}" >/dev/null 2>&1 &&
      log "  removed container ${STARTED_CONTAINERS[$i]}"
  done
}
trap on_exit EXIT

# --- 0. Reuse, or refuse — never duplicate (issue #273) ---------------------
#
# A run that already has a live stack prints its bindings and stops. A
# worktree that already has one **under a different id** is refused, because
# the second stack is not a mistake this script can fix by starting a third:
# the caller chose an id, and two ids for one directory is what put 1.66 GB
# of orphans on this box.
mkdir -p "$STATE_DIR"

# The shared stack is included from #296. It used to be idempotent only
# through the port probes below — "something answers :3002, so it is mine" —
# which is precisely the assumption this issue removes. Recording it and
# reusing it by pid gives it the same lifecycle every `--run` stack has, and
# leaves no path in this file that decides ownership from liveness.
if [[ -f "$STATE_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$STATE_FILE"
  if ours_and_alive "${STATE_POSTGREST_PID:-}" postgrest; then
    log "run ${RUN_ID:-shared} already up — reusing db ${STATE_DB_NAME}, ports ${STATE_POSTGREST_PORT}/${STATE_PROXY_PORT}/${STATE_PGMETA_PORT}"
    # The same bindings a fresh start reports, through both doors: a job that
    # ran this twice would otherwise get its environment written once.
    if [[ -n "${GITHUB_ENV:-}" ]]; then
      {
        echo "REACHKIT_DB_NAME=${STATE_DB_NAME}"
        echo "PGMETA_PORT=${STATE_PGMETA_PORT}"
        echo "DATABASE_URL=${STATE_DATABASE_URL}"
        echo "SUPABASE_URL=http://127.0.0.1:${STATE_PROXY_PORT}"
        echo "SUPABASE_ANON_KEY=${STATE_ANON}"
        echo "SUPABASE_SERVICE_ROLE=${STATE_SERVICE_ROLE}"
        echo "SUPABASE_SERVICE_ROLE_KEY=${STATE_SERVICE_ROLE}"
      } >> "$GITHUB_ENV"
    fi
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
  log "run ${RUN_ID:-shared} has a stale state file (its processes are gone) — starting fresh"
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

# --- 0b. The run's ports are the run's, or this stops (issue #296) ---------
#
# All four, before anything is started. Step 0 has already proved this run has
# no live stack of its own, so a listener on any of these is another run's or a
# stranger's — and starting beside it fails deep inside a service's log
# (`EADDRINUSE` from postgres-meta's admin app was what raised this issue),
# while adopting it is worse still. Refusing here names the port, the holder
# and the run that claims it, at the one moment a human can act on it.
refuse_if_held "$POSTGREST_PORT" postgrest POSTGREST_PORT
refuse_if_held "$PROXY_PORT" proxy PROXY_PORT
refuse_if_held "$PGMETA_PORT" postgres-meta PGMETA_PORT
refuse_if_held "$PGMETA_ADMIN_PORT" "postgres-meta admin" PGMETA_PORT

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

if [[ -n "$POSTGREST_BIN" ]]; then
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
  remember_started postgrest "$POSTGREST_PID"
  wait_for_http "http://127.0.0.1:${POSTGREST_PORT}/" 60 || {
    log "postgrest did not come up"; tail -40 "/tmp/postgrest${CONTAINER_SUFFIX}.log" >&2; exit 1;
  }
else
  command -v docker >/dev/null || {
    log "no docker and no PostgREST binary — set POSTGREST_BIN or put one on PATH"; exit 1;
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
  STARTED_CONTAINERS+=("reachkit-postgrest${CONTAINER_SUFFIX}")
  wait_for_http "http://127.0.0.1:${POSTGREST_PORT}/" 60 || {
    log "postgrest did not come up"; docker logs "reachkit-postgrest${CONTAINER_SUFFIX}" 2>&1 | tail -40 >&2; exit 1;
  }
fi

# --- 5. The /rest/v1 proxy -------------------------------------------------
log "starting rest-v1-proxy on :${PROXY_PORT}"
POSTGREST_PORT="$POSTGREST_PORT" PROXY_PORT="$PROXY_PORT" \
  nohup node rest-v1-proxy.mjs > "/tmp/rest-v1-proxy${CONTAINER_SUFFIX}.log" 2>&1 &
PROXY_PID=$!
remember_started rest-v1-proxy "$PROXY_PID"
wait_for_http "http://127.0.0.1:${PROXY_PORT}/" 30 || {
  log "proxy did not come up"; cat "/tmp/rest-v1-proxy${CONTAINER_SUFFIX}.log" >&2; exit 1;
}

# --- 6. postgres-meta ------------------------------------------------------
SERVER="${PGMETA_HOME}/node_modules/@supabase/postgres-meta/dist/server/server.js"
if [[ ! -f "$SERVER" ]]; then
  log "installing ${PGMETA_PACKAGE} into ${PGMETA_HOME}"
  mkdir -p "$PGMETA_HOME"
  npm install --no-save --no-audit --no-fund --prefix "$PGMETA_HOME" "$PGMETA_PACKAGE" >/dev/null
fi
log "starting postgres-meta on :${PGMETA_PORT} (admin :${PGMETA_ADMIN_PORT})"
PG_META_PORT="$PGMETA_PORT" PG_META_DB_URL="$DATABASE_URL" \
  nohup node "$SERVER" > "/tmp/pg-meta${CONTAINER_SUFFIX}.log" 2>&1 &
PGMETA_PID=$!
remember_started postgres-meta "$PGMETA_PID"
wait_for_http "http://127.0.0.1:${PGMETA_PORT}/health" 60 || {
  log "postgres-meta did not come up"; tail -40 "/tmp/pg-meta${CONTAINER_SUFFIX}.log" >&2; exit 1;
}

# --- 6b. Record what this run started (issue #273) -------------------------
#
# Written last, when every service is up, so a state file's existence means
# a stack that answered rather than one that was attempted. `down.sh` and
# `down.sh --orphans` read exactly this, which is why the pids are recorded rather
# than re-derived from a port: a port says something is listening, and only
# a pid says it is ours.
#
# Every run records, the shared one included (#296): it is what makes step 0
# above able to reuse a stack by pid instead of by liveness, and what lets
# `down.sh --run shared` stop it.
#
# All four ports are recorded, the admin port with them, so
# `run_claiming_port` can name the run holding any port this stack occupies —
# a port bound but not written down is exactly how the collision in #296 went
# unexplained.
cat > "$STATE_FILE" <<EOF
STATE_RUN_ID=${RUN_ID:-shared}
STATE_CALLER_PATH=${CALLER_PATH}
STATE_DB_NAME=${DB_NAME}
STATE_DATABASE_URL=${DATABASE_URL}
STATE_ADMIN_URL=${ADMIN_URL}
STATE_POSTGREST_PORT=${POSTGREST_PORT}
STATE_PROXY_PORT=${PROXY_PORT}
STATE_PGMETA_PORT=${PGMETA_PORT}
STATE_PGMETA_ADMIN_PORT=${PGMETA_ADMIN_PORT}
STATE_POSTGREST_PID=${POSTGREST_PID:-}
STATE_PROXY_PID=${PROXY_PID:-}
STATE_PGMETA_PID=${PGMETA_PID:-}
STATE_ANON=${ANON}
STATE_SERVICE_ROLE=${SERVICE_ROLE}
EOF
log "recorded run ${RUN_ID:-shared} in ${STATE_FILE}"

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

log "up${RUN_ID:+ (run ${RUN_SLUG})} — db ${DB_NAME}, postgrest :${POSTGREST_PORT}, proxy :${PROXY_PORT}, postgres-meta :${PGMETA_PORT} (admin :${PGMETA_ADMIN_PORT})"
