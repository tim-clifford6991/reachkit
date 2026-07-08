# Launch-Readiness Implementation Plan

## PROGRESS (branch `feat/launch-readiness-workstream-a`, updated 2026-07-08)

**Workstream A — DONE (A1–A7), 1064 tests green, 0 type errors.**
- A1 ✅ action floor `< MIN_ACTIONS(5)` (was `==0`) + `signalKeys` on every card + `persistActions` writes `signal_keys`. New `action-linking.ts` (+tests).
- A2 ✅ upgrade wall never advertises `Unlock N fixes` when `lockedCount==0` — pivots to playbook/tracking.
- A3 ✅ deterministic JSON-LD draft (`action-drafts.ts`, no LLM) for the schema quick-win. (Haiku-draft-for-all-quickWins = deferred; generator already drafts.)
- A4 ✅ competitor name→domain resolver (`competitor-resolve.ts`, brand-ambiguity safe) + `seedFromScan` resolves name-only rows & backfills. Fixes onboarding "1 competitor".
- A5 ✅ free search-gap = locked upsell teaser, not a "data unavailable" apology.
- A6 ✅ unassessed pillars render "Not measured" (not 0/100); lever ignores them; basis subtitle. (Content-threshold recalibration → C3 with the batch.)
- A7 ✅ mirror prompt names a real competitor when the gap sheet has one. (Deeper enrichment + live LLM verify → P1.)

**Workstream B — B1 DONE.**
- B1 ✅ `.github/workflows/inngest-sync.yml` auto-PUTs `/api/inngest` on prod deploy. (`/status` canary → follow-up.)
- B2 ⏳ real test-mode Stripe checkout e2e — NOT done (needs deploy + test keys).
- B3 ⏳ cost aggregation + score/market snapshots — NOT done.

**Gates still required before "launch-ready":**
- ⏳ `pnpm build` + `pnpm check:bundle` (could not run — `next dev` was live; run with dev stopped).
- ⏳ Deploy to prod → **manually `PUT /api/inngest` once** (B1 automates subsequent deploys) → fresh live trustmrr scan verifying every Workstream-A AC.
- ⏳ Workstream C (iOS mode, direct-paid branch, score calibration batch, retention loop, degraded/abuse).

---

## LIVE FINDINGS (2026-07-08, floor-fix re-validation + subagents)

- **Floor fix (PR #28) VERIFIED live:** deep pass 2→3 actions; the new ones are market-derived fails (`content_cadence`, `owned_channels`) now visible to the floor. Honest count = # genuinely-failing signals.
- **SCORE INSTABILITY (NEW, launch-relevant):** trustmrr scored 86, 86, then **100** across identical scans — `schema_jsonld` flipped fail→pass because the target's fetched HTML varied (JSON-LD present/absent). Our headline swings with the target site's served HTML. Mitigations to weigh: retried/more-robust fetch, treat single fixed-basis-signal flips as `warn` not `fail`, or render JS. Pairs with C3 calibration + a fetch-determinism review.
- **C5 subagent found 2 real bugs (fixed on its branch):** (1) `scan-requested` onFailure marked a scan `failed` even when a good `report_payload` was already persisted (hid working partial reports); (2) `scan-deepen` onFailure never wrote a terminal status → scan stuck on `synthesizing` forever, blocking future scans. New `lib/scan/terminal-status.ts` (degrade-if-report-exists) + tests. Rate-limit path was already correct (429).
- **B2 subagent found 1 real bug (fixed on its branch):** `provisionCheckoutUser` re-sent the onboarding email on every Stripe webhook redelivery (non-idempotent). Guarded + tests + `scripts/stripe-e2e.md`.

## REMAINING-ITEMS EXECUTION PLAN (2026-07-08) — B2 + C1–C5

After Workstream A + B1 + B3 shipped & live-verified, and the market-aware action-floor fix (PR #28), the remaining plan items split into **code-now** (dispatched to parallel subagents, isolated worktrees) and **live-run** (need a prod session + budget; can't be done by a subagent):

| Item | Code-now (subagent) | Live-run (needs prod) |
|------|---------------------|------------------------|
| **B2** Stripe e2e | Audit checkout→webhook→provision→email path; fix bugs; write `scripts/stripe-e2e.md` runbook + tests | Run one test-mode checkout with card 4242…; verify each hop |
| **C1** iOS/Android | Audit iTunes/RSS adapters + v1 app scoring + brand-leak; add tests | Run one live app-store scan (free+deepen) |
| **C2** direct paid-fresh scan | Verify tier=full fork runs full-scan in scan-requested; add test | Scan a new domain as a paid user, confirm ≥5 actions + market |
| **C3** score calibration | Build `scripts/score-calibration.mjs` harness + conservative content-threshold tightening + `docs/score-calibration.md` | Run the harness over 6–10 domains; finalize thresholds to hit monotonic band separation |
| **C4** retention loop | (n/a — trigger-only) | Manually fire weekly-refresh + score-pulse against the test app; assert watermarks/snapshot |
| **C5** degraded/abuse | Harden degraded-not-failed + rate-limit→429; add tests | Force an adapter timeout (bad domain)→degraded; >N scans/IP→429 |

Subagents produce reviewed branches; I integrate + PR. The live-run column is a follow-up prod session (each is a short scripted run using `scripts/prelaunch-validate.md`). C4 is trigger-only (no code).

---


**Author:** Fable 5 pre-launch review, 2026-07-07 (see `fable_assessment` in the validation JSON)
**Executor:** Opus — follow this document task by task, in order, with TDD (`superpowers:test-driven-development`) and live verification per the protocol at the bottom.
**Mission:** Make ReachKit launch-ready. The pipeline mechanics are proven live end-to-end; what's broken is the **conversion spine**. The free scan page must become a *competent* page — credible score, real named insights, visible proof of depth — that shows the first 30% of value and gates the rest behind upgrade. Today it gives away 100% of a thin plan while apologizing for missing data.

## Evidence baseline (live prod run, trustmrr.com, scan `cc5c1aad-c8b9-46ba-a1fc-b1e467bde69f`)

- Free scan: 36s, score **86/100 v2** ("Highly discoverable"), Content **100/100**, Outreach shown **0/100** (actually *unassessed*), SEO 76.
- Paid deepen: 72s, `deepened_at` set, **only 2 actions**, both with **empty drafts** and `signal_keys=[]`. 3 findings. Signals: 13 pass / 4 fail / 1 unmeasured.
- All 5 `competitors` rows have `competitor_store_url=""` (`source=llm_extracted`) → onboarding picker showed 1 candidate (live-discovery fallback), zero scan-seeded.
- Free page renders "Search-gap data wasn't available for this scan" (it's tier-gated, not unavailable) and "Unlock all 2 fixes" with `lockedCount=0` — nothing behind the wall.
- `scans.cost_cents=0` (pipeline_runs holds real cost), `score_snapshots=0`, `market_snapshots=0`, `rank_data_fetched_at=null`.
- CRITICAL (fixed live, unautomated): Inngest Cloud registration was stale — `scan/deepen` + likely `weekly-refresh`, `verify-action`, `score-pulse`, `search-cache-cleanup` were unregistered; events silently dropped. `PUT /api/inngest` fixed it (`modified:true`).

## Ground rules (non-negotiable)

1. **Never run `pnpm build` while `next dev` is running** (corrupts `.next`).
2. **Live-verify everything** — fixtures, evals, and code review have all historically masked real-adapter/LLM bugs in this repo. A change isn't done until observed against the real prod/preview app.
3. **Do NOT break the fixed-basis headline invariant**: free and paid headline score must remain identical (same 8 on-site signals, `FIXED_BASIS_SIGNAL_KEYS` in `lib/scan/registry-score.ts:124`). Reframe copy, don't fork the number.
4. **No schema drops in this pass** (the dead `evidence` table and 7 write-only intel tables are a separate, later decision).
5. Design-token changes go via `/design-sync`, not direct edits; app intel-kit components (`--c-*`) may be edited directly.
6. One branch per workstream, PR to `main`, tests green + `pnpm build` before each PR.
7. Each task below lists **AC** (acceptance criteria). A task is complete only when every AC is demonstrably true — cite the evidence (test output, SQL result, rendered-page grep) in the PR description.

---

## Workstream A — Free scan page: competent, insightful, enticing (P0)

### A1. Action plan floor: ≥5 ranked fixes, always
**Problem:** Generator+critic produced 2 cards; the fallback floor (`lib/scan/full-scan.ts:523-538` → `lib/scan/fallback-actions.ts`) only fires when the plan is **empty**, so a thin plan bypasses it despite 4 failing signals sitting unused.
**Instructions:**
- Introduce `MIN_ACTIONS = 5`. After critic + §11, if `plan.length < MIN_ACTIONS`, **top up** from `fallbackActionsFromSignals`, excluding signals already covered by surviving cards (match on `signal_keys`). Cap total at 8.
- Every action card — generated and fallback — must carry non-empty `signal_keys` linking it to the registry signals that motivated it (score-delta attribution depends on this). For generated cards, have the action-gen prompt (`lib/llm/actions.ts`) return the signal keys it addressed; validate against the registry (`lib/scan/signals.ts`), drop unknown keys.
- Free scans get the same floor at report time: `runFreeReport` should surface fix *stubs* derived from failing fixed-basis signals so the free page can honestly claim "N fixes found".
**AC:**
- [ ] Paid scan of a site with ≥3 failing signals yields ≥5 actions, each with ≥1 valid `signal_keys` entry.
- [ ] Free report exposes total fix count ≥5 while rendering at most 3 (see A2).
- [ ] Unit tests cover: thin plan (2) → topped to 5; rich plan (8) → untouched; dedupe (fallback never duplicates a covered signal).

### A2. Upgrade wall: never advertise an empty lock
**Problem:** `components/report/captured/results-screen.tsx:286` renders `Unlock all ${p.fixes.length + p.lockedCount} fixes` even when `lockedCount === 0`.
**Instructions:**
- Guard: when `lockedCount === 0`, do not render an "unlock fixes" CTA; fall back to the weekly-tracking/monitoring pitch. (Post-A1 this should be rare, but the guard must exist.)
- With A1 in place, free preview = 3 of ≥5 → `lockedCount ≥ 2`. Show the locked cards as *visible, blurred rows with real titles* (title visible, why/draft blurred) — the user must see WHAT they're not getting, not a count.
**AC:**
- [ ] `lockedCount=0` renders no "Unlock all N fixes" string (component test).
- [ ] Free page for trustmrr-class scan shows 3 open + ≥2 blurred-but-titled locked fixes.

### A3. Drafts: the done-for-you promise must be real
**Problem:** Both paid action drafts were empty (`draft_len=0`).
**Instructions:**
- **JSON-LD action:** generate the draft deterministically server-side (no LLM) — template a valid `SoftwareApplication`/`Organization` JSON-LD block from `preliminary_facts` (name, domain, category, description). This is the highest-frequency quick-win; it must never be empty.
- **Other quickWins:** draft via Haiku at generation time; if the draft comes back empty after one retry, set `draft_requires_edit=true` and change the card copy so it does not claim a ready-made draft.
- Free tier continues to null drafts via `redactReportForTier` (that's the tease) — but the *locked* preview should indicate "draft included" so the paid delta is explicit.
**AC:**
- [ ] Paid scan: every quickWin card has a non-empty draft; the JSON-LD draft parses as valid JSON and contains the app's name and domain.
- [ ] No rendered card claims a draft it doesn't have.

### A4. Competitors: names must resolve to domains
**Problem:** `llm_extracted` competitors persist with `competitor_store_url=""` (`lib/scan/competitors.ts:43`, names from `lib/llm/competitor-names.ts`). `seedFromScan` in `app/api/competitors/candidates/route.ts` drops URL-less rows (`normalizeHost("") → continue`) → onboarding showed 1 candidate instead of 5.
**Instructions:**
- At persist time, resolve each extracted name → domain using the existing SERP/Tavily adapters (query `"<name>" <category>`; take the top organic domain). Apply the **brand-ambiguity rule** (see memory `reachkit-realmode-quality`): if the top results disagree on the entity, persist the name with `competitor_store_url=null` rather than a wrong domain — but log it.
- Make `seedFromScan` tolerant: include name-only rows in the candidate list (flagged `unresolved`, resolve on selection) instead of silently dropping them.
- This also feeds the free page: **"Who you're up against" on the free report must name the scan's discovered competitors** (they're already in `report_payload.competitiveLandscape`) — verify the free redaction keeps names + mention counts visible (it should per `redactLandscape`).
**AC:**
- [ ] Fresh scan of trustmrr.com persists ≥4 of 5 competitors with non-empty, plausible domains.
- [ ] Onboarding picker shows ≥3 scan-seeded candidates for that app.
- [ ] No competitor row is silently invisible to the picker.

### A5. Search-gap: gate it, don't apologize for it
**Problem:** `results-screen.tsx:254` shows "Search-gap data wasn't available for this scan" on free scans. It's not unavailable — it's paid-only (`to-results-props.ts:77`). A paywall phrased as a failure destroys competence perception.
**Instructions:**
- Thread tier/deep-status into the props. Three states:
  1. **Free scan** → locked teaser: "Keyword-gap analysis is part of the full scan — see where rivals outrank you." Styled as locked value, not absence.
  2. **Paid scan with data** → the table.
  3. **Paid scan, data genuinely missing** → the current honest empty state (only case that keeps apology copy).
**AC:**
- [ ] Free page contains no "wasn't available" text; renders the locked teaser.
- [ ] Paid page renders the gap table when `market.gap.keywordGap` is non-empty.

### A6. Score presentation: credible, not inflated
**Problem:** Outreach renders **0/100** when it's *unassessed* (`assessed:false` in the radar; `registry-score.ts` excludes unmeasured pillars from the total, but the UI shows 0). Content **100/100** from HTML-only signals reads as fake-perfect. The band "Highly discoverable" overclaims for an on-site-only basis.
**Instructions:**
- Unassessed pillars render as **"Not measured"** (grey/locked chip, no numeric value, excluded from any visual average). Never display 0 for `unmeasured`.
- Reframe headline copy to state its basis: e.g. band label subtitle "on-site discoverability readiness" and a one-line "Measured from N on-site signals; off-site reach unlocks with the full scan" — this turns the limitation into an upgrade hook without touching the number (invariant preserved).
- Content=100: review the content-pillar signal thresholds (`lib/scan/signals.ts` pass/warn) so a median indie site cannot trivially hit 100 — tighten `content_depth` / `media_richness` pass bars. Do **not** change `FIXED_BASIS_SIGNAL_KEYS` membership.
**AC:**
- [ ] No pillar ever displays `0/100` when its state is unmeasured (component test + rendered-page grep).
- [ ] Headline area names its measurement basis and the upgrade path.
- [ ] trustmrr re-scan lands Content < 100 unless it genuinely maxes the tightened bars.

### A7. Positioning Mirror: make it concrete
**Problem:** Mirror is thin/generic.
**Instructions:** Enrich the synth input (`lib/llm/synth.ts`) with the now-domain-resolved competitor profiles (A4) and review themes, and require the mirror to name ≥1 competitor and ≥1 differentiator with evidence. Reject-and-retry once if the output contains no proper nouns from the input set (always-insight rule from `reachkit-realmode-quality`).
**AC:**
- [ ] Mirror on a fresh trustmrr scan names ≥1 real competitor and a specific differentiator.

---

## Workstream B — Infrastructure blockers (P0)

### B1. Inngest registration must survive deploys
**Problem:** Prod registration went stale; `scan/deepen` events were silently dropped (zero error surface). Fixed manually via `PUT /api/inngest`.
**Instructions:**
- Add an automated post-deploy re-sync: GitHub Action on `deployment_status` (state=success, environment=production) → `curl -fsS -X PUT https://reachkit-pi.vercel.app/api/inngest` (or a Vercel deploy hook). Fail the workflow on non-200.
- Add a canary check to `/status`: it should surface the count of registered functions or last-sync time so a stale sync is *visible*.
- Document in `docs/architecture.md` (keep-updated rule).
**AC:**
- [ ] Deploying to prod triggers the PUT automatically (verify in Action logs; second PUT returns `modified:false`).
- [ ] `/status` exposes sync health.

### B2. One real Stripe test-mode checkout, end-to-end
**Problem:** The revenue path (checkout → webhook → `provisionAccount` → `ensureDeepScan` → Resend magic-link email) was **bypassed** in validation via direct entitlement grant. It has never been exercised live.
**Instructions:** Using test keys on a preview deployment (or prod with test-mode keys if configured), run one full checkout with a Stripe test card. Verify: webhook 200s, `users` row gets stripe ids + `subscription_status`, deepen fires, provisioning email arrives and its confirm link signs in.
**AC:**
- [ ] Documented run with evidence for each hop (webhook log, SQL row, email screenshot/link, deepened scan).

### B3. Cost + snapshot telemetry
**Problem:** `scans.cost_cents=0` while `pipeline_runs` holds real cost (unit economics blind; budget guard possibly comparing against 0). `score_snapshots=0` and `market_snapshots=0` after a full scan → dashboard history and market trends start dead.
**Instructions:**
- Aggregate stage cost onto `scans.cost_cents` (increment at each stage end, or sum `pipeline_runs` at completion). Confirm `ScanBudget` enforcement reads real numbers.
- Write a `score_snapshots` row (`source='scan'`) at free-scan completion and at deepen completion; write a `market_snapshots` row when `report_payload.market` is first persisted (`lib/scan/market.ts` — the insert at `market.ts:91` exists but didn't fire on the deepen path; find out why and fix).
**AC:**
- [ ] After a fresh free+deepen cycle: `scans.cost_cents` ≈ `sum(pipeline_runs.cost_cents)` (±1c), ≥2 score snapshots, ≥1 market snapshot exist, and the dashboard history chart renders non-empty.

---

## Workstream C — Coverage the validation didn't reach (P1, before/at launch)

- **C1. iOS/Android mode:** run one live app-store scan (free + deepen); verify iTunes/RSS adapters, v1 scoring path, and the report render. AC: `done` status, sane score, no brand-leak in themes.
- **C2. Direct paid-fresh-scan branch:** as an already-paid user, scan a *new* domain (tier=`full` at POST → full-scan step inside `scan-requested`, a different branch than free→deepen). AC: completes with ≥5 actions and market block.
- **C3. Score calibration batch:** scan 6–10 known domains (mix: strong SaaS e.g. linear.app; median indie; weak/thin site). AC: monotonic band separation (strong > median > weak); median indie lands 50–69 ("Fair"); document the distribution in `docs/score-calibration.md`. Tune signal thresholds (A6) if not.
- **C4. Retention loop staging run:** manually trigger `weekly-refresh` and `score-pulse` once against the test app. AC: monitors update watermarks, a pulse snapshot is written, no errors. (These were likely unregistered in prod until the resync — assume never-run.)
- **C5. Degraded + abuse paths:** force one adapter timeout (bad domain) → scan ends `degraded` not `failed`, page renders. Rate-limit: >N scans from one IP → 429. AC: both observed live.

## Codify the validation loop

Create `scripts/prelaunch-validate.md` (runbook) capturing the exact loop used on 2026-07-07 so it's repeatable before every launch-critical deploy:
1. (Optional) purge test data; 2. anonymous `POST /api/scan`; 3. poll `scans` to `done`; 4. grant/verify entitlement; 5. authed re-POST → deepen; 6. poll `deepened_at`; 7. SQL completeness checks (actions≥5, signals=18, market present, snapshots, cost_cents>0); 8. render greps on `/scan/<slug>` and `/app`; 9. `PUT /api/inngest` idempotency check.

## Definition of launch-ready (exit criteria)

- [ ] All Workstream A ACs pass on a **fresh live scan** (purge trustmrr, rescan free, deepen) — the free page shows: credible score with "not measured" states, ≥5 fixes (3 open + locked-titled rest), named competitors, keyword-gap teaser, concrete positioning mirror, and an upgrade wall with real locked value behind it.
- [ ] B1–B3 verified in prod.
- [ ] C1–C3 executed with documented evidence; C4–C5 at minimum scheduled.
- [ ] Full test suite green, `pnpm build` clean, no new security-advisor regressions.
