# Merge Contract — the three 2026-07-17 plans

**Purpose:** the owner is merging three parallel plans into one master plan with phases. This document is the **conflict analysis** and the **sequencing contract**. It decides nothing the owner has already decided; it surfaces every place two plans touch the same thing, and marks the ones that need a ruling.

**Status:** 3 real conflicts (C1–C3), 4 file-level overlaps needing sequencing (S1–S4), 1 new invariant with no owner (N1).

---

## The three plans

| ID | Plan | Owns | State |
|---|---|---|---|
| **A** | `plans/2026-07-17-grounding-honesty-and-flag-removal.md` | Fabricated evidence (`runSynth` inventing reviews; Tavily `answer` laundered into snippets) + `REACHKIT_USE_FIXTURES` removal | Written; carries a **Tim ruling** |
| **B** | `specs/2026-07-17-free-scan-number-consistency-design.md` | Free-scan number honesty; one keyword engine; the G1–G8 guard class | Design agreed, not implemented |
| **C** | `plans/2026-07-17-onboarding-score-coherence.md` | Onboarding flow · free-report reveal timing · dashboard score coherence · product removal | Written |

**Already shipped today** (do not re-plan): PR #88 (one post-checkout provisioning policy; `onboarding_link_sent_at`; weekly-refresh self-heal) and PR #90 (progress gate + time-based ring + SSE replay cursor). Both live at `64410d1`, **neither live-verified**.

---

## C1 — 🔴 The Outreach bar: A/B/C disagree. **Plan C is wrong. Owner ruling needed.**

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
| **0** | **B/WS0** — the 25¢ free cap that didn't fire (**120.70¢ free scan, `external_cap_hit_at` NULL**). Guard G8. | Live money leak. Zero dependencies. B says ship it alone — agreed. This is *"a guard you have not SEEN FAIL"* live in prod. |
| **1** | **A/Phase 0** — stop the fabrication. | Small, unblocks the video, and makes every downstream evidence claim honest. Resolves C3 by going first. |
| **2** | **A/Phase 1** — `fixturesEnabled()` has **no `NODE_ENV` check**: one mistyped env var = free upgrades to any tier, rate limiting off, magic links in logs, **in production**. | Cheap, and the blast radius is catastrophic. A says "do regardless" — agreed. Arguably belongs at Phase 0 alongside the cap. |
| **3** | **C/WS6** — product removal + honest cap copy. | Self-contained. A growth customer at 3/3 is permanently capped and told to do two impossible things. |
| **4** | **B/WS1 + WS2** — honest totals + honest copy. Guards G1–G6. | The core free-scan fix. Owns `free-report.ts` + `results-screen.tsx` first (S1, S2). |
| **5** | **C/WS3** — free reveal at facts (t+8.1s measured). | After B renames/reshapes the stages (S1). |
| **6** | **C/WS4 + C1 ruling** — one score story on the dashboard, adopting B §6's `Measured` contract (S3). | Needs the C1 ruling and B's contract to exist. |
| **7** | **B/WS3** — one keyword engine (the structural collapse). | Biggest, riskiest; do it once the honesty fixes have settled the definitions it must unify. |
| **8** | **N1/G9** — the paid-data ledger sweep. | Needs B's engine collapsed first, or it audits three engines that are about to become one. |
| **9** | **A/Phases 2–3** — the seam + flag deletion (~43 files). | Largest mechanical change; last, so it doesn't churn under everything above. |
| **10** | **C/WS1** — onboarding into `/app/add`. | Independent of all the above; can move earlier if the owner wants it sooner. Its riskiest step (1.2/6) is stranding freshly-upgraded users — verify by driving the flow. |

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

## Rulings needed before the master plan is executable

1. **C1 — the Outreach bar.** Options 1/2/3 above. **Plan C is wrong as written**; it must not merge unamended.
2. **N1/G9 owner.** Which plan takes the paid-data ledger — B (owns the guard class) or a fourth plan?
3. **A/Phase 1 priority.** It's listed as Phase 2 above; the `NODE_ENV` blast radius arguably makes it Phase 0 alongside the cap.
