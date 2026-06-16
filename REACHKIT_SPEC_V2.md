# GTM BRAIN — Product Specification v2

**Status:** Canonical spec v2.3, ready for Claude Code implementation
**Supersedes:** GTM_BRAIN_SPEC.md (v1) and v2 draft of same date
**Date:** 2026-06-10
**Owner:** Tim
**v2.1 deltas:** web SaaS first-class (input router), PLG-native Cold Start (no interview mandate), per-scan source empiricism (podcasts demoted), four-question UI frame
**v2.2 deltas:** cost-optimized pipeline under hard 90%+ GM constraint, tool registry + bounded agentic loops, three-layer data warehouse + pgvector semantic layer, delta refresh formalized + daily signal feed (gated, v1.5)
**v2.3 deltas:** frontend stack researched & locked (Next.js 16 / React 19.2 / shadcn on Base UI / Motion + GSAP), three-tier animation system, section-composition template architecture, full page tree incl. SEO+GEO surface, seven-moment funnel UX (scan → email gate → monetization)

---

## 1. Executive Summary & Changes from v1

GTM Brain is an AI distribution system for solo founders of consumer subscription products — mobile apps and web SaaS. The founder enters their App Store URL or website URL plus an email. GTM Brain derives everything else, produces an instant free Discoverability Scan, and (paid) runs a continuous engine that tells the founder exactly what distribution actions to take each week, with evidence, drafts, and progress tracking — "the hands of 20 people."

### What changed from v1 (read this first)

| # | v1 | v2 | Why |
|---|----|----|-----|
| 1 | Build data infra first, dashboard last | **Free Scan ships first (wk 2-3)**, paid product behind it | Scan = demo + lead magnet + validation gate |
| 2 | WHO/WHERE/HOW triple report is the product | WHO/WHERE/HOW becomes the **data layer**; customer-facing structure is **7 Action Categories** + Discoverability Score | Founders buy actions, not research |
| 3 | 7 categories all in MVP | **MVP = 3 modules** (Content, Outreach, SEO/ASO) + Score. Ads/Partnerships/PR/Positioning-full → v1.5+ | Solo founder, 3-month runway |
| 4 | $49 / $149 / $399 | **Free Scan / $29 Solo / $99 Growth** (decision: confirm) | ICP is pre-revenue; comparables $29-139 |
| 5 | Reddit API as data source | **Killed as dependency.** Reddit public JSON = garnish only | GummySearch lesson; platform risk |
| 6 | pytrends, NewsAPI, scraped G2/Capterra in matrix | Honest 3-tier matrix; **DataForSEO + Tavily = paid backbone** | TOS/fragility honesty |
| 7 | No GTM plan for GTM Brain itself | **Section 3: full GTM plan** (dogfooding, teardowns, free-scan loop) | The tool must distribute itself |
| 8 | No validation step | **Phase 0 validation gate**: smoke test primary + ~10 founder conversations, pre-committed kill criteria (v2.1: signals-first per row 14) | We did zero discovery; fix before building |
| 9 | Critic Gate rules community-centric | **Critic Gate v2: action-first rules** | Output unit changed from finding to action |
| 10 | Cost: $0.30-0.61 per analysis | Honest range **$3-8 full analysis**, free scan engineered to **<$0.50** | This chat's quality = frontier model + 30 searches |
| 11 | Gamification undefined | **Light-plus**: Score, radar, action queue, weekly streak. No leaderboards | Engagement without manipulation |
| 12 | B2B refused → accepted (drifted) | B2C-consumer = full-confidence analysis + marketing wedge; B2B = supported with directional labeling, secondary | Stop the Nudgi-style ICP drift, keep honesty about proven modes |
| 13 | App Store only | **Web SaaS first-class**: input router (App Store URL or website URL), per-mode source adapters | v2 couldn't even scan GTM Brain itself; dogfooding requires web mode |
| 14 | Cold Start mandated discovery interviews | **PLG-native validation**: validation-through-distribution action cards; interviews optional; kill criteria from observed signals | "Go interview 20 people" is homework, not value → churn |
| 15 | Fixed source list incl. Apple Podcasts in MVP | **Per-scan source empiricism**: sources earn evidence weight by measured signal density; podcasts demoted to v1.5 PR | No source has fixed authority; thin sources auto-drop |
| 16 | 7 categories as customer-facing navigation | **Four-question UI** (What you offer / Who it's for / Where they are / This week's plays) + Score; 7 categories internal | Founder's mental model is the question chain; simplicity mandate |
| 17 | Full scan $3-8, refresh $0.50-1.50 | **Optimized: scan $0.65-1.50, blended refresh ~$0.30** via fact-sheet compression, model routing, shared cache, delta-only refresh | Hard constraint: 90%+ gross margin in every month incl. month 1 |
| 18 | Agentic behavior implied | **Tool registry (10 named function calls) + bounded loops** with budgets and stop rules (§9.4-9.5) | Loops are where cost balloons; brakes specified, not assumed |
| 19 | Flat data model | **Three-layer warehouse** (raw evidence / shared fact sheets w/ TTL / insights+outcomes) + **pgvector semantic layer** (§5.7) | Margin lives in layer 2; the moat lives in outcomes; meaning-search powers monitoring |
| 20 | "Next.js 15, UI unspecified" | **Researched frontend stack locked** (§20): Next.js 16 / React 19.2 / Tailwind v4 / shadcn on Base UI / Motion + free GSAP / View Transitions | The product sells discoverability + polish; it must *look* like it knows what good looks like |
| 21 | Pages built ad hoc | **Section-composition template system** (§21): tokens → primitives → sections → pages; new page <1hr; programmatic pages from DB rows | Scale = composition, not duplication |
| 22 | No funnel UX design | **Seven-moment funnel** (§23): scan theater → partial reveal → email gate (magic link) → badge loop → stale-report trigger → monitoring upsell | The funnel IS the product demo; friction budgeted per step |

### The product in one paragraph

A solo founder pastes their App Store URL or website URL. In 10 seconds GTM Brain shows it's working (reviews pulled, competitors found, site crawled). In 2 minutes: a preliminary Discoverability Score, a positioning mirror ("here's what your product appears to say it does"), and three concrete findings. In ~30 minutes (email-gated): the full scan — ICP X-Ray, competitor gap map, and a prioritized action plan across content, outreach, and SEO/ASO, each action with evidence links, an effort estimate, and a ready-to-edit draft. Paid tiers turn this into a weekly operating system: fresh action queue, intent monitoring, progress tracking, and a Discoverability Score that moves as the founder executes.

---

## 2. Product Definition & Positioning

### Positioning statement

For solo technical founders of consumer subscription products — mobile apps and web SaaS — who can build but can't distribute, GTM Brain is the distribution system that tells you exactly what to do this week — with evidence, drafts, and a score that tracks your progress. Unlike ChatGPT (one-shot, no state, hallucinated links) or SparkToro (research without product-specific actions), GTM Brain runs continuously on your actual product data and verifies your progress.

### The "why not ChatGPT?" answer (must be true in the product)

1. **Continuous, not one-shot.** Monitors competitors, keywords, communities weekly. Chat sessions don't.
2. **Evidence-grounded.** Every claim links to a verifiable source (review, thread, SERP). Enforced by Critic Gate.
3. **Stateful.** Knows what you did last week, what worked, what's pending. Score persists and compounds.
4. **No prompting skill required.** The founder's input is one URL. The product knows what to ask.
5. **Drafts in your voice.** Learns founder tone over time; ChatGPT starts cold every session.

If a feature doesn't reinforce at least one of these five, it doesn't get built.

### Named competitors & wedge

| Competitor | What they do | Our wedge |
|---|---|---|
| ChatGPT/Claude raw | One-shot advice | Continuous + evidence + state (above) |
| SparkToro ($38-225/mo) | Audience research (clickstream, SERPs, profiles); recently added "Take Action" tasks | App-native (App Store data), action-first by design, far deeper per-app specificity |
| AppFigures / Astro / ASO tools | ASO keywords only | ASO is 1 of our 7 categories; we cover the whole distribution surface |
| GummySearch (dead, Nov 2025) | Reddit audience research | Proof of demand AND proof of platform risk; we have no Reddit dependency |
| F5Bot / Syften (free/cheap) | Keyword mention alerts | Mentions are an input; we output prioritized actions with drafts |
| Indie marketing courses/agencies | Education / done-for-you | Software price point, always-on, no $2K retainers |

---

## 3. GTM Brain's Own GTM Plan (dogfooding)

The tool must market itself. This section is a first-class deliverable, not an afterthought.

### 3.1 Our ICP (locked — do not drift)

- Solo technical founder (iOS/Swift, Flutter, React Native, or full-stack web dev)
- Subscription product live in market: **mobile app (App Store / Play) or web SaaS** — both first-class
- $0 — $5K MRR. Pre-revenue explicitly included
- Can build, can't distribute. Self-identifies as "developer who hates marketing"
- Trigger moment (publicly detectable): launched → ~50 downloads or signups → flatline → posts "how do I market my app/SaaS?"

Business-model note: input mode (app vs web) is orthogonal to business model (B2C vs B2B). B2C-consumer products get full-confidence analysis (all five validated examples were B2C) and are the first marketing/content vertical; B2B products are fully supported but carry directional-confidence labeling (§4.2). Dogfooding check: GTM Brain and Nudgi are both web SaaS — the product must be able to scan itself, which v2's app-only input could not.

### 3.2 Where they are (channel map)

| Channel | Type | Play |
|---|---|---|
| r/iOSProgramming, r/SideProject, r/indiehackers, r/SaaS, r/microsaas, r/androiddev, r/FlutterDev, r/reactnative | Community | Genuine participation; answer "how do I market my app/SaaS" threads; teardown posts |
| Indie Hackers | Community | Build-in-public journal; milestone posts |
| X #buildinpublic | Community | Daily dogfooding narrative |
| Hacker News | Launch | Show HN: the free scan (not the paid product) |
| Product Hunt | Launch | Free scan launch; later paid launch |
| Sub Club (RevenueCat), Indie Bites, App Masters, Under the Radar | Podcasts | Pitch the dogfooding story after traction |
| iOS Dev Weekly, Indie Hackers newsletter, TLDR | Newsletters | Earned mentions first; sponsor later |
| RevenueCat ecosystem | Platform | Sub Club community participation; **integrations directory listing** — highest-leverage single channel; our exact ICP concentrated |

### 3.3 How we sell (motion)

- **Pure PLG. No sales calls. Self-serve only.**
- Funnel: free scan (no signup for 2-min preview) → email gate for full report → $29/mo for weekly action queue + monitoring.
- **Share loop:** scan results render a score badge image ("Discoverability Score: 34/100 — see what I'm missing") sized for X/Reddit. Every share is an ad.
- **Content engine = teardowns.** The five analyses already produced (Bearable, Opal, CardPointers, Sofa, Nudgi) are the first five content pieces. Format: public discoverability teardown of a known indie app using only public data. One per week.
- **Meta-narrative:** "I'm using GTM Brain to grow GTM Brain" — every channel experiment we run becomes content.

### 3.4 Channel sequence (calendar)

- Wk 1-4: community participation + Phase 0 smoke test & conversations (§14)
- Wk 3-6: free scan live; teardown cadence starts; waitlist → scan invites
- Wk 6-10: Show HN + Product Hunt (free scan); collect conversion data
- Wk 10+: podcast pitches; RevenueCat directory submission; paid tier launch

---

## 4. Customer ICP & Modes (their products)

### 4.1 Input modes (the router)

One pipeline, two source adapters. `apps.platform ∈ {ios, android, web}` drives adapter selection; schemas and pipeline stages are shared.

| | App mode | Web mode |
|---|---|---|
| Input | App Store / Play URL | Website URL |
| Listing/positioning data | iTunes Search API metadata | Site fetch (Tavily/direct), pricing page, Wayback history |
| Reviews (ICP language) | App Store review RSS (~500 recent) | Trustpilot via DataForSEO, Product Hunt reviews/comments, **competitor** reviews (often richer than the customer's own) |
| Competitor discovery | Similar apps + category charts + iTunes keyword overlap + SERP | SERP "alternatives to {X}" + Product Hunt categories + AlternativeTo (gray) |
| Keywords / SEO | DataForSEO (shared) | DataForSEO (shared) — web mode is the SEO module's home turf |
| Score axes | Content / Outreach / SEO+**ASO** | Content / Outreach / **web SEO** (no ASO components) |
| Optional enrichment | RevenueCat or Stripe read-only | Stripe read-only (**elevated priority in web mode** — compensates for thinner review evidence: "you have 5 paying users; here are lookalike and adjacent ICPs") |

Honesty rule for web mode: small web SaaS often has near-zero own-review presence; the ICP X-Ray must weight competitor reviews, community threads, and connected revenue data, and label evidence basis accordingly.

### 4.2 Business-model confidence tiers (orthogonal to input mode)

- `business_type: b2c_consumer` — full-confidence analysis (the five validated examples). First marketing/content vertical.
- `business_type: b2b` — fully supported, sources adapted (G2-category SERPs via DataForSEO, LinkedIn-public via Tavily), outputs labeled "directional," confidence cap 0.6. Secondary marketing priority, not zero.
- `business_type: prosumer` — between the two; cap 0.8.

### 4.3 Cold Start sub-mode — PLG-native (v2.1 rewrite)

Detection: <25 reviews (app) / negligible review+traffic footprint (web), or pre-launch.

Principle: **validation through distribution, not before distribution.** The product never assigns interview homework as the primary path. Instead the Cold Start queue front-loads action cards whose execution generates validation signals as a byproduct:

1. Ship a waitlist or free-tool page targeting the hypothesized ICP (PLG artifact card, with draft copy)
2. Post it in 2-3 scored communities (content cards that double as demand tests)
3. Stand up one comparison/landing page on the top intent keyword; measure search conversion
4. Optional fast-signal card: $50 ad test on the top intent keyword
5. Optional card (never mandatory): discovery-conversation script for founders who want it

All Cold Start findings remain `probability_based`, confidence capped 0.6. Kill/pivot criteria are retained but computed from **observed signals** (waitlist conversion, CTR, community engagement) rather than interview counts — and a triggered kill criterion surfaces as a pivot-suggestion action card, in the same queue, not a lecture. Coherence bonus: our own motion is PLG; the advice engine preaches the same playbook it runs on.

### 4.4 Refusals

One-time-purchase products with no retention surface: warned (limited fit), not refused. Anything requiring private data we can't access: refused with explanation.

---

## 5. Product Architecture: Free Scan → Paid

### 5.1 The funnel is the architecture

```
App Store URL or website URL pasted (no signup)
        │
   0-3s   "Working" screen: live data-pull feed
        │   app mode:  reviews fetched: 412 ✓, competitors found: 6 ✓, keywords queued ✓
        │   web mode:  site crawled ✓, Trustpilot/PH reviews ✓, SERP competitors: 5 ✓
   3-10s  Preliminary screen (FACTS, not insights):
        │   category, top 5 auto-discovered competitors (1-click confirm/edit),
        │   review volume + rating trend (or traffic-proxy signals in web mode),
        │   top review themes (word-level)
  90-120s Instant Findings (email gate appears here):
        │   preliminary Discoverability Score (0-100),
        │   positioning mirror ("here's what your product appears to say it does"),
        │   3 concrete findings w/ evidence links,
        │   1 sample action card (locked drafts visible but blurred)
  15-30m  Full Scan delivered (email + dashboard):
        │   four-question report (§5.6): WHAT you offer (positioning mirror, full),
        │   WHO it's for (ICP X-Ray), WHERE they are (competitor gap map + surfaces),
        │   HOW to engage (prioritized top-10 action plan, 3 MVP categories),
        │   full Score breakdown
        │
  Paid:  weekly action queue refresh, intent monitoring,
         progress tracking, score history, drafts unlocked
```

Design rule learned from v1 critique: **the 10-second screen shows data motion, not claims.** Thin data at 10s means generic insight (the horoscope problem). Facts fast; claims only when evidence exists.

### 5.2 Input router & competitor auto-discovery (no user input)

Router: URL pattern → `platform` (apps.apple.com → ios, play.google.com → android, else web) → adapter set per §4.1.

App mode pipeline: iTunes Search keyword overlap + App Store similar-apps (page scrape, gray-tolerant; fallback: DataForSEO App Data search) + category top charts + Tavily "alternatives to {app}" + review co-mentions.
Web mode pipeline: DataForSEO SERP "alternatives to {product}" + "{product} vs" autocomplete + Product Hunt category neighbors + AlternativeTo (gray, cached).
Output: ranked candidate list; founder one-click confirms (edits allowed). Stored as `competitor_set` with `source` per entry.

### 5.3 Tech stack (Claude Code targets)

| Layer | Choice | Notes |
|---|---|---|
| Web app | Next.js 16 (App Router, Turbopack, Cache Components) on Vercel | React 19.2 + React Compiler stable; full frontend stack in §20 |
| UI system | Tailwind v4 + shadcn/ui on **Base UI** primitives | Radix maintenance slowed post-WorkOS acquisition; Base UI is the actively maintained layer (MUI team) |
| Animation | Motion (app UI) + GSAP incl. all plugins, free since 4/2025 (marketing set pieces) + native View Transitions (navigation) | Three-tier system, §20.3 |
| DB + Auth | Supabase (Postgres + RLS + Auth + **pgvector** + Storage for blobs) | Single DB is the warehouse at MVP — no Snowflake/BigQuery |
| Background jobs | Inngest (or Trigger.dev) | Scan pipeline = durable multi-step function |
| LLM | Anthropic API (Haiku 4.5 extract/format, Sonnet 4.6 synth/critic) | model strings: claude-haiku-4-5-20251001, claude-sonnet-4-6 |
| Search/data | DataForSEO (backbone), Tavily (web research), official free APIs (§8) | |
| Billing | Stripe (subscriptions + customer portal) | |
| Email | Resend (scan delivery, weekly digest) | |
| Analytics | PostHog (funnel: paste→preview→email→scan→paid) | |

### 5.4 Core data model (Postgres sketch)

```sql
apps(id, store_url, platform, name, category, icp_mode, business_type, created_at)
scans(id, app_id, status, tier, score_total, score_breakdown jsonb, started_at, completed_at, cost_cents)
evidence(id, scan_id, source_type, url, excerpt, captured_at)        -- every claim links here
findings(id, scan_id, category, basis, confidence, body jsonb, evidence_ids int[])
actions(id, app_id, category, title, effort_min, deadline, expected_outcome jsonb,
        draft text, status, verify_url, verify_state, score_component, created_at)
score_snapshots(id, app_id, taken_at, total, breakdown jsonb, installs_reported int)
competitors(id, app_id, competitor_store_url, name, source, confirmed bool)
monitors(id, app_id, kind, query, cadence, last_run_at)              -- keyword/competitor/intent watches
users(id, email, app_ids, tier, founder_voice jsonb)
```

Extended by the warehouse tables in §5.7: `raw_documents`, `fact_sheets`, `outcomes`, `pipeline_runs`, plus `monitors.watermark`.

### 5.5 API surface (internal)

- `POST /api/scan` {store_url} → scan_id (anonymous allowed for preview stage)
- `GET /api/scan/:id/stream` → SSE progress events for the 0-10s screen
- `POST /api/scan/:id/claim` {email} → gates full report
- `GET /api/app/:id/queue` → current weekly action queue
- `POST /api/action/:id/complete` {verify_url?} → verification job enqueued
- `POST /api/app/:id/connect/revenuecat|stripe` → optional enrichment

---

### 5.6 UI principle: the four questions (v2.1 — simplicity mandate)

The founder's mental model is a question chain, not a marketing taxonomy. The dashboard navigation is exactly four plain-language panels plus one number:

1. **What you offer** — positioning mirror: what your listing/site appears to say, vs what your best reviews say users actually value. Gap highlighted.
2. **Who it's for** — ICP X-Ray in plain language, evidence-linked.
3. **Where they are** — ranked surfaces with evidence + the competitor gap map.
4. **What to do this week** — the action queue. The only tool-like surface.

Plus the Discoverability Score (and radar) as the single persistent number.

The 7 action categories (§6) are **internal structure**: they organize queue composition, score breakdown, and pipeline modules. The founder never navigates by category. Acceptance rule for every UI addition: it must answer one of the four questions or move the Score; otherwise it doesn't ship.

---

### 5.7 Data Warehouse & Memory (three layers + pgvector)

One Supabase Postgres is the entire warehouse at MVP. Three layers with strictly different rules:

**Layer 1 — Raw evidence (immutable, append-only).** Every fetched item exactly as collected.

```sql
raw_documents(id, subject_type, subject_key, source_type, url, content_hash,
              body jsonb, fetched_at, mode)
-- bulky blobs (HTML snapshots, screenshots) → Supabase Storage, row stores pointer
-- dedupe on content_hash; rows are never edited or deleted (retention policy aside)
```

Purpose: the audit trail behind "every claim links to evidence"; enables re-running improved pipelines on historical data with zero re-fetch cost.

**Layer 2 — Compressed fact sheets (cheap-model output; shared; TTL'd).** What the expensive model actually reads. Keyed to the *subject*, not the customer — competitor X's review-theme sheet serves every customer tracking X. This layer is where the margin lives.

```sql
fact_sheets(id, subject_type, subject_key, kind, body jsonb, evidence_ids int[],
            model_version, created_at, expires_at, shared bool)
-- TTLs: keyword data 30d · competitor sheets 14d · community maps 30d · SERP results 7d
-- scheduled refresh of expiring shared sheets is a budgeted job, not a surprise
```

**Layer 3 — Insights & outcomes (customer-facing + learning).** Existing `findings`, `actions`, `score_snapshots`, plus the compounding moat:

```sql
outcomes(id, action_id, app_id, verified_signal, observed_delta jsonb, observed_at)
-- "founder did X → ranking moved Y" — feeds future prioritization and the
-- "founders like you who did this saw that" benchmark layer no competitor can copy
```

**pgvector — what gets embedded (semantic layer):**

| Embedded | Why |
|---|---|
| Review chunks (own + competitors) | ICP language mining; "find every review expressing this pain"; grounds drafts in real user words |
| Community threads/posts | Match new threads to the product by meaning ("someone is asking exactly what you do") — powers monitoring and the daily feed |
| Autocomplete / PAA questions | Cluster into demand themes |
| Competitor positioning blurbs | Semantic competitor discovery — catches rivals who describe themselves like you but share no keywords (feeds the discovery loop) |
| Findings | Novelty detection for delta refresh ("already told you this") |
| Action drafts | Near-duplicate suppression week-over-week + cross-customer draft-divergence check (algorithm-safety rule 5) |

Not embedded: numerics (rankings, volumes — plain SQL), raw HTML, anything retrievable by exact key. Ops: HNSW indexes; embedding model + version stored per row; model upgrades re-embed as a batch job.

**Delta state (what makes refresh cheap):** `monitors.watermark jsonb` holds last-seen review ID, last rank, last thread timestamp per watch. Refresh = fetch past watermark → nothing new = ~$0.02 no-op → else Haiku delta summary → escalate to Sonnet only if vector novelty vs existing findings exceeds threshold.

**Cost telemetry (margin enforcement):**

```sql
pipeline_runs(id, scan_id, stage, model, tokens_in, tokens_out, cost_cents,
              critic_rejections, duration_ms)
-- per-scan budget enforced in code; alert when p95 scan cost > $1.50
```

---

## 6. The 7 Action Categories (modules)

Internal taxonomy powering the queue and the Score (§5.6: not customer-facing navigation). Each module = same five elements (the SEO-tool meta-pattern): data sources, scoring, specific tasks, progress tracking, competitor gap. **MVP builds modules 1, 2, 5. Positioning-lite ships inside the scan. 3, 4, 6 and full 7 are v1.5+.**

**Per-scan source empiricism (v2.1, applies to every module):** no source has fixed authority. Each scan measures signal density per source (ICP-relevant evidence items actually returned for this product); sources below threshold are dropped from that scan's evidence automatically, and the report shows which sources fed the analysis. A category with no YouTube creator coverage produces a scan with zero YouTube weight — by measurement, not opinion. This also disciplines founder-intuition bias in both directions: founders over-trust channels they personally use and ignore ones they don't; the Sofa analysis found its best channel (indie-podcaster co-promotion) on a surface the founder would never have looked at.

### Module 1 — Post Content (organic) [MVP]

- Sources: Reddit public JSON (garnish), HN Algolia, Indie Hackers pages via Tavily, YouTube comments (Data API), Product Hunt discussions, Quora via SERP
- Scoring: community ICP density × engagement norm × promo-tolerance × recency of similar posts
- Task format: "Post this angle on {community} {day}. Why it fits: {evidence}. Draft below (edit before posting)."
- Tracking: posts published (verify_url), engagement fetched where API allows, referral clicks (UTM)
- Gap: "Competitor mentioned in {n} community threads last 90d; you in {m}"
- Horizon: weeks → months

### Module 2 — Direct Outreach (1:1) [MVP]

- Sources: YouTube Data API (creators who reviewed competitors — intelligence + named pitch targets w/ public view counts; weighted per-scan empirically, never "start a channel" advice in MVP), Substack/newsletter discovery via SERP, Hunter.io (email finding; GDPR-aware). Apple Podcasts demoted to v1.5 PR module: RSS yields titles/cadence but no audience sizes — too thin to score outreach targets confidently.
- Scoring: audience size × audience-ICP overlap × competitor-mention recency × responsiveness proxy (posting frequency)
- Task format: "Pitch {creator}. They covered {competitor} on {date} ({link}). 150-word personalized draft below. Max 5 drafts/day systemwide."
- Tracking: sent (self-report) → response (self-report) → partnership (verified link)
- Gap: "Competitor reviewed by {n} creators; you by {m}"
- Horizon: days → weeks

### Module 3 — Run Ads [v1.5]

- Sources: DataForSEO Keywords Data (volumes/CPC), Facebook Ad Library (free), TikTok Creative Center (free), Apple Search Ads (requires founder's own ASA account connect)
- Note: deprioritized for MVP — pre-revenue ICP has no ad budget; module value rises with Growth-tier customers
- Horizon: hours → days

### Module 4 — Partnerships & Integrations [v1.5]

- Sources: Apple similar-apps graph, Product Hunt categories, AlternativeTo (gray), competitor "built with" pages via Tavily
- Task format: integration/cross-promo pitch with overlap estimate + draft
- Horizon: weeks → months

### Module 5 — SEO & Discoverability [MVP — deepest module]

Sub-surfaces: web SEO, ASO, directories, GEO (AI-answer presence).
- Sources: DataForSEO SERP + Keywords Data (volume, difficulty proxy, autocomplete, PAA), DataForSEO App Data (App Store/Play keyword search results), directory list (curated ~40: AlternativeTo, There's An AI For That, AppGrooves, etc.), DataForSEO LLM Mentions (GEO)
- Task formats:
  - "Build landing page for '{keyword}' — {vol}/mo, low competition. Brief below (headings, PAA questions to answer)."
  - "Submit to these 5 directories this week (links + prefilled blurbs)."
  - "Replace App Store keyword {x} with {y} — {n}x search volume at same competition."
  - "Add FAQ schema answering {3 PAA questions} → AI Overview eligibility."
- Tracking: rankings (DataForSEO rank checks, weekly), directories live (verify_url), ASO keyword coverage
- Gap: "Competitor ranks for {n} category keywords; you for {m}" — the highest-converting visualization; render prominently
- Horizon: months → years (compounds most)

### Module 6 — PR & Earned Media [v1.5]

- Sources: GDELT (free), GNews/Mediastack (cheap NewsAPI alternatives), journalist bylines via SERP, podcast guest patterns
- Horizon: weeks → months, high variance

### Module 7 — Product / Positioning [lite in MVP scan; full module v2]

- Scan includes: App Store title/subtitle/screenshot recommendations, one comparison-page suggestion ("{You} vs {Competitor}" with search volume), pricing observation vs competitor set
- Full module later: A/B test tracking, positioning-gap analysis, Wayback-based competitor positioning history

### Time-horizon rebalancing

Weekly queue composition adapts to founder constraints captured at onboarding (time-rich/money-poor default for ICP): default mix = 1-2 quick wins + 2-3 medium plays + 1 long play, weighted toward Content/Outreach/SEO. Money-available founders get Ads/PR weighted up at v1.5.

---

## 7. Discoverability Score & Gamification (light-plus)

### 7.1 Score definition

`DiscoverabilityScore = Σ (weight_c × subscore_c)` over active categories. MVP weights: Content 0.30, Outreach 0.25, SEO/ASO 0.45 (long-horizon weighted highest because it compounds; revisit with data). Web mode: ASO components excluded; the SEO subscore is computed from web-SEO components only (rankings, directories, comparison/landing pages live), same axis weight.

Each subscore (0-100) computed from verified components only, e.g. SEO/ASO: keywords ranking (40%), directories live (20%), comparison/landing pages live (20%), ASO coverage vs competitor median (20%).

### 7.2 Anti-vanity rules (hard requirements)

1. Score components must be externally verifiable wherever possible (URL exists, ranking observed, listing live). Self-reported-only items contribute ≤20% of any subscore.
2. Removed/deleted/downvoted-to-hidden posts are subtracted, not kept.
3. Outreach with no response after 21 days leaves the active count.
4. Low-authority directory listings (below curated-list threshold) contribute zero.
5. Dashboard renders Score **next to** founder-reported installs/revenue trend with the honest caption: "Score measures distribution surface built, not guaranteed installs." If Score ↑ while installs flat for 8+ weeks, the system says so and rebalances the queue.

### 7.3 Gamification surface (MVP)

- Score + 7-axis radar (locked axes greyed until module active) + anonymized "founders at your stage" benchmark band
- Weekly action queue with tick-off + verification
- Weekly streak (≥3 verified actions/week)
- Share badge (score image) — doubles as growth loop
- Explicitly excluded from MVP: leaderboards, achievement unlock trees, points economies

---

## 8. Data Sources Matrix v2 (honest)

Rule: **nothing critical sits on a gray-area source.** Every source tagged with tier, cost, and failure mode. Sources are data inputs for intelligence, not channels we tell founders to inhabit — and per §6, every source earns its evidence weight per scan by measured signal density.

### Tier A — Official, free, stable (build on freely)

| Source | What | Limits / notes |
|---|---|---|
| iTunes Search API | Legacy-named official App Store catalog API: app metadata, keyword search, similar-genre apps, podcast directory | Free, no auth, official. App-mode foundation (powers the scan); N/A in web mode |
| App Store review RSS | Recent reviews per app | ~500 most recent (10 pages × 50); enough for themes, not history. App mode only |
| App Store category RSS / charts | Top charts per genre | Official. App mode only |
| HN Algolia API | Stories/comments search | Free, excellent |
| Product Hunt GraphQL | Launches, discussions, reviews | Free key, rate-limited. Key web-mode review source |
| YouTube Data API | Creator landscape + competitor-review comments (ICP language) + outreach target lists | 10K units/day; search=100 units → budget ~80 searches/day/project. Strong for consumer apps, moderate for web SaaS; weight set per-scan empirically |
| GitHub / Stack Exchange APIs | Dev-tool adjacency signals | Free |
| Wayback Machine | Competitor site history | Free |
| GDELT | News mentions | Free, noisy |
| Google Trends official API | Trend lines | Alpha (mid-2025); request access; fallback = DataForSEO Trends |

### Tier B — Paid backbone (the v2 decision)

| Source | What it covers | Cost |
|---|---|---|
| **DataForSEO** | SERP (Google/Bing/YouTube/App Store), autocomplete, People-Also-Ask, keyword volumes & CPC (Keywords Data), Google Trends, App Data (App Store + Google Play search/listings/reviews), Trustpilot reviews, LLM-mention tracking (GEO) | Pay-as-you-go; SERP $0.0006 (Standard ~5min) / $0.002 (Live); $50 min deposit, $1 trial. Est. $50-200/mo at MVP scale |
| Tavily | Agentic web research (sites, founders, "alternatives to" queries) | ~$0.005-0.01/search; already specced in v1 |
| Hunter.io | Creator/journalist email finding | From ~$34/mo; EU-data GDPR care: only business-contact lookups, no enrichment storage beyond need |
| Anthropic API | All synthesis | §13 cost model |

DataForSEO alone covers ~60% of total data needs (everything keyword/SERP/app-store shaped) through one legitimate vendor. This is what replaces the killed Reddit dependency AND the gray scraping cluster.

### Tier C — Gray-area, garnish only (degrade gracefully if lost)

| Source | Use | Risk |
|---|---|---|
| Reddit public JSON (`.json` suffix) | Low-volume thread context for Content module | Rate limits, could close anytime. Never a core dependency. No Reddit API contract. |
| google-play-scraper libs | Play reviews beyond DataForSEO coverage | TOS-gray, widely used |
| AlternativeTo page parsing | Partnership candidates (v1.5) | Cloudflare; cache aggressively |

### Killed (do not build on)

- Reddit official API as dependency (GummySearch precedent)
- pytrends as core infrastructure (unofficial, breaks)
- NewsAPI production tier ($449/mo — if news needed, GNews/Mediastack)
- G2 / Capterra / Trustpilot scraping (DataForSEO provides Trustpilot legitimately)
- Apple Search Ads keyword API as our data (requires advertiser account; v1.5 = founder connects their own ASA account)

---

## 9. Intelligence Pipeline & Critic Gate v2

### 9.1 Pipeline (per scan / per weekly refresh)

```
Stage 0 COLLECT   (no LLM)        parallel fetch: Tier A + DataForSEO + Tavily → evidence rows
Stage 1 EXTRACT   (Haiku 4.5)     per-source structured extraction → typed facts w/ evidence_ids
Stage 2 SYNTH     (Sonnet 4.6)    ICP X-Ray, gap map, candidate actions (over-generate 2-3x)
Stage 3 CRITIC    (Sonnet 4.6)    Critic Gate v2 (below); reject/revise loop, max 3 retries
Stage 4 FORMAT    (Haiku 4.5)     schemas → UI payloads, drafts polished to founder_voice
Fallback: after 3 Critic rejections → ship degraded output, flagged sections labeled
          "lower confidence", never silently padded
```

Weekly refresh runs Stages 0-4 scoped to deltas (new reviews, rank movements, new competitor activity) — far cheaper than full scan.

### 9.2 Critic Gate v2 — action-first rules (verbatim, for the Critic prompt)

An action card PASSES only if ALL hold:

1. **Evidence.** ≥2 evidence links from ≥2 distinct source types directly supporting why THIS action for THIS app. Links must resolve (checked in Stage 0 inventory).
2. **Specificity.** Names the exact surface (community/creator/keyword/directory), not a category. "Post on Reddit" fails; "Post {angle} on r/X, where {competitor} threads averaged {n} comments" passes.
3. **Effort + deadline.** Concrete effort estimate in minutes/hours and a suggested completion date.
4. **Expected outcome.** A measurable expectation tied to a score component ("expected: directory listing live → SEO subscore +3; realistic referral range {a}-{b}/mo").
5. **Draft present** where category requires (Content, Outreach) — and the draft must reference ≥1 app-specific fact (a real review theme, a real competitor gap). Generic drafts fail.
6. **Source diversity at plan level.** No single source type supports >30% of the weekly queue.
7. **Confidence calibration.** `probability_based` findings (Cold Start) capped 0.6; `evidence_based` requires the evidence rows to actually entail the claim (Critic spot-checks 2 random links per card against the claim text).
8. **Audience honesty.** Newcomer-hostile communities (rules forbidding promo) may only appear as "participate first" actions, never "post your app" actions.
9. **Algorithm safety.** Action must not violate §11 rules (no bulk, no auto, cadence respected).
10. **Score linkage.** Every passed action maps to exactly one score_component.

### 9.3 The quality-bar risk (named, owned)

The validated analyses (Bearable, Opal, CardPointers, Sofa, Nudgi) were produced by a frontier model with extensive iterative search. Replicating that bar programmatically is the **top technical risk** (§16-R1). Mitigations: over-generate + Critic filter; evidence-entailment spot checks; depth budget per scan (30-60 tool calls); golden-set regression (the 5 analyses become eval fixtures — every pipeline change is scored against them before deploy).

### 9.4 Tool registry (function calls)

The engine is small named tools + bounded loops, not one big prompt. Cost class: D = data call (cheap, cast wide), L = LLM call (expensive, run narrow).

| Tool | Does | Backed by | Class |
|---|---|---|---|
| find_competitors | Candidate rivals for a product | iTunes Search / DataForSEO App Data / SERP "alternatives" / PH categories / pgvector positioning neighbors | D |
| get_reviews | Reviews for any product | App Store RSS / DataForSEO (Play, Trustpilot) / PH | D |
| get_listing | Store page or website + pricing | iTunes Search / site fetch / Wayback | D |
| search_keywords | Volumes, autocomplete, PAA | DataForSEO Keywords Data + SERP | D |
| search_web | Open-ended research | Tavily | D |
| find_communities | Where a topic is discussed | HN Algolia / Reddit JSON (garnish) / SERP | D |
| find_creators | People who reviewed a competitor | YouTube Data API / SERP | D |
| check_link | Does the source actually say what the claim says | fetch + Haiku entailment | L (cheap) |
| track_rank | Keyword position check | DataForSEO rank endpoint | D |
| verify_action | Confirm a completed action is live | fetch + parse verify_url | D |

### 9.5 Bounded agentic loops (budgets and stop rules)

Every loop declares `(max_rounds, novelty_threshold, budget_cents)`. Diminishing-returns early exit: if the last round added ~nothing, stop.

1. **Competitor-discovery loop.** find_competitors → get_reviews/get_listing on each → new names surface in review co-mentions + pgvector positioning neighbors → add → repeat. Stop: a full round adds no new confirmed candidate; hard cap 3 rounds. (First-pass competitors are never assumed complete — the weekly refresh re-enters this loop.)
2. **Evidence loop.** Critic rejects a claim for thin proof → ≤2 targeted retrieval attempts → still thin = claim drops or downgrades to `probability_based`. Never deleted silently, never padded.
3. **Gap-chasing loop.** Remaining scan budget reallocates to the weakest of the four questions instead of polishing the strongest. Total scan budget: 30-60 tool calls, hard cap.
4. **Continuous loop (paid).** Weekly delta re-entry into loops 1-3, watermark-scoped (§5.7).

### 9.6 Refresh cadence & the signal feed

**Weekly refresh (MVP).** Delta-only: new reviews, moved ranks, new threads, new competitor candidates since watermark. Output = "what changed" digest + new action cards. Unchanged week ≈ $0.02.

**Daily signal feed (v1.5, gated).** Notifications-inbox UI: "2 new reviews mention onboarding confusion," "competitor launched on PH," "keyword #12 → #8," "new r/SaaS thread asks exactly what you do" — each a card with a one-tap action. Gate before shipping: median ≥1 genuine signal/day/app in beta data; otherwise empty feeds train users to stop opening the app. Mitigations: widen signal classes (competitor moves, trend shifts, answerable threads — not just own-product changes) or daily light-signals view atop the weekly deep scan. Cost stays viable because the feed is delta-only on shared cache.

---

## 10. Output Schemas (canonical JSON)

### 10.1 Scan result (free, full)

```json
{
  "scan_id": "…", "app_id": "…", "tier": "free|full",
  "score": {"total": 34, "breakdown": {"content": 22, "outreach": 10, "seo_aso": 48}},
  "icp_xray": {
    "primary": {"label": "…", "evidence_ids": [..], "basis": "evidence_based"},
    "adjacent": [{"label": "…", "basis": "probability_based", "confidence": 0.55}]
  },
  "competitor_gap": [
    {"competitor": "…", "dimension": "category_keywords_ranked", "them": 47, "you": 3, "evidence_ids": [..]}
  ],
  "findings": [
    {"id": "…", "category": "seo_aso", "claim": "…", "basis": "evidence_based",
     "confidence": 0.8, "evidence_ids": [..]}
  ],
  "actions": ["<action_card>", "…"]
}
```

### 10.2 Action card

```json
{
  "id": "…", "category": "content|outreach|seo_aso",
  "title": "…", "why": "…", "evidence_ids": [..],
  "effort_min": 45, "suggested_deadline": "2026-06-17",
  "expected_outcome": {"score_component": "seo.directories", "delta": 3,
                        "secondary": "est. 5-15 referral visits/mo"},
  "draft": "…|null", "draft_requires_edit": true,
  "verification": {"method": "url|self_report|rank_check", "state": "pending"}
}
```

### 10.3 Weekly plan

```json
{"week_of": "2026-06-15", "app_id": "…",
 "queue": {"quick_wins": ["<card>","<card>"], "medium": ["<card>","<card>","<card>"], "long_play": ["<card>"]},
 "carryover": ["<card_ids unfinished>"], "score_delta_last_week": 4,
 "honesty_note": "…|null"}
```

---

## 11. Algorithm-Safety Rules (cross-cutting, enforced in Stage 4 + UI)

1. **No auto-posting, auto-sending, auto-submitting. Ever.** Every action is founder-executed.
2. Drafts are starting points: UI requires an edit event (or explicit "send as-is" confirmation with friction) before copy button activates.
3. Max 5 outreach drafts generated per founder per day; suggested sends spaced across days.
4. Per-platform cadence caps in the queue composer (e.g., ≤2 Reddit posts/wk/community, ≤1/community).
5. Cross-customer similarity check: if two customers' drafts for the same surface exceed similarity threshold, both regenerate with divergence instruction.
6. Generic-tell scan on every draft (clichés, AI-isms) → regenerate before delivery.
7. Founder-voice calibration: store writing samples / edits in users.founder_voice; Stage 4 conditions on it.
8. Newcomer-hostile communities → "participate first" sequencing enforced (Critic rule 8).

---

## 12. Pricing & Unit Economics v2  [DECISION: confirm pricing]

| Tier | Price | Contents |
|---|---|---|
| Free Scan | $0 | One full scan per app (email-gated), score badge, 3 sample actions w/ drafts blurred |
| Solo | **$29/mo** | 1 app, weekly action queue (drafts unlocked), monitoring, score history |
| Growth | **$99/mo** | 3 apps, daily intent monitoring, higher draft quota, RevenueCat/Stripe enrichment, rank tracking depth |
| (Studio $399) | cut from MVP | revisit at v2 if agencies appear organically |

Rationale: ICP is pre-revenue→$5K MRR; $49 was a real barrier for $0-MRR founders; comparables (SparkToro $38+, Surfer $89+) serve richer buyers. Churn reality: assume 8-12%/mo because customer apps die. LTV at $29 / 10% churn ≈ $290 → CAC must be near-zero → which is exactly what the free-scan PLG loop provides. Revenue math to default alive on runway: 100 Solo + 15 Growth ≈ $4.4K MRR — attainable inside the RevenueCat/indie ecosystem if free-scan conversion ≥5%.

---

## 13. Cost Model v2.2 (optimized — 90%+ GM is a hard constraint)

The v2 estimate ($3-8/scan) priced *wasted* LLM spend: the expensive model re-reading raw text, and loops without brakes. Both are designed out, not hoped away.

**Cost disciplines (load-bearing, enforced in code):**
1. **Sonnet never reads raw text.** Haiku compresses every source into fact sheets (§5.7 layer 2); Sonnet synthesizes from sheets only — premium rates on a tenth of the words.
2. **Model routing.** Extraction/formatting/tagging = Haiku; Sonnet = 1-2 synthesis calls + selective critic checks per scan.
3. **Loop budgets** (§9.5): hard round caps, novelty stop rules, 30-60 tool-call ceiling.
4. **Delta-only refresh** (§5.7 watermarks): the dominant lever — refreshes outnumber scans 4:1.
5. **Cross-customer shared cache** with TTLs: keyword data, competitor sheets, community maps fetched once, reused fleet-wide. 100th customer in a niche costs a fraction of the 1st.
6. **Telemetry enforcement:** pipeline_runs logs cost per stage; per-scan budget cap in code; alert at p95 > $1.50.
7. **Quality guardrail:** golden-set evals must pass on the cheap pipeline. If quality slips, the fix is more Haiku passes (cheap), never more Sonnet by default.

**Optimized unit costs:**

| Item | Cost | Composition |
|---|---|---|
| Free scan | **≤$0.15** | cached data + shallow depth + 1 Haiku + 1 small Sonnet |
| Full scan (paid onboarding) | **$0.65-1.50** | data $0.30-0.60 (cached) + Haiku compression $0.05-0.15 + Sonnet synth $0.20-0.50 + critic/link checks $0.10-0.25 |
| Weekly refresh | **~$0.30 blended** | no-change $0.02 · typical $0.15-0.40 · busy (new competitor) $0.40-0.60 |
| DataForSEO fleet-wide | $50-200/mo at MVP scale | pay-as-you-go; falls per-customer as cache hit rate rises |

**Margin check (Solo $29/mo):**

| Month | COGS | Gross margin |
|---|---|---|
| Steady state (4 refreshes) | $1.20 | **95.9%** |
| Month 1 (scan $1.50 + 4 refreshes) | $2.70 | **90.7%** |
| At scale (cache hit rate ↑) | <$1.00 | **96-97%** |

Both pass the 90%+ constraint, including the heaviest month. Stale-cache risk is the price of layer-2 sharing: TTLs (§5.7) plus a budgeted scheduled-refresh job, tracked as R12.

Free-scan abuse control: 1 scan/app, email verification for full report, IP+app dedupe, depth budget hard cap.

---

## 14. Phase 0 — Pre-Build Validation Gate (replaces v1's "Reddit license inquiry")

**No serious build time before this gate.** Free-scan scaffolding may proceed in parallel (it doubles as the test instrument), but no paid-product code.

### 14.1 Smoke test first (weeks 1-4) — primary gate

Same PLG logic we now prescribe to customers (§4.3): signals beat interviews. Landing page: "Paste your App Store URL or website URL → free Discoverability Scan." Drive only via genuine community participation (no ads). Instrument with PostHog. The scan scaffolding (Phase 1) doubles as the test instrument.

### 14.2 Founder conversations (weeks 2-4, ~10, lightweight) — secondary signal

- Recruit from the waitlist itself plus "how do I market my app/SaaS" posters (r/iOSProgramming, r/SideProject, r/SaaS, Indie Hackers, #buildinpublic, Sub Club) — warm, not cold
- Script (short):
  1. Walk me through what you did to get users after launch. What produced nothing?
  2. What do you currently pay for (tools/courses) to grow it?
  3. If a tool told you exactly what to do this week with drafts — what would make you NOT trust it?
  4. (Show mock scan screenshot) What would you do with this? What's missing? Would you share the score badge?
- Log verbatim quotes → marketing copy and Critic eval fixtures.

### 14.3 Kill / proceed criteria (pre-committed)

| Signal | Proceed | Kill / pivot |
|---|---|---|
| Waitlist signups from ~4 wks organic participation (primary) | ≥150 | <50 |
| Free scan → email-gate conversion, once live (primary) | ≥35% | <15% |
| Score-badge shares / scan completions (primary) | ≥10% | <3% |
| Free scan → paid intent ("take my money" signals) | ≥5 explicit | 0 |
| Conversations expressing the flatline pain unprompted (secondary) | ≥6/10 | <3/10 |

If killed: the salvage asset is the teardown content engine + audience — pivot options documented before sunk-cost bias kicks in.

---

## 15. MVP Scope — the brutal cut

### IN (8-10 weeks of build after Phase 0 starts passing)

1. Free Scan funnel (app or web URL → 10s → 2min → email gate → full scan) — **ships first**
2. Input router + per-mode source adapters (§4.1); competitor auto-discovery + confirm UI
3. Modules: Content, Outreach, SEO/ASO (incl. ASO recommendations + directory checklist + keyword/landing-page briefs)
4. Positioning mirror in scan (what your listing/site says vs what reviews value) + title/subtitle/comparison-page suggestions
5. Discoverability Score (3 active axes, ASO components app-mode only) + radar + share badge
6. Weekly action queue + verification (URL paste + rank checks) + weekly streak
7. Solo tier billing (Stripe), Growth tier flagged "coming soon"
8. Cold Start sub-mode, PLG-native (probability_based labeling + validation-through-distribution cards, §4.3)
9. Four-question dashboard (§5.6) — the only customer-facing navigation
10. Critic Gate v2 + golden-set evals (the 5 analyses)
11. Warehouse foundations: raw_documents, fact_sheets w/ TTL cache, monitors.watermark, pipeline_runs cost telemetry, pgvector indexes
12. Marketing surface at launch = landing + /scan funnel + 5 teardowns + pricing + legal (the full §22 tree incl. programmatic pages grows post-launch from templates)

### OUT (explicitly deferred)

- Ads module, Partnerships module, PR module, full Positioning module (v1.5)
- B2B marketing (mode exists, unmarketed)
- RevenueCat/Stripe enrichment (v1.5, after RevenueCat directory listing)
- Leaderboards/achievements; team seats; API; Studio tier; Google Play first-class parity (accept Play URLs, App Store gets the polish)
- Founder-voice deep calibration (MVP = simple tone sample at onboarding)

---

## 16. Risk Register v2

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | **Quality-bar replication**: pipeline output worse than the frontier-model analyses that set expectations | Critical | Golden-set evals, over-generate+Critic, depth budget, honest degraded-output labeling |
| R2 | "Why not ChatGPT" positioning fails | Critical | §2 five differentiators enforced as build filter; continuous monitoring + verified evidence front and center |
| R3 | Pre-revenue churn (customer apps die) | High | $29 price, near-zero CAC via PLG, Growth tier captures survivors; track cohort survival |
| R4 | Free scan cost abuse | Med | §13 controls |
| R5 | Data source closure (Reddit JSON, Play scraping) | Med | Tier C = garnish only; degrade gracefully; DataForSEO backbone is contractual |
| R6 | Score becomes vanity metric | High | §7.2 anti-vanity rules; score-vs-installs honesty check |
| R7 | Solo-founder bandwidth (Tim's own) | High | This document's MVP cut; Phase 0 kill criteria; weekly scope review against §15 |
| R8 | Drafts trigger platform spam detection for customers | High | §11 rules; per-platform cadence caps; similarity divergence |
| R9 | DataForSEO cost creep at scale | Low | Standard queue default ($0.0006), Live only for the 10s screen; per-scan budget caps |
| R10 | GDPR (Hunter.io, EU founder data) | Med | Business-contact-only lookups, minimal retention, DPA with vendors; revisit at Dubai entity setup |
| R11 | Web-mode evidence thinness (small SaaS lack reviews) | Med | Weight competitor reviews + community threads + Stripe enrichment; honest basis labeling; golden-set must include 2 web-mode fixtures (GTM Brain itself, Nudgi) |
| R12 | Stale shared cache misleads customers | Med | TTLs per data kind (§5.7); budgeted scheduled refresh; fact sheets carry created_at surfaced in evidence panel |

---

## 17. Claude Code Implementation Roadmap (scan-first)

Each phase ends with a deployable increment and acceptance criteria. Run Phase 0 (§14) in parallel from day 1.

**Phase 1 (wk 1-2): Scan skeleton.**
Next.js + Supabase + Inngest scaffold. `POST /api/scan` → input router → Stage 0 collectors per mode (app: iTunes Search, review RSS, DataForSEO app data; web: site fetch, Trustpilot/PH via DataForSEO, SERP alternatives; both: 5 SERP calls, Tavily ×3) → evidence rows. SSE progress stream → the 0-10s screen with live data-pull feed + preliminary facts.
*Accept: paste any App Store URL or website URL → facts screen <10s, p95. First two test scans: GTM Brain itself and Nudgi (web mode), plus Sofa (app mode). Warehouse layers 1-2 + pipeline_runs logging live from day one — every fetch lands in raw_documents.*

**Phase 2 (wk 2-3): Instant findings + email gate.**
Stage 1-2 minimal (Haiku extract, one Sonnet synth), preliminary Score, 3 findings w/ evidence links, blurred sample action. Email claim flow (Resend, magic link). PostHog funnel events. Funnel moments 1-4 (§23): scan theater w/ live SSE artifacts, animated Score reveal, blur-locked sections with real headlines, single-field email gate.
*Accept: URL → 2-min findings <120s p95; gate conversion measurable. → SHIP PUBLICLY (waitlist invites).*

**Phase 3 (wk 3-5): Full scan + Critic Gate.**
Full Stage 0-4, Critic Gate v2 with retry loop, golden-set eval harness (5 fixtures, scored pre-deploy), competitor confirm UI, full Score breakdown, action cards with drafts, scan email delivery.
*Accept: golden-set mean quality ≥ threshold; full scan <30min; cost/scan logged <$8.*

**Phase 4 (wk 5-7): The paid loop.**
Stripe Solo tier; weekly refresh pipeline (delta-scoped via monitor watermarks + vector novelty, §5.7/§9.6); action queue UI + verification (URL paste, weekly DataForSEO rank checks); streak; score history; share badge generator.
*Accept: a paying user receives a Monday queue whose every card passes Critic v2; badge shares render correctly on X/Reddit.*

**Phase 5 (wk 7-9): Hardening + launch + polish pass.**
Abuse controls, degraded-output paths, founder-voice sample, Cold Start sub-mode, directory checklist content (curated 40), Show HN / Product Hunt launch assets.
*Accept: free scan survives launch traffic; Phase 0 conversion criteria re-measured at scale.*

**Phase 6 (v1.5, post-revenue):** Ads + Partnerships + PR modules, RevenueCat enrichment + directory listing, Growth tier on, Play parity.

---

## 18. Decision Log (v2 additions)

| # | Decision | Rationale |
|---|---|---|
| D21 | Free scan ships before paid product | Demo + lead gen + validation in one artifact |
| D22 | MVP = 3 modules (Content, Outreach, SEO/ASO) | Solo founder, 3-mo runway; SEO weighted deepest |
| D23 | DataForSEO + Tavily = paid data backbone; Reddit API dead | Legitimate, pay-as-you-go, covers ~60% of needs |
| D24 | Pricing Free/$29/$99, Studio cut | Pre-revenue ICP; PLG CAC story |
| D25 | Discoverability Score central, light-plus gamification, anti-vanity rules hard | Engagement without vanity-metric churn |
| D26 | Critic Gate rewritten action-first (10 rules) | Output unit is now the action card |
| D27 | Phase 0 validation gate with pre-committed kill criteria | We did zero discovery; fix before code |
| D28 | B2C locked; B2B exists unmarketed | Stop ICP drift (Nudgi lesson) |
| D29 | Golden-set evals from the 5 conversation analyses | Quality-bar replication is risk R1 |
| D30 | No auto-posting/sending ever | Algorithm safety + trust positioning |
| D31 | Web SaaS first-class via input router; app and web modes share pipeline/schemas | Dogfooding requires it (GTM Brain + Nudgi are web SaaS); web mode is SEO-module home turf |
| D32 | Cold Start is PLG-native: validation through distribution; interviews optional, kill criteria from observed signals | Interview homework = churn; tool practices what it preaches |
| D33 | Per-scan source empiricism: sources earn evidence weight by measured signal density; report shows sources used | No fixed source authority; corrects founder channel bias in both directions |
| D34 | Apple Podcasts demoted to v1.5 PR module | RSS data too thin (no audience sizes) to score outreach targets |
| D35 | UI = four-question frame + Score; 7 categories internal only | Simplicity mandate; founder mental model is WHAT/WHO/WHERE/HOW |
| D36 | 90%+ GM is a hard constraint; Sonnet reads fact sheets only; per-scan cost caps enforced via pipeline_runs telemetry | Margin engineered, not hoped; quality protected by golden-set gate |
| D37 | Three-layer warehouse on single Supabase Postgres (raw evidence / shared TTL'd fact sheets / insights+outcomes); no separate warehouse product at MVP | Simplicity + the margin lives in layer 2, the moat in outcomes |
| D38 | pgvector scope: reviews, threads, questions, positioning blurbs, findings, drafts; numerics stay SQL | Meaning-search powers monitoring, novelty detection, safety rule 5 |
| D39 | Weekly delta refresh in MVP; daily signal feed v1.5 behind a signal-density gate (median ≥1 genuine signal/day) | Empty daily feeds train churn; deltas not re-reports |
| D40 | shadcn/ui generated on Base UI primitives, not Radix | Radix maintenance slowed after WorkOS acquisition; Base UI actively maintained by MUI; shadcn supports both since 2025 |
| D41 | Animation = three tiers: View Transitions (navigation) / Motion (app UI) / GSAP+Lenis (marketing set pieces only) | Each tool where it's strongest; GSAP 100% free incl. plugins since Apr 2025; app stays light |
| D42 | Auth = magic link only, no passwords, created silently at the email gate | The gate IS the signup; every removed field raises the ≥35% conversion target's odds |
| D43 | Public shareable report pages (/report/[slug]) + embeddable score badge | The growth loop: every shared report is a landing page + backlink |
| D44 | GEO is a launch requirement, not a later optimization: llms.txt, JSON-LD on every template, answer-shaped playbooks, AI crawlers explicitly allowed | The ICP asks ChatGPT "how do I market my app" — GTM Brain must be the cited answer; also dogfooding |

## 19. Open Questions (for Tim, none block Phase 0/1)

1. Confirm pricing (D24) — $29/$99 vs keeping $49 Solo.
2. Score weights (Content .30 / Outreach .25 / SEO .45) — gut-check.
3. Free scan: one per app forever, or refresh quarterly as re-engagement hook?
4. Teardown cadence commitment — 1/week is a real content job alongside the build.
5. Entity/billing jurisdiction timing (DE now vs UAE post-move) — affects Stripe + GDPR posture; legal question, not product.
6. Name check: "GTM Brain" vs something founder-native ("Discoverability" language tested better in this spec's framing) — test in Phase 0 conversations.
7. Web-mode traffic proxy for the preliminary screen: which public signal stands in for "review volume" (SERP presence count, PH upvotes, Wayback age)? Decide in Phase 1.
8. Daily signal feed: which signal classes count as "genuine" for the density gate (own-product changes only, or competitor moves + answerable threads too)? Decide from beta telemetry.
9. Landing theme: dark-first matches the dev ICP aesthetic; light landings often convert better broadly. Ship dark-first, A/B once traffic allows.

---

## 20. Frontend Stack & UX Technology (researched June 2026)

The product's entire promise is "we know what good discoverability looks like." A generic-looking app contradicts the pitch before a word is read. Polish is positioning.

### 20.1 Framework layer

| Layer | Choice | Why (research-backed) |
|---|---|---|
| Framework | **Next.js 16** (16.2.6+) | Turbopack default, Cache Components (`"use cache"`), layout-deduped prefetching, proxy.ts; React 19.2 bundled |
| React | **19.2** + React Compiler (stable) | Auto-memoization = fewer perf footguns; `<Activity>` for preserving tab state in the app shell; native View Transitions |
| Language | TypeScript strict | Non-negotiable for a solo founder + Claude Code maintaining it |
| Styling | **Tailwind v4** | CSS-first `@theme` config = design tokens as native CSS variables; faster builds; the ecosystem standard |
| Fonts | Geist Sans + Geist Mono (variable) | Free, modern, dev-native aesthetic; mono for data/evidence UI |

### 20.2 Component layer

| Layer | Choice | Why |
|---|---|---|
| Primitives | **shadcn/ui generated on Base UI** | Copy-paste = owned code, zero version lock-in. Base UI over Radix: Radix maintenance slowed after the WorkOS acquisition; Base UI is actively maintained by the MUI team and shadcn supports it as a primitive layer since 2025 |
| Animated marketing components | **Magic UI / Aceternity-style** (selectively copied, never wholesale) | NumberTicker (Score), animated beams (pipeline visual), marquee (social proof), bento grid (features) — Tailwind+Motion native, same copy-paste model |
| Charts | shadcn charts (Recharts) | Score breakdown radial, rank-over-time sparklines, feed deltas |
| Toasts/feedback | Sonner | Action completed / verification states |
| Icons | Lucide | shadcn default; consistent stroke weight |

Anti-generic rule: shadcn defaults are everywhere in 2026 — ship a real theme (custom radius scale, custom accent, mono-accented data UI, signature Score visual), not stock zinc.

### 20.3 Animation system — three tiers

Fluidity everywhere, spectacle in exactly the right places.

| Tier | Tool | Scope | Examples |
|---|---|---|---|
| 1 — Navigation | **View Transitions API** (native in React 19.2 / Next 16, CSS-driven, graceful fallback) | All route changes | Shared-element morph: Score circle persists from scan screen → report header; teardown card → teardown page |
| 2 — App UI | **Motion** (formerly Framer Motion; React-declarative) | Authenticated app + funnel | Layout animations on the four-question dashboard, AnimatePresence on feed cards, spring physics on action-card complete/dismiss, staggered evidence reveal, blur-to-sharp unlock at the email gate |
| 3 — Set pieces | **GSAP** (100% free incl. SplitText, ScrollTrigger, ScrollSmoother since Apr 2025) + **Lenis** smooth scroll | Marketing pages only | Hero headline SplitText reveal, scroll-driven "watch a scan happen" sequence on the landing page, pinned how-it-works |

GSAP and Motion don't conflict — imperative DOM-level vs declarative React-level; standard practice is GSAP for marketing sections, Motion for product UI. GSAP stays out of the app bundle entirely (marketing routes only, client components, lazy below the fold).

**Motion rules (so it reads premium, not busy):**
1. Every animation has a job: orientation (where did this come from), feedback (did it work), or delight (budget: one moment per page).
2. Micro-interactions 150-300ms; transitions 400-700ms; springs over easings for interactive elements.
3. Animate position/opacity/scale only (compositor-friendly); never animate text the user is currently reading.
4. `prefers-reduced-motion` honored globally — every Motion/GSAP entry point checks it. Non-negotiable.
5. The Score count-up is the signature moment; it gets the most care (NumberTicker + radial sweep + shared-element continuity).

### 20.4 Performance budget (enforced, not aspired)

- Marketing routes: LCP < 2.0s, INP < 200ms, CLS < 0.05; Lighthouse ≥ 95. Animation JS lazy-loaded below the fold; hero animates with CSS until GSAP hydrates.
- App routes: INP < 200ms; skeletons never spinners; optimistic UI on action complete.
- CI check: bundle-size budget per route group; PostHog web vitals tracking from day one.
- Dark-first theme (dev ICP), light fully supported via next-themes; theme = CSS variables in `@theme`, so both are free.

---

## 21. Design System & Template Architecture (scale = composition)

The requirement: a new page must be cheap forever. Achieved by strict layering — nothing skips a layer.

```
Tokens (@theme CSS vars: color, radius, spacing, motion durations)
  → Primitives (components/ui/* — shadcn-generated, owned, themed once)
    → Sections (components/sections/* — typed, content-as-props)
      → Pages (a page = ordered section list + one content object)
```

### 21.1 Section library (marketing)

Hero, ScanInput, SocialProofMarquee, FeatureBento, HowItWorksScroll, TeardownGrid, ComparisonTable, PricingTable, FAQ (renders JSON-LD automatically), FinalCTA, Footer. Each takes a typed content prop — zero layout code per page. A new landing variant = a new content file, <1 hour including copy.

### 21.2 Programmatic page factories

Three templates render from DB rows, not files: teardown (`analyses` table → page), comparison (`/compare/[a]-vs-[b]` from competitor pairs in the warehouse), ICP landing (`/for/[segment]` from a segments table). The meta move: **the engine maintains its own marketing pages** — weekly refresh data updates comparison pages and "last verified" stamps automatically. Dogfooding as a freshness signal (AI engines weight recency; quarterly-stale content loses citations).

### 21.3 App shell

Persistent sidebar = the four questions + Score + Feed + Settings; content area swaps with View Transitions; `<Activity>` preserves tab state across question switches. Report layout is ONE component for free and paid — paid unlocks sections, free shows blur-locked previews with real headlines. One layout, one maintenance surface, and the upgrade delta is visible by construction.

### 21.4 Repo structure (Claude Code target)

```
app/
  (marketing)/        # GSAP+Lenis allowed; static/ISR; layout: nav+footer
    page.tsx  scan/  pricing/  teardowns/[slug]/  compare/[pair]/
    for/[segment]/  playbooks/[topic]/  changelog/  legal/*
  (funnel)/scan/[id]/ # SSE progress, results, gate — minimal chrome
  (app)/app/          # Motion only; auth-gated; sidebar shell
    page.tsx  offer/  audience/  channels/  plays/  feed/  settings/  billing/
  report/[slug]/      # PUBLIC shareable reports (the growth loop)
components/ ui/  sections/  motion/  report/
lib/ seo.ts (metadata factory + JSON-LD builders)  analytics.ts  flags.ts
content/ pages/*.ts  playbooks/*.mdx
```

`lib/seo.ts` is the enforcement point: every page gets `generateMetadata` + JSON-LD from one factory. SEO/GEO correctness is structural, not remembered.

---

## 22. Page Tree (marketing + SEO/GEO + app)

### 22.1 Public tree

| Route | Job | SEO/GEO payload |
|---|---|---|
| `/` | Convert ICP in <5s: headline + scan input above the fold | SoftwareApplication + Organization + FAQPage JSON-LD |
| `/scan` | Dedicated lead-magnet entry (link target for posts/podcasts) | HowTo JSON-LD |
| `/report/[slug]` | Public shareable reports + badge target — every share is a landing page | Article JSON-LD, OG image = score card |
| `/teardowns`, `/teardowns/[slug]` | Content engine (launch with the 5: Bearable, Opal, CardPointers, Sofa, Nudgi) | Article + Author; "last verified" date |
| `/compare/[a]-vs-[b]` | Programmatic: "X alternatives", "X vs Y" — highest-intent SEO in the niche | ComparisonTable + FAQPage |
| `/for/[segment]` | ICP landings: indie iOS devs, Flutter devs, bootstrapped SaaS | Tailored copy + proof |
| `/playbooks/[topic]` | Answer-shaped guides ("How to market an iOS app with $0") — GEO bait | Question-headings, direct answers, numbered steps, HowTo/FAQ JSON-LD |
| `/tools/*` | Secondary magnets (score badge generator, keyword peek) | Free-tool backlink earners |
| `/pricing` | One decision: Solo $29 | Product + Offer JSON-LD |
| `/changelog` | Build-in-public artifact, linked from X/IH posts | Freshness signal |
| `/privacy` `/terms` `/imprint` | DE entity = Impressum required | — |

MVP launch subset (per §15 item 12): `/`, `/scan`+funnel, `/report/[slug]`, 5 teardowns, `/pricing`, legal. Everything else is post-launch template output.

### 22.2 GEO requirements (launch checklist)

1. `llms.txt` describing the product, pricing, and key pages for AI crawlers.
2. robots.txt explicitly allows GPTBot, ClaudeBot, PerplexityBot, Google-Extended — and verify the CDN isn't silently blocking them (Cloudflare default-blocks AI bots; we're on Vercel, still verify).
3. JSON-LD on every template via `lib/seo.ts` (see table above) + Author entity pages (Tim) for E-E-A-T.
4. Answer-shaped content rules for playbooks/teardowns: question H2s, first-paragraph direct answers, numbers and citations, extractable lists.
5. Freshness pipeline: programmatic pages carry engine-maintained "last verified" dates (§21.2); core playbooks on a quarterly refresh cycle.
6. The UGC/authority layer LLMs trust most is third-party mentions — which is exactly the Phase 0 community strategy (Reddit/IH/HN presence does double duty as GEO).

### 22.3 App tree (auth)

`/app` (four questions + Score + this week's plays) · `/app/offer` · `/app/audience` · `/app/channels` · `/app/plays` (action queue + verify) · `/app/feed` (v1.5, gated) · `/app/settings` · `/app/billing`. Funnel routes: `/scan` → `/scan/[id]` (live progress) → `/scan/[id]/results` (partial + gate) → `/report/[slug]` (full).

---

## 23. Funnel UX — seven moments (lead magnet → monetization)

Friction is budgeted: we ask for exactly one thing per moment, always after value, never before.

| # | Moment | What they see | What we ask | Craft notes |
|---|---|---|---|---|
| 1 | **Land** | Headline + single input: "Paste your App Store URL or website." Live ticker of recent scans + count | Nothing | No nav distraction above fold; input autofocused; works logged-out |
| 2 | **Scan theater** | Streaming progress with real artifacts: "Found 12 competitors… reading 340 reviews… mapping 8 communities" — items materialize as found | Patience (15-45s) | SSE-driven; never a blank spinner; this IS the demo and the perceived-value builder; each artifact animates in (Motion stagger) |
| 3 | **Partial reveal** | Score counts up (NumberTicker + radial sweep — the signature moment), top finding in full with evidence links, remaining sections blur-locked **with real headlines** ("3 communities where your users are asking for this — locked") | Nothing yet | Real headlines under blur = honest curiosity gap; fake teasers would poison trust |
| 4 | **Email gate** | One field. "Send my full report." | Email only — magic link, no password, account created silently | Conversion target ≥35% (Phase 0 gate); every removed field helps; resend + change-email affordances |
| 5 | **Full report** | All sections unlock (blur-to-sharp, staggered), evidence panel per claim, score badge module ("Add to your site/README") | A share (optional) | Badge embeds link to `/report/[slug]` → growth loop; OG image = score card for social shares |
| 6 | **The stale-report moment** | Report header: "Snapshot — June 11" + a "what changes weekly" strip. Day 7 email: "Your market moved: 2 changes since your scan" — one delta shown, rest locked | Attention | Monetization is set up by honesty: reports decay, monitoring doesn't; automated from the monitors table |
| 7 | **Upgrade** | Paywall framed as activation: "Turn your report into an engine — weekly deltas, action queue, verification. $29/mo." Stripe checkout → `/app` with first week's plays pre-loaded | Payment — the first and only time | In-app prompts fire only at delta moments (new finding, stale data), never modal spam; cancel-anytime stated plainly |

Funnel instrumentation (PostHog, from Phase 2): land→scan start, scan completion, reveal→gate view, gate conversion, report→badge embed, day-7 email CTR, upgrade conversion. These are the §14 Phase 0 gate numbers, measured in the real funnel.

---

— End of spec —
