#!/usr/bin/env bash
# redeploy-dry.sh: dry cases R1–R4 of the hand production redeploy against a scratch state it builds and deletes.
# Every run is REDEPLOY_DRY=1, so Vercel, GitHub and Inngest are lines in $S/dry.calls. Nothing reads the box or spends.
# usage: bash docs/ops/redeploy-dry.sh <redeploy.sh> [R1 … R4]   (default: every case; exit 1 if one fails)
set -u
RD=$(readlink -f "${1:?usage: redeploy-dry.sh <redeploy.sh> [case …]}"); shift
cases=${*:-R1 R2 R3 R4}
# a redeploy.sh without the dry stubs would POST to Vercel and write the box state
grep -q REDEPLOY_DRY "$RD" || { echo "$RD has no REDEPLOY_DRY: refusing to run it"; exit 2; }
W=$(mktemp -d); trap 'for s in "$W"/s.*; do echo Ready > "$s/dry.inspect"; done 2>/dev/null; sleep 1; rm -rf "$W"' EXIT
A=$(echo prod | sha1sum | cut -c1-40); H=$(echo head | sha1sum | cut -c1-40)
bad=0
names(){ sed -e "s/$A/<A>/g; s/$H/<H>/g"; }
fresh(){ S=$W/s.$1; mkdir -p "$S"; echo "$A" > "$S/deploy-prod.sha"; : > "$S/prod-redeploy.log"; : > "$S/dry.calls"; echo "== $1: $2"; }
inflight(){ touch -d "-$1 minutes" "$S/deploy-prod.inflight"; }
run(){ S=$S REDEPLOY_DRY=1 REDEPLOY_HEAD=$H REDEPLOY_POLL_S=0.2 bash "$RD" --reason "dry $1" >/dev/null 2>&1; rc=$?; }
n(){ grep -c -- "$1" "$S/${2:-dry.calls}" || true; }
expect(){ if [ "$2" = "$3" ]; then echo "  ok   $1 = $3"; else echo "  FAIL $1 = $2, expected $3"; bad=1; fi; }
show(){ sed 's/^/  call: /' "$S/dry.calls" | names; sed 's/^/  log:  /' "$S/prod-redeploy.log" | names
  echo "  deploy-prod.sha: $(names < "$S/deploy-prod.sha")"; }
accepted(){ # R3 and R4 start the same way: no in-flight mark, one hand redeploy
  run "$1"; expect "exit" "$rc" 0; expect "production POSTs" "$(n '^deploy production')" 1
  expect "in-flight mark after ACCEPTED" "$([ -e "$S/deploy-prod.inflight" ] && echo present)" present; }
for k in $cases; do case $k in
R1) fresh R1 "deploy-prod.inflight is 5 min old"; inflight 5; run R1; show
  expect "exit" "$rc" 3; expect "production POSTs" "$(n '^deploy production')" 0
  expect "refused line" "$(n "redeploy refused: production build in flight (inflight 5m old) trigger=hand reason=\"dry R1\"" prod-redeploy.log)" 1 ;;
R2) fresh R2 "deploy-prod.inflight is 31 min old"; inflight 31; echo Ready > "$S/dry.inspect"; run R2; show
  expect "exit" "$rc" 0; expect "production POSTs" "$(n '^deploy production')" 1 ;;
R3) fresh R3 "no deploy-prod.inflight, main's head is H"; accepted R3; show
  expect "request names H" "$(n "^deploy production .*\"gitSource\":{\"type\":\"github\",\"repoId\":[0-9]*,\"ref\":\"main\",\"sha\":\"$H\"}")" 1
  expect "deploy-prod.sha" "$(names < "$S/deploy-prod.sha")" "<H>"
  read -r _ _ _ _ _ _ sha _ id _ < <(grep ACCEPTED "$S/prod-redeploy.log")
  expect "deployer recovery parser reads" "$(echo "$sha $id" | names)" "<H> dpl_dryhand"
  expect "deployer recovery pattern" "$(grep -cE '^[0-9-]+ [0-9:]+ production (re)?deploy of main [0-9a-f]+ ACCEPTED: dpl_' "$S/prod-redeploy.log")" 1 ;;
R4) fresh R4 "after R3's ACCEPTED, the stub answers Ready"; accepted R4; echo Ready > "$S/dry.inspect"
  for _ in $(seq 1 25); do [ -e "$S/deploy-prod.inflight" ] || break; sleep 0.2; done; sleep 0.5; show
  expect "in-flight mark after Ready" "$([ -e "$S/deploy-prod.inflight" ] && echo present || echo gone)" gone
  expect "Ready line" "$(n "production dpl_dryhand Ready; inngest sync 200" prod-redeploy.log)" 1
  expect "inngest PUT" "$(n '^inngest PUT')" 1 ;;
*) echo "unknown case $k"; bad=1 ;;
esac; done
exit $bad
