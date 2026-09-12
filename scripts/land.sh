#!/usr/bin/env bash
# scripts/land.sh — landing a production deployment (docs/PROCESS.md step 10:
# "**Deployer** deploys dev on the merge and production in batches; **master**
# applies the migration and then runs the production smoke check by hand").
#
#   scripts/land.sh                     # land the current production deployment
#   LAND_BASE_URL=https://dev.reachkit.app scripts/land.sh
#   scripts/land.sh dpl_XXXX            # wait on one named Vercel deployment
#
# A deployment is not READY because it built. It is READY once the live site
# walks landing → scan → report, which is what `scripts/smoke.sh` asserts —
# so this script waits for the platform to report the deployment ready, runs
# the smoke check against it, and **reports READY only when that check
# passes**. A red smoke check is a refusal here, never a footnote under a
# green build: that gap is how nine scan defects shipped in 36 h with CI
# green and a production funnel where 0 of 17 scans completed (issue #543).
#
#   LAND_BASE_URL    the deployment to land. Default `https://reachkit.app`.
#   LAND_DOMAIN      the domain the smoke check scans (it spends one free
#                    pass). Passed straight to `scripts/smoke.sh`.
#   LAND_READY_TIMEOUT_S  how long to wait for readiness. Default 900.
#   VERCEL_TOKEN     optional. With it — and a deployment id, or
#                    `VERCEL_PROJECT_ID` — readiness is the platform's own
#                    `readyState`. Without it, readiness is the site
#                    answering 200, which is all a deployment reports to
#                    anyone who does not hold the token.
#   VERCEL_TEAM_ID   optional, for a team-scoped project.
#
# Exit status:
#
#   0  READY — the deployment is live and the chain walks on it.
#   1  NOT READY — the smoke check refused it. The failing step is on stderr.
#   2  the deployment never reported ready, or the run could not be made.
set -u
set -o pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${LAND_BASE_URL:-https://reachkit.app}"
BASE_URL="${BASE_URL%/}"
DEPLOYMENT="${1:-${LAND_DEPLOYMENT:-}}"
READY_TIMEOUT_S="${LAND_READY_TIMEOUT_S:-900}"
POLL_S=15

[ "$#" -le 1 ] || { echo "usage: scripts/land.sh [<vercel deployment id>]" >&2; exit 2; }

say() { printf '%s %s\n' "$(date -u +%H:%M:%S)" "$1"; }

# ── 1. wait for the deployment to report ready ───────────────────────────
#
# Two readers, because there are two kinds of caller. The master lands by
# hand and holds no token in the shell: for them "ready" is the deployment
# answering its own address, which is exactly what a visitor sees. The
# always-on deployer holds one: for it "ready" is the platform's
# `readyState`, which distinguishes a build still running from one that
# failed. Neither reader is required by the other, and the smoke check
# below is the same either way.
vercel_ready_state() {
  local url="https://api.vercel.com/v13/deployments/$DEPLOYMENT"
  [ -n "${VERCEL_TEAM_ID:-}" ] && url="$url?teamId=$VERCEL_TEAM_ID"
  curl -sS --max-time 20 -H "Authorization: Bearer $VERCEL_TOKEN" "$url" \
    | sed -n 's/.*"readyState":"\([A-Z_]*\)".*/\1/p' | head -1
}

waited=0
if [ -n "${VERCEL_TOKEN:-}" ] && [ -n "$DEPLOYMENT" ]; then
  say "waiting for $DEPLOYMENT to report ready"
  while :; do
    state=$(vercel_ready_state)
    case "${state:-}" in
      READY) say "deployment $DEPLOYMENT READY"; break;;
      ERROR|CANCELED) echo "land: deployment $DEPLOYMENT reported $state — nothing to land" >&2; exit 2;;
    esac
    [ "$waited" -ge "$READY_TIMEOUT_S" ] && { echo "land: $DEPLOYMENT never reported ready inside ${READY_TIMEOUT_S}s (last: ${state:-unknown})" >&2; exit 2; }
    sleep "$POLL_S"; waited=$(( waited + POLL_S ))
  done
else
  say "waiting for $BASE_URL to answer"
  while :; do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$BASE_URL/" || echo 000)
    [ "$code" = 200 ] && { say "$BASE_URL answers 200 — the deployment is live"; break; }
    [ "$waited" -ge "$READY_TIMEOUT_S" ] && { echo "land: $BASE_URL never answered 200 inside ${READY_TIMEOUT_S}s (last: $code)" >&2; exit 2; }
    sleep "$POLL_S"; waited=$(( waited + POLL_S ))
  done
fi

# ── 2. the gate that matters ─────────────────────────────────────────────
say "smoke check against $BASE_URL"
# The status is captured from the run itself, never read after an `if`: a
# failed `if` with no `else` leaves `$?` at 0, which would report the
# refusal and the exit code that caused it as disagreeing with each other.
SMOKE_BASE_URL="$BASE_URL" bash "$HERE/smoke.sh" ${LAND_DOMAIN:+"$LAND_DOMAIN"}
status=$?

if [ "$status" -eq 0 ]; then
  say "READY $BASE_URL"
  exit 0
fi

echo "land: NOT READY — $BASE_URL built, but scripts/smoke.sh refused it (exit $status)" >&2
exit 1
