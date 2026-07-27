# Mobile & UI enhancements — design spec

**Date:** 2026-07-27
**Status:** approved (design), ready for implementation

Seven scoped UI/mobile fixes across the authenticated `/app` surfaces and the
public marketing chrome. Each is grounded to exact files, respects the
inline-style/mobile rules in `CLAUDE.md`, and keeps every design-synced
component's `ds-src` mirror in sync in the same change.

## Owner requests (verbatim)

1. Mobile Calendar is single scroll and tough to get a complete overview.
2. Similarly today's action is a single scroll and tough to get a complete overview.
3. For mobile and all app types — the user's app listed in the side panel must contain the user's logo.
4. Mobile Competitors page has multiple overlapping components blocking text and content — unreadable.
5. Customer "where they hang out" component should be at the top of the screen, currently it feels lost.
6. In the public pages, when the user is authenticated, they still see "login" when they should rather see "dashboard".
7. Dashboard You vs. top competitors — this component should be raised up, for all device types, to below the discoverability score.

## Clarifications recorded

- **#1/#2 approach:** Compact **dot-calendar** (keep the 7-col month grid on mobile,
  swap text chips for kind-keyed dots so the month fits one screen) + **collapsible
  Today** (headline entries always, extras behind "show N more").
- **#5 target:** the card **literally titled "Where they hang out"** (the intent/recency
  map + buyer thread feed), moved to be the first section (above "Who your buyer is").

## Per-item design

### #1 + #2 — Plan mobile overview
- **Live:** `components/app/intel/plan-timeline-view.tsx` — `CAL_CSS` (`@media max-width:640px`)
  and the "Today's actions" `<section>` (list at the `[...headlineEntries, ...extraEntries]` map).
- Calendar: keep `display:grid; 7 cols` on mobile; render a `rk-cal-dots` row (kind-keyed
  colored dots, capped) that is shown on mobile and hidden on desktop, and hide the text
  chips (`rk-cal-chips`) on mobile — **all display toggles live in the scoped `<style>`**, never
  inline, so the media query wins. Tapping a day scrolls its action panel into view.
- Today: render `headlineEntries` always; `extraEntries` behind a `showAll` toggle
  ("show N more" / "show less").
- **Mirror:** `.design-sync/ds-src/PlanScreen.tsx`. **Gates:** `test:mobile` 390/360, `check:design`.

### #3 — Real app logo in sidebar switcher
- Data already exists: `apps.store_url` → `brandFromUrl(store_url).logoUrl` (`lib/brand/logo.ts`,
  Google favicon service). No schema/pipeline change.
- **Live:** `lib/app/active-app.ts` (return `store_url`/logo in `userApps` + `SwitcherApp`),
  `app/(app)/app/layout.tsx` (thread domain → `AppShell`), `components/app/captured/app-shell.tsx`
  (thread prop), `components/app/captured/app-switcher-menu.tsx` (render `<img>` in the 28×28
  square, **letter square as fallback** on error/empty).
- **Mirror:** `.design-sync/ds-src/AppShell.tsx`. **Gate:** `check:design`.

### #4 — Competitors mobile overlap
- Root cause: `components/app/intel/referrer-row.tsx` fixed inline grid
  (`1fr 84px 64px 16px`) with `whiteSpace:nowrap` badges overflowing the bar column.
- Fix intrinsically (inline only — media queries can't touch inline grid): host `EvidenceLink`
  gets `overflow:hidden; textOverflow:ellipsis; whiteSpace:nowrap`; badge container gets
  `flexWrap:wrap` + `minWidth:0`; verify computed geometry at 360px.
- **Mirror:** `.design-sync/ds-src/ReferrerRow.tsx`. **Gate:** `test:mobile`.

### #5 — Customers "Where they hang out" to top
- **Live:** `components/app/intel/customers-view.tsx` — move the "Where they hang out" Card
  above "Who your buyer is". Order: Where they hang out → Who your buyer is → Communities to engage.
- Same labels → label-drift safe. **Mirror:** `.design-sync/ds-src/CustomersScreen.tsx`.

### #6 — Authed → "Dashboard" everywhere (class fix)
- Desktop header already correct (`marketing-nav.tsx`). Remaining surfaces:
  - `components/sections/mobile-menu.tsx` — accept `isLoggedIn`, conditional Dashboard/Login;
    threaded from `components/sections/marketing-nav.tsx`.
  - Footers `app/(marketing)/layout.tsx` + `components/sections/site-chrome.tsx` — auth-aware
    login link via the same `Suspense` island pattern the nav uses (no static-prerender block).
- **Mirror:** `Footer` / `NavBar` if their rendered labels change.

### #7 — Dashboard competitors below score
- **Live:** `app/(app)/app/dashboard/page.tsx` — move `<DashboardIntelBlocks />` to render
  between `<DashboardHero>` and `<WhatToRankFor>`, all viewports. Streamed client card
  (skeletons-in below the hero). Page is not mirrored → no `check:design` impact.

## Non-goals / out of scope
- No score/scoring changes, no cost-bearing calls added, no data-contract or schema changes.
- No new favicon capture in the scan pipeline (derive at render, as elsewhere).

## Acceptance
- `pnpm test` green; `pnpm test:mobile` green at 390 + 360 (Competitors + Plan especially);
  `pnpm check:design` green (mirrors updated + re-blessed); `pnpm check:arch` green.
- Manual: authed user sees "Dashboard" on mobile menu + footer; sidebar shows real favicons;
  Plan calendar fits one mobile screen with tappable days; Customers "Where they hang out" first;
  dashboard competitors card directly under the score.
