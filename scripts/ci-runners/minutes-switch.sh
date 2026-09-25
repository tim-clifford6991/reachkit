#!/usr/bin/env bash
# scripts/ci-runners/minutes-switch.sh — light CI jobs to the box when hosted minutes run out
#
# Run hourly by `rk-ci-switch.timer` as root on the box (owner, 2026-09-25,
# #1113; `install-minutes-switch.sh` installs it). It sets the repository
# variable `CI_LIGHT_RUNNER`, which `.github/workflows/ci.yml` and
# `drift-audit.yml` read for their light jobs:
#
#   * on hosted (variable unset) and **90% or more** of the cycle's included
#     Actions minutes used → set it to the box's `reachkit-light` runner;
#   * on hosted and a hosted job this cycle refused for **billing** (a failed
#     payment or the spending limit, whatever the minutes) → the box too;
#   * on the box because this script put it there **for minutes**, a new
#     billing cycle has begun, the minutes read below 90% and the last hosted
#     job was not refused for billing → delete it, back to hosted.
#
# **It never goes back to hosted on its own after a billing refusal** (#1119).
# A failed payment or a spending limit does not reset with the month, and a
# flip back while it stands would break every pull request again. That flip is
# by hand, once Billing & plans is fixed: `gh variable delete CI_LIGHT_RUNNER`
# and `rm /root/ops/reachkit/state/ci-switch`. Nor does it go back when the
# minutes cannot be read: unknown is not "available".
#
# The cycle starts on day `RK_CI_RESET_DAY` of the month (UTC). The unit's 25
# is unconfirmed (#1113): read the day in Settings → Billing & plans and change
# the unit to match.
#
# A value somebody set by hand is left alone: the script only undoes a flip it
# recorded in its state file. Every flip is one line on stdout, which the
# unit appends to /root/ops/reachkit/log/ci-switch.log.
#
# **Reading the minutes.** `GET /users/{owner}/settings/billing/actions`
# (`total_minutes_used`, `included_minutes`) needs a token with the `user`
# scope. The box's `gh` token had only `repo`, `workflow`, `gist`, `project`
# and `read:org` on 2026-09-25 — add it with `gh auth refresh -h github.com -s
# user`. Until then the percentage is unknown: the script still flips to the
# box on a billing refusal ("…recent account payments have failed or your
# spending limit needs to be increased…"), and never back by itself.
#
#   --dry-run   say what it would do, change nothing
set -euo pipefail

REPO="tim-clifford6991/reachkit"
OWNER="${REPO%%/*}"
VAR="CI_LIGHT_RUNNER"
BOX='["self-hosted","reachkit-light"]'
THRESHOLD=90
RESET_DAY="${RK_CI_RESET_DAY:-25}"
STATE="${RK_CI_SWITCH_STATE:-/root/ops/reachkit/state/ci-switch}"
DRY=0; [[ "${1:-}" == "--dry-run" ]] && DRY=1

now="$(date -u +%FT%TZ)"
say() { echo "$now $*"; }

# The day this billing cycle began: this month's reset day, or last month's.
day="$(printf '%02d' "$RESET_DAY")"
if (( 10#$(date -u +%d) >= RESET_DAY )); then
  cycle="$(date -u +%Y-%m)-${day}"
else
  cycle="$(date -u -d "$(date -u +%Y-%m-15) -1 month" +%Y-%m)-${day}"
fi

current="$(gh api "repos/${REPO}/actions/variables/${VAR}" --jq .value 2>/dev/null || true)"

# `set_box <minutes|billing> <why>` — the state file records the cycle and
# which of the two it was, because only a minutes flip may be undone.
set_box() {
  if (( DRY )); then say "would set $VAR=$BOX ($2)"; return; fi
  gh variable set "$VAR" --repo "$REPO" --body "$BOX"
  mkdir -p "$(dirname "$STATE")"
  printf '%s %s\n' "$cycle" "$1" > "$STATE"
  say "FLIP to box: $VAR=$BOX ($2)"
}

# "used included" if the token can read them, else nothing.
minutes() {
  local out
  out="$(gh api "users/${OWNER}/settings/billing/actions" \
    --jq '"\(.total_minutes_used) \(.included_minutes)"' 2>/dev/null || true)"
  # On a 404 `gh api` prints the error body to stdout: only two numbers count.
  [[ "$out" =~ ^[0-9]+\ [0-9]+$ ]] && echo "$out" || true
}

# Was a hosted job refused for billing — the run id, or nothing? `latest`
# asks only of the most recent hosted job; `since` of every one this cycle.
billing_refused() {
  local run cr
  for run in $(gh api "repos/${REPO}/actions/runs?created=>=${cycle}&per_page=20" --jq '.workflow_runs[].id'); do
    for cr in $(gh api "repos/${REPO}/actions/runs/${run}/jobs?filter=all&per_page=50" \
        --jq '.jobs[] | select((.labels | index("self-hosted")) | not) | select(.conclusion != null) | .check_run_url | split("/") | last'); do
      if gh api "repos/${REPO}/check-runs/${cr}/annotations" --jq '.[].message' 2>/dev/null \
          | grep -qiE 'payments have failed|spending limit'; then
        echo "$run"; return 0
      fi
      [[ "$1" == latest ]] && return 0
    done
  done
}

set_hosted() {
  if (( DRY )); then say "would delete $VAR ($1)"; return; fi
  gh variable delete "$VAR" --repo "$REPO"
  rm -f "$STATE"
  say "FLIP to hosted: $VAR deleted ($1)"
}

# --- On the box: back to hosted only after a minutes flip, in a new cycle,
#     with the minutes read below the threshold and no billing refusal.
if [[ "$current" == *self-hosted* ]]; then
  if [[ ! -f "$STATE" ]]; then
    (( DRY )) && say "on the box, set by hand; left alone"
    exit 0
  fi
  read -r flipped reason < "$STATE"
  if [[ "$reason" != minutes ]]; then
    (( DRY )) && say "on the box since $flipped for billing; back to hosted by hand only"
    exit 0
  fi
  if [[ "$flipped" == "$cycle" ]]; then
    (( DRY )) && say "on the box since the cycle from $flipped; stays until the next"
    exit 0
  fi
  usage="$(minutes)"
  if [[ -z "$usage" ]]; then
    say "new cycle $cycle but the minutes cannot be read; staying on the box"
    exit 0
  fi
  read -r used included <<<"$usage"
  if (( used * 100 >= included * THRESHOLD )); then
    (( DRY )) && say "new cycle, but ${used} of ${included} minutes used; staying on the box"
    exit 0
  fi
  if refused="$(billing_refused latest)" && [[ -n "$refused" ]]; then
    say "new cycle, but the last hosted job (run $refused) was refused for billing; staying on the box"
    exit 0
  fi
  set_hosted "new cycle $cycle, ${used} of ${included} minutes used"
  exit 0
fi

# --- On hosted: a billing refusal this cycle sends the jobs to the box, and
#     so do 90% of the included minutes.
refused="$(billing_refused since)"
if [[ -n "$refused" ]]; then
  set_box billing "a hosted job in run $refused was refused for billing (payment or spending limit)"
  exit 0
fi
usage="$(minutes)"
if [[ -n "$usage" ]]; then
  read -r used included <<<"$usage"
  if (( included > 0 )) && (( used * 100 >= included * THRESHOLD )); then
    set_box minutes "${used} of ${included} included minutes used"
  elif (( DRY )); then
    say "hosted; ${used} of ${included} included minutes used"
  fi
elif (( DRY )); then
  say "hosted; minutes unreadable without the user scope; no billing refusal since $cycle"
fi
