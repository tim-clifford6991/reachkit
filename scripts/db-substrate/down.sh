#!/usr/bin/env bash
# scripts/db-substrate/down.sh
#
# Stops what `up.sh --run` started, and — with `--orphans` — every stack
# whose worktree is gone.
#
# **Why this file exists** (issue #273). `up.sh --run` (#221) gives each run
# its own database, PostgREST, `/rest/v1` proxy and postgres-meta, and by
# design "leaves its database behind" so the next run reuses it. What it also
# left behind was the three *server processes*, for ever: removing a worktree
# does not stop them, and nothing else did either. Measured on this box on
# 2026-09-07: **59 substrate processes holding 2.4 GB of 7.7 GB, 41 of them
# (1.66 GB) belonging to worktrees that no longer existed** — across twelve
# removed worktrees, one of which had three separate stacks. With swap
# already full, that is what the kernel was killing `npm ci` and `next build`
# to make room for, at 1.0–1.6 GB anon-rss. A stack costs ~150–190 MB, so
# roughly every sixth one costs the box a build.
#
# ## Usage
#
#     scripts/db-substrate/down.sh                # this worktree's run
#     scripts/db-substrate/down.sh --run <id>     # a named run
#     scripts/db-substrate/down.sh --drop         # …and drop its database
#     scripts/db-substrate/down.sh --orphans      # every stack whose cwd is gone
#
# `--drop` is not the default and should not become one: a run's database is
# what makes the *next* run on that worktree cheap, and dropping it turns
# every `up.sh` into a full migration replay. Stopping the processes is what
# recovers the memory; the database costs disk, which this box has.
#
# **It stops only what it can prove is ours.** Every kill goes through a pid
# recorded by `up.sh` in the run's state file, checked against
# `/proc/<pid>/cmdline` before the signal — a pid is reused by the kernel, so
# "the number is alive" is not "the process is mine". A service `up.sh`
# adopted rather than started has no recorded pid and is reported, never
# killed: the whole defect this replaces was a script assuming a port
# belonged to it.
set -euo pipefail

cd "$(dirname "$0")"
CALLER_PATH="$OLDPWD"

STATE_DIR="${REACHKIT_SUBSTRATE_STATE:-/tmp/reachkit-substrate}"

log() { echo "db-substrate: $*" >&2; }

RUN_ID=""
DROP=0
ORPHANS=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --run) RUN_ID="${2:-}"; [[ -n "$RUN_ID" ]] && shift 2 || shift 1 ;;
    --drop) DROP=1; shift ;;
    --orphans) ORPHANS=1; shift ;;
    *) echo "db-substrate: unknown argument '$1' (expected --run [id] | --drop | --orphans)" >&2; exit 2 ;;
  esac
done

# The same slug `up.sh` derives, so a caller may name a run the way they
# started it — or not name one at all and mean this worktree's.
slug_of() {
  printf '%s' "$1" | tr -c 'a-zA-Z0-9' '_' | tr 'A-Z' 'a-z' | cut -c1-40
}

# Alive, and ours? Both halves, for the reason the header gives.
ours_and_alive() {
  local pid="$1" pattern="$2"
  [[ -n "$pid" ]] && [[ -d "/proc/$pid" ]] &&
    tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null | grep -q "$pattern"
}

# Whether a process's working directory has been removed underneath it —
# which is exactly what a stack belonging to a deleted worktree looks like,
# and the only signal that needs no bookkeeping to be true.
cwd_is_gone() {
  local pid="$1" cwd
  cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null || true)"
  [[ -z "$cwd" || "$cwd" == *"(deleted)"* ]]
}

stopped=0

# Stops one run's three services. Returns the number signalled.
stop_run() {
  local file="$1" n=0
  # shellcheck disable=SC1090
  source "$file"

  local pair
  for pair in "${STATE_POSTGREST_PID:-}:postgrest" \
              "${STATE_PROXY_PID:-}:rest-v1-proxy" \
              "${STATE_PGMETA_PID:-}:postgres-meta"; do
    local pid="${pair%%:*}" pattern="${pair#*:}"
    if [[ -z "$pid" ]]; then
      log "  ${pattern}: no recorded pid (this run adopted an already-running one) — left alone"
      continue
    fi
    if ours_and_alive "$pid" "$pattern"; then
      kill "$pid" 2>/dev/null && n=$((n + 1))
      log "  ${pattern}: stopped (pid ${pid})"
    else
      log "  ${pattern}: already gone (pid ${pid})"
    fi
  done

  if [[ "$DROP" == "1" ]]; then
    log "  dropping database ${STATE_DB_NAME}"
    PGPASSWORD="${DB_PASSWORD:-reachkit}" psql "${STATE_ADMIN_URL}" -v ON_ERROR_STOP=1 -q \
      -c "drop database if exists \"${STATE_DB_NAME}\" with (force);" >/dev/null 2>&1 ||
      log "  could not drop ${STATE_DB_NAME} (it may have connections) — left in place"
  fi

  rm -f "$file"
  stopped=$((stopped + n))
}

if [[ "$ORPHANS" == "1" ]]; then
  # Every recorded run whose worktree is gone. The state file's own
  # `STATE_CALLER_PATH` answers it directly, and `/proc/<pid>/cwd` is the
  # cross-check for a stack started before this file existed.
  found=0
  for file in "$STATE_DIR"/*.state; do
    [[ -e "$file" ]] || continue
    caller="$(sed -n 's/^STATE_CALLER_PATH=//p' "$file")"
    pid="$(sed -n 's/^STATE_POSTGREST_PID=//p' "$file")"
    if [[ -n "$caller" && ! -d "$caller" ]] || { [[ -n "$pid" ]] && cwd_is_gone "$pid"; }; then
      log "orphan: $(sed -n 's/^STATE_RUN_ID=//p' "$file") (worktree ${caller} is gone)"
      stop_run "$file"
      found=$((found + 1))
    fi
  done

  # Stacks with no state file at all — everything started before #273. They
  # are found the way the master found them by hand: a substrate process
  # whose working directory has been deleted.
  for pid in $(pgrep -f 'postgrest|postgres-meta|rest-v1-proxy' 2>/dev/null || true); do
    if cwd_is_gone "$pid"; then
      log "orphan: pid ${pid} (no state file; its working directory is gone)"
      kill "$pid" 2>/dev/null && stopped=$((stopped + 1))
      found=$((found + 1))
    fi
  done

  log "reaped ${found} orphaned run(s); ${stopped} process(es) stopped"
  exit 0
fi

[[ -n "$RUN_ID" ]] || RUN_ID="$(basename "$CALLER_PATH")"
STATE_FILE="${STATE_DIR}/$(slug_of "$RUN_ID").state"

if [[ ! -f "$STATE_FILE" ]]; then
  log "no stack recorded for run '${RUN_ID}' — nothing to stop"
  log "(a stack started before #273 has no state file; \`down.sh --orphans\` finds those)"
  exit 0
fi

log "stopping run ${RUN_ID}"
stop_run "$STATE_FILE"
log "stopped ${stopped} process(es)"
