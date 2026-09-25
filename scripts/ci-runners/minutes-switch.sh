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
#   * on the box because this script put it there, and a new billing cycle
#     has begun → delete it, back to hosted.
#
# The cycle starts on day `RK_CI_RESET_DAY` of the month (UTC). The unit sets
# 25: the minutes ran out on 2026-09-22 and had refreshed by 2026-09-25
# (#1113). If Settings → Billing & plans shows another day, change the unit.
#
# A value somebody set by hand is left alone: the script only undoes a flip it
# recorded in its state file. Every flip is one line on stdout, which the
# unit appends to /root/ops/reachkit/log/ci-switch.log.
#
# **Reading the minutes.** `GET /users/{owner}/settings/billing/actions`
# (`total_minutes_used`, `included_minutes`) needs a token with the `user`
# scope. The box's `gh` token had only `repo`, `workflow`, `gist`, `project`
# and `read:org` on 2026-09-25 — add it with `gh auth refresh -h github.com -s
# user`. Until then the percentage is unknown, and the script falls back to
# what it can see: a hosted job this cycle that GitHub refused with its
# billing annotation ("…recent account payments have failed or your spending
# limit needs to be increased…") flips the variable to the box too.
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

current="$(gh variable get "$VAR" --repo "$REPO" 2>/dev/null || true)"

set_box() {
  if (( DRY )); then say "would set $VAR=$BOX ($1)"; return; fi
  gh variable set "$VAR" --repo "$REPO" --body "$BOX"
  mkdir -p "$(dirname "$STATE")"
  printf '%s\n' "$cycle" > "$STATE"
  say "FLIP to box: $VAR=$BOX ($1)"
}

set_hosted() {
  if (( DRY )); then say "would delete $VAR ($1)"; return; fi
  gh variable delete "$VAR" --repo "$REPO"
  rm -f "$STATE"
  say "FLIP to hosted: $VAR deleted ($1)"
}

# --- On the box: back to hosted once the cycle this script flipped in is over.
if [[ "$current" == *self-hosted* ]]; then
  if [[ -f "$STATE" ]]; then
    flipped="$(cat "$STATE")"
    if [[ "$flipped" != "$cycle" ]]; then
      set_hosted "flipped in the cycle from $flipped; a new one began $cycle"
    elif (( DRY )); then
      say "on the box since the cycle from $flipped; stays until the next"
    fi
  elif (( DRY )); then
    say "on the box, set by hand; left alone"
  fi
  exit 0
fi

# --- On hosted: the percentage, if the token can read it.
if usage="$(gh api "users/${OWNER}/settings/billing/actions" \
      --jq '"\(.total_minutes_used) \(.included_minutes)"' 2>/dev/null)"; then
  read -r used included <<<"$usage"
  if (( included > 0 )) && (( used * 100 >= included * THRESHOLD )); then
    set_box "${used} of ${included} included minutes used"
  elif (( DRY )); then
    say "hosted; ${used} of ${included} included minutes used"
  fi
  exit 0
fi

# --- The percentage cannot be read: a hosted job refused for billing this cycle.
refused=""
for run in $(gh api "repos/${REPO}/actions/runs?created=>=${cycle}&per_page=20" --jq '.workflow_runs[].id'); do
  for cr in $(gh api "repos/${REPO}/actions/runs/${run}/jobs?per_page=50" \
      --jq '.jobs[] | select(.conclusion == "failure" and ((.labels | index("self-hosted")) | not)) | .check_run_url | split("/") | last'); do
    if gh api "repos/${REPO}/check-runs/${cr}/annotations" --jq '.[].message' 2>/dev/null \
        | grep -qiE 'payments have failed|spending limit'; then
      refused="run $run"; break 2
    fi
  done
done
if [[ -n "$refused" ]]; then
  set_box "minutes unreadable without the user scope; a hosted job in $refused was refused for billing"
elif (( DRY )); then
  say "hosted; minutes unreadable without the user scope; no billing refusal since $cycle"
fi
