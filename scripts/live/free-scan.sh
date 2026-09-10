#!/usr/bin/env bash
# scripts/live/free-scan.sh <domain> [domain ...] — §16 milestone 3's check,
# run against a live deployment: a real domain, a real report, and the two
# numbers the milestone is stated in — how long a visitor waited, and how
# many cents the pass ledgered.
#
#   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… scripts/live/free-scan.sh example.com
#
# Bindings (docs/DEPLOYMENT.md §2 — the owner holds them; nothing here logs
# a value):
#
#   SUPABASE_URL                the deployment's own database, where the
#   SUPABASE_SERVICE_ROLE_KEY   pass writes `scans` and ledgers `fetches`.
#                               `fetches` is `dbAdmin()`-only (BUILD §10
#                               default-deny), so the service role is the
#                               only reader there is.
#   RK_LIVE_APP_URL             the deployment to scan against. Defaults to
#                               the development host, `dev.reachkit.app`
#                               (DEPLOYMENT §1), which since cutover serves
#                               the same `main` as production — so this
#                               spends the product's real money against the
#                               real vendors, which is the whole point of a
#                               live check and the reason it is never run
#                               from CI.
#
# Exit status is the finding, so a run can be read without reading the run:
#
#   0  measured, inside both bounds
#   1  measured, over the time target or over the spend cap — the defect
#      milestone 3 exists to find
#   2  no measurement: refused, failed, hung, or §6.4's rescan window
#      served a stored report
#
# Several domains run one after another, never at once: the free path
# admits one scan in flight per network (REQ-003 criterion 7), so a
# parallel run would refuse itself and measure nothing.
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: scripts/live/free-scan.sh <domain> [domain ...]" >&2
  exit 2
fi

: "${SUPABASE_URL:?free-scan needs SUPABASE_URL (docs/DEPLOYMENT.md §2)}"
: "${SUPABASE_SERVICE_ROLE_KEY:?free-scan needs SUPABASE_SERVICE_ROLE_KEY (docs/DEPLOYMENT.md §2)}"

exec node "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/free-scan.mjs" "$@"
