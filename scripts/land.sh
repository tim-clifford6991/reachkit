#!/bin/bash
# scripts/land.sh — the master's landing chain (docs/PROCESS.md §3).
#
#   scripts/land.sh <pr> [<pr> ...]
#
# For each PR, in the order given: update its branch if it is behind main,
# wait until every required check is green (Vercel rows are ignored — PROCESS §3), then merge
# with a merge commit and delete the branch. The chain stops at the first PR
# that cannot land, so dependent PRs never land out of order.
#
# `--admin` is deliberate: branch protection on main requires a code-owner
# review, the master lands with the owner's account, and an account cannot
# review its own PR. The checks are the gate; the flag only bypasses the
# review row.
#
# A DIRTY PR (conflicts) is the author's to rebase; the chain waits up to
# four hours for it. Run this in a Herdr pane or a foreground shell — never
# as a harness background job, which is reclaimed under memory pressure.
set -u
[ $# -gt 0 ] || { echo "usage: scripts/land.sh <pr> [<pr> ...]" >&2; exit 2; }
R=$(gh repo view --json nameWithOwner -q .nameWithOwner) || exit 1

land() {
  local n=$1 t0 st ms checks pending hyg bad
  t0=$(date +%s)
  while :; do
    st=$(gh pr view "$n" -R "$R" --json state,mergeStateStatus -q '[.state,.mergeStateStatus]|join(" ")')
    case "$st" in
      MERGED*) echo "#$n already MERGED"; return 0;;
      CLOSED*) echo "#$n is CLOSED — nothing to land"; return 1;;
    esac
    ms=${st#OPEN }
    if [ "$ms" = BEHIND ]; then
      gh api -X PUT "repos/$R/pulls/$n/update-branch" \
        -f expected_head_sha="$(gh pr view "$n" -R "$R" --json headRefOid -q .headRefOid)" >/dev/null 2>&1 \
        && echo "#$n update-branch"
      sleep 90; continue
    fi
    if [ "$ms" = DIRTY ]; then
      sleep 60
      [ $(( $(date +%s) - t0 )) -gt 14400 ] && { echo "#$n DIRTY for 4h — giving up"; return 1; }
      continue
    fi
    # `gh pr checks` exits non-zero when ANY check failed — its exit code is not a signal here.
    # Since 2026-09-09 no Vercel row is a gate (PROCESS §3: previews are off, the Hobby plan's
    # build quota was spent on them, CI renders are the review surface); every Vercel row is ignored.
    checks=$(gh pr checks "$n" -R "$R" 2>/dev/null)
    [ -n "$checks" ] || { sleep 60; continue; }
    pending=$(echo "$checks" | awk -F'\t' '$1 !~ /^Vercel/ && $2=="pending"' | wc -l)
    hyg=$(echo "$checks" | awk -F'\t' '$1 ~ /done-when ticked/ && $2=="pass"' | wc -l)
    bad=$(echo "$checks" | awk -F'\t' '$1 !~ /^Vercel/ && $2!="pass" && $2!="skipping" && $2!="pending"' | wc -l)
    if [ "$pending" -eq 0 ] && [ "$hyg" -eq 1 ]; then
      if [ "$bad" -eq 0 ]; then
        gh pr merge "$n" -R "$R" --merge --admin --delete-branch >/dev/null 2>&1 && { echo "#$n MERGED"; return 0; }
        echo "#$n merge failed ($ms) — retrying"; sleep 60
      else
        echo "#$n has $bad failing check(s), state $ms — waiting for the author"
        echo "$checks" | awk -F'\t' '$2!="pass"'
        sleep 180
      fi
    else
      sleep 60
    fi
    [ $(( $(date +%s) - t0 )) -gt 5400 ] && { echo "#$n timed out (90 min)"; return 1; }
  done
}

for n in "$@"; do land "$n" || exit 1; done
