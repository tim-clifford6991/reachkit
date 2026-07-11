# WS1 — Competitors page redesign (browsing-first, honest referrer reach, husk/noise filtering)

**Date:** 2026-07-11 · **Status:** approved design, pre-plan · **Workstream:** 1 of 6 (paid-app value round)

## Context

The paid Competitors page (`app/(app)/app/audience/competitors/page.tsx` → `components/app/intel/competitors-view.tsx`) shows, per competitor, top referrers / top pages / top keywords / "their edge → your move". User feedback (2026-07-11): the data is useful but the presentation under-delivers — referrers eat huge vertical space (3 lines each), there's no sense of how valuable each referral platform is, ambiguous/illogical referrers slip through, some links 404 (a `producthunt.com` referrer whose link opens the competitor's *own* dead `fellow.ai/blog/…` page), and the whole surface should feel like a **browsing tool** for "how rivals get found and where their traffic comes from". It also renders a second left rail next to the app nav — two-rails awkwardness.

This spec covers only WS1. WS2–WS6 are separate specs.

## Goals

1. Collapse each referrer from 3 lines to **one dense, scannable row**; show far more referrers at once.
2. Give each referrer an **honest "platform reach"** signal so the user can gauge how valuable each platform is.
3. **Filter** ambiguous/illogical referrers (hide clear noise, flag borderline) and make "referrers to pursue" logical.
4. Fix the **404-on-click** problem structurally.
5. Reorganise into a **browsing-first, single-nav** layout that highlights where the user is *absent*.

## Non-goals / out of scope

- Measured referral click-through (see Data reality). Reddit/forum engagement counts (WS2 territory, and unavailable from current sources).
- Live HTTP liveness-probing of backlink targets (explicitly deferred — see Husk decision).
- Any change to competitor *discovery/selection* (`CompetitorSetup`, `MAX_SELECTED`) or the scan pipeline's cost/scoring invariants.

## Data reality (the honesty constraints — CLAUDE.md "degrade, never invent")

Verified against the funnel code (`lib/scan/referral/*`, `lib/scan/adapters/dataforseo-*`):

- **Per-referrer traffic:** NOT available as measured click-through. `backlinks/live` gives `url_from`, `url_to`, `anchor`, `domain_from_rank` (authority), `dofollow` only. The obtainable proxy is the **referrer host's own organic ETV** via `fetchTrafficForHosts` (`bulk_traffic_estimation`, ≤1000 hosts/call) — today computed for missing-channel ranking then discarded. We surface this as **"platform reach"** (how big/busy that venue is), explicitly not "traffic they send".
- **Source + target URLs:** both captured (`QualityReferrer.url` = source, `.target` = target). Enough to link to the source and never 404 on click.
- **Existing filtering:** `isNoiseHost` (ubiquitous / generic-authority / spam / customer-embed / exclude-cohort) + LLM `classify-referrers` into `ReferrerCategory` with `QUALITY_CATEGORIES` vs `LOW_VALUE_CATEGORIES`. No target-liveness or relevance-to-subject pruning today.

## Design

### Layout (rebuild of `CompetitorsView`)

Single app nav (240px, `app-shell.tsx`) + one full-width content column. The current in-content competitor rail is **removed**. Content, top to bottom:

1. **Gap-map matrix** (~5 rows) — channels down, `you + rivals` across, colour = strength; **red = you're absent where a rival is strong**. The matrix column headers **are the competitor selector** — clicking a column focuses that entity (no separate switcher, no second rail). Compact so the detail stays the star.
2. **Focused detail** (full width, for the selected column):
   - 4-stat strip (visits/mo, referring domains, keywords, branded search — all already on the entity).
   - **Referrer table** (the hero) — see below.
   - **Referrers to pursue** (your gaps) + **Their edge → your move** (tightened; keep the existing `channelsMissing`/`edgeText` logic but shorter).
   - **Top pages** and **Top keyword gaps** — kept, tightened (existing `PagesEdgeList` / `KeywordGapRow`).

### Gap-map matrix — data

No new fetch. Roll the 11 `ReferrerCategory` values into **~5 channel groups**: `launch` · `review` · `community` · `directory` · `media/partner`. For each (entity, group), strength = normalised quality-referrer reach in that group (bucketed hi/med/lo/absent). The `you` column uses the subject's own breakdown. Emitted from `funnel.ts` alongside the existing per-entity data as a `channelStrength` map. "Red/absent" cells are the honest "you're not here" signal that makes the page decision-useful.

### Referrer table — the hero

- **Row (one line):** host (link → **source** `url_from`) · reach bar · **est. platform reach** (with info-tip: "that platform's own traffic — how big the venue is, not measured click-through to this rival") · category pill · live/husk dot.
- **Expand on click:** source URL, target URL, anchor text, dofollow, authority (`domain_from_rank`).
- **Controls:** sort by reach (default) · filter by category · 30+ rows visible (was ~25 at 3 lines each).
- **New data:** attach `etv` to `QualityReferrer`, sourced from `fetchTrafficForHosts` over the referrer hosts. **One bulk call covers all competitors' referrers.** It is a metered DataForSEO call → it MUST run inside the existing `costedIntelStep` cost context so it attributes to the scan row and respects the soft cap (invariant #2). When the reach call is unavailable/capped, degrade to the bar-less list (host + category + health) — never invent a number.

### Husk / 404 handling — DECISION: link-to-source, no liveness probe

The 404-on-click is fixed structurally: the row's primary link targets the **source** page (`url_from`, where the backlink actually lives), so a click always lands somewhere real. We do **not** add an HTTP liveness probe on targets this round (deferred; would add latency and complexity for a marginal "stale backlink" signal). No husk-specific flag ships in WS1 beyond what link-to-source already solves.

### Filtering — DECISION: hide clear noise, flag borderline

- Clear spam/aggregators: dropped silently by the existing `isNoiseHost` rules (unchanged).
- **Borderline-relevance** referrers (pass the noise gate but weak category/subject fit): **shown, muted, tagged "low relevance"** — never silently dropped (matches the always-surface ethos of the don't-cache-empties / floor invariants).
- **Referrers to pursue**: the gap list is noise-filtered AND category-relevant to the subject (not just "any host a rival has that you don't").

## Data-model changes

- `QualityReferrer`: add `etv?: number` (platform reach) and `relevance?: "core" | "low"` (borderline flag).
- Funnel payload: add `channelStrength: Record<entityId, Record<ChannelGroup, "hi"|"med"|"lo"|"absent">>` (or equivalent) for the matrix.
- All additive + null-coalesced on read (older `report_payload`/funnel-cache blobs predate these fields — `?? []` / `?? undefined`).

## Components / files (indicative — plan will finalise)

- `components/app/intel/competitors-view.tsx` — rebuild around matrix-selector + full-width detail.
- New: gap-map matrix component + compact `ReferrerRow` (compose from intel `kit.tsx` — `Card`, `Badge`, `Bar`, `EvidenceLink`, `info-tip`; no new atom unless unavoidable).
- `lib/scan/referral/funnel.ts` + `intel.ts` — attach `etv` to referrers (reuse `fetchTrafficForHosts`), emit `channelStrength`, keep it inside the cost context.
- `lib/scan/referral/classify.ts` — borderline "low relevance" tagging.
- Claude Design: mirror the changed live components into `.design-sync/ds-src/` + `INVENTORY.md`, re-bless (`@mirrors`, coverage, freshness) in the same change (CLAUDE.md Change Protocol / design parity).

## Cost & invariants to respect

- The new reach call runs under `costedIntelStep` (invariant #2 soft cap; guard `app/api/costed-routes.test.ts`). Degrade on cap breach.
- Brand-ambiguity (invariant #6): the gap-map + pursue list are built only from the category-validated cohort, never from raw "alternatives".
- Bundle: the audience pages are already in `KNOWN_OVERAGES_KB`; net code should not grow the overage (prefer composition, lazy-load heavy bits). Do not add a new baseline entry.
- Live-test with `REACHKIT_USE_FIXTURES=false` and RENDER the page (headless) before trusting — fixtures mask real adapter/LLM behaviour (CLAUDE.md hard rule).

## Testing / verification

- Unit: channel-group rollup mapping (11→5) is total and deterministic; borderline-tag logic; `etv` degrade path (no call → no invented number).
- Guard: reach call is inside a cost context (extend/spot-check `costed-routes` expectations if a new caller file appears).
- Live: scan a real SaaS with a rich backlink profile (e.g. a note-taking rival set), render `/app/audience/competitors`, confirm: one-line rows, reach numbers present + honestly labelled, matrix red cells where subject absent, no 404 on referrer click, borderline items muted-not-missing.

## Success criteria

Referrers are one line with a reach signal and >30 visible; the matrix makes "where am I absent" obvious at a glance and drives selection; no referrer click 404s; ambiguous referrers are either muted-tagged or (for clear spam) gone; only one left nav; all gates green (`pnpm test && pnpm check:arch && pnpm check:design && pnpm lint`) and cost stays attributed + capped.
