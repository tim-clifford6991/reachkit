#!/usr/bin/env bash
# deployer-dry.sh: dry ticks S1–S12 of the box deployer against a throwaway git repo it builds and deletes.
# Every tick runs DEPLOYER_DRY=1 DEPLOYER_ONCE=1, so Vercel, Inngest and GitHub writes are lines in $S/dry.calls,
# and both checks run a stub smoke.sh inside the throwaway repo. Nothing reads the main checkout or spends.
# usage: bash docs/ops/deployer-dry.sh <deployer.sh> [S1 … S12]   (default: every case; exit 1 if one fails)
set -u
DEP=$(readlink -f "${1:?usage: deployer-dry.sh <deployer.sh> [case …]}"); shift
cases=${*:-S1 S2 S3 S4 S5 S6 S7 S8 S9 S10 S11 S12}
# a deployer that ignores DEPLOYER_MAIN would check in the main checkout; S1 never reaches a check on it
grep -q DEPLOYER_MAIN "$DEP" || [ "$cases" = S1 ] || { echo "$DEP does not read DEPLOYER_MAIN: run S1 only"; exit 2; }
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
G=(git -C "$W/main" -c user.name=dry -c user.email=dry@example.invalid)
git init -q --bare "$W/origin.git"; git init -q -b main "$W/main"; "${G[@]}" remote add origin "$W/origin.git"
mkdir -p "$W/main/scripts" "$W/wt"; printf '#!/bin/sh\n# --free\nexit 0\n' > "$W/main/scripts/smoke.sh"
"${G[@]}" add scripts; "${G[@]}" commit -q -m A; A=$("${G[@]}" rev-parse HEAD)
"${G[@]}" commit -q --allow-empty -m B; B=$("${G[@]}" rev-parse HEAD)
"${G[@]}" checkout -q -b side; "${G[@]}" commit -q --allow-empty -m X; X=$("${G[@]}" rev-parse HEAD); "${G[@]}" checkout -q main
"${G[@]}" commit -q --allow-empty -m C; C=$("${G[@]}" rev-parse HEAD)
"${G[@]}" commit -q --allow-empty -m D; D=$("${G[@]}" rev-parse HEAD)
Z=$("${G[@]}" commit-tree "$("${G[@]}" mktree </dev/null)" -m Z)
git init -q "$W/far"; E=$(git -C "$W/far" -c user.name=dry -c user.email=dry@example.invalid commit-tree "$(git -C "$W/far" mktree </dev/null)" -m E)
"${G[@]}" push -q origin main
bad=0
names(){ sed -e "s/$A/<A>/g; s/$B/<B>/g; s/$C/<C>/g; s/$D/<D>/g; s/$X/<X>/g; s/$Z/<Z>/g; s/$E/<E>/g"; }
fresh(){ # deploy-prod.sha = A, last deploy 3 h ago and its check passed, dev already at the head
  S=$W/s.$1; mkdir -p "$S"; echo "$A" > "$S/deploy-prod.sha"; echo $(( $(date +%s) - 10800 )) > "$S/deploy-prod.at"
  echo "pass $A" > "$S/prod-check.last"; echo "$D" > "$S/deploy-dev.sha"; echo 0 > "$S/deploy-backoff.until"; : > "$S/prod-redeploy.log"; : > "$S/dry.calls"
  echo "== $1: $2"
}
pass(){ for s in "$@"; do echo pass > "$S/dev-check.$s"; done; }
tick(){ S=$S DEPLOYER_DRY=1 DEPLOYER_ONCE=1 DEPLOYER_HEAD=${HEAD:-$D} DEPLOYER_MAIN=$W/main DEPLOYER_WT=$W/wt DEPLOYER_MINUTE=${MIN:-20} \
  DEVCHECK_BASE_URL=http://127.0.0.1:9 PRODCHECK_BASE_URL=http://127.0.0.1:9 bash "$DEP" >/dev/null 2>&1; }
n(){ grep -c -- "$1" "$S/${2:-dry.calls}" || true; }
expect(){ if [ "$2" = "$3" ]; then echo "  ok   $1 = $3"; else echo "  FAIL $1 = $2, expected $3"; bad=1; fi; }
show(){ sed 's/^/  call: /' "$S/dry.calls" | names; sed 's/^/  log:  /' "$S/prod-redeploy.log" | names
  echo "  deploy-prod.sha: $(names < "$S/deploy-prod.sha")"; }
prod_sha(){ grep '^deploy production' "$S/dry.calls" | grep -oE '"sha":"[0-9a-f]+"' | cut -d'"' -f4 | names | paste -sd' '; }
for k in $cases; do case $k in
S1) fresh S1 "starvation replay: B and C pass, head D has no check, minute 20, spacing due"; pass "$B" "$C"; tick; show
  expect "production calls" "$(n '^deploy production')" 1; expect "production sha" "$(prod_sha)" "<C>"
  expect "deploy-prod.tries.C" "$(cat "$S/deploy-prod.tries.$C" 2>/dev/null)" 1
  expect "ACCEPTED names C, reason names head D" "$(n "production deploy of main $C ACCEPTED: dpl_dryproduction trigger=deployer reason=\"newest checked; head $D\"" prod-redeploy.log)" 1
  read -r _ _ _ _ _ _ sha _ id _ < <(grep ACCEPTED "$S/prod-redeploy.log"); expect "recovery parser reads" "$(echo "$sha $id" | names)" "<C> dpl_dryproduction" ;;
S2) fresh S2 "the head D passes"; pass "$C" "$D"; tick; show
  expect "production calls" "$(n '^deploy production')" 1; expect "production sha" "$(prod_sha)" "<D>"
  expect "reason" "$(n 'reason="main moved"' prod-redeploy.log)" 1 ;;
S3) fresh S3 "the only pass is side-branch commit X"; pass "$X"; tick; show; expect "deploy calls" "$(n '^deploy')" 0 ;;
S4) fresh S4 "the only pass is deploy-prod.sha A itself"; pass "$A"; tick; show; expect "deploy calls" "$(n '^deploy')" 0 ;;
S5) fresh S5 "deploy-prod.sha Z is unrelated to main; C passes, D has no check (two ticks), then D passes"; echo "$Z" > "$S/deploy-prod.sha"
  pass "$C"; tick; tick; expect "deploy calls after two ticks" "$(n '^deploy')" 0; pass "$D"; tick; show
  expect "head-only line" "$(n "deploy-prod.sha $Z is not on main; head only" prod-redeploy.log)" 1
  expect "production sha on the third tick" "$(prod_sha)" "<D>" ;;
S6) fresh S6a "C passes with 2 tries, B passes"; pass "$B" "$C"; echo 2 > "$S/deploy-prod.tries.$C"; tick; show
  expect "production sha" "$(prod_sha)" "<B>"
  fresh S6b "B and C pass, both with 2 tries"; pass "$B" "$C"; echo 2 > "$S/deploy-prod.tries.$C"; echo 2 > "$S/deploy-prod.tries.$B"; tick; show
  expect "deploy calls" "$(n '^deploy')" 0 ;;
S7) fresh S7 "head D is red landing, C passes (two ticks, spacing due on both)"; pass "$C"; echo "red landing" > "$S/dev-check.$D"
  tick; echo $(( $(date +%s) - 10800 )) > "$S/deploy-prod.at"; tick; show
  expect "hold lines" "$(n "production held: dev check red at $D (landing)" prod-redeploy.log)" 1
  expect "gh issue create" "$(n '^gh issue create')" 1; expect "production calls" "$(n '^deploy production')" 1
  expect "production sha" "$(prod_sha)" "<C>" ;;
S8) fresh S8 "minute 45, C passes"; pass "$C"; MIN=45 tick; show; expect "deploy calls" "$(n '^deploy')" 0 ;;
S9) fresh S9 "last deploy 30 min ago, its check passed, C passes"; pass "$C"; echo $(( $(date +%s) - 1800 )) > "$S/deploy-prod.at"; tick; show
  expect "deploy calls" "$(n '^deploy')" 0 ;;
S10) fresh S10 "state/prod-frozen exists, dev is at C, C passes"; pass "$C"; touch "$S/prod-frozen"; echo "$C" > "$S/deploy-dev.sha"; tick; show
  expect "production calls" "$(n '^deploy production')" 0; expect "preview calls" "$(n '^deploy preview')" 1
  expect "preview names head D" "$(n "^deploy preview .*\"ref\":\"main\",\"sha\":\"$D\"" | head -1)" 1 ;;
S11) fresh S11 "deploy-prod.inflight is 1 min old, C passes"; pass "$C"; touch "$S/deploy-prod.inflight"; tick; show
  expect "deploy calls" "$(n '^deploy')" 0 ;;
S12) fresh S12 "origin renamed away, main's head E was never fetched, dev already at E (two ticks)"; echo "$E" > "$S/deploy-dev.sha"
  mv "$W/origin.git" "$W/origin.gone"; HEAD=$E tick; HEAD=$E tick; mv "$W/origin.gone" "$W/origin.git"; show
  expect "fetch-failed line" "$(n "production: fetch failed; head only" prod-redeploy.log)" 1; expect "deploy calls" "$(n '^deploy')" 0 ;;
*) echo "unknown case $k"; bad=1 ;;
esac; done
exit $bad
