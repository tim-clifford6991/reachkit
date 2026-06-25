# ReachKit — UI & Data Requirements (derived from SEO-tool UX research)

**Purpose:** Translate the best-practice patterns from the SEO-tool UX research into concrete, build-ready requirements for ReachKit specifically. This is the implementation companion to the research playbook. It is scoped to ReachKit's actual model: a **single-URL, single-score, four-question engine** for **solo founders**, with a **weekly verified action queue** — not a multi-domain SEO suite.

**How to read this:** Requirements are tagged `[MUST]` / `[SHOULD]` / `[LATER]` and, where useful, `[CALC]` for data/computation logic. Hand this to Claude Code; component and table names are suggestions — map them onto the actual repo (`/app`, `/components`, Supabase schema). Where a requirement assumes a column or field, it is called out so you can reconcile with the live schema.

**The core translation principle:** Borrow the *scannability, score-as-brand, and progressive-disclosure* lessons from Ahrefs/Semrush/Surfer. Reject the *density* — the 20-module sidebar, the multi-project switcher, the data-table-first layouts. Those serve agencies and in-house SEO teams. ReachKit's user is a developer who shipped a thing and wants one number and a short list. Every requirement below is filtered through that.

---

## 0. What ReachKit already has (baseline from the live site)

Locking the vocabulary so requirements are unambiguous:

- **Discoverability Score** — 0–100, built from **18 signals** across three pillars: **Content, Outreach, SEO**. (Live site shows a sample score of 47/100 with three sub-areas.)
- **Four-question engine** = the Report: (1) **Positioning Mirror** — who the page targets vs. who you think; (2) **Search Gap Analysis** — queries you're invisible for; (3) **Ranked Action Steps**; (4) implicitly, the score itself ("how findable are you").
- **Weekly Action Engine** — paid; a prioritised queue that refreshes weekly, each action with **draft copy**, **expected score impact**, and **action verification** (re-fetches the live URL to confirm a fix before the score moves).
- **Scan** = one App Store/Play/website URL run through the 18 checks. Free = 1 scan; paid = weekly re-scan.
- Plans: Solo $59, Growth $129 (3 products, deeper rank tracking).

Everything below assumes these primitives and makes them concrete in the UI and the data layer.

---

## 1. The Score — make it the brand asset (highest-leverage work)

The single most important lesson from the research: **DR, DA, Authority Score, Content Score are referenced by people who don't even pay for those tools.** The number *is* the distribution. ReachKit's Discoverability Score must be engineered to that standard — legible, trustworthy, and shareable.

### 1.1 Score display — the gauge `[MUST]`
- Render the score as a **radial gauge (0–100)** with a single large numeral, not a progress bar. This is the hero of both the report and the dashboard.
- Always pair the number with a **qualifying band label** in plain English. Define five bands and use them everywhere the score appears:
  - 0–29 **Invisible** · 30–49 **Hard to find** · 50–69 **Fair — room to climb** · 70–84 **Findable** · 85–100 **Highly discoverable**
- Below the gauge, **three pillar sub-scores** (Content / Outreach / SEO) as mini-gauges or horizontal segmented bars, each 0–100. (The live homepage already implies this; make it real and consistent.)
- `[MUST]` Semantic color, never color-alone: band drives color (red→amber→green), but the **band label and the numeral always carry the meaning** for accessibility (WCAG AA contrast; colorblind-safe palette).

### 1.2 Score explainability `[MUST]`
The research's strongest recurring pattern: every proprietary metric carries a one-line plain-English explanation and a "what moves this" hint (Ahrefs literally prints "you'll need ~X referring domains to rank" under Keyword Difficulty). ReachKit must do the same or the score reads as arbitrary.
- A persistent **"How this is calculated"** affordance next to the gauge → opens a panel listing the 18 signals, grouped by pillar, each with: current value, pass/warn/fail state, and **weight/contribution to the score**.
- Each signal row answers three things (steal Sitebulb's "Hints" model): **what it is · why it matters · how to fix it.**
- `[CALC]` Persist per-signal contribution at scan time so the explanation is exact, not reconstructed. See §6.

### 1.3 Score delta — always show movement `[MUST]`
- Anywhere the score appears for a returning user, show **Δ vs. previous scan** (e.g. `47 ▲ +6 since last week`), colored by direction, with the prior value on hover.
- First scan: suppress the delta, show a "baseline" tag instead of a fake zero.

### 1.4 Shareable score card `[SHOULD]` → growth lever
The site already leans on "share your score" as a distribution mechanic ("Every shared score is how the next founder finds the gap"). Make the artifact first-class:
- Generate an **OG image** per scan: gauge + band + product name + top-1 fix, ReachKit-branded. This is your equivalent of the MozBar/DR-in-the-wild free-distribution play.
- `[CALC]` Render via a serverless OG route (e.g. `@vercel/og`) keyed by scan id; cache immutably.

---

## 2. The Report (post-scan) — the four-question page

This is ReachKit's equivalent of an Ahrefs "Overview." Apply the **universal page anatomy** from the research — *summary → trend/context → detail* — but compressed to one scrollable narrative, because the persona won't tab-hunt.

### 2.1 Page anatomy, top to bottom `[MUST]`
1. **Hero band:** score gauge + band + Δ + the product's resolved title/URL + "Re-scan" (paid) / "Upgrade to track weekly" (free).
2. **Three pillar sub-scores** with one-line verdicts each.
3. **Top fixes preview** — the 3 highest-impact actions as cards (free users see exactly 3, the live site's promise). Each card: title, expected `+Δ score`, effort tag (`$0 fix` / `quick` / `deep`), and a peek of the draft copy.
4. **The four questions**, each its own clearly-headed section (see 2.2–2.5).
5. **Evidence footer:** "Scanned [URL] at [timestamp] · 18 signals · view raw extraction." Reinforces the "grounded, no hallucinations" promise that differentiates you from a ChatGPT prompt.

> Anti-requirement `[MUST NOT]`: do **not** open the report on a data table. The research shows tables-first is right for agencies and wrong for a glanceable persona. Lead with the gauge and the three fixes.

### 2.2 Positioning Mirror `[MUST]`
- Visual: a **two-column "intended vs. actual"** comparison (who you think you target / who the page actually targets), with the **gap** called out as the headline.
- `[SHOULD]` Represent audience as 3–5 tags or a small **bubble/positioning plot** (audience segments by relevance) — borrow the competitor-positioning scatter idea from the research, scaled down. Don't over-build; the two-column diff is the MUST.

### 2.3 Search Gap Analysis `[MUST]`
- A **ranked table of queries you're invisible for**, columns: query · est. monthly volume · current rank/“not ranking” · opportunity tag.
- Apply the research's table best-practices even at small scale: **sortable, color-coded opportunity cells, inline volume sparkline optional**, and an **empty/low-data state** ("we couldn't find high-volume queries for this category — here's why" rather than a blank grid).
- `[CALC]` Volume + rank depth are the metered resource (Solo = 20 keyword rank-depth, Growth = 50). Enforce the quota at query time and show a "showing 20 of N — upgrade for full depth" row, which doubles as an upgrade surface.

### 2.4 Ranked Action Steps `[MUST]`
- Card list, **ordered by expected score impact descending** (the research's "lead with impact" rule).
- Each card: title · plain-English why · **expected `+Δ`** · effort tag · **draft copy block** (copy-to-clipboard) · "Mark done" (paid).
- `[CALC]` Expected Δ must be the *modelled* contribution from §6, not a guess, so that post-fix verification can reconcile predicted vs. actual movement.

### 2.5 The score breakdown (question 4, implicit) `[MUST]`
- Make "how findable are you" answerable by exposing the 18-signal breakdown from §1.2 here as an expandable section.

---

## 3. The authenticated Dashboard (paid, returning users)

Free users get the one-shot report. Paid users get a place to come back to weekly. This is where a *little* of the SEO-suite structure earns its place — but kept minimal.

### 3.1 Dashboard home `[MUST]`
- **Glanceable zone** (the research's top-row rule): current score gauge + Δ since last week + "next action" CTA. Answer "is it moving?" in one glance.
- **Score history line chart** (see §4.1) — the primary trend visual.
- **This week's queue** — the top 3–5 open actions, not the full backlog.
- For Growth (3 products): a **product switcher** (simple dropdown, not an Ahrefs-style folder tree). Each product is one row in a compact list with its score, band, and Δ. Switching context reloads the dashboard for that product. `[MUST NOT]` build multi-workspace/folder hierarchy — wrong scale for this persona.

### 3.2 Navigation `[MUST]`
- Keep it to a **slim left sidebar or even a top-nav** with ≤5 items: **Dashboard · Report · Actions · History · Settings**. The research shows suites use 5–7 modules; ReachKit should sit at the low end. Resist feature-creep into the nav.
- Global "Re-scan" always reachable.

### 3.3 The Action Engine view `[MUST]`
- The weekly queue as a **prioritised list**, grouped `Open / In progress / Verifying / Done`.
- Each action carries its **predicted Δ**; completed actions show **actual Δ** after verification (see §5).
- A **"refreshes in X days"** indicator for the weekly cadence.
- Empty state when the queue is cleared: celebratory + "next refresh" + offer to scan another product (Growth) / upgrade (Solo).

---

## 4. Charts & visualization — matched to ReachKit's data

Apply the research's **chart-type-to-data-type mapping**, but only for data ReachKit actually has. Don't add charts for decoration; the persona reads numbers, not dashboards.

### 4.1 Score history → **line/area chart** `[MUST]`
- X = scan date (weekly), Y = score 0–100. Overlay the three pillar lines as toggleable series.
- **Annotate completed actions as markers on the line** (this is ReachKit's version of Ahrefs annotating Google algorithm updates on the traffic chart) — so the user sees "this fix → this bump." Powerful retention + proof mechanic.
- `[SHOULD]` Shade band thresholds (Invisible/Fair/Findable) as faint horizontal zones so progress toward the next band is visible.

### 4.2 Pillar composition → **segmented bars**, not a pie `[MUST]`
- Show Content/Outreach/SEO contribution as horizontal segmented bars. The research is explicit: **demote pie charts in favour of bars** (length is read 3–4× faster than angle). Only use a donut if you genuinely need a part-to-whole at-a-glance and there are ≤3 segments — and even then, prefer the bar.

### 4.3 Search Gap → **ranked table with inline cues** `[MUST]`
- Table is the right visual here (volume + rank + opportunity). Add **color-coded opportunity cells** and an optional **volume sparkline/bar** per row. Sort, filter by opportunity, paginate at the quota line.

### 4.4 Signal breakdown → **pass/warn/fail list with weight bars** `[MUST]`
- Each of the 18 signals: a small horizontal bar showing its weighted contribution, colored by pass/warn/fail. This is the "gauge → explanation" drill-down layer.

### 4.5 `[MUST NOT]` ship for v1
- Network/link graphs, crawl maps, treemaps, heatmap matrices (MarketMuse-style). These are powerful in the research but solve agency-scale problems ReachKit doesn't have yet. Revisit only if Outreach/backlink data grows into a genuine graph.

---

## 5. Action verification & score reconciliation `[MUST]`

This is ReachKit's genuine differentiator (no competitor in the live comparison table has it) — engineer it rigorously.

- `[CALC]` On "Mark done," enqueue a **re-fetch of the live URL** and re-evaluate **only the signals that action targets** (store a `signal_keys[]` on each action so verification is scoped and fast).
- Compare targeted-signal state pre/post:
  - **Verified** → apply the score delta, move action to Done, stamp the history chart marker.
  - **Not detected** → keep action open, show "we couldn't find this change on your live page yet — here's what we looked for," with the exact extracted evidence. Never self-report without evidence (the live site promises this).
- `[SHOULD]` Surface **predicted Δ vs. actual Δ** on the completed card. Over time this calibrates user trust in the score and gives you an internal accuracy metric to tune §6 weights.

---

## 6. Data & calculation requirements — the Discoverability Score engine

The score must be **deterministic, persisted, and explainable**. The research's lesson is that opaque scores still work as brand — but ReachKit's "grounded in evidence, no hallucinations" positioning means yours must be *defensible* on inspection.

### 6.1 Signal model `[MUST] [CALC]`
- Maintain an explicit **signal registry** (config, not hardcoded in the LLM prompt) of the 18 signals. Each signal definition:
  - `key`, `pillar` (Content/Outreach/SEO), `weight`, `extractor` (how it's measured), `scoring_fn` (raw value → 0–1), `why`, `how_to_fix`, `draft_template`.
- Score = weighted sum, normalised to 0–100. Pillar sub-score = weighted sum within pillar, normalised.
- `[MUST]` Persist, per scan: each signal's **raw extracted value, normalised value, weight, and point contribution.** This single table powers §1.2 explainability, §4.4 the breakdown, and §5 verification. Without it, every explanation is a reconstruction and verification can't be scoped.

### 6.2 Extraction = grounded, separated from generation `[MUST]`
- **Two-stage pipeline:** (1) **deterministic extraction** of the live page (fetch, parse metadata, title, headings, schema.org/JSON-LD, word/keyword counts, alt text, category, links) — this is code, not the LLM; (2) **LLM interpretation** (Positioning Mirror, Search Gap narrative, action drafting) fed *only* the extracted evidence.
- `[MUST]` Every LLM claim must cite an extracted field (store `evidence_ref` per generated insight) so the "no hallucinations / every claim links to a real source" promise is technically enforced, not just marketing. This is also what makes the Report defensible vs. "just a ChatGPT prompt" — your #1 comparison-table differentiator.
- `[CALC]` Cache the raw fetch+extraction by URL+content-hash so a re-scan that finds no change is cheap and verification is fast.

### 6.3 Keyword / rank-depth metering `[MUST] [CALC]`
- Rank-depth is the metered resource (Solo 20 / Growth 50). Implement as a hard quota at query time with a visible "showing X of N" upgrade seam.
- `[CALC]` Volume + rank data: define the source (third-party keyword API vs. SERP fetch). Persist `fetched_at` and show **data-freshness stamps** (research best-practice: stale data must be labelled, never silently shown as current).

### 6.4 Score stability & versioning `[MUST]`
- `[CALC]` Version the signal registry (`score_version`). Store it on every scan. When weights change, **don't retroactively move historical scores** — annotate the history chart with a "scoring updated" marker (same pattern as algorithm-update annotations). Otherwise users see unexplained jumps and lose trust in the number, which is the whole product.
- `[CALC]` Same input URL + same `score_version` must produce the **same score** (determinism). Keep LLM-generated *narrative* out of the numeric score; the number comes only from deterministic signals. This is non-negotiable for verification to mean anything.

### 6.5 Platform-adaptive signal sets `[SHOULD] [CALC]`
- The live site promises the engine "adapts the signal set to the platform" (App Store/Play vs. web). Model this as **signal subsets per platform** in the registry, with per-platform weights that still normalise to 0–100, so scores are comparable in band terms across platforms even when the underlying 18 differ.

---

## 7. Cross-cutting UX requirements (from the research, ReachKit-scoped)

- **Progressive disclosure, three layers** `[MUST]`: gauge (overview) → hover/tooltip (context: prior value, what a signal means) → click (detail: full 18-signal breakdown, raw evidence). Never show all of it at once.
- **Tooltips on every metric and acronym** `[MUST]`: Discoverability Score, each pillar, each signal, "rank depth," "Δ." De-jargon for a non-SEO founder ("Invisible for this query" > "not ranking in top 100").
- **Empty / low-data states** `[MUST]`: every table and chart needs a designed empty state that explains *why* it's empty and what to do — not a blank panel. Especially Search Gap (niche products legitimately have thin data).
- **Onboarding** `[SHOULD]`: a getting-started checklist for paid users (scan → review top fix → mark one done → see score move). The "see the score move" loop is the activation moment — instrument it.
- **Color discipline** `[MUST]`: one semantic system (band-driven), reused everywhere; never decorative color; AA contrast; never color-as-sole-signal.
- **Mobile-first report** `[SHOULD]`: the free shared report will be opened on phones from social. The report (§2) must be fully legible single-column on mobile — gauge, three fixes, four questions stacked.

---

## 8. Distribution hooks to bake into the UI (from the research GTM patterns)

The research's clearest GTM lesson: **free tools + proprietary metric + content = the SEO-industry growth machine.** ReachKit's homepage already gestures at all three; wire them into the product surface:

- **Free embeddable mini-tools** `[SHOULD]`: the `/tools` page should host 2–4 single-purpose free checkers (title-tag checker, schema checker, keyword-density checker) that each expose a slice of a real signal and end with "see your full Discoverability Score →." These are linkable, rankable acquisition assets — the Ahrefs free-tool play at founder scale.
- **The score as a wild metric** `[MUST]`: the shareable score card (§1.4) is ReachKit's DR-in-the-wild. Every teardown, every shared report, every OG image carries the number and the brand.
- **Teardowns as content engine** `[SHOULD]`: the existing `/teardowns` are your content-led-growth flywheel; make "scan → public teardown" a one-click path (with consent) so user scans can become marketing content.
- **API as upsell** `[LATER]`: per the research, API access is consistently a top-tier upsell. Not for now, but reserve it as the Growth→future-tier lever.

---

## 9. Build priority (suggested sequence)

1. **§6 score engine** (signal registry, two-stage extraction, persisted per-signal contributions, versioning) — everything else renders this. `[MUST]`
2. **§1 score gauge + explainability + delta** — the brand asset. `[MUST]`
3. **§2 four-question report** with lead-with-fixes anatomy. `[MUST]`
4. **§5 action verification** loop. `[MUST]` (the differentiator)
5. **§3 dashboard + §4.1 score-history chart with action markers** — the retention loop. `[MUST]`
6. **§1.4 shareable card + §8 distribution hooks** — growth. `[SHOULD]`
7. Polish: empty states, tooltips, onboarding checklist, mobile report. `[SHOULD]`

---

## 10. Open questions to resolve against the actual repo/schema

These need reconciliation with the real codebase (which I couldn't read in this session — pick them up in Claude Code where the repo is mounted):

1. **Are the 18 signals already a config/registry, or are they embedded in an LLM prompt?** §6.1 assumes a registry; if they're prompt-embedded, refactoring to config is the precondition for explainability, verification, and versioning.
2. **Is per-signal contribution currently persisted per scan?** If not, this is the first schema change — add a `scan_signals` table (`scan_id, signal_key, raw_value, normalised, weight, contribution, state`).
3. **Is the numeric score currently LLM-generated or deterministic?** If the LLM is producing the number, §6.4 (determinism) is a required change — move the number to code, keep the LLM for narrative only.
4. **Does the schema already store score history + a `score_version`?** Needed for §4.1 and §6.4.
5. **How is rank/volume data sourced today**, and is freshness stamped? (§6.3)
6. **Existing component library** (shadcn/Base UI per your locked stack) — confirm the gauge/chart primitives so §1 and §4 reuse them rather than introducing a new chart dep. Recharts or visx are both fine within the stack; pick one and standardise.

---

*Companion to the SEO-tool UX research playbook. Scoped to ReachKit's single-URL, single-score, founder-facing model — deliberately rejecting agency-scale density in favour of one legible number and a short, verified weekly list.*
