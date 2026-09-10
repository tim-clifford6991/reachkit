#!/usr/bin/env bash
# scripts/live/m4-check.sh — §16 milestone 4's check, run against a live
# deployment: "12 SERPs stored with their `ai_overview` references; draft
# only after email".
#
# Three checks, because the milestone's three facts fall due at different
# hours. Each is run on its own:
#
#   m4-check.sh serps <domain>
#       The twelve the free pass stored: how many carry an AI Overview, how
#       many of those carry its reference domains, and whether the matrix
#       on `/scan/{domain}` says what the SERPs under it say. Reads only.
#
#   m4-check.sh mail <domain> <address>
#       One real capture against that domain's current report, and what the
#       deployment did with the page it now owes. Captures once: a second
#       run on the same address reads the row rather than submitting again.
#       **Send a real address you can open** — the milestone's criterion is
#       that the first page is received, and only the inbox can say so.
#
#   m4-check.sh nurture <address>
#       The sequences that address is in, one hour or more after the tick
#       that should have moved them: their state, their touch counts and
#       whether a due touch has been left standing.
#
# Bindings (docs/DEPLOYMENT.md §2 — the owner holds them; nothing here logs
# a value):
#
#   SUPABASE_URL                the deployment's own database. `fetches` is
#   SUPABASE_SERVICE_ROLE_KEY   `dbAdmin()`-only and `leads` grants `select`
#                               only to the owning site's user, which an
#                               anonymous lead has none of, so the service
#                               role is the only reader of either there is.
#   RK_LIVE_APP_URL             the deployment to capture against. Defaults
#                               to `dev.reachkit.app` (DEPLOYMENT §1), which
#                               since cutover serves the same `main` as
#                               production — so `mail` writes a real lead
#                               and, once the page is written, spends the
#                               product's real money at the real vendors.
#                               Only the `mail` check reaches the app at all.
#
# Exit status is the finding, so a run can be read without reading the run:
#
#   0  the milestone's criterion holds
#   1  measured, and it does not — with the cause named, and named as
#      either the owner's unwritten copy or a defect
#   2  no measurement: nothing to read, nothing attempted, or nothing due
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: scripts/live/m4-check.sh serps <domain> | mail <domain> <address> | nurture <address>" >&2
  exit 2
fi

# Checked here rather than with `${VAR:?}`, whose exit status is 1 — and 1
# already means "measured, and the criterion does not hold". A run that
# never started measured nothing, and says so with 2.
for binding in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
  if [ -z "${!binding:-}" ]; then
    echo "m4-check needs $binding (docs/DEPLOYMENT.md §2)" >&2
    exit 2
  fi
done

exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/m4-check.mjs" "$@"
