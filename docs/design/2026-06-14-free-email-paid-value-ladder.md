# Free → Email → Paid Value Ladder
## Strategic Design for the ReachKit Free-Scan Funnel

**Date:** 2026-06-14
**Author:** Architecture Review (code-grounded)
**Status:** Design deliverable — for Tim's review before implementation

---

## 1. Data Inventory

Everything in this section is derived from reading the actual pipeline code. No speculation.

### 1.1 What the pipeline produces

The pipeline writes to two phases. The first phase (Cycle 2 — the ~2-minute findings pass) produces what `FindingsPayload` carries over SSE. The second phase (Cycle 3 — the full scan, ~15–30 min) assembles `ReportPayload` and persists it to `scans.report_payload`.

**Phase 1 data (emitted as `findings` SSE event, available ~2 min in):**

| Field | Type | Source | Notes |
|---|---|---|---|
| `score.total` | number 0–100 | `score.ts` preliminary | Preliminary (basis: inferred from facts, not verified surfaces) |
| `score.breakdown.content` | number | preliminary | Content subscore |
| `score.breakdown.outreach` | number | preliminary | Outreach subscore |
| `score.breakdown.seo` | number | preliminary | SEO/ASO subscore |
| `positioningMirror.listingSays` | string | Haiku extract of listing | What the store/site copy claims |
| `positioningMirror.reviewsValue` | string | Haiku extract of reviews | What users actually praise |
| `positioningMirror.gap` | string | Sonnet synth | The delta between those two |
| `findings[].claim` | string | Sonnet synth | A concrete finding about the product's distribution |
| `findings[].category` | "content"\|"outreach"\|"seo_aso" | Sonnet | Which module this finding belongs to |
| `findings[].basis` | "evidence_based"\|"probability_based" | Critic | Confidence provenance |
| `findings[].confidence` | 0..1 | Critic | Calibrated confidence |
| `findings[].evidence[].excerpt` | string | Critic Gate | Verbatim quote from the source |
| `findings[].evidence[].source` | string | Critic Gate | Source identifier (app_store_rss, dataforseo_serp, etc.) |
| `sampleAction.title` | string | Haiku format | One representative action |
| `sampleAction.category` | string | Haiku | Category of that action |
| `sampleAction.why` | string | Haiku | Why this action |
| `sampleAction.draft` | string | Haiku | Ready-to-edit draft copy |

**Phase 1 data (emitted earlier as `facts` SSE event, available ~10 sec):**

| Field | Type | Source | Notes |
|---|---|---|---|
| `listing.name` | string | iTunes/site-fetch | Product name |
| `listing.category` | string\|null | iTunes/site-fetch | Category |
| `listing.description` | string\|null | iTunes/site-fetch | Store description |
| `listing.pricing` | string\|null | site-fetch | Pricing text (web mode) |
| `competitors[]` | `Competitor[]` | `find_competitors` tool | `{name, url, source, rank}` |
| `competitors[].name` | string | iTunes/SERP/Tavily/PH | Competitor name |
| `competitors[].url` | string | — | Store URL or domain |
| `competitors[].source` | string | — | Where found: itunes_search, dataforseo_serp, product_hunt, tavily |
| `competitors[].rank` | number | `rankCompetitors()` | 1–5 relevance rank |
| `reviewVolume` | number | iTunes RSS / DataForSEO | Count of reviews found |
| `ratingTrend` | number\|null | iTunes RSS | Average rating (app mode only) |
| `webProxy.score` | number | DataForSEO SERP | Web presence proxy score |
| `webProxy.serpResultCount` | number | DataForSEO SERP | SERP result count |
| `webProxy.phUpvotes` | number | Product Hunt | Upvote count |
| `webProxy.domainAgeYears` | number\|null | domain-age adapter | Domain age |
| `themes[]` | `ThemeCount[]` | Haiku extract of reviews | `{term, count}` — top review themes |
| `coldStart` | boolean | `isColdStart()` | Whether product has thin footprint |
| `sourcesUsed` | string[] | collect stage | Which data sources contributed |

**Phase 2 data (in `ReportPayload`, available after full scan, ~15–30 min):**

| Field | Type | Source / Code Location | Notes |
|---|---|---|---|
| `whatYouOffer.positioningMirror` | `PositioningMirror` | `readFindingsPayload()` in `full-scan.ts` | Same three fields as Phase 1 |
| `whoItsFor.summary` | string | `buildWhoSummary()` in `report.ts` | Built from icpSignals + reviewsValue |
| `whoItsFor.signals[]` | string[] | `readIcpSignals()` in `full-scan.ts` | Top 6 ICP theme strings from `review_themes` fact sheet |
| `whereTheyAre.surfaces[]` | `{source, title, url}[]` | `readSurfaces()` in `full-scan.ts` | Communities + YouTube creators from `raw_documents` where `source_type IN ('communities','youtube')` |
| `whereTheyAre.competitorGap[]` | `{competitor, dimension, them, you}[]` | `readCompetitorGap()` in `full-scan.ts` | Derived from `competitor_gap` fact sheet; fallback = facts.competitors with `{dimension:"presence",them:1,you:0}` |
| `whatToDoThisWeek.quickWins[]` | `ActionCard[]` | `bucketActions()` in `report.ts` | `effortMin < 30` |
| `whatToDoThisWeek.medium[]` | `ActionCard[]` | — | `effortMin 30..120` |
| `whatToDoThisWeek.longPlay[]` | `ActionCard[]` | — | `effortMin > 120` |
| `score` | `VerifiedScore` | `verifiedScore()` in `score-full.ts` | `{total, breakdown:{content,outreach,seo}, radar:[{axis,value,active}], basis:"verified"}` |
| `score.radar[]` | `RadarAxis[]` | `verifiedScore()` | 7 axes: Content, Outreach, SEO/ASO (active); Ads, Partnerships, PR, Positioning (locked/greyed) |

**Per-`ActionCard` fields (in `whatToDoThisWeek.quickWins/medium/longPlay`):**

| Field | Type | Notes |
|---|---|---|
| `category` | "content"\|"outreach"\|"seo_aso" | Module |
| `title` | string | Specific action title |
| `why` | string | Why this action for this app |
| `evidence[]` | `{excerpt,source,sourceType}[]` | ≥2 items from ≥2 sourceTypes (Critic rule 1) |
| `effortMin` | number | Effort in minutes |
| `suggestedDeadline` | ISO date string | When to do it |
| `expectedOutcome` | `{scoreComponent,delta,secondary?}` | Score component + numeric delta + optional note |
| `draft` | string\|null | Ready-to-edit copy (present for content/outreach) |
| `draftRequiresEdit` | true | Always true per §11 |
| `verification` | `{method,state}` | How to verify it's done |
| `basis` | "evidence_based"\|"probability_based" | Confidence provenance |
| `confidence` | 0..1 | Calibrated confidence |

**Fact sheets (Layer 2, in `fact_sheets` table, not directly in ReportPayload):**

| Kind | Shape | Used for |
|---|---|---|
| `review_themes` | `ReviewThemesSheet` — `{themes:[{theme,sentiment,quote,evidenceIds}]}` | ICP signals, `whoItsFor.signals`, tone context |
| `positioning` | `PositioningSheet` — `{category, claims[], valueProps[]}` | Positioning mirror input |
| `competitor_gap` | `CompetitorGapSheet` — `{competitors:[{name,positioning,gap}]}` | `whereTheyAre.competitorGap` (provides `name`, `positioning`, `gap` strings) |
| `keyword_data` | `KeywordSheet` — `{clusters:[{theme,keywords:[{keyword,volume}]}]}` | Action cards, SEO score input |

**Weekly-engine data (paid, from `actions` table and monitors):**

| Asset | Fields | Notes |
|---|---|---|
| Persisted `actions` rows | `category, title, why, draft, effort_min, deadline, expected_outcome, score_component, verification, status` | Written by `persistActions()` in `full-scan.ts` |
| `score_snapshots` | `total, breakdown, installs_reported, taken_at` | Per-week score history |
| `monitors` | `kind IN (reviews,rank,threads,competitors)`, `watermark` | Delta watermarks for weekly refresh |
| `WeeklyPlan` | `queue:{quickWins,medium,longPlay}, carryover, scoreDeltaLastWeek, honestyNote` | Assembled by `assembleWeeklyPlan()` in `weekly-plan.ts` |
| `outcomes` | `verified_signal, observed_delta, observed_at` | Score movement proof |

### 1.2 What we do NOT currently produce (gaps)

These are gaps relevant to the value-ladder design:

| Missing asset | Where the gap lives | Effort |
|---|---|---|
| **Competitor positioning blurbs** — what each competitor claims to do in their own words | `competitor_gap` fact sheet has `name`, `positioning`, `gap` but `readCompetitorGap()` in `full-scan.ts` uses only `name`, discarding `positioning` and `gap` strings entirely. The data is extracted but not surfaced in `ReportPayload`. | Low — wire the existing `CompetitorGapSheet.competitors[].positioning` and `.gap` strings into `whereTheyAre.competitorGap` alongside the `them/you` scores. Schema change + `readCompetitorGap()` fix. |
| **Competitor keyword presence** — how many keywords each competitor ranks for vs the scanned product | The `KeywordSheet` has keyword clusters for the product but no per-competitor keyword data. `competitorGap[].dimension` is hardcoded to `"presence"` (see `full-scan.ts:152–155`) — a placeholder, not real data. | Medium — DataForSEO competitor keyword overlap calls; adds ~$0.10–0.30/scan. |
| **Competitor community thread count** — how often each competitor is mentioned in HN/Bluesky/communities | The `competitors` monitor tracks `knownCompetitors[]` but counts are not in the report payload. | Medium — count raw_documents `communities` entries mentioning each competitor name; cheap SQL. |
| **Competitor review signal** — their rating/volume | The pipeline fetches competitor reviews in some adapters but does not expose counts/ratings in `ReportPayload`. | Low-medium — already in `raw_documents`; aggregate query. |

---

## 2. Current State: What's Free, Email-Gated, and Paid Today

### 2.1 Tier mechanics (from the code)

**`redactReportForTier()` in `lib/billing/entitlements.ts`:**
```
FREE_PREVIEW_ACTIONS = 3
```
The function returns the full payload unchanged for paid tiers. For free tier it caps `whatToDoThisWeek` to the first 3 actions (drawn in order: quickWins → medium → longPlay) and sets every previewed action's `draft` to `null`. All other sections — `whatYouOffer`, `whoItsFor`, `whereTheyAre`, `score` — are returned **unchanged and in full**.

**`WhereTheyAreSection` in `components/report/where-they-are-section.tsx`:**
The component has an `unlocked` prop but the current behavior shows surfaces and competitor gap with `previewSurfaceCount=3` and `slice(0,2)` on competitor gap when `unlocked=false`. The `results/page.tsx` passes `unlocked={isPaid}` so free viewers see 3 surfaces and 2 competitor gap rows.

**`TierLimits` in `lib/billing/tiers.ts`:**
```
free:   { apps:1, refreshCadence:"none",   draftQuota:0,  rankDepth:0  }
solo:   { apps:1, refreshCadence:"weekly", draftQuota:20, rankDepth:20 }
growth: { apps:3, refreshCadence:"weekly", draftQuota:100,rankDepth:50 }
```

### 2.2 What each tier sees TODAY

**FREE (no email required, on the live scan page `/scan/[id]`):**

The `FactsView` in `scan-stream.tsx` shows immediately after the ~10s SSE `facts` event:
- Product name + category + mode badge
- Metric grid: `reviewVolume`, `ratingTrend` OR `webProxy.score` + `serpResultCount`, `competitors.length`
- Competitor list: `facts.competitors.slice(0, 5)` — name, rank number, source badge
- Theme chips: `facts.themes.slice(0, 10)` with counts
- Artifact feed (progress log)

After the ~2-min `findings` SSE event, `FindingsReveal` in `findings-reveal.tsx` appends:
- Discoverability Score ring (preliminary, `basis:"preliminary"`, no radar)
- Positioning mirror: `listingSays`, `reviewsValue`, and `gap` — all shown in full
- Finding[0] — first finding shown completely with evidence excerpts and sources
- Finding[1..N] — real claims visible but blur-locked (`blur-[4px]`) with a "Unlock with your report" overlay
- Sample action — title, why, draft all blur-locked
- Email gate form

**EMAIL-GATED (after magic-link click, at `/scan/[id]/results`):**

The results page calls `redactReportForTier(fullReport, tier)` where `tier = "free"` for unauthenticated or unsubscribed users. It renders:
- Verified score ring (real `VerifiedScore` with radar)
- `UpgradeCta` — the paid pitch
- `WhatYouOfferSection` — `positioningMirror` in full (all three fields), `unlocked=false` (gap dimmed, no danger-red accent)
- `WhoItsForSection` — summary + signals, `unlocked=false`
- `WhereTheyAreSection` — 3 surfaces + 2 competitor gap rows, `unlocked=false`, "+N more communities/competitors" hint
- `ActionPlanSection` — first 3 actions (capped by redactor), drafts null, evidence limited to 1 item, `unlocked=false`

**PAID (Solo $29 or Growth $99):**

Full `ReportPayload` unreacted. Plus:
- All surfaces and competitor gap rows in `WhereTheyAreSection`
- All action cards in `ActionPlanSection` with drafts, full evidence
- Weekly refresh producing new action cards and score deltas
- `score_snapshots` history + `honestyNote`
- Score movement from verified outcomes
- `rankDepth: 20/50` keyword rank tracking

### 2.3 Why it underdelivers the "wow"

**Problem 1: The competitor section on the free scan page is a list, not intelligence.**
`scan-stream.tsx` shows `facts.competitors.slice(0,5)` as an ordered list of names + source badges — for example "1. Opal · itunes_search". This tells the founder only that competitors exist. It does not tell them what those competitors are doing, where they appear, or how far ahead they are. The source badge ("itunes_search") is meaningless to a founder. A list of competitor names without context is not intelligence.

**Problem 2: The `competitorGap` data we have is largely placeholder.**
`readCompetitorGap()` in `full-scan.ts` (lines 152–155) maps each competitor to `{competitor:name, dimension:"presence", them:1, you:0}`. Every competitor scores `them:1, you:0`. This is a stub derived from the existence of competitors, not from actual gap analysis. The `CompetitorGapSheet` — which has real `positioning` and `gap` strings — is populated by the extract stage but those strings are discarded. The `WhereTheyAreSection` renders `gap.dimension` ("presence") and `gap.them / gap.you` scores (always 1 vs 0), which looks like a broken table, not an intelligence tool.

**Problem 3: The free scan page's emotional sequence is backwards.**
The user sees product facts first, then the score, then findings — and the email gate appears at the end after the findings blur lock. The "wow" moment (finding out who the competitors are and what they're doing) happens only after email, and even then it's understated. The spec §23 says "each artifact animates in — this IS the demo and the perceived-value builder." Currently, the artifact feed shows opaque progress labels, not competitive intelligence.

**Problem 4: The competitor data that EXISTS on the free page is not framed as intelligence.**
The free page knows competitor names, their sources (app store, SERP, Product Hunt), and their rank. The `themes` array contains what topics are discussed in reviews. Neither is framed to say "here's what your competitors are doing and why it matters." The framing is purely "here's what we found" not "here's what this means for you."

**Problem 5: The email-to-paid transition is a generic pitch, not a competitive trigger.**
`UpgradeCta` in `upgrade-cta.tsx` pitches the weekly queue with four generic bullets ("Weekly action queue with ranked priorities"). It does not use any of the actual competitor data we produced in the scan to make the conversion personal and urgent. The stale-report strip from `SnapshotStrip` is shown but the competitive monitoring angle is not explained.

---

## 3. Recommended 3-Tier Value Ladder

### Design principles

1. Every tier shows something genuinely valuable — no bait-and-switch.
2. Each transition is triggered by a specific gap that the next tier fills, not by a generic "upgrade" wall.
3. The competitor-intelligence "wow" belongs in the FREE tier because it creates immediate personal relevance. A founder who sees "your competitors are in 6 communities you're not in" is primed to want the full report.
4. The email wall unlocks the analysis that explains the competitive picture and what to do about it — the interpretation layer.
5. The paywall unlocks the operating system: the machine that keeps the analysis current and turns it into executable weekly work.

### Tier 1 — FREE (no email, on `/scan/[id]` live scan page)

**Core principle: Show the competitive landscape as intelligence, not a list.**

What to show, in presentation order:

**A. Scan theater (existing, improve messaging)**
Keep the SSE artifact feed but rewrite the artifact labels from opaque pipeline terms ("extracting…") to intelligence-framing: "Found 5 competitors → reading their positioning…", "Mapped 8 communities where your users ask these questions…", "Pulled 340 reviews — extracting what buyers actually care about…". These are real artifacts; just reframe them as discoveries, not technical steps.

**B. Competitor intelligence card (NEW — the wow)**
After the `facts` event arrives, before the score, surface the competitor data as a competitive intelligence snapshot. This uses ONLY fields already present in `facts.competitors`:

```
YOUR COMPETITIVE LANDSCAPE

[CompetitorName 1] · ranked #1 on [source] 
[CompetitorName 2] · ranked #2 on [source]
[CompetitorName 3] · ranked #3 on [source]
[+ N more found]

They were found on: [itunes_search / dataforseo_serp / product_hunt / tavily]
→ These sources are where your category buyers search.
```

The key reframe: the `source` field tells the founder WHERE competitors are discoverable. "found on product_hunt" means "your buyers are finding alternatives on Product Hunt". Turn the source badge into a distribution insight.

**C. Review themes as ICP signal (existing, improve framing)**
Keep the theme chips but lead with framing: "What buyers in your category say they care about — from [reviewVolume] reviews". This is currently shown as neutral data; frame it as "the language your ICP uses."

**D. Your score vs. competitors (partial, teaser)**
After the score ring appears (~2 min), show ONE competitor gap row immediately — the most stark one. Use the fact that `competitorGap[0]` currently always shows `them:1, you:0` (after fixing the placeholder), and present it as: "[Competitor] has presence on [dimension] that you don't yet." This is honest (it's real data) and creates urgency.

**What is NOT shown free:**
- The full positioning mirror (shown on email tier) — specifically the `gap` field with the red danger styling
- The findings (only finding[0] shown, rest blur-locked — this is the existing correct behavior)
- The communities/surfaces where buyers gather (shown on email tier)
- The full competitor gap with positioning analysis
- Any action cards

**Psychological trigger for email:** "We found [N] communities where buyers are talking about this, and [K] gaps where competitors have presence you don't. Your full report shows exactly what to do. →"

### Tier 2 — EMAIL-GATED (magic link, at `/scan/[id]/results`)

**Core principle: The report that interprets the competitive picture and tells you what it means.**

What unlocks with email:

**A. Full verified score with radar** (exists today — correct)
The `VerifiedScore` with all 7 radar axes including the 4 locked ones (showing where more modules will activate). Anti-vanity basis shown ("verified against real surface data").

**B. Positioning mirror in full, with red gap styling** (partially exists but currently `unlocked=false` dims the gap)
Change: pass `unlocked=true` for email tier. The `gap` field with `color-danger-subtle` background and left border is the most emotionally resonant part of the report — "your listing says X but buyers value Y." This should be fully visible after email, not dimmed. The positioning mirror is the intellectual insight; the action plan is the prescription. The former belongs at email tier, the latter at paid.

**C. ICP signals — who it's for** (exists today — correct for email tier)
`whoItsFor.summary` and all 6 signals from the `review_themes` fact sheet. This grounds the user in their audience.

**D. Full competitor gap with positioning context** (REQUIRES FIX — see §5)
After fixing `readCompetitorGap()` to wire in `CompetitorGapSheet.competitors[].positioning` and `.gap` strings, show:
- Full list of competitors (not capped at 2)
- Each competitor's positioning blurb ("they position as X")
- The gap string ("they rank for keyword X; you don't appear there")
- The `them/you` scores (once we have real scores beyond the `1 vs 0` placeholder)

**E. Communities/surfaces where buyers gather** (exists — correct for email tier)
All surfaces (not capped at 3). These are the distribution channels. Show them in full after email because they're the "where" answer that makes the action cards actionable.

**F. Action plan — 3 preview actions** (exists today — correct behavior)
Keep the existing `FREE_PREVIEW_ACTIONS = 3` cap. Show action title, why, effort, expected outcome. Keep `draft: null`. Show evidence limited to 1 item. This is the correct email-tier boundary: enough to show the format and value, not enough to be independently actionable.

**Psychological trigger for paid:** Replace the current generic `UpgradeCta` with a competitive-intelligence pitch that uses the actual scan data: "Your competitors are refreshed weekly. Your report is a snapshot from [date]. Turn on monitoring to see when the landscape shifts — and get a fresh action queue every Monday." This uses real data (`generatedAt`) and is honest about what the paid tier adds.

**What is NOT shown at email tier:**
- Full action plan with drafts
- Score history / delta tracking
- Weekly refresh
- Verification engine
- Rank tracking

### Tier 3 — PAID ($29 Solo / $99 Growth)

**Core principle: The weekly operating system — monitoring + fresh action queue + progress tracking.**

The paid tier is fundamentally different in KIND from the free tiers, not just in quantity. It is time-continuous. Everything free/email is a single-point-in-time snapshot; paid is a machine that runs continuously.

**A. Full action plan with drafts unlocked** (exists — correct)
All `ActionCard[]` from `whatToDoThisWeek.quickWins/medium/longPlay`. Every `draft` field shown. Full evidence panel. Every `expectedOutcome` with `scoreComponent` and `delta`.

**B. Weekly action queue** (`assembleWeeklyPlan()` in `weekly-plan.ts`)
Each Monday: `queue.quickWins`, `queue.medium`, `queue.longPlay` refreshed from new actions. `carryover[]` shows unfinished work. `scoreDeltaLastWeek` shows movement. `honestyNote` fires when score went up but installs didn't (§7.2 rule 5).

**C. Score history + verified movement**
`score_snapshots` table. Score goes up as `outcomes` are verified. The `outcomes` table feeds `countVerifiedOutcomes()` in `score-full.ts` which bumps `contentSurfaces`, `outreachSurfaces`, and the `seo_aso` directory fractions — so doing work in the app visibly moves the score.

**D. Competitive monitoring**
The four monitors seeded by `seedMonitors()` in `monitors.ts` after the full scan:
- `reviews` monitor — new reviews since `lastReviewId`
- `rank` monitor — keyword rank movements against `topRanks`
- `threads` monitor — new community threads since `lastThreadAt`
- `competitors` monitor — new competitors since `knownCompetitors[]`

Weekly refresh (Inngest `weekly-refresh.ts`) delta-scopes each monitor and generates new action cards only for what actually changed.

**E. Verification engine**
Each `ActionCard` has `verification: {method:"url"|"self_report"|"rank_check", state:"pending"}`. The `verify_action` tool checks whether the action is live and writes to `outcomes`. This is the proof-of-work layer.

**F. Growth tier adds:** `apps: 3` (3 products), `draftQuota: 100`, `rankDepth: 50` keywords tracked.

**What paid distinctively provides that free cannot:**
1. Time dimension — the report ages; paid doesn't
2. Competitor moves detected automatically
3. Verified progress — score movement as proof you're doing work
4. Draft copy — the ready-to-use content engine
5. Honesty note when score and installs diverge

---

## 4. Free-Scan Page Redesign

### 4.1 Current component map

The live scan page is `/scan/[id]` → `ScanPage` (server) → `ScanHydrator` → `ScanStream` (client).

`ScanStream` renders:
- `ScanTheater` while no `facts` yet
- `FactsView` once `facts` SSE arrives
- `FindingsReveal` (lazy-loaded) once `findings` SSE arrives, appended inside `FactsView`

`FindingsReveal` contains the score, positioning mirror, findings list, sample action, and the `EmailGate`.

### 4.2 Recommended page structure after redesign

**Section 1 — Scan theater (no change in structure, improve copy)**
The `ScanTheater` component is correct. The artifact labels need rewriting at the data source (wherever `emitScanEvent(ctx.scanId, "artifact", {label: "..."})` is called in the pipeline) to be intelligence-framing rather than technical labels.

Target artifact label copy:
- "Found [N] competitors — reading their positioning..."
- "Pulled [N] reviews — mapping what buyers value..."
- "Mapped [N] communities where your category is discussed..."
- "Extracting keyword signals..."

**Section 2 — Competitive landscape card (NEW, replace current competitors list)**
After `facts` event, instead of showing `FactsView` with the current competitors ordered list:

Rename the "Competitors found" section to "Your competitive landscape." Change the display from a plain numbered list to an intelligence card:

```
YOUR COMPETITIVE LANDSCAPE

[Name 1] · [description of source in plain English]
  "Found via App Store search" → "other apps your buyers find when searching your category"
  "Found via Google SERP" → "sites ranking when buyers Google alternatives to you"
  "Found via Product Hunt" → "products launched alongside you in your category"

[Name 2] ...
[Name 3] ...

+ [N] more competitors mapped in your full report
```

The `source` values from `facts.competitors[].source` map to these plain-English descriptions:
- `itunes_search` → "ranks in your App Store category"
- `dataforseo_serp` → "appears when buyers search for alternatives"
- `product_hunt` → "launched in your Product Hunt category"
- `tavily` → "mentioned alongside you in search results"

**Section 3 — What buyers say (improve framing of existing theme chips)**
Lead with: "From [reviewVolume] reviews in your category — what buyers say they care about:" then the existing `facts.themes` chips. If `coldStart === true`, change the copy to "What buyers in similar [category] products say they care about."

**Section 4 — Your preliminary score (existing, minimal change)**
After the `findings` SSE event, `FindingsReveal` shows the score. This is correct. Minor improvement: add a one-line context note "Based on content, outreach, and SEO signals. Your full report shows exactly where you're behind." This already exists in the current copy; keep it.

**Section 5 — Positioning mirror reveal (existing, no change)**
The current `FindingsReveal` shows all three positioning mirror fields. This is strong and should stay. The `gap` field with the red-danger accent is the most valuable free-tier asset; it creates immediate personal recognition.

**Section 6 — Finding[0] in full + findings blur-lock (existing, no change)**
The current behavior is correct: first finding shown with evidence, rest blur-locked with real headlines. "Unlock with your report" is the honest copy.

**Section 7 — Competitive intelligence teaser (NEW, before email gate)**
Insert between the blur-locked findings and the email gate: a card that says:

```
WHAT YOUR REPORT ALSO CONTAINS

  [N] communities where your buyers are discussing [category]
  [K] competitor gaps — where they have presence you don't yet
  [M] action cards across content, outreach, and SEO

Your competitive landscape is shifting. Get your full report — one email, no password.
```

The numbers `N`, `K`, `M` are available: `surfaces.length` from the full scan (available after Phase 2 completes), `competitorGap.length`, and `actions.length`. If the full scan hasn't completed yet when `findings` arrives, show the competitor count from `facts.competitors.length` with "and more being analyzed."

**Section 8 — Email gate (existing EmailGate component, improve heading)**
Change heading from "Get your full discoverability report" to "See who's ahead — and exactly what to do about it." The current call-to-action "Send my full report →" is good.

### 4.3 Email gate moment (current `EmailGate` component)

The `EmailGate` in `app/(funnel)/scan/[id]/email-gate.tsx` is functionally correct. It calls `POST /api/scan/[id]/claim` with the email, sends magic link via Resend, and fires `funnel.emailSubmitted()`. No structural changes needed.

Improvement: after the `{ status: "sent" }` confirmation state, change the confirmation copy from "click the link to unlock your full report" to "click the link to see your full competitor analysis and action plan" — more specific to what they're actually getting.

### 4.4 The upgrade prompt (improve `UpgradeCta`)

The `UpgradeCta` in `components/report/upgrade-cta.tsx` currently shows four generic bullet points. Replace with a data-driven pitch using the scan's actual `generatedAt` timestamp and competitor count:

Instead of:
```
"Weekly action queue with ranked priorities"
"Draft copy for every action — edit, then ship"
```

Show:
```
Your report was generated [relative time ago]. Competitors don't stand still.

Solo turns this snapshot into a weekly engine:
→ New competitive moves detected automatically
→ Fresh action queue every Monday — ranked, with draft copy
→ Score that moves as you execute (verified, not self-reported)
→ Alerts when competitors enter new channels

$29/mo · Cancel any time.
```

The `generatedAt` field is available on `report.generatedAt` in the results page. `relativeDaysAgo()` is a trivial date utility.

---

## 5. Gaps — Data We Need But Don't Currently Produce

### Gap 1 (Low effort, HIGH impact): Wire competitor positioning + gap strings into ReportPayload

**What:** `readCompetitorGap()` in `lib/scan/full-scan.ts` (lines 143–172) reads the `competitor_gap` fact sheet but discards `CompetitorGapSheet.competitors[].positioning` and `.gap` strings. It maps only `name` to a placeholder row `{competitor:name, dimension:"presence", them:1, you:0}`.

**Impact:** Every competitor currently shows `them:1, you:0` on the dimension "presence." This is a broken table. `WhereTheyAreSection` renders a score comparison that is always 1 vs 0, which is visually confusing and intellectually empty.

**Fix:** Extend the `GapRow` type in `full-scan.ts` with optional `positioning?: string` and `gap?: string` fields. Wire these from `CompetitorGapSheet.competitors[].positioning` and `.gap` into `whereTheyAre.competitorGap`. Extend `ReportPayload["whereTheyAre"]["competitorGap"]` type in `lib/scan/report.ts` to carry these strings. Update `WhereTheyAreSection` to display the `positioning` and `gap` strings when present.

This is a schema extension + one function change in `readCompetitorGap()` + component update. Estimated effort: 2–3 hours. Zero new LLM calls; the extract stage already produces these strings.

**What it enables for the ladder:** Once wired, the email-tier competitor gap table becomes genuinely useful competitive intelligence instead of a broken-looking 1 vs 0 table.

### Gap 2 (Medium effort): Real `them/you` scores on competitorGap

**What:** The `them: number, you: number` fields in `competitorGap` are meant to reflect real comparative scores (e.g., "they rank for 47 category keywords, you rank for 3" per §10 spec JSON schema). Currently both are placeholder values.

**Impact:** The `GapScorePair` component in `WhereTheyAreSection` renders a score comparison that always shows 1 vs 0 with a danger-red "you" score. The visual design expects meaningful numbers.

**Fix:** Requires DataForSEO keyword overlap calls per competitor during the full scan. The `keyword_data` fact sheet has keyword clusters for the product; extending the collect stage to also run keyword searches for each competitor name and comparing overlap would produce real `them/you` keyword counts. Alternatively, a simpler proxy: count `raw_documents` rows where `source_type = "communities"` and body items mention the competitor name vs the product name — a thread-mention count.

Estimated effort: Medium — 1–2 day implementation, adds ~$0.10–0.30/scan in DataForSEO costs. Good candidate for Cycle 5/6.

### Gap 3 (Low effort): Competitor community thread counts

**What:** We don't currently surface how many community threads mention each competitor vs the scanned product. This is Tim's core "competitor intelligence" ask — seeing what competitors are doing in communities.

**Impact:** Without this, the competitor section can only show "they exist." With it: "Opal was mentioned in 23 threads in r/selfimprovement last 90 days; you were mentioned in 2."

**Fix:** The `communities` `raw_documents` entries already exist. A simple SQL aggregation: count body items from `communities` raw_documents that contain each competitor name string. This is a query, not a new data collection call. The count could be computed during `readCompetitorGap()` and stored as the `them` score.

Estimated effort: Low — ~half a day. No new LLM or API calls.

### Gap 4 (Low effort): Competitor review signal in facts

**What:** `facts.competitors[]` has `{name, url, source, rank}` but no review count or rating. Showing "Competitor X has 4,200 reviews, you have 340" on the free page would be a powerful gap signal.

**Impact:** Makes the free competitive landscape card immediately informative.

**Fix:** The pipeline already fetches competitor reviews in some adapters (the `get_reviews` tool). Adding `reviewCount?: number` to the `Competitor` type and populating it from whatever the fetch returns would enable this display. Only the count is needed, not the reviews themselves.

Estimated effort: Low-medium — depends on which adapters already return counts. 1 day.

### Gap 5 (None needed for Tier 2): Positioning/gap strings

Already exists in `CompetitorGapSheet` (produced by the extract stage) — just needs wiring (Gap 1 above).

---

## 6. Open Questions for Tim

**Q1 — The email-tier scope of the positioning mirror:**
Currently `WhatYouOfferSection` passes `unlocked=false` for free/email tier viewers in `results/page.tsx`, which dims the `gap` field styling (no danger-red, no left border). Should the full positioning mirror (including the red-accented gap) be visible at email tier, or held for paid? The current code treats email = free for this section. My recommendation is to show the full gap at email tier — it's the core intellectual insight and it's not independently actionable without the action cards. But Tim should confirm.

**Q2 — Competitive intelligence on the free scan page:**
The recommended redesign shows competitor names with source-translated descriptions on the free scan page (no email). Tim explicitly wants this. Confirm: are we comfortable naming specific competitor products on the free page with no gate? (Yes per the spec intent, but worth confirming before implementing.)

**Q3 — Competitor gap "them/you" scores:**
The current placeholder (always `them:1, you:0`) should be fixed before shipping the competitive intelligence tier. Which proxy score to use first: keyword overlap (more accurate, costs ~$0.10–0.30/scan) or community thread mention count (free, simpler, less meaningful)? Recommend community count as the first implementation since it uses existing data.

**Q4 — When does the full scan complete relative to email gate?**
The email gate is shown after the ~2-min findings SSE event. The full scan (which populates `ReportPayload` including `whereTheyAre.surfaces` and full `competitorGap`) takes 15–30 min. The "competitive intelligence teaser" card before the email gate would ideally show real surface counts (`surfaces.length`) — but those aren't ready at gate-view time. Options: (a) show placeholder copy ("communities and gaps mapped in your full report") until the full scan completes, then update via polling; (b) show competitor count from `facts.competitors.length` as an immediate proxy; (c) show counts from the full scan only in the emailed report. Option (b) is the pragmatic first implementation.

**Q5 — Naming the artifact labels:**
Rewriting artifact labels from technical terms to intelligence-framing requires changing the `emitScanEvent(ctx.scanId, "artifact", {label: "..."})` calls scattered through the pipeline. This is a copy/messaging change, not an architectural one. Should this be bundled with the funnel redesign implementation or kept separate?

**Q6 — Growth tier competitive angle:**
Growth tier ($99/mo) allows 3 apps and deeper rank tracking. Should the competitive monitoring angle be differentiated — e.g., Growth gets competitor monitoring at a higher cadence or with `daily signal feed` earlier? The spec puts daily signals at v1.5; this is a future question but worth noting in the upgrade pitch.

---

## Summary — The Three Tiers

### Tier 1: FREE (scan page, no email)
**The hook: see your competitive landscape as intelligence, not a list.**
Show competitor names reframed through their distribution channels (where buyers find them). Show review themes as ICP language. Show the preliminary score with a one-gap competitive teaser. Show finding[0] in full, rest blur-locked. The email gate is anchored to "see who's ahead — and exactly what to do about it."
**Requires:** Artifact label rewrites (messaging); competitor card redesign in `FactsView` (low effort UI change); no new data.

### Tier 2: EMAIL (magic link, full report page)
**The interpretation layer: what the competitive picture means and what's in the analysis.**
Full positioning mirror with danger-red gap styling. All ICP signals. Full competitor gap with positioning blurbs and gap strings (requires Gap 1 fix: wire `CompetitorGapSheet` strings into `ReportPayload`). All surfaces. 3 preview action cards without drafts.
**Requires:** Fix `readCompetitorGap()` to pass through `positioning` + `gap` strings (the single highest-leverage gap fix). Update `WhatYouOfferSection` to show full gap styling at email tier. Data-driven `UpgradeCta` using `generatedAt`.

### Tier 3: PAID ($29 Solo / $99 Growth)
**The operating system: time-continuous monitoring + weekly executable action queue.**
Full action cards with drafts. Weekly refresh. Score history. Verified outcomes moving the score. Competitor monitoring (new moves detected). Rank tracking. The paid proposition is not "more data" — it is "continuous vs snapshot."
**Requires:** Already built (Cycles 4–5). The gap is messaging — the current `UpgradeCta` doesn't communicate the continuity advantage. Fix the upgrade prompt to lead with the temporal difference.

---

*All code paths referenced exist at the commit state of 2026-06-14. File paths: `lib/scan/report.ts`, `lib/scan/types.ts`, `lib/llm/types.ts`, `lib/scan/full-scan.ts`, `lib/billing/entitlements.ts`, `lib/billing/tiers.ts`, `app/(funnel)/scan/[id]/scan-stream.tsx`, `app/(funnel)/scan/[id]/findings-reveal.tsx`, `app/(funnel)/scan/[id]/results/page.tsx`, `app/report/[slug]/page.tsx`, `components/report/where-they-are-section.tsx`, `components/report/action-plan-section.tsx`, `components/report/what-you-offer-section.tsx`, `components/report/upgrade-cta.tsx`.*
