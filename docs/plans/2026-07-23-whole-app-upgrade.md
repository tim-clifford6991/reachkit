# Whole-app upgrade — every surface onto one spine, converging on the plan

> **Status:** Plan for owner (Tim) approval — 2026-07-23. NO implementation until approved. Supersedes/absorbs `2026-07-22-paid-port.md` (P1 shipped + approved; P2/P3 folded in below).
> **Trigger:** P1 "What to rank for" board approved. Owner: *don't dribble the new data structure in one component at a time — plan how the WHOLE app comes together with it, across every subpage (competitors, customers, trends, action plans, …). Every user-facing component considered for upgrade, upgraded only if appropriate.*
> **Grounded in:** a complete component inventory (every `/app` subpage + free report + the orphaned tree) — the ledger in §3 is exhaustive, not illustrative.

---

## 1. The organizing idea — one story, three lenses, one destination

The whole product tells **one story in three lenses, and every lens ends in a specific move on the plan**:

1. **Where you stand** — the Discoverability Score (gauge · drivers · trend).
2. **What to rank for** — the KEYWORD/MARKET spine: the specific searches your buyers make that you don't win, sized by demand. → *create these pages.*
3. **How the market works around you** — two off-keyword lenses that are the paid contract's other pillars:
   - **Competitor lens** — who refers your rivals, what they rank for → *the lessons: pursue these referrers, publish these comparisons.*
   - **Customer lens** — where your buyers actually gather → *go post/engage here.*

**Everything converges on the Plan** — a calendar of specific moves (create this page · pitch this referrer · post in this community), each tracked over time as the score climbs. The Plan is the destination; every other surface is a reason to add a move to it.

**Two rules make this real (both already owner-set):**
- **One spine per concept.** There is ONE "what to rank for" (the persisted `searchVisibility` opportunity model), not two — today the dashboard/competitors keyword surfaces run a *separate*, metered Pipeline-B keyword model that diverges from it. Unify.
- **Always specific + actionable, never general.** Every rendered item on every surface names a concrete artifact + a real number, or it's cut. (Free fixes already meet this; extend product-wide.)

---

## 2. What the inventory revealed (the structural facts driving the ledger)

- **Two data pipelines.** **A** = `report_payload` (persisted once at scan, cheap, server-read). **B** = `/api/app/intel` (metered DataForSEO/Tavily/LLM, **recomputed on every paid tab-load**, cached after first hit). The new spine is Pipeline A; almost every paid tab is Pipeline B.
- **The keyword concept is forked.** The spine (`searchVisibility.categoryCard/nicheCard/categoryOpportunities`, A) powers WhatToRankFor + the whole free report. But the paid tabs' keyword surfaces — dashboard **KeywordGapTable**, competitors **KeywordEdgeList**, customers **DemandThemes** — read `supply.keywords.gaps` / `demand.searchDemand` (B): a *different, metered, divergent* keyword source. This is the #1 thing to unify.
- **A whole dead component tree.** All ~23 `components/report/*-section.tsx` files have **zero live importers** (grep-confirmed; most have no test either). The live report is entirely `components/report/captured/`. Dead weight.
- **Write-only producers still cost money.** `competitiveLandscape`, `creatorsToReach` (with `audienceProxy` hardcoded 0), `reviewThemes`, `strengthsAndWeaknesses` are computed + persisted by `full-scan.ts` and rendered by *only* the dead tree above → paid every scan, seen by no one.
- **The off-keyword lenses are healthy and on-contract.** Competitor referrers/channels/pages and customer communities are real paid value (contract pillars 2–3) — they stay, on their own data (the spine doesn't apply to them).

---

## 3. The per-surface upgrade ledger (every user-facing component)

Legend: **UPGRADE** = change it onto the spine / contract / actionability · **KEEP** = correct as-is (may move to Pipeline A in consolidation) · **CUT** = off-contract or dead.

### 3.1 Dashboard (`/app/dashboard`)
| Component | Verdict | Why / what changes |
|---|---|---|
| DashboardHero (gauge · pillars · lever · trend · recap) | **KEEP** | The score story. Correct, Pipeline A. Lens 1. |
| **WhatToRankFor** | **DONE (P1)** | The spine's reference render. Lens 2. |
| **KeywordGapTable** (intel blocks) | **UPGRADE → merge into the spine** | It's a *second* "what to rank for" on metered Pipeline B. Collapse: the spine becomes the one keyword surface, **rival-enriched on paid** (who outranks you = the "why"). Kills the fork. (This IS P3.) |
| You-vs-competitors · Traffic-by-channel donut · ChannelDrilldown/Panel · KpiRow | **KEEP** | Referrer/channel concept (Lens 3a). Correct; moves to Pipeline A in consolidation (E1). |
| WeekPlanPreview | **UPGRADE** | Feed the spine's targets straight in as content moves (board→plan link, the actionability through-line). |

### 3.2 Competitors (`/app/audience/competitors`) — Lens 3a: the competitor lessons
| Component | Verdict | Why / what changes |
|---|---|---|
| ReferrerRow "where you get found" · "Referrers to pursue" | **KEEP + reframe** | This is contract pillar 2 (competitor referrers). Reframe as the explicit **"lessons → your move"** (pursue this referrer) and make each an add-to-plan outreach action. |
| CompetitorGapMap (channel strength) · EntityStatStrip · PagesEdgeList | **KEEP** | Real competitor intel. On-contract. |
| **KeywordEdgeList / KeywordGapRow** | **UPGRADE → the spine** | Same fork as the dashboard: unify onto the one keyword spine, rival-enriched. This is where the paid rival-gap fetch lives. |
| "Their edge → your move" / EdgeMoves | **KEEP + wire to plan** | Already the "lessons" idea — ensure every edge produces a specific add-to-plan move. |

### 3.3 Customers (`/app/audience/customers`) — Lens 3b: where buyers gather
| Component | Verdict | Why / what changes |
|---|---|---|
| WhoYourBuyer (ICP · JTBD) | **KEEP** | Contract pillar 3. |
| IntentRecencyMap · BuyerThreadFeed (communities) | **KEEP + wire to plan** | The "which communities / where to engage" contract line. Add: each community → a specific "post/engage here" plan move. |
| **DemandThemes** (searchDemand keywords) | **UPGRADE → the spine** | Keyword-adjacent, currently a third keyword source (B). Fold into the spine, or reframe as buyer-language themes over the spine. |
| **PainBars** (review-derived pains) | **CUT (OPEN — recommend)** | Review-derived → off-contract per the reset's O-7 (cut reviews both tiers) + grounding-risk. Rendered + mildly useful, so flagged as a decision, not silent. |

### 3.4 Plan (`/app/plan`) — the destination
| Component | Verdict | Why / what changes |
|---|---|---|
| PlanCalendar · PlanEntryCard · LifecycleRow · GenerateMore | **KEEP + UPGRADE** | Feed the three lenses' moves directly: spine targets (create page), competitor lessons (pursue referrer / publish comparison), communities (post here) — one calendar. Enforce actionability: every entry names an artifact + number. |

### 3.5 Progress (`/app/progress`) — tracking over time
| Component | Verdict | Why / what changes |
|---|---|---|
| ScoreTrendLarge · WhyItMoved · ChangedList | **KEEP + UPGRADE** | Add **per-keyword rank-over-time** for the plan's target keywords ("watch them climb as the score rises"). This IS P2. |

### 3.6 Free report (`/scan`) — already on the spine
MarketCards · category stat · "What to rank for next" · fixes · zero-state · rivalry teaser · unlock band — **KEEP** (shipped this session, on the spine). Legacy market-tier ladder — **KEEP** (old-payload fallback only).

### 3.7 Utility pages
Settings · Billing · Add · Diagnostics · CompetitorSetup — **KEEP** (utility; no spine relevance). Redirect stubs — **KEEP** (harmless muscle-memory routes).

### 3.8 Dead / write-only — CUT
- **~23 orphaned `components/report/*-section.tsx`** (competitive-landscape, creators-to-reach, strengths-weaknesses, channel-opportunities, where-they-are, who-its-for, what-you-offer, keyword-gap-table, top-pages-table, action-plan-section, signal-breakdown, executive-summary, snapshot-strip, top-fixes-preview, discoverability-score, score-gauge, deep-section-shell, evidence-panel/footer, distribute-widget, section-nav(+active), share-score-button) — **zero live importers. CUT.**
- **Write-only producers** in `full-scan.ts` feeding only that tree: `competitiveLandscape`, `creatorsToReach` (+ dead `audienceProxy`/2nd-YouTube path), `reviewThemes`, `strengthsAndWeaknesses`. **CUT the fetch+persist** (per-field, both directions — "never pay for data you don't render").

---

## 4. The consolidation (what makes it ONE app, not two pipelines)

1. **One keyword spine.** Collapse `supply.keywords.gaps` (B) into the persisted `searchVisibility` spine (A); the dashboard/competitors keyword surfaces render the spine, **rival-enriched on paid**. Capability-ledger: one keyword-opportunity producer (a 2nd fails the build).
2. **Precompute intel at scan (E1).** Pipeline B stops recomputing per tab-load — the deep scan writes the referrer/channel/community layers into `report_payload`; `/api/app/intel` becomes a thin reader + post-scan refresher. Kills the metered-per-load cost + the divergence.
3. **Delete the dead tree + write-only producers** (§3.8).

---

## 5. Phasing (ship-to-sell first; frugal on scans)

**ARC 1 — sellable (critical path, days):**
- **P1 — WhatToRankFor board.** ✅ DONE + approved.
- **P3 — unify keyword surfaces onto the spine + rival-gap "why" + competitor "lessons" framing + wire lenses→plan.** The one genuinely new cost (rival fetch) — **one** small deep scan to verify. Collapses the dashboard/competitors keyword forks, delivers the "lessons," makes the plan converge.
- **P2 — per-keyword rank-over-time on Progress.** New store + render; no new scan cost (writes on scans that already run).
- **C — cut the dead tree + the clearly-dead write-only producers** (creators/`audienceProxy`, competitiveLandscape). Low-risk deletions, immediate cost + clarity win.

**ARC 2 — consolidation (fast-follow, post-first-paying-users):**
- **E1 — precompute intel at scan** (Pipeline B → reader). The big cost/latency win; XL, staged.
- **E2 — resolve the OPEN cuts** (PainBars/reviews per O-7; DemandThemes fold) + final one-producer-per-capability sweep.

---

## 6. Decisions for you (defaults marked)

1. **Unify all three keyword surfaces (dashboard KeywordGapTable, competitors KeywordEdgeList, customers DemandThemes) onto the ONE spine, rival-enriched on paid?** *(Default: yes — kills the fork, one-path.)*
2. **Reframe competitor referrers as the explicit "lessons → your move" (add-to-plan)?** *(Default: yes — contract pillar 2, actionability.)*
3. **Cut PainBars (review-derived, off-contract per O-7)?** *(Default: cut — but it renders today, so your call.)*
4. **Cut the ~23 orphaned report sections + the write-only producers now (Arc 1) — they're dead/invisible?** *(Default: yes — pure cleanup, immediate cost win.)*
5. **Sequence: P3 → P2 → C to sellable, then Arc 2 after first paying users?** *(Default: yes.)*

---

## 7. Guardrails (every phase)

- **Corpus-first per surface** — extend the paid-surface rubric with a captured tier=full fixture BEFORE each render change; actionability rule (every action names an artifact) product-wide.
- **Capability ledger** — one keyword-opportunity producer; a second definer fails the build.
- **Invariant #1 untouched** — the spine feeds presentation, never `sv.score`.
- **Cost frugality** — Arc-1 needs exactly ONE deep scan (P3's rival fetch). P1/P2/C = zero new scans.
- **Live-verify** each shipped surface (render, not DB).

---

## 8. As-built log (owner APPROVED all 5 decisions, 2026-07-23)

Owner ruling: file all 3 keyword surfaces onto the one spine · reframe competitor referrers as lessons→plan · cut PainBars · cut the 23 dead sections + write-only producers (**"never have an invisible cost"**) · **sequence by data flow / what's available** · **stop at significant milestones for validation.**

**Milestone decomposition (data-flow order).** The spine is already persisted (`report_payload`), so zero-cost / already-available work leads; the one paid fetch lands last.

- **M1 — Dashboard keyword unify (DONE, zero cost).** The dashboard rendered TWO keyword models: the persisted spine (`WhatToRankFor`) AND the metered Pipeline-B `supply.keywords.gaps` (`KeywordGapTable`), recomputed per tab-load. **Fix:** the dashboard now renders ONLY the spine; the metered `KeywordGapTable` (+ its `useActionPlan`/`AddToPlanChip`/`KeywordGapRow` orphans) is deleted. Base target list byte-identical free↔paid (invariant #1 untouched).
  - **Rival "why" deferred to M3 — a real defect caught by verifying on live data (the "look for what nobody is looking for / verify on real data" rules paying off).** I first built the obvious win: fold the deep scan's persisted `report_payload.market.gap.keywordGap` in to show "N rivals rank · best #P". Rendering it against the REAL cardpointers paid payload (scan `35e30a99`, 15 gap rows) surfaced the problem: that gap is **raw, unclassified rival keywords** — `capital one` (9.1M), `los angeles international airport` (1.5M), `hilton honors` (550k), `amex platinum` (201k). They pass `isMeaningfulMarketPhrase` (multi-word, not single mega-tokens) yet are **un-winnable "Create a page targeting X" targets — the SpaceX-"space" class**. Merging rival keywords into an ACTIONABLE surface needs the category RELEVANCE classifier (Phase-B judge), which is M3. Reverted the merge; `buildRankTargets` stays spine-only. **Guard:** paid-corpus rubric — new mutation-proven test that a raw mega-brand `market.gap` NEVER leaks into the targets (injecting `capital one`/`los angeles international airport` changes nothing). Rival "why" (classified), per-rival expand-detail, and per-target add-to-plan all land in M3.
- **M2 — cut the dead render tree (DONE, zero cost/risk).** Deleted the 23 orphaned `report/*-section.tsx` (Python-verified: ZERO external importers — a fully self-contained dead island) + their 2 dead tests (`section-nav.test.ts`, `report-sections.test.ts` — the latter tested inline reimplementations of the dead components, importing no live code). KEPT `discoverability-score.test.ts` (misnamed — it tests the live `verifiedScore`). Retired the `section-nav-active ↔ section-nav` cycle from the arch baseline; pinned the design-coverage win (51→28 unmirrored). **NOT in M2:** the write-only PRODUCERS (`full-scan` computing `competitiveLandscape`/`creatorsToReach`/`reviewThemes`/`strengthsAndWeaknesses`) + their satellite readers (`diagnostics.ts` coverage points, `entitlements.ts` redaction) — that is the actual invisible COST, but cutting `reviewThemes` changes the LLM action generator (behavioral), so the producer cuts ride M3's single deep scan. M2 removed the dead RENDER half; M3 removes the dead PRODUCER half.
- **M3 — rival "lessons" + competitors/customers keyword unify + wire lenses→plan + producer/fetch cuts.** MOVED here (from the doc's original all-in-one P3): competitors `KeywordEdgeList` sits INSIDE the per-rival "edge" card and customers `DemandThemes` beside communities — both are structurally part of their lens's reframing, so they upgrade *with* the lessons framing ("only upgrade if appropriate, at the same time"). The producer cuts (`reviewThemes` feeds the LLM action generator — NOT pure dead code; `creators`/`competitiveLandscape`) are a paid-pipeline behavioral change, so they ride M3's single deep scan. **All of Arc 1 = exactly ONE deep scan.**
- **M4 — per-keyword rank-over-time on Progress.** Zero new scan cost.
