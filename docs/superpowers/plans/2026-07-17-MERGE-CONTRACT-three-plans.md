# Merge Contract — the three 2026-07-17 plans

**Purpose:** the owner is merging three parallel plans into one master plan with phases. This document is the **conflict analysis** and the **sequencing contract**. It decides nothing the owner has already decided; it surfaces every place two plans touch the same thing, and marks the ones that need a ruling.

**Status:** 3 real conflicts (C1–C3), 4 file-level overlaps needing sequencing (S1–S4), 1 new invariant with no owner (N1). **C1 and Plan B §1.10/WS0 both RULED by the owner 2026-07-17 — see the ✅ blocks.**

---

## ✅ OWNER RULINGS — 2026-07-17

**R1 — C1, the Outreach bar → merge-contract option 3.** A pillar bar renders when it has **≥1 measured signal**, computed from the full `scan_signals` set, each labelled with its **basis** (Plan B §6's `Measured` contract). Outreach renders `comparison_pages: fail`. The gauge stays on the fixed basis — **invariant #1 untouched**. This fixes the class: a bar's presence is driven by whether we measured it, not by which basis a *different* number uses. Plan C/WS4 Task 4.1 is rewritten to this. Composes with Plan B and closes its §8 deferred item.

**R2 — Plan B §1.10/WS0 is FACTUALLY WRONG; replaced by a cost-attribution split.** The "120.70¢ free scan, cap didn't fire" does not exist. Root-caused against prod 2026-07-17 (see § C-COST below): it is a ~12¢ free scan whose *row* accumulated ~100¢ of **paid intel + weekly-refresh** spend over the following days, because `costedIntelStep`/the cron flush onto the latest scan id. `scans.dataforseo_cost_cents` is a **lifetime accumulator**, not a per-run figure. **The cap did not fail — the free scan spent ~12¢, inside 25¢. Invariant #2 holds** (all spend is attributed to the user via `app_ids`). The fix is to **split per-run scan spend from post-scan spend** so "what did this scan cost" and "what has this app cost since" are distinct answerable questions — not to touch the cap's breach logic, which would then fire spuriously. **Do not implement Plan B WS0 as written.**

---

## The three plans

| ID | Plan | Owns | State |
|---|---|---|---|
| **A** | `plans/2026-07-17-grounding-honesty-and-flag-removal.md` | Fabricated evidence (`runSynth` inventing reviews; Tavily `answer` laundered into snippets) + `REACHKIT_USE_FIXTURES` removal | Written; carries a **Tim ruling** |
| **B** | `specs/2026-07-17-free-scan-number-consistency-design.md` | Free-scan number honesty; one keyword engine; the G1–G8 guard class | Design agreed, not implemented |
| **C** | `plans/2026-07-17-onboarding-score-coherence.md` | Onboarding flow · free-report reveal timing · dashboard score coherence · product removal | Written |

**Already shipped today** (do not re-plan): PR #88 (one post-checkout provisioning policy; `onboarding_link_sent_at`; weekly-refresh self-heal) and PR #90 (progress gate + time-based ring + SSE replay cursor). Both live at `64410d1`, **neither live-verified**.

---

## C1 — ✅ RULED (R1, option 3). The Outreach bar: A/B/C disagreed; Plan C was wrong.

> Ruling recorded above (R1): bars render per-pillar when measured, each with its basis, adopting Plan B §6's `Measured` contract. Plan C/WS4 Task 4.1 rewritten. The analysis below is retained as the evidence for the ruling.

**Where:** C/WS4 Task 4.1 vs B §8-Deferred.

**Plan C claims** *"delete the Outreach bar — it can never render."*
**Plan B claims** *"the headline basis and the signal table disagree about whether Outreach was measured."*

**Verified 2026-07-17** (resend free scan `14533748…`, `scan_signals`):

```
outreach | fail        | 1 row  | comparison_pages          ← MEASURED, and FAILING
outreach | unmeasured  | 4 rows | community_presence, marketplace_presence, press_mentions, share_of_voice
```

**Both are right about different things, and C's *fix* is wrong.** `comparison_pages` (`pillar: outreach`, weight 0.15, `lib/scan/signals.ts:92`) **is measured on a free scan** and it **fails**. It is excluded from the bar only because the dashboard decomposes `headlineScore`'s FIXED 8-key basis — and `comparison_pages` isn't one of the 8. So:

- C's premise ("outreach is never measured") is **false**.
- C's *observation* (the bar is unrenderable) is **true** — but because of the basis chosen, not because the data is absent.
- Deleting the bar would **hide a real failing signal we already paid nothing extra to measure** — and would silently pre-empt B's deferred item, which would then have nothing left to reconcile.

This is the `735dbae` class *again*: that commit reworded a dead row instead of asking why it was dead. C/WS4 Task 4.1 was about to make the same mistake one level up.

**The real class:** the dashboard's pillar bars present as *"your pillars"* but decompose the **headline's** basis, which is deliberately on-page-only (invariant #1). Any genuinely-measured off-site signal is therefore invisible by construction.

**Ruling needed — three coherent options:**

| | Fix | Cost |
|---|---|---|
| **1** | Bars decompose **on-page readiness only**, relabelled to say exactly that. Outreach bar deleted. `comparison_pages` surfaces elsewhere (Market Position / signal table). | Honest, minimal. The failing signal moves rather than shows. **This is C as written, with a corrected premise.** |
| **2** | Bars decompose the **full measured set** (`registryScore` over all rows). Outreach renders "comparison_pages: fail". Gauge stays on the fixed basis (invariant #1 untouched). | Shows the real failure — but bars then genuinely ≠ gauge, which is the *"multiple conflicting numbers"* the owner complained about. |
| **3** | Bars show a pillar **only when it has ≥1 measured signal**, from the full set, each labelled with its basis (B §6's `Measured` contract applied to pillars). | Most honest; most work; composes with B's contract. |

**Recommendation: 3**, because it is the only one that fixes the class (a bar's presence is driven by whether we measured it, not by which basis a different number uses) rather than choosing which symptom to keep. If speed wins, **1** — but then B's deferred item must be closed in the same release, not left dangling.

**Do not merge C/WS4 Task 4.1 as written.**

---

## C2 — 🟠 The fixtures verification instruction is stale in B (and in CLAUDE.md)

**Where:** B/WS4 says *"`REACHKIT_USE_FIXTURES=false`, deploy, scan three live shapes"*. A/Phase 3 **deletes that flag** and rewrites the CLAUDE.md hard rule into its successor (*"prod ships one path; live-test against real adapters"*).

**Ordering:** if A/Phase 3 lands first, B/WS4's instruction references a flag that no longer exists. If B lands first, it is correct but becomes stale on A's merge.

**Resolution:** B/WS4's *intent* — "fixtures return canned clean data and would mask every defect in §1" — survives A intact; only the mechanism changes. Merge B/WS4 with the wording *"verify against real adapters (see A's successor rule)"*, not the flag name. **A owns the CLAUDE.md edit; B must not also edit it** (two plans editing one rule = the drift).

⚠️ **Live now:** CLAUDE.md still carries the superseded text. Anyone reading it today gets the dead rule. A/Phase 3 owns the fix.

---

## C3 — 🟠 The Positioning Mirror has two owners

**Where:** A/Task 0.2 (*"Empty review sheet → empty mirror (never invented)"*) + A/Task 0.4 (*"An ungrounded mirror does not render"*) vs B §8-Deferred (*"The Positioning Mirror earns its space or goes… likely merges with the parallel agent's work"*).

**Not a contradiction — a sequencing trap.** A fixes the mirror's *grounding*; B questions its *existence*. If B later deletes the mirror, A's Phase 0 work on it is wasted; if A hardens it first, B's "earns its space" decision is made on a mirror that finally behaves.

**Resolution:** **A first.** A/Phase 0 is explicitly the fabrication fix and unblocks the launch video; it is small and it makes B's evidence honest. B's mirror decision is then taken against a mirror that no longer invents — which is the only fair test of whether it earns its space. B §8's own wording already anticipates this.

---

## C-COST — 🔴 Plan B §1.10 root-caused: there was never a 120.70¢ free scan

**Both this chat's Plan C and the other chat's Plan B carried "the 25¢ free cap did not fire on a 120.70¢ scan" as a live cost-safety bug. It is not one.** Root-caused against prod 2026-07-17.

The 120.70¢ row is **nudgi.ai** (`b009bccb`). Proof it ran the FREE track only:

| | nudgi.ai | a real deep scan (trustmrr) |
|---|---|---|
| `deepened_at` | **null** | set |
| `actions` rows | **0** | 5 |
| LLM `cost_cents` | **3¢** | 12¢ |
| `dataforseo_cost_cents` | **112.70¢** | 52.73¢ |

`pipeline_runs` for that scan total **~3¢ of LLM** (2 tool, 2 extract, 1 synth, 1 refresh) — free-track work, no deep pass. Yet `dataforseo_cost_cents = 112.70`. Where it came from — `scan_events`:

```
2026-07-11 11:50   free scan finishes             ~12¢   ← the actual free scan, inside 25¢
2026-07-11 17:00   intel-spend  source=candidates         ← /api/competitors/candidates (assertPaid)
2026-07-11 17:01   intel-spend  source=intel-stream       ← /api/app/intel/stream       (assertPaid)
2026-07-11 17:02   intel-spend  source=select   ~€1       ← /api/competitors/select     (assertPaid)
2026-07-11 21:45   intel-spend  source=intel-stream       ← (assertPaid)
2026-07-13 09:00   refresh (noOp)                         ← weekly cron
```

**Mechanism.** `costedIntelStep` and `weekly-refresh.ts:137` both flush their DataForSEO spend onto the **latest scan id** (`costedStep(latestScanId, …)`), and `scans.dataforseo_cost_cents` is a **lifetime accumulator for everything ever attributed to that row**. `tier='free'` describes how the *scan* ran, not what the *row* has since absorbed. The ~12¢ free scan is correct; the other ~100¢ is genuine paid-intel + cron spend correctly attributed to the app — just **stored on the scan row**, where a tier-grouped query misreads it as free-scan cost.

**Why the cap "didn't fire" — and why touching it would be a bug.** `costedStep`'s cap (`scan-telemetry.ts:88-94`) computes `remaining = capCents − flushedExternalCents(scanId)`, a lifetime flush. On the free scan itself (~12¢) it never breached — correctly. Plan B's WS0 would "fix" the cap to fire here; that would make it fire on the *accumulator*, i.e. spuriously on any long-lived row. **Invariant #2 holds** — nothing spent anonymously; every cent traces to the user via `app_ids`. This is a **measurement/reporting** bug, not a spend leak.

**Ruling R2 replaces Plan B WS0:** split per-run scan spend from post-scan spend so the two questions are distinct, and fix `/app/diagnostics` + any tier-grouped analysis that reads the accumulator as per-scan. **Do NOT modify the cap breach logic.** G8 becomes: *the cap fires on a genuine single-RUN overspend* (drive one run past `EXTERNAL_SCAN_CAP_CENTS_FREE`), not on an accumulated total.

**⚠️ For the other chat:** you flagged WS0 as "ship alone, today — live money, no design agreement needed." **Please hold it.** The premise is disproven above; shipping it as written changes cap behaviour to chase spend that is already correctly attributed, and risks spurious breaches. The real work is attribution-split, which is Plan C/N1 territory and wants sequencing, not a same-day solo ship. Nothing is leaking — no urgency.

---

## S1–S4 — File-level overlaps (no contradiction; sequence them)

| # | File | Plans | Contract |
|---|---|---|---|
| **S1** | `lib/scan/free-report.ts` | **B** (WS1/WS2: what it computes) · **C** (WS3: emits progress artifacts — it currently emits **none**) | Orthogonal: C adds `emitScanEvent` calls, B changes the data. **B first** (structural), then C's artifacts wrap B's final stage names — otherwise C names stages B is about to rename. |
| **S2** | `components/report/captured/{results-screen,to-results-props}.tsx` | **B** (WS1/WS2: the numbers + labels) · **C** (WS3: reveal timing) | **B owns the content; C owns the timing.** C/WS3 must not touch labels. B's G5/G6 pin the copy — C would trip them. |
| **S3** | `components/app/intel/*` | **B** §6.5 (vocabulary) · **C**/WS4 (dashboard hero) | B §10.3 asks this explicitly: **yes, C touches them.** §6's `Measured` contract is the shared seam — C/WS4 must adopt it rather than invent a parallel basis label. Same release. |
| **S4** | `docs/architecture.md`, `CLAUDE.md` | **all three** | Highest collision risk — every plan's Change Protocol step edits both. **One plan per rule.** A owns the fixtures rule; B owns the new "a number measures its label" rule; C owns the onboarding rule. Nobody edits another's. |

---

## N1 — 🔴 The new owner invariant has NO owner in any plan

**Owner rule, 2026-07-17:** *"There should never be data that we call from DataForSEO or Tavily or LLMs that is not used for rendering the output. There is no point in wasting money on data that we store and never show to a user."*

Recorded in `CLAUDE.md` under the hard rules. **No plan currently owns enforcing it**, and all three touch cost-bearing calls. It needs a home in the master plan.

**Known live violations** (evidence, not hunch):

| Instance | Evidence |
|---|---|
| `categoryCapturedSearches` | B §6.2: *"internal, incoherent, feeds nothing"* — paid-derived, rendered nowhere. B deletes it. ✅ covered |
| `categorySeeds` volumes | B §1.4: we pay `google_ads/search_volume` for ≤8 seeds; the report itemises **only the unwon** ones. The won seeds are paid-for and unrendered. B §6.4 fixes this by rendering all phrases. ✅ covered |
| `ranked_keywords(50)` | B §1.2/1.3: 50 rows fetched; a subset rendered. B's `Footprint` uses all 50 for the split — so the spend *is* used. ✅ no violation |
| **Unaudited** | **Nothing has swept the paid surface for this rule.** The 2026-07-10 audit found *"7 write-only tables"* and *"demand billed 2×"* — that class has never been re-checked. |

**Two consequences for the master plan:**

1. **B's `domain_rank_overview` (+2¢, §4 step 2) is justified** — it renders true totals, replacing a rendered constant. It passes the rule. Merge it.
2. **A new workstream is needed: the paid-data ledger.** Sweep every cost-bearing call → name the surface that renders its output → delete the call or render the data. Nothing else in the three plans does this, and B's RC1 (*three keyword engines, same primitives, billed separately*) all but guarantees findings.

**Proposed guard — G9, extending B's G1–G8 class:**

> **G9 — every cost-bearing call has a render target.** A ledger test maps each cost-bearing adapter/field to the component that renders it. A new call without a target fails; a deleted render orphaning a call fails. Same idiom as `app/api/costed-routes.test.ts`, which already pins the exact route list — this pins the exact *render* list.

G9 belongs with B (it owns the guard class and the metric contract) or as a fourth plan. **It should not be split across plans.**

---

## Recommended phase order for the master plan

Ordered by *independence* and *risk*, not by plan.

| Phase | Work | Why here |
|---|---|---|
| **0** | **A/Phase 1** — `fixturesEnabled()` has **no `NODE_ENV` check**: one mistyped env var = free upgrades to any tier, rate limiting off, magic links in logs, **in production**. | Cheap, catastrophic blast radius, zero dependencies. This is the *actual* live money risk (Plan B's WS0 was not — see C-COST). Ship first. |
| **1** | **A/Phase 0** — stop the fabrication. | Small, unblocks the video, and makes every downstream evidence claim honest. Resolves C3 by going first. |
| **2** | **C/WS6** — product removal + honest cap copy. | Self-contained. A growth customer at 3/3 is permanently capped and told to do two impossible things. |
| **3** | **B/WS1 + WS2** — honest totals + honest copy. Guards G1–G6. | The core free-scan fix. Owns `free-report.ts` + `results-screen.tsx` first (S1, S2). **⚠️ WS1 BLOCKED on the `domain_rank_overview` `[VERIFY]` (B §10.1) — confirm response shape + live cost, or fall back to true-ETV-only, before estimating.** |
| **4** | **C/WS3** — free reveal at facts (t+8.1s measured). | After B renames/reshapes the stages (S1). |
| **5** | **C/WS4 (R1)** — one score story: per-pillar bars with basis, adopting B §6's `Measured` contract (S3). | Needs B's contract to exist. Ruling R1 settled. |
| **6** | **B/WS3** — one keyword engine (the structural collapse). **Mostly DELETION.** | The other chat confirms `keyword-gap.ts:97-98` already implements the full fetch-yours/fetch-rivals/subtract/brand-filter/rank process, cost-deduped through the shared 14-day cache. Free runs a weaker parallel copy. Under D1/D2 the paid engine is now the *correct* architecture — so WS3 deletes the free duplicate and re-points, it does not build. |
| **7** | **C-COST (R2) + N1/G9** — split per-run from post-scan spend; the paid-data ledger sweep. | Replaces Plan B's WS0. Needs B's engine collapsed first (Phase 6), or it audits three engines about to become one. G8 = cap fires on a single-RUN overspend; G9 = every cost-bearing call has a render target. |
| **8** | **A/Phases 2–3** — the seam + flag deletion (~43 files). | Largest mechanical change; last, so it doesn't churn under everything above. |
| **9** | **C/WS1** — onboarding into `/app/add`. | Independent of all the above; can move earlier if the owner wants it sooner. Its riskiest step (1.2/6) is stranding freshly-upgraded users — verify by driving the flow. |

> **Note on what moved.** Plan B's WS0 ("the cap that didn't fire") is **gone from Phase 0** — C-COST disproved it. Its real content (attribution split) is now Phase 7 with N1. A/Phase 1 takes Phase 0 because it is the genuine live-production risk. Nothing about this ordering leaves money leaking in the meantime — the 120.70¢ was already correctly attributed.

**Cross-cutting, every phase:** `pnpm test` · `check:arch` · `lint` · `check:design` · `eval` · `check:bundle`. Every guard mutation-proven. `git add -A` is unsafe (shared tree).

---

## Performance & cost posture (the owner's optimisation ask)

Measured 2026-07-17, prod:

| | Now | After the merge |
|---|---|---|
| Free wall clock | **40.2s** (p50 41.2 / p95 57.4, n=7) | unchanged — **one `runSynth` call is 22.4s = 56%** of it. C/WS3 reveals at **t+8.1s** so it stops being *felt*; nothing cuts it. |
| Free external | 12.60¢ typical · **one 120.70¢ outlier, cap NOT enforced** | ~14.6¢ (+`domain_rank_overview`), **cap enforced (G8)** |
| Deep wall clock | **137.8s** (47.1s dead zone) | unchanged — PR #90 makes the bar honest; the market pass is untouched (owner decision) |
| Paid external | ~37–60¢ | unchanged |

**The cost lever nobody has pulled:** B/RC1 — free, paid-gap and paid-demand run **three keyword engines over the same primitives**. The 2026-07-10 audit already found *"demand billed 2×"* and it was never collapsed. B/WS3 is the fix, and N1/G9 is how we find what else it's paying for twice.

**Explicitly NOT pursued** (owner decisions, do not re-litigate): rival keyword fetch on free (B/D2 — would cost ~21.6¢ on 100% of scans to serve the ~5% who convert); market-pass parallelization (C — heaviest external-spend path, cache-key drift silently doubles DataForSEO spend); any change to the v5 score math (all three plans).

---

## Rulings — status

1. **C1 — the Outreach bar.** ✅ **RULED (R1): option 3** — per-pillar bars with basis, Plan B §6 contract. Plan C Task 4.1 rewritten.
2. **Plan B WS0 / the "cap failure".** ✅ **RULED (R2):** it isn't a cap failure (C-COST). Replaced by the per-run/post-scan attribution split, folded into Phase 7 with N1.
3. **A/Phase 1 priority.** ✅ Moved to **Phase 0** — the genuine live-production risk.

**Still open (do not block the merge, but the master plan should name owners):**
- **N1/G9 owner** — the paid-data ledger. Recommend Plan B owns it (it owns the guard class + the metric contract); now sits in Phase 7.
- **`domain_rank_overview` `[VERIFY]`** (B §10.1) — blocks estimating B/WS1. Confirm response shape + live cost before Phase 3.
