# WS4 — Dashboard + Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard read honestly and lean — Outreach points to Market Position (not a broken "not measured" bar), the trend is half-width beside a compact recent-changes recap — and keep Progress as the complementary over-time page (relabelled "History").

**Architecture:** Pure render/IA change — NO score-model change (invariant #1 untouched). Extract the changelog-event builder Progress already uses into a shared pure helper, reuse it for a small dashboard recap, reframe one pillar row, restructure one layout row, relabel one nav entry.

**Tech Stack:** Next.js 16 App Router (RSC), the `@/components/app/intel/kit` `--c-*` kit, tokens-only styling, vitest.

## Global Constraints

- **Invariant #1 is untouched.** No change to `discoverabilityScore`, `headlineScore`, `pillarRollupFromRegistry`, `marketPositionScore`, pillar weights, or `SCORE_BANDS`. This is render/IA only. The existing guard tests (`registry-score.test.ts`, `documented-invariants.test.ts`) must stay green with no edits.
- **Tokens only** — semantic `--c-*` / kit components. Never raw hex or arbitrary Tailwind values.
- **Additive + null-coalesced** — every new read `?? []` / `?? null`; the recap degrades to a friendly zero-state when there's no history.
- **No new external spend** — dashboard reads are cheap Supabase selects under `resolveIntelContext`; no gather.
- **Bundle** — `/app/dashboard/page` is pinned at 283 KB in `KNOWN_OVERAGES_KB` (`scripts/check-bundle.mjs`); this change must NOT grow it past 283. It's a small render change and WeekPlanPreview is already deferred (so `plan-schedule` isn't in first-load). Verify via CI build.
- **Live-test** `REACHKIT_USE_FIXTURES=false` by RENDERING `/app/dashboard` + `/app/progress`.
- **Claude Design** — the dashboard hero has a DS mirror; reconcile it + `INVENTORY.md` in the same branch, `check:design` 0-STALE, `pnpm bless:design`.

---

### Task 1: Extract the shared changelog-event builder (DRY, no behavior change)

Progress builds its "What changed" events inline in `app/(app)/app/progress/page.tsx` (`eventsFromMarkers` + a market-alert push from two `market_snapshots`). The dashboard recap needs the SAME events. Extract the pure builder so both pages produce identical events.

**Files:**
- Create: `lib/scan/progress-events.ts`
- Test: `lib/scan/progress-events.test.ts`
- Modify: `app/(app)/app/progress/page.tsx` (replace inline logic with the import — no behavior change)

**Interfaces:**
- Consumes: `ScoreHistoryPoint` (`lib/scan/engagement`), `HistoryMarker` (`lib/scan/score-history-markers`), `computeMarketAlerts` (`lib/scan/market`), the `ProgressEvent` type (currently exported from `components/app/intel/progress-view`).
- Produces:
  - `buildProgressEvents(args: { history: ScoreHistoryPoint[]; markers: HistoryMarker[]; marketSnapshots: { taken_at: string; summary: unknown }[] }): ProgressEvent[]` — verified-fix events (each with score delta vs prior point + `href: "/app/plan"`) PLUS week-over-week market alerts when exactly two snapshots exist, sorted newest-first. PURE.
  - Re-export or move the `ProgressEvent` type so both the page and `progress-view` import it from one place (keep `progress-view`'s export working — re-export from there to avoid a breaking import churn).

- [ ] **Step 1: Write the failing test**

```ts
// lib/scan/progress-events.test.ts
import { describe, expect, test } from "vitest";
import { buildProgressEvents } from "./progress-events";

const history = [
  { takenAt: "2026-07-01", total: 40 },
  { takenAt: "2026-07-08", total: 44 },
] as any;
const markers = [{ takenAt: "2026-07-08", label: "Fixed meta description", category: "seo" }] as any;

describe("buildProgressEvents", () => {
  test("a verified-fix marker becomes an event with the score delta and a plan href", () => {
    const events = buildProgressEvents({ history, markers, marketSnapshots: [] });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ label: "Fixed meta description", date: "2026-07-08", delta: 4, href: "/app/plan" });
  });

  test("no market alerts unless exactly two snapshots exist; newest-first ordering", () => {
    const two = [
      { taken_at: "2026-07-08", summary: {} },
      { taken_at: "2026-07-01", summary: {} },
    ];
    const events = buildProgressEvents({ history, markers, marketSnapshots: two });
    // fix event + any alerts, sorted date-desc (no throw on empty summaries)
    expect(events[0]!.date >= events[events.length - 1]!.date).toBe(true);
    expect(buildProgressEvents({ history, markers, marketSnapshots: [two[0]!] })).toHaveLength(1); // one snapshot → no alerts
  });

  test("empty history + no markers → no events", () => {
    expect(buildProgressEvents({ history: [], markers: [], marketSnapshots: [] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails** — `npx vitest run lib/scan/progress-events.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `buildProgressEvents`** by moving the exact logic from `progress/page.tsx` (`deltaAt`, `eventsFromMarkers`, the two-snapshot `computeMarketAlerts` push, the newest-first sort) into `lib/scan/progress-events.ts`. Keep `hrefForCategory` returning `/app/plan`. Move/re-export the `ProgressEvent` type so `progress-view.tsx` still exports it (re-export from the new module to avoid breaking existing imports). Do not change the event shape or ordering.

- [ ] **Step 4: Run the test** → PASS.

- [ ] **Step 5: Refactor `progress/page.tsx`** to import `buildProgressEvents` and delete the now-moved inline helpers. Keep its reads (`engagementSummary`, `scoreHistoryMarkers`, the two-row `market_snapshots` select, `signalChanges`) unchanged; just feed them to `buildProgressEvents`. Run `pnpm test` + `npx tsc --noEmit` → green (Progress output unchanged).

- [ ] **Step 6: Commit** — `git add … && git commit -m "refactor(ws4): extract buildProgressEvents shared by Progress + dashboard recap (no behavior change)"`

---

### Task 2: Dashboard — reframe the Outreach pillar row (render-only)

The Outreach pillar has no on-site signal, so it always renders "not measured yet" (`dashboard-hero.tsx:101`) — reading as broken when it's really measured off-site as Market Position (shown at `dashboard-hero.tsx:77-89`). Make the Outreach row point there; keep "not measured yet" for genuinely-unscanned on-site pillars.

**Files:**
- Modify: `components/app/intel/dashboard-hero.tsx` (the pillar `.map` at ~`:92-104`)
- Test: `components/app/intel/dashboard-hero.test.tsx` (create if absent; render-assert the two states)

**Interfaces:**
- Consumes: `PillarRollup` / its `pillars[]` (each has `pillar` key, `label`, `assessed`, `value`) from `lib/scan/pillar-scores`. Identify the off-site pillar by its pillar key — confirm the key at implementation (it is the Outreach pillar; read `PILLAR_WEIGHTS` / `pillar-scores.ts` for the exact key literal and use it verbatim).
- Produces: no new exports; a render change internal to `DashboardHero`.

- [ ] **Step 1: Write the failing test** — render `DashboardHero` with a rollup whose Outreach pillar is `assessed:false` and another on-site pillar `assessed:false`; assert the Outreach row shows an off-site pointer (text like `/measured off-site/i` and links to Market Position) while the on-site pillar shows `/not measured yet/i`.

```tsx
// components/app/intel/dashboard-hero.test.tsx (shape — fill exact props at implementation)
import { render, screen } from "@testing-library/react";
import { DashboardHero } from "./dashboard-hero";
// build a minimal PillarRollup with outreach {assessed:false} + seo {assessed:false}
test("Outreach reads as measured off-site, not 'not measured yet'", () => {
  render(<DashboardHero {...props} />);
  expect(screen.getByText(/measured off-site/i)).toBeInTheDocument();
  expect(screen.getByText(/not measured yet/i)).toBeInTheDocument(); // the on-site pillar keeps it
});
```

- [ ] **Step 2: Run it** → FAIL (both rows currently say "not measured yet"). Confirm the project's component-test setup (jsdom + testing-library) — if `DashboardHero` isn't unit-testable in isolation (heavy imports), instead extract the single pillar row into a small pure `PillarRow` function in the same file and test THAT; wire the test to `PillarRow`. Decide at implementation; prefer the smallest testable unit.

- [ ] **Step 3: Implement** — in the pillar `.map`, branch on the pillar being the off-site (Outreach) one: when it's off-site AND unassessed, render an intentional pointer — e.g. a small inline anchor/text *"measured off-site → Market Position"* using `--c-*` tokens (link tone `var(--c-action)`), pointing at the Market Position block (an in-page anchor `#market-position`, or just styled text if no anchor target — add `id="market-position"` to the Market Position block at `:80` if linking). On-site unassessed pillars keep the existing "not measured yet". Assessed pillars (any) keep the Bar + value.

- [ ] **Step 4: Run the test** → PASS. Run `pnpm test` (invariant #1 guards untouched → still green).

- [ ] **Step 5: Commit** — `git commit -m "fix(ws4): dashboard Outreach pillar points to Market Position (measured off-site), not 'not measured'"`

---

### Task 3: Dashboard — half-width trend + recent-changes recap row

Turn the full-width "Discoverability over time" Card (`dashboard-hero.tsx:113-116`) into a **two-column row**: half-width trend (with a "Full history →" link) beside a compact **RecentChangesRecap** (top 3 events, newest-first, zero-state when empty), which links "See all →" to `/app/progress`.

**Files:**
- Modify: `components/app/intel/dashboard-hero.tsx` (the trend Card → two-column grid + a new `RecentChangesRecap` component in-file or a sibling)
- Modify: `app/(app)/app/dashboard/page.tsx` (build events via `buildProgressEvents` and pass to `DashboardHero`)
- Test: `components/app/intel/dashboard-hero.test.tsx` (recap top-N + zero-state, if the recap is a pure-enough unit) OR a pure `pickRecentEvents` helper test.

**Interfaces:**
- Consumes: `ProgressEvent[]` from Task 1's `buildProgressEvents`; `DashboardHeroProps` gains `events?: ProgressEvent[]` (optional, `?? []`).
- Produces: `DashboardHero` renders the two-column row; a `RecentChangesRecap({ events }: { events: ProgressEvent[] })` component (top 3, newest-first — `events` is already sorted by Task 1; slice 3); a zero-state ("Your changelog builds as you ship & verify fixes.").

- [ ] **Step 1: Write the failing test** — for the pickN/zero-state behavior. If `RecentChangesRecap` is a pure render component, render with 5 events → assert exactly 3 rows + a "See all →" link to `/app/progress`; render with `[]` → assert the zero-state text and NO "See all". If extracting a pure `pickRecentEvents(events, 3)` helper, unit that instead.

- [ ] **Step 2: Run it** → FAIL.

- [ ] **Step 3: Implement**
  - Add `events?: ProgressEvent[]` to `DashboardHeroProps`; default `[]`.
  - Replace the trend Card block with a responsive two-column row: `display:grid; gridTemplateColumns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap:20`. Left cell = the existing trend Card, now with a "Full history →" link (`<Link href="/app/progress">`, `var(--c-action)`). Right cell = a Card titled "What's changed lately" wrapping `RecentChangesRecap`.
  - `RecentChangesRecap`: top 3 events as one-line rows (delta chip using existing band colors — reuse the same delta styling idiom already in `ScoreTrend`/hero, tokens only; NO new hex), each row links to `event.href ?? "/app/progress"`; a "See all →" link to `/app/progress`; zero-state when `events.length === 0`.
  - In `dashboard/page.tsx`: add the two-row `market_snapshots` select (mirror Progress's `page.tsx` select) to the existing `Promise.all`, call `buildProgressEvents({ history: engagement.history, markers, marketSnapshots })`, pass `events` to `<DashboardHero … events={events} />`.

- [ ] **Step 4: Run the test** → PASS. `pnpm test` + `npx tsc --noEmit` green.

- [ ] **Step 5: Commit** — `git commit -m "feat(ws4): dashboard trend half-width beside a recent-changes recap linking to Progress"`

---

### Task 4: Nav — relabel "Progress" → "History"

**Files:**
- Modify: `components/app/captured/app-shell.tsx:37` (nav item label)

**Interfaces:** none — a string change. Route `/app/progress` unchanged.

- [ ] **Step 1: Change** the nav item label at `app-shell.tsx:37` from `"Progress"` to `"History"`. Leave `href: "/app/progress"` and the icon unchanged.
- [ ] **Step 2: Verify** `npx tsc --noEmit` + `pnpm test` green; grep confirms no test asserts the literal nav label "Progress" (if one does, update it).
- [ ] **Step 3: Commit** — `git commit -m "ws4: relabel nav 'Progress' → 'History' (route unchanged) so its over-time purpose is distinct from the dashboard"`

---

### Task 5: Claude Design mirror reconcile + gates

**Files:**
- Modify: the dashboard hero's `ds-src` mirror (find it via `.design-sync/INVENTORY.md` — the DashboardScreen/hero mirror) + `.design-sync/INVENTORY.md` if the recap adds a described element.
- Modify: `.design-sync/mirror-lock.json` (via `pnpm bless:design`).

- [ ] **Step 1: Reconcile** the dashboard hero `ds-src` mirror to match the new Outreach framing + half-width trend + recap (structure/copy parity). If the recap is a genuinely new atomic element, note it in `INVENTORY.md` per the coverage ratchet (or compose from existing kit primitives so no new mirror is needed — prefer composition).
- [ ] **Step 2: Run** `node .design-sync/ds-src/build.mjs && node .design-sync/ds-src/layout.mjs` then `pnpm check:design` → must be 0 STALE for the dashboard mirror (other pre-existing STALE mirrors from WS3 are the batched-upload backlog, not this task's concern — do not regress them further).
- [ ] **Step 3: `pnpm bless:design -- <DashboardMirror>`** (scope to the reconciled card).
- [ ] **Step 4: Commit** — `git commit -m "design(ws4): reconcile dashboard DS mirror to Outreach/trend/recap changes"`

---

## Final verification (whole branch)

1. Gates: `pnpm test` (incl. untouched invariant #1 guards) · `npx tsc --noEmit` · `pnpm check:arch` · `pnpm check:design` (0 STALE for the dashboard mirror) · `pnpm lint` — all green.
2. Bundle: CI build shows `/app/dashboard/page` ≤ 283 KB (its pin). If it grew, defer the recap or trim (dynamic-import) — never raise the baseline.
3. Live (fixtures=false): scan an app, open `/app/dashboard` — Outreach reads "measured off-site → Market Position" (not a broken bar); the trend is half-width beside the recap; "Full history →" and "See all →" reach `/app/progress`; the nav says "History". Open `/app/progress` — unchanged (annotated trend + why-it-moved + changelog).
4. Invariant #1 unchanged — the headline/pillars/Market Position numbers are identical to before (render/IA only).

## Self-review notes

- Spec coverage: Outreach reframe (Task 2), half-width trend + recap (Task 3), keep+relabel Progress (Task 4), shared event builder DRY (Task 1), DS parity (Task 5) — all covered.
- Type consistency: `ProgressEvent` is single-sourced (Task 1) and consumed by both Progress and the dashboard recap; `buildProgressEvents` signature is fixed in Task 1's Produces block and consumed verbatim in Task 3.
- No score-model edits anywhere — the plan is deliberately render/IA-only to keep invariant #1's guards green untouched.
