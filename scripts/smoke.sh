#!/usr/bin/env bash
# scripts/smoke.sh — the production smoke check (docs/PROCESS.md `## Gates`,
# "Production smoke check · the real chain works on production · **Yes** —
# the gate that matters").
#
#   scripts/smoke.sh [domain]
#   SMOKE_BASE_URL=https://reachkit.app scripts/smoke.sh example.com
#
# It walks the chain a stranger walks — landing → scan → report — against a
# live deployment, and exits non-zero on the first step that does not hold,
# naming it. Nothing else in CI walks that chain: the five required checks
# prove the code compiles and renders, and a deployment is marked READY on
# the strength of a build, which is how nine scan defects shipped in 36 h
# with CI green and 0 of 17 production scans completing (issue #543).
#
# **It is a visitor, not an operator.** Every assertion is made from what a
# public visitor can see — the landing document, `POST /api/scan`, the
# progress stream, and `GET /scan/{domain}`. It reads no database, holds no
# vendor key and sends no header a browser would not send, so it runs
# against production exactly as it runs against dev. That is deliberate: a
# check that needs a secret is a check nobody runs.
#
#   SMOKE_BASE_URL   the deployment to walk. Default `https://dev.reachkit.app`
#                    (docs/RUNBOOK.md §1). Production is `https://reachkit.app`.
#   domain           the site to scan. Default `SMOKE_DOMAIN`, else the
#                    built-in below. **It spends real money** — one free
#                    pass, capped at `CAPS.FREE_C` — so it is one domain a
#                    run, never a loop.
#
# Exit status is the finding:
#
#   0  the chain walked: a scored, complete report from the landing.
#   1  a step did not hold. The step is named on stderr, first failure only.
#   2  the run could not be made at all (bad usage, unreachable deployment).
#
# **It transcribes no pin and no sentence.** The ceilings, the spend cap and
# the report's own words are read at run time out of `src/lib/config/constants.ts`
# and `src/lib/presentation/copy/keys/` — the same sources the product
# renders from — so an owner copy change or a moved ceiling cannot leave
# this script asserting yesterday's product (CLAUDE.md: copy is owner-owed,
# and a pin lives in one place).
set -u
set -o pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${SMOKE_BASE_URL:-https://dev.reachkit.app}"
BASE_URL="${BASE_URL%/}"
DOMAIN="${1:-${SMOKE_DOMAIN:-basecamp.com}}"

[ "$#" -le 1 ] || { echo "usage: scripts/smoke.sh [domain]" >&2; exit 2; }

WORK="$(mktemp -d)"
SSE_PID=""
cleanup() { [ -n "$SSE_PID" ] && kill "$SSE_PID" 2>/dev/null; rm -rf "$WORK"; }
trap cleanup EXIT

T0=""

now_ms() { echo $(( $(date +%s%N) / 1000000 )); }
since_ms() { echo $(( $(now_ms) - $1 )); }
secs() { awk -v ms="$1" 'BEGIN { printf "%.1fs", ms / 1000 }'; }

# One line per step, so a transcript reads as the walk it was.
ok() { printf 'ok   %-22s %s\n' "$1" "${2:-}"; }
note() { printf '     %-22s %s\n' "" "$1"; }

# The first failure ends the run, names the step, and says what was seen —
# "exits non-zero on the first failed step, naming it".
fail() {
  printf 'FAIL %-22s %s\n' "$1" "$2" >&2
  [ -n "$T0" ] && printf '     %-22s %s after %s\n' "" "$DOMAIN" "$(secs "$(since_ms "$T0")")" >&2
  exit 1
}

# `pin <name>` — the integer `constants.ts` binds to <name>. A pin this
# script could not read is a refusal, never a default: a smoke check that
# invents its own ceiling proves nothing about the product's.
pin() {
  local value
  # Two spellings, because `constants.ts` holds both: a member of a frozen
  # group (`FREE_C: 12`) and a standalone binding (`FREE_RESCAN_WINDOW_D = 7`).
  value=$(sed -n "s/.*[^A-Za-z_]$1: *\([0-9][0-9]*\).*/\1/p" "$REPO/src/lib/config/constants.ts" | head -1)
  [ -n "$value" ] || value=$(sed -n "s/^export const $1 = \([0-9][0-9]*\).*/\1/p" "$REPO/src/lib/config/constants.ts" | head -1)
  [ -n "$value" ] || { echo "smoke: src/lib/config/constants.ts binds no $1" >&2; exit 2; }
  printf '%s' "$value"
}

# `copy_text <key>` — the sentence the copy registry binds to <key>. The
# script never carries a user-facing sentence of its own (CLAUDE.md).
copy_text() {
  sed -n "s/.*\"$1\": *\[\"\([^\"]*\)\".*/\1/p" "$REPO"/src/lib/presentation/copy/keys/*.ts | head -1
}

REPORT_CEILING_S=$(pin reportCeilingS)   # the pass's own bound — TIMING
PLATFORM_CEILING_S=$(pin platformCeilingS) # the platform's hard stop
FREE_CAP_C=$(pin FREE_C)                 # CAPS — one free pass's ceiling in cents
RESCAN_WINDOW_D=$(pin FREE_RESCAN_WINDOW_D) # §2: inside it, the stored report is served
FIRST_FRAME_MS=3000                      # issue #543: a dead stream is the defect

echo "smoke: $BASE_URL · $DOMAIN · ceiling ${REPORT_CEILING_S}s, hard stop ${PLATFORM_CEILING_S}s, cap ${FREE_CAP_C}c"

# ── 1. landing ───────────────────────────────────────────────────────────
# REQ-001 c1, the landing's whole contract: "exactly one text input and one
# submit control". Asserted as structure — the field's own name, the form's
# action and the submit control — rather than as words, because the words
# are the owner's and change without the chain breaking.
step=landing
body="$WORK/landing.html"
code=$(curl -sS -o "$body" -w '%{http_code}' --max-time 30 "$BASE_URL/" 2>"$WORK/landing.err") \
  || fail "$step" "GET / did not answer ($(tr -d '\n' < "$WORK/landing.err"))"
[ "$code" = 200 ] || fail "$step" "GET / answered $code"
grep -q 'action="/api/scan"' "$body" || fail "$step" "GET / carries no form posting to /api/scan"
fields=$(grep -o 'name="value"' "$body" | wc -l)
[ "$fields" -ge 1 ] || fail "$step" "GET / carries no domain field (name=\"value\")"
grep -q 'type="submit"' "$body" || fail "$step" "GET / carries no submit control"
ok "$step" "200 · the one field and its CTA"

# ── 2. scan-start ────────────────────────────────────────────────────────
# The visitor's own first request: the JSON arm of `POST /api/scan`, which
# is the canonicaliser and the starter. A response with no `scanId` claimed
# no scan — refused, or inside §2's 7-day re-scan window — and there is no
# chain to walk, so it is a failure of this step and not a green run.
step=scan-start
T0=$(now_ms)
start="$WORK/start.json"
code=$(curl -sS -o "$start" -w '%{http_code}' --max-time 30 \
  -H 'content-type: application/json' -d "{\"value\":\"$DOMAIN\"}" \
  "$BASE_URL/api/scan" 2>"$WORK/start.err") \
  || fail "$step" "POST /api/scan did not answer ($(tr -d '\n' < "$WORK/start.err"))"
[ "$code" = 200 ] || fail "$step" "POST /api/scan answered $code: $(head -c 200 "$start")"
SCAN_ID=$(sed -n 's/.*"scanId":"\([^"]*\)".*/\1/p' "$start")
[ -n "$SCAN_ID" ] || fail "$step" "POST /api/scan claimed no scan (refused, or a stored report inside the re-scan window): $(head -c 200 "$start")"
ok "$step" "scanId $SCAN_ID"

# ── 3. progress-first-frame ──────────────────────────────────────────────
# The defect this check exists for: on production the stream was dead, so
# the visitor watched the first stage handle for ever (#540). The route
# opens with a heartbeat on its own first database read, so a frame is owed
# at once — three seconds is generous, and silence past it is the defect.
step=progress-first-frame
frames="$WORK/frames.sse"
: >"$frames"
sse_at=$(now_ms)
curl -sN --max-time "$PLATFORM_CEILING_S" -H 'accept: text/event-stream' \
  "$BASE_URL/api/scan/$SCAN_ID/progress" >"$frames" 2>"$WORK/sse.err" &
SSE_PID=$!
while ! grep -q '^data:' "$frames" 2>/dev/null; do
  [ "$(since_ms "$sse_at")" -gt "$FIRST_FRAME_MS" ] \
    && fail "$step" "no data: frame from /api/scan/$SCAN_ID/progress inside $((FIRST_FRAME_MS / 1000))s"
  if ! kill -0 "$SSE_PID" 2>/dev/null; then
    # A stream that closed may have delivered every frame it owed between
    # the grep above and this line: curl flushes its body as it exits, so
    # "the reader is gone" is not "nothing arrived". Re-read before calling
    # it dead — without this, a scan that had already finished (its log
    # replayed and the connection closed at once) failed a check it passed.
    sleep 0.2
    grep -q '^data:' "$frames" 2>/dev/null && break
    closed_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL/api/scan/$SCAN_ID/progress")
    fail "$step" "the progress stream closed with no frame (HTTP ${closed_code:-none}) $(tr -d '\n' < "$WORK/sse.err")"
  fi
  sleep 0.05
done
ok "$step" "first frame after $(secs "$(since_ms "$sse_at")")"

# ── 4/5. progress-advance, ending ────────────────────────────────────────
# A stream that only ever names its first stage is the same dead chain seen
# from one step further in, so the walk is not done until a second stage is
# named; and the pass must reach its one `ending` inside the platform's hard
# stop, which is what freezes the invocation the pass runs in.
step=progress-advance
first_stage=""
advanced=0
while :; do
  [ -z "$first_stage" ] && first_stage=$(sed -n 's/.*"stage":"\([a-z_]*\)".*/\1/p' "$frames" | head -1)
  if [ "$advanced" = 0 ] && [ -n "$first_stage" ] \
     && sed -n 's/.*"stage":"\([a-z_]*\)".*/\1/p' "$frames" | grep -qv "^$first_stage$"; then
    advanced=1
    ok "$step" "$first_stage → $(sed -n 's/.*"stage":"\([a-z_]*\)".*/\1/p' "$frames" | grep -v "^$first_stage$" | head -1) after $(secs "$(since_ms "$T0")")"
  fi
  if grep -q '"ending"' "$frames"; then
    # An ending with no stage behind it measured nothing. §2: "a re-scan of
    # the same domain inside 7 days serves the stored report and spends
    # nothing" — the pass is admitted, gets an id, and ends `complete` at
    # once. Every assertion below would then hold against a report this run
    # did not produce, which is the false green this check exists to kill,
    # so it is named and refused rather than walked past.
    if [ "$advanced" != 1 ] && [ -z "$first_stage" ]; then
      fail "$step" "the pass recorded no stage: $DOMAIN was scanned inside the ${RESCAN_WINDOW_D}-day re-scan window, so the stored report was served and nothing was measured — give a domain not scanned in the last ${RESCAN_WINDOW_D} days"
    fi
    [ "$advanced" = 1 ] || fail "$step" "the pass ended without leaving its first stage ($first_stage)"
    break
  fi
  elapsed_ms=$(since_ms "$T0")
  [ "$elapsed_ms" -gt $(( PLATFORM_CEILING_S * 1000 )) ] \
    && fail ending "no ending inside the platform hard stop of ${PLATFORM_CEILING_S}s (last stage: ${first_stage:-none})"
  if ! kill -0 "$SSE_PID" 2>/dev/null && ! grep -q '"ending"' "$frames"; then
    fail ending "the progress stream closed with no ending after $(secs "$elapsed_ms")"
  fi
  sleep 0.2
done
ENDED_MS=$(since_ms "$T0")
ok ending "inside the ${PLATFORM_CEILING_S}s hard stop, at $(secs "$ENDED_MS")"

# ── 6. complete ──────────────────────────────────────────────────────────
# `stopped_reason=complete` is what says no ceiling fired: a pass that
# crossed the spend cap ends `spend_ceiling`, one that crossed its own clock
# ends `time_ceiling`, and one that could not read the home page ends
# `site_unreadable`. So **this is where spend is asserted** — at most
# `CAPS.FREE_C`, enforced by the pass itself. No public visitor can read the
# ledger, which is why the check reads the ending it is told rather than
# asking for a service-role key it has no business holding.
#
# It is **not**, on its own, proof that every driver was measured. A pass
# can end `complete` and still store a degraded report — a local run with no
# vendor keys ends `complete` at 0c with no score on the report. The drivers
# are asserted where a visitor can see them, on the report itself, in step 8.
step=complete
reason=$(sed -n 's/.*"stoppedReason":"\([a-z_]*\)".*/\1/p' "$frames" | tail -1)
[ "$reason" = complete ] || fail "$step" "the pass ended \`${reason:-unknown}\`, not \`complete\` — a ceiling fired, or the site's home page could not be read"
ok "$step" "stopped_reason=complete · no ceiling fired · spend ≤ ${FREE_CAP_C}c"

# ── 7. elapsed ───────────────────────────────────────────────────────────
# SPEC §2's own done-when: "the pass ends inside 50 s". The hard stop above
# is the platform's; this is the product's promise to the visitor waiting.
step=elapsed
[ "$ENDED_MS" -le $(( REPORT_CEILING_S * 1000 )) ] \
  || fail "$step" "the pass took $(secs "$ENDED_MS"), past the ${REPORT_CEILING_S}s ceiling"
ok "$step" "$(secs "$ENDED_MS") ≤ ${REPORT_CEILING_S}s"

# ── 8. report ────────────────────────────────────────────────────────────
# The permanent public address, read the way a stranger reads it: a score
# under its own label, one of the four band words, the three driver bars
# carrying a value rather than a dash, and no incomplete notice.
step=report
page="$WORK/report.html"
code=$(curl -sS -o "$page" -w '%{http_code}' --max-time 30 "$BASE_URL/scan/$DOMAIN" 2>"$WORK/report.err") \
  || fail "$step" "GET /scan/$DOMAIN did not answer ($(tr -d '\n' < "$WORK/report.err"))"
[ "$code" = 200 ] || fail "$step" "GET /scan/$DOMAIN answered $code"

score_label=$(copy_text "verdict.score.label")
[ -n "$score_label" ] || fail "$step" "the copy registry binds no verdict.score.label"
grep -qF "$score_label" "$page" || fail "$step" "the report carries no score"

band_seen=""
for key in band.score.invisible band.score.hard-to-find band.score.findable band.score.dominant; do
  word=$(copy_text "$key")
  [ -n "$word" ] && grep -qF ">$word<" "$page" && band_seen="$word"
done
[ -n "$band_seen" ] || fail "$step" "the report carries no band word"

incomplete=$(copy_text "notice.incomplete")
incomplete=${incomplete%% —*}
[ -n "$incomplete" ] || fail "$step" "the copy registry binds no notice.incomplete"
grep -qF "$incomplete" "$page" && fail "$step" "the report shows the incomplete notice"

unreadable=$(copy_text "notice.site-unreadable")
[ -n "$unreadable" ] && grep -qF "$unreadable" "$page" && fail "$step" "the report says the site could not be read"

bars=$(grep -o '[0-9]\{1,2\}/10' "$page" | wc -l)
[ "$bars" -ge 3 ] || fail "$step" "the report's driver strip carries $bars measured values, not three"
ok "$step" "200 · $score_label · $band_seen · $bars driver values"

echo "smoke: PASS · $BASE_URL walked landing → scan → report for $DOMAIN in $(secs "$ENDED_MS")"
