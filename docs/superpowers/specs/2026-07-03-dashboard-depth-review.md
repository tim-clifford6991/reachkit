# Dashboard depth review — UI vs. data structure, with recommendations

**Date:** 2026-07-03 · **Scope:** the 1:1 dashboard shipped in PR #9 (Dashboard · Audience · Plan · Progress), reviewed against what the data layer actually holds.

## The headline finding

**The client payloads already carry most of the drill-down data the UI drops on the floor.** Referrer URLs, community thread URLs+titles, per-keyword competitor ranking URLs, content briefs and ready-to-use agent prompts — all of it reaches the browser today and is rendered as flat text or not at all. Most recommendations below are therefore *UI-only* changes (hours, not days); the few that need backend work are small and named.

Verified payload inventory (file: `components/app/intel/*-view.tsx` interfaces, confirmed against `lib/scan/*` + `lib/db/types.ts`):

| Data | Where it already is | What the UI shows today |
|---|---|---|
| Referrer `{host, category, url}` (gatherer also has `anchor`, `target`) | `Supply.funnel.competitors[].backlinks.topQualityReferrers` | host name as plain text |
| Community threads `{title, url, intent, publishedAt, theme}` | `Demand.community.pockets[].topThreads` | subreddit pill only (Customers view) |
| Per-keyword rivals `{domain, position, url}` | `Supply.keywords.gaps[].competitors` | count ("3 rank it") |
| Competitor pages `{url, title, contentType, cluster, keywordCount, etv, wordCount}` | `Supply.content.entities[].pages` | top-3 paths as plain text |
| Content brief + **agent prompt** + exemplars `{domain, url, position}` | `Synthesis.contentPlan[]` (`brief`, `agentPrompt`, `competitorExemplars`) | not surfaced |
| Distribution `targetUrl`, `evidence` | `Synthesis.distributionPlan[]` | partially (target name, no link/evidence) |
| Pillar breakdown per snapshot | `score_snapshots.breakdown` (jsonb, in DB) | **not selected** — history reads `taken_at, total` only |
| Per-scan 18-signal states | `scan_signals` table | not used by Progress |

---

## 1. Referrers / pages / keywords — deep drill-down (Audience · Competitors)

**Today:** the edge panel lists 3 referrer hosts, 3 page paths, 3 keywords as plain text.

**Recommend:**
- **R1. Link every referrer** — `topQualityReferrers[].url` is in the payload. Render host as an external link to the exact referring page, with the `category` as a Badge (marketplace/community/newsletter…). *Widen the client interface + API passthrough to include `anchor` and `target`* (they exist in `ReferralBreakdown`, `lib/scan/referral/funnel.ts`) → show the anchor text ("what they call you") and deep-link `target` (the page on the rival that earns the link). Effort: S (type widening + UI).
- **R2. Pages drill-down** — `ContentIntel.entities[].pages` carries url/title/cluster/etv/wordCount. Replace the 3 plain paths with linked titles + `etv` (est. traffic) + cluster chip; add a "all N pages" `Expand` (kit has `Expand`) grouped by cluster — this is the "what content actually powers them" view. Effort: S–M.
- **R3. Keyword rows expand** — each `Gap` has `competitors[{domain, position, url}]`. Make keyword-gap rows expandable: who ranks, at what position, linking to the exact winning URL (the page to study/outrank). Same treatment on the Dashboard keyword-gap preview. Effort: S.
- **R4. Referrer overlap → move** — `channelsMissing[{host, type, action, competitorsUsing}]` already computes "N rivals are on host X, you aren't." Surface it in the edge panel as the concrete move under "their edge → your move" instead of prose. Effort: S.

## 2. "Where they hang out" → threads (Audience · Customers)

**Today:** subreddit pills. **This is a regression** — the old `demand-view.tsx` `WhereBuyersAsk` already rendered theme-tabbed pockets with linked threads and freshness; the new Customers view uses none of `topThreads`.

**Recommend:**
- **C1. Port `WhereBuyersAsk` into Customers** (it's sitting in `demand-view.tsx`, working): per-surface cards, theme filter tabs, each thread as an external link with title + relative date + intent. Effort: S (mostly a move).
- **C2. Thread → plan linkage** — each thread has `theme`; distribution plan items carry `evidence`. Cross-link: a thread card shows "in your plan →" when a distribution item targets that surface (match on `target`/`surface`). Effort: M.

## 3. Deep-linking everywhere (cross-cutting)

**Recommend one rule:** *any domain, page, thread, or keyword-winning URL the payload knows is rendered as a link to the exact URL, never a name.* The kit already has `EvidenceLink` for exactly this — it's used in older views and unused in the new ones. Applies to: referrers (R1), pages (R2), keyword winners (R3), distribution `targetUrl`, content `competitorExemplars[].url` ("see the page that ranks #2 for this"), buyer-insight `sources`. Effort: S per view.

## 4. Direct actions from the plan (Plan · Content / Distribution)

**Today:** plan views are read-only synthesis. But the pieces for action already exist:
- `Content.brief` and `Content.agentPrompt` are **in the payload** — a ready-to-paste prompt for drafting the piece.
- An actions API surface exists (`app/api/action/[id]/complete`) and the actions system has drafts, status, verify (`actions` table, `lib/scan/action-board.ts` with `predictedDelta`/`actualDelta`).
- Kit has `CopyButton`, `ActionButton`.
- The DS template's keyword table spec'd `inPlan` / `canAdd` chips — the add-to-plan affordance is part of the target design.

**Recommend:**
- **P1. Zero-backend actions now:** on each content card — "View brief" (Expand) + "Copy agent prompt" (CopyButton); on each distribution card — link `targetUrl` + show `evidence` via EvidenceLink. Effort: S. **Highest value-per-effort in this review** — it turns the plan from a report into a to-do you can execute immediately.
- **P2. "Add to plan" (small backend):** `POST /api/action` creating an `actions` row from a plan item (title/category/why/expected_outcome from the item; `signal_keys` from its pillar). Wire the chip on plan cards AND keyword-gap rows (`canAdd`/`inPlan` from the template). The weekly board then tracks it through done→verify with real predicted/actual deltas. Effort: M.
- **P3. Status round-trip:** plan cards show the linked action's status (`open/done/verifying`) + verified delta once measured — closing the loop the template's `a.statusLabel`/`a.actual` design implies. Effort: M (join plan items ↔ actions by provenance).
- **P4. Plan progress strip:** template's `actDone/actTotal/actPct` header. Data = `actions` counts. Effort: S.

## 5. Progress — tracking and display

**Today:** total-score line + verified-fix markers + what-changed (markers + market alerts — the page already computes `computeMarketAlerts`, good).

**Recommend:**
- **G1. Pillar series overlay** — the template's `pillarSeries` (SEO/Content/Outreach lines) is designed-in and the data exists: `score_snapshots.breakdown` jsonb. One-line change to the select in `lib/scan/engagement.ts` (`taken_at, total` → `+ breakdown`) + three thin lines on the chart. *This is the single most template-visible gap in Progress.* Effort: S.
- **G2. Signal-level "why it moved"** — diff `scan_signals` between consecutive scans: "meta descriptions fail→pass (+2.1)". Renders under each marker as the concrete cause. Effort: M (new small server read + UI).
- **G3. Event → plan deep-link** — markers already join `actions(title)`; carry the action id and link each what-changed row to the plan/action. Effort: S.
- **G4. Band-zone shading** on the chart from `SCORE_BANDS` (the report's recharts version has it; the kit-idiom SVG should too — the fixture already shows a light version, keep/refine). Effort: S.

## 6. Additional findings (beyond the ask)

- **A1. Channel drill-down (Dashboard):** the template's donut has a selected-channel panel (`chanSelList` — top referrers or landing pages for the picked channel + a per-channel plan link). Data: `TrafficLens.sources` + `topQualityReferrers` filtered by category + `channelsMissing`. Today the donut is static. Effort: M.
- **A2. Two band scales coexist** — `lib/scan/score-bands.ts` (5 bands: 0/30/50/70/85) vs `components/app/intel/bands.ts` (85/65/45/25). Same score can label differently across surfaces. Pick one (recommend `score-bands.ts` as canonical, re-export for the kit). Effort: S, correctness issue.
- **A3. Demand intel is cache-only** — ICP/themes/buyer insights live in a 7-day JSON cache; only `demand_pocket` is a table. Cache expiry = silent re-gather cost and no history. Recommend persisting the `DemandIntel` core to structured tables (schema exists as a pattern). Effort: M–L, reliability.
- **A4. `paid_keywords` is a hardcoded 0** (`funnel.ts`) — fine while the donut uses shares, but any future "paid" KPI would lie. Track as debt.
- **A5. Token hygiene:** hardcoded hex in `dashboard-hero.tsx` (delta `#1f9d5b`/`#e5484d`) and `synthesis-view.tsx` (`PRIO_COLOR`/`KIND_COLOR`) — swap for `--c-band-*` tokens. Effort: XS.
- **A6. Dashboard "Referring domains" KPI** was in the template + PR #7 but the current dashboard shows Est. visits + Share of voice; re-add referring domains (`mix.referringDomains` in payload). Effort: XS.

## Suggested sequencing

| Wave | Items | Effort | Why first |
|---|---|---|---|
| 1 (UI-only, payload-ready) | P1, C1, R1–R3, 3 (link rule), G1, G3, A5, A6 | ~1 day | All data in hand; transforms perceived depth immediately |
| 2 (small backend) | P2, P4, R4, G4, A2 | ~1–2 days | Add-to-plan + consistency |
| 3 (deeper) | P3, G2, C2, A1, A3 | ~2–3 days | Round-trips + drill-downs needing joins/persistence |

Every Wave-1 item is independently shippable and verifiable via the existing fixture routes.
