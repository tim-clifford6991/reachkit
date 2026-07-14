# WS4 — Dashboard + Progress (honest Outreach framing, half-width trend, complementary Progress)

**Date:** 2026-07-14 · **Status:** design approved (audit + direction, 2026-07-14) · **Workstream:** 4 of 6

## Context

The paid Dashboard (`app/(app)/app/dashboard/page.tsx` → `components/app/intel/dashboard-hero.tsx`) is the founder's home: the unified Discoverability Score gauge, the pillar breakdown, the biggest-lever callout, Market Position, and a full-width "Discoverability over time" trend. The separate Progress page (`app/(app)/app/progress/page.tsx` → `components/app/intel/progress-view.tsx`) shows a *large* annotated trend, a "Why it moved" signal diff, and a "What changed" changelog.

User feedback (2026-07-11): the dashboard **Outreach** pillar reads as "not measured" (confusing — it looks like a broken/unassessed on-page pillar); the discoverability-over-time chart should be **half-width**; and **Progress might be redundant** with the dashboard.

**Audit finding (2026-07-14):** Progress is NOT redundant. The overlap is narrow — only the trend chart is duplicated (dashboard has a small inline one, Progress a large annotated one). Progress's **"Why it moved"** (signal-level diff between the two most recent scans) and **"What changed"** (verified-fix + market-alert changelog) are unique and valuable — they explain *why* the score moved, which the dashboard never does. **Decision: keep Progress; make the two pages complementary** (dashboard = the *now* snapshot; Progress = the *over-time* story).

## Root cause of the "Outreach not measured" confusion

The unified Discoverability Score's on-page driver decomposes into pillar bars (`pillarRollupFromRegistry`). **Outreach has no on-site signal** — its strength is measured off-site as the separate **Market Position** grade (already shown prominently in the hero, `dashboard-hero.tsx:77-89`). So rendering Outreach as an on-page pillar bar that says *"not measured yet"* (`dashboard-hero.tsx:101`) reads as broken, when it's actually *measured elsewhere by design*. This is invariant #1's separation (on-page headline vs off-site `marketPositionScore`) leaking a confusing UI state.

## Goals

1. **Honest Outreach framing** on the dashboard — the Outreach pillar no longer reads as an unmeasured/weak on-page bar; it points to where it IS measured (Market Position).
2. **Half-width trend** on the dashboard, with a compact "full history →" link to Progress.
3. **Progress kept and clarified** as the complementary over-time page (optional nav relabel so its distinct purpose is obvious).

## Design

### 1. Dashboard — Outreach → Market Position framing (`dashboard-hero.tsx`)

The pillar rows (`dashboard-hero.tsx:92-104`) render every pillar in `rollup.pillars`, including Outreach. Outreach's off-site nature means its on-page bar is always empty ("not measured yet"). Fix: the Outreach pillar row, when unassessed, renders an **explicit off-site pointer** instead of the generic "not measured yet" — e.g. *"measured off-site → Market Position"* (a small inline link/anchor to the Market Position block, styled as intentional, not a gap). Other unassessed pillars (which genuinely await a scan) keep "not measured yet".

- The distinction is **pillar identity**, not just assessed-state: Outreach is *by design* off-site; SEO/Content are on-site-but-not-yet-scanned. The row must tell them apart (the pillar key/label already carries this — Outreach is the off-site one).
- No score-model change: the pillar rollup, the headline, and Market Position are all unchanged (invariant #1 untouched). This is a **render-only** reframe of one pillar's empty state.

### 2. Dashboard — half-width trend + link to Progress (`dashboard-hero.tsx:113-116`)

The full-width "Discoverability over time" Card becomes **half-width**, in a two-column row (`display:grid; gridTemplateColumns: repeat(2, minmax(0,1fr))` collapsing to 1 column on narrow screens via `minmax`/`auto-fit`). The trend keeps the small inline `ScoreTrend`. The card gains a **"Full history →"** link to `/app/progress` (the annotated trend + why-it-moved + changelog live there).

**The other half** of the row is a compact **"What's changed lately"** recap: the top 2-3 most-recent changelog events (verified fixes / market alerts — the same `scoreHistoryMarkers` + market-alert source Progress uses), each a one-line row, with a "See all →" link to Progress. This reinforces the complementary relationship and fills the half honestly (it degrades to a friendly zero-state when there's no history yet). The dashboard page already loads `markers` (`scoreHistoryMarkers`) — this recap reuses that read plus (optionally) the same two-snapshot market-alert read Progress does; no new heavy work, all cheap Supabase reads under the existing `resolveIntelContext` pattern.

> **Decision point for spec review:** the "other half" = a compact recent-changes recap (recommended, reinforces complementarity) vs. simply constraining the trend to half-width with the right half empty/reserved. Rec: the recap.

### 3. Progress — keep, clarify (`app-shell.tsx:37`, `progress-view.tsx`)

Keep Progress as-is functionally (annotated trend + "Why it moved" + "What changed"). **Optional relabel** the nav entry (`app-shell.tsx:37`) from "Progress" to **"History"** (or "Timeline") so its purpose vs. the dashboard is self-evident; `plan-timeline-view.tsx` already calls it the "Progress timeline". Keep the route `/app/progress` (no redirect churn); relabel is display-only.

> **Decision point for spec review:** relabel nav "Progress" → "History" (rec: yes, clearer) vs. leave "Progress".

## Data / model changes

- **None to the score model.** Invariant #1 (unified Discoverability Score, on-page driver, Market Position separation) is untouched — this is a render/IA change. No migration.
- The dashboard's "what's changed lately" recap reuses `scoreHistoryMarkers(appId)` (already loaded) + optionally the two-row `market_snapshots` read Progress does (cheap, additive, null-coalesced).

## Files (indicative — plan finalises)

- `components/app/intel/dashboard-hero.tsx` — Outreach pillar row reframe; trend → half-width two-column row + "Full history →" link; the compact recent-changes recap component.
- `app/(app)/app/dashboard/page.tsx` — pass the recap's data (markers already loaded; add the market-snapshot read if the recap uses alerts).
- `components/app/captured/app-shell.tsx` — optional nav relabel.
- Claude Design: mirror the changed dashboard hero into `.design-sync/ds-src/` + `INVENTORY.md`; `check:design` 0-STALE + re-bless (Change Protocol).

## Cost & invariants

- **Invariant #1 untouched** — no change to `discoverabilityScore`, `headlineScore`, `pillarRollupFromRegistry`, or `marketPositionScore`. Render-only. (Guard tests stay green unchanged.)
- No new external spend (dashboard reads are cheap Supabase selects under `resolveIntelContext`; no gather).
- Tokens only (`--c-*`); additive/null-coalesced reads; the recap degrades to a zero-state when history is empty.
- Bundle: the dashboard page is pinned in `KNOWN_OVERAGES_KB` (283) — the reframe + recap must not grow it past the pin (it's a small render change; WeekPlanPreview is already deferred, so plan-schedule isn't in first-load). Verify via CI build.
- Live-test with `REACHKIT_USE_FIXTURES=false` by RENDERING `/app/dashboard` and `/app/progress`.

## Testing / verification

- The dashboard hero is a pure-ish render component — assert (where testable) that the Outreach pillar row renders the off-site pointer (not "not measured yet") and other unassessed pillars keep "not measured yet".
- The recent-changes recap: unit the "top N events, newest first, zero-state when empty" selection if it's a pure helper.
- Live (fixtures=false): scan an app, open `/app/dashboard` — Outreach reads as Market-Position-measured (not a broken bar); the trend is half-width beside the recap; "Full history →" and "See all →" reach `/app/progress`; Progress still shows the annotated trend + why-it-moved + changelog.

## Success criteria

The dashboard reads honestly and lean: Outreach no longer looks unmeasured (it points to Market Position); the trend is half-width beside a compact recent-changes recap; both link to Progress. Progress remains the dedicated over-time deep-dive, clearly distinct (relabelled). No score-model change; all gates green; bundle under pin.

## Out of scope

- Any change to the score model, pillar weights, or Market Position computation (invariant #1).
- The `audienceProxy` always-0 gap (separate known risk).
- Folding/removing Progress (audit showed it's not redundant).
