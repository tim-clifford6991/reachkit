# WS3 — Plan Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Plan page: calendar-first with a one-line status, greyed-clickable past days, each day's top-3 actions labelled by impact horizon (short/medium/long) with realistic effort + thread-specific ready drafts, and a "generate more actions" control that surfaces more already-computed recommendations.

**Architecture:** Pure helpers first (horizon assignment + effort recalibration, unit-tested), then the plan builder wiring (top-3-by-horizon + thread-reply entries from demand data), then the "generate more" endpoint (paid + cost-contexted, surfaces more existing recommendations — no per-click LLM call), then the UI (layout reorder, horizon cards, calendar, button), then Claude Design + gates.

**Tech Stack:** Next.js 16 RSC/client, TypeScript, Vitest, the `@/components/app/intel/kit`, the `actions` table, the synthesis/competitor/demand intel already gathered.

**Visual spec:** approved mockup Artifact `cbf5ada5-cc5c-4a9e-a8dd-750ec808449e`.

## Global Constraints

- **Effort honesty:** the recalibrated constants are the new truth; the LLM effort clamp (`lib/llm/actions.ts` `ACTION_EFFORT_MAX`) is lowered so the model can't emit inflated times. Constants pinned by a guard test (Change Protocol: constant + guard + this file together).
- **Impact honesty (invariant #5a):** any shown `expectedOutcome.delta` stays model-computed via `recomputeActionImpacts` — never an LLM free-choice number.
- **No auto-send (invariant #7):** thread-reply + generate-more actions are `draftRequiresEdit=true`, never auto-posted; §11 caps hold.
- **Paid + costed (invariants #2, #5b):** the generate-more endpoint calls `assertPaid` before any work and runs under `costedIntelStep`; it draws on ALREADY-gathered intel (no fresh external scan). Guards: `app/api/costed-routes.test.ts` + `app/api/entitlement-gates.test.ts` get the new route.
- **Floors (invariants #4/#5):** generated/surfaced actions respect `MIN_ACTIONS` + per-category floor + the §11 critic where they run.
- **Brand-ambiguity (#6):** thread-reply sources are the category-validated demand threads only.
- **Bundle:** the plan page is pinned at 293 KB in `KNOWN_OVERAGES_KB` — must not grow past it (dynamic-import heavy additions).
- **Tokens only; additive/null-coalesced; live-test fixtures-false by rendering `/app/plan`.**

Commands: `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm check:arch` · `pnpm check:design` · `pnpm lint` · `node scripts/check-bundle.mjs` (fresh build; never build while `next dev` runs).

---

### Task 1: Horizon assignment (pure)

**Files:** Create `lib/scan/plan-horizon.ts` + `lib/scan/plan-horizon.test.ts`

**Interfaces:**
- Consumes: `PlanEntry` (`lib/scan/plan-schedule.ts`).
- Produces: `type Horizon = "short" | "medium" | "long"`; `function horizonForEntry(e: Pick<PlanEntry,"kind"|"channel"|"effortMin">): Horizon`; `const HORIZON_LABEL: Record<Horizon,string>` (`{short:"Quick win", medium:"This week", long:"Compounding"}`).

- [ ] **Step 1: Write the failing test**

```ts
// lib/scan/plan-horizon.test.ts
import { describe, it, expect } from "vitest";
import { horizonForEntry, HORIZON_LABEL } from "./plan-horizon";

describe("horizonForEntry", () => {
  it("maps kinds to horizons: post->short, content->medium, distribution->long", () => {
    expect(horizonForEntry({ kind: "post", channel: null, effortMin: 3 })).toBe("short");
    expect(horizonForEntry({ kind: "content", channel: null, effortMin: 45 })).toBe("medium");
    expect(horizonForEntry({ kind: "distribution", channel: "directory", effortMin: 12 })).toBe("long");
  });
  it("a community reply (distribution+community, tiny effort) is a short quick-win", () => {
    expect(horizonForEntry({ kind: "distribution", channel: "community", effortMin: 4 })).toBe("short");
  });
  it("has a label for every horizon", () => {
    expect(HORIZON_LABEL.short).toBe("Quick win");
    expect(HORIZON_LABEL.medium).toBe("This week");
    expect(HORIZON_LABEL.long).toBe("Compounding");
  });
});
```

- [ ] **Step 2: Run — FAIL** (`pnpm vitest run lib/scan/plan-horizon.test.ts`)

- [ ] **Step 3: Implement**

```ts
// lib/scan/plan-horizon.ts
/**
 * Impact-horizon for a plan entry — the short/medium/long framing shown on the
 * Plan page. By kind (post/reply = quick, content = this-week, distribution =
 * compounding), with a nuance: a low-effort community reply is a Quick win, not
 * a long compounding play. Deterministic + total. PURE.
 */
export type Horizon = "short" | "medium" | "long";
export const HORIZON_LABEL: Record<Horizon, string> = { short: "Quick win", medium: "This week", long: "Compounding" };

export function horizonForEntry(e: { kind: "post" | "content" | "distribution"; channel: string | null; effortMin: number }): Horizon {
  if (e.kind === "post") return "short";
  if (e.kind === "content") return "medium";
  // distribution: a quick community reply/comment is a short quick-win; a
  // directory/marketplace/backlink placement compounds over time.
  if (e.channel === "community" || e.effortMin <= 6) return "short";
  return "long";
}
```

- [ ] **Step 4: Run — PASS.** **Step 5: Commit** `git add lib/scan/plan-horizon.* && git commit -m "feat(ws3): horizon assignment for plan entries"`

---

### Task 2: Recalibrate effort + clamp (pinned)

**Files:** Modify `lib/scan/plan-schedule.ts` (`EFFORT_MIN`, `CONTENT_EFFORT_MIN`, the daily-post `effortMin: 10`), `lib/llm/actions.ts` (`ACTION_EFFORT_MAX`); add/extend `lib/scan/documented-invariants.test.ts` (or a new `plan-effort.test.ts`) pinning the values.

**Interfaces:** Produces the new constants: `EFFORT_MIN = { low: 8, medium: 20, high: 45 }`, `CONTENT_EFFORT_MIN = 45`, daily-post effort `3`, `ACTION_EFFORT_MAX = 60`.

- [ ] **Step 1: Write the failing pin test**

```ts
// lib/scan/plan-effort.test.ts
import { describe, it, expect } from "vitest";
import { EFFORT_MIN, CONTENT_EFFORT_MIN } from "./plan-schedule";
import { ACTION_EFFORT_MAX } from "@/lib/llm/actions";

describe("recalibrated effort (human-honest times)", () => {
  it("pins the new, realistic effort minutes", () => {
    expect(EFFORT_MIN).toEqual({ low: 8, medium: 20, high: 45 });
    expect(CONTENT_EFFORT_MIN).toBe(45);
    expect(ACTION_EFFORT_MAX).toBe(60);
  });
});
```

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** — set `EFFORT_MIN = { low: 8, medium: 20, high: 45 }`, `CONTENT_EFFORT_MIN = 45` in `plan-schedule.ts`; change `addDailyPosts`'s `effortMin: 10` → `effortMin: 3` (find the literal in `addDailyPosts`); set `ACTION_EFFORT_MAX = 60` in `lib/llm/actions.ts` (keep `ACTION_EFFORT_MIN = 5`, `clampEffort` unchanged — it now clamps to `[5,60]`).
- [ ] **Step 4: Run — PASS** + `pnpm test` (a few schedule tests may assert old minutes — update them to the new values, documented in the commit body per Change Protocol).
- [ ] **Step 5: Commit** `feat(ws3): recalibrate plan effort to realistic times (pinned)`

---

### Task 3: Plan builder — top-3-by-horizon + thread-reply quick-wins

**Files:** Modify `lib/scan/plan-schedule.ts` (`buildPlanDays` / the day-assembly + a new `topThreadReplies` input), `components/app/intel/plan-timeline-view.tsx` (pass demand pockets through), `app/(app)/app/plan/page.tsx` (load demand pockets alongside the board/synthesis). Test: `lib/scan/plan-schedule.test.ts` (extend).

**Interfaces:**
- Consumes: `horizonForEntry` (Task 1); the demand `community.pockets[].topThreads` (already gathered; now intent-ranked) — pass the top buyer-intent threads into the builder.
- Produces: each `ScheduledDay` exposes (or the view derives) its **top-3 entries, one per horizon where available** (fallback by priority); a new entry kind for a **thread reply** (a `distribution`/`community` entry with `channel:"community"`, `targetUrl:` the thread URL, `title:` "Reply to: <thread title>", `draft: null` until generated) built from the highest-intent threads not already actioned.

- [ ] **Step 1** — read `buildPlanDays`, `addDailyPosts`, `scheduleToDays` in `plan-schedule.ts` and `plan-timeline-view.tsx`'s data flow. Add a `threadReplies?: {title;url;intent}[]` input to `buildPlanDays` and a helper that turns the top-N highest-intent threads into `PlanEntry` quick-win reply entries (kind `distribution`, channel `community`, `effortMin: 4`, `targetUrl: url`, `title: \`Reply to: ${trunc(title,60)}\``, `why: "A buyer is describing your problem unprompted — a genuine, helpful reply puts you in front of them."`, `evidence: url`). Place at most 1 reply/day among the day's short slot.
- [ ] **Step 2** — expose a `topThreeByHorizon(entries): PlanEntry[]` selection (pure, tested): group the day's entries by `horizonForEntry`, take the highest-priority per horizon, return up to 3 (short, medium, long order); if a horizon is empty, backfill from the remaining highest-priority entries. Write a unit test for the selection (deterministic).
- [ ] **Step 3** — thread the demand pockets from `app/(app)/app/plan/page.tsx` (it already resolves the app; load the demand intel the same way the customers page does — via the cached `gatherDemand` / the persisted `demand_intel`, whichever the page can access cheaply) into `PlanTimelineView` → `buildPlanDays({ threadReplies })`. If demand data isn't readily available server-side on the plan page, load it client-side via `useIntel<Demand>("demand")` in the plan view (cheap when warm) and pass the top threads to the day builder. **Decide the cheapest path at implementation; do NOT trigger a fresh demand gather on plan load** (reuse cache only).
- [ ] **Step 4** — tests green (`pnpm vitest run lib/scan/plan-schedule.test.ts`), `tsc`, `pnpm test`. Commit `feat(ws3): top-3-by-horizon selection + thread-reply quick-wins from demand`.

---

### Task 4: "Generate more actions" endpoint (paid, costed, surfaces existing recommendations)

**Files:** Create `app/api/app/plan/generate/route.ts` + `app/api/app/plan/generate/route.test.ts`; add the route to `app/api/costed-routes.test.ts` + `app/api/entitlement-gates.test.ts` expectations.

**Interfaces:** `POST /api/app/plan/generate { higherImpactOnly?: boolean }` → `{ added: {id,title,category}[] }`. `assertPaid(viewer)` first; then under `costedIntelStep(appId, "plan-generate", …)`: pull the app's ALREADY-gathered recommendations (synthesis `contentPlan` + `distributionPlan`, competitor `channelsMissing`, keyword `gaps`) that are NOT already in the `actions` table (dedupe by title), rank by expected impact, take top-N (≤5; `higherImpactOnly` → only high-priority / top-delta), persist as `pending` actions (reuse the `/api/action` insert logic — factor a shared `createAction` helper if clean), `recomputeActionImpacts` on the new cards. **No fresh external scan, no per-click LLM generation in the common path** (the recommendations already exist). If NONE remain un-actioned, return `{ added: [] }` with a signal the UI shows as "you're on top of it — next scan surfaces more".

- [ ] **Step 1** — read `/api/action/route.ts` (insert path + `assertPaid`/active-app resolution), `lib/scan/synthesis/synthesize.ts` (the recommendation shape), `lib/scan/action-linking.ts` (`recomputeActionImpacts`). Write the failing route test (mock the intel + db): paid gate returns 402 when unpaid; a paid call with un-actioned recommendations returns `added` non-empty and inserts `pending` rows; `higherImpactOnly` filters to high-priority; a second call (all actioned) returns `added: []`.
- [ ] **Step 2** — implement the route per the interface. Bounded N. Under `costedIntelStep`. Reuse gathered intel (cached) only.
- [ ] **Step 3** — add the route to the `costed-routes` + `entitlement-gates` source tripwires. Run those + the new test. `tsc`, `pnpm test`, `pnpm check:arch`.
- [ ] **Step 4** — Commit `feat(ws3): /api/app/plan/generate — surface more grounded actions (paid, costed, bounded)`.

---

### Task 5: UI — calendar-first layout + slim status + greyed-clickable past days

**Files:** Modify `components/app/intel/plan-timeline-view.tsx` (`PlanTimelineBody` order), `PlanCalendar` (past-day styling/click).

- [ ] **Step 1** — reorder `PlanTimelineBody`: replace the tall summary `Card` with a **one-line status row** (`score · N to do · N verifying · N verified +Δ`), put the **calendar first**, then the selected-day panel, then verifying/done. Make past calendar days **greyed (`opacity`) but clickable** (they already render; ensure `onClick` selects them and the day panel shows their entries; a past day with no entries shows an empty "nothing scheduled" state). Build to the mockup.
- [ ] **Step 2** — `tsc` + (fresh build) `node scripts/check-bundle.mjs` (plan page ≤ 293 pin; dynamic-import if it grows) + `pnpm check:design`. Commit `feat(ws3): plan page is calendar-first with a slim status line + clickable past days`.

---

### Task 6: UI — horizon action cards + thread-reply target + draft

**Files:** Modify `components/app/intel/plan-entry-card.tsx` (horizon badge + thread-reply rendering), `components/app/intel/plan-kind-style.ts` (horizon colours), `plan-timeline-view.tsx` (render the day's top-3-by-horizon).

- [ ] **Step 1** — read `plan-entry-card.tsx` (the draft `generate()` composer + `target`/`targetUrl` rendering + `KIND_STYLE`). Add a **horizon badge** (`HORIZON_LABEL[horizon]`, coloured via `plan-kind-style`) to each card; the day panel renders the **top-3-by-horizon** (Task 3) as the three cards. For a **thread-reply** entry, the card shows the specific thread (`targetUrl` → "Open in Reddit →") and the **ready draft** via the existing `generate()` flow (`/api/distribute/draft` or the appropriate draft route) — `draftRequiresEdit=true`, never auto-post. Realistic `~{effortMin} min` (now honest from Task 2). Tokens only.
- [ ] **Step 2** — `tsc` + `check:design` + build/bundle. Commit `feat(ws3): horizon action cards with thread-specific reply + ready draft`.

---

### Task 7: UI — "Generate more actions" control

**Files:** Modify `plan-timeline-view.tsx` (the button + wiring).

- [ ] **Step 1** — add a **"Generate more actions for today"** button (+ a "higher-impact only" toggle) under the day panel that `POST`s `/api/app/plan/generate`, shows a pending state, and on success refreshes the board (re-fetch / optimistic append) so the new actions appear. Empty result → a friendly "you're on top of it — your next scan surfaces more" message. Tokens only; keyboard-accessible button.
- [ ] **Step 2** — `tsc` + `check:design` + build/bundle (≤ 293 pin). Commit `feat(ws3): generate-more control wired to the plan-generate endpoint`.

---

### Task 8: Claude Design reconcile + parity

- [ ] Update the ds-src mirrors for the changed plan components (`PlanTimelineView`/`PlanScreen`, `PlanEntryCard`/`PlanItemCard`, any new horizon styling) + `INVENTORY.md` + a dated `NOTES.md` entry; `node build.mjs && node layout.mjs && pnpm bless:design && pnpm check:design` → 0 STALE + parity OK. Also reconcile the **WS2.1 `CustomersScreen`** caption staleness here (it's outstanding). Commit `design(ws3): reconcile plan DS mirrors (+ WS2.1 customers caption)`.

---

### Task 9: Full gates + live verify (fixtures=false) + PR

- [ ] **Step 1** — `pnpm test && pnpm check:arch && pnpm check:design && pnpm lint`; fresh `pnpm build && node scripts/check-bundle.mjs` (plan ≤ 293, nothing over its pin).
- [ ] **Step 2** — live render `/app/plan` (fixtures=false, on prod/preview after merge): calendar at top, slim status, past days greyed+clickable, each day ≤3 horizon cards with realistic times, a quick-win reply carrying a real thread + draft (not auto-posted), "generate more" adds bounded grounded actions, `/app/diagnostics` shows the generate-more spend attributed + capped (should be ~0 — no external call).
- [ ] **Step 3** — push `feat/ws3-plan-redesign`; `gh pr create` describing the redesign; note live-render pending on prod.

---

## Self-Review

**Spec coverage:** calendar-first + slim status → T5. Greyed-clickable past → T5. Horizon 3-actions → T1 + T3 + T6. Realistic effort → T2. Thread-specific drafts → T3 + T6. Generate-more → T4 + T7. DS → T8. Cost/paid/floors/honesty → T4 constraints + T2 pin. ✅

**Placeholder scan:** data-layer tasks (1,2,3-selection) carry full TDD code; the builder-wiring, endpoint, and UI tasks give exact interfaces + the real files/functions to read + the honesty/cost rules — the WS1/WS2 pattern. The one genuinely open implementation choice (how the plan page cheaply accesses demand pockets — server cache vs client `useIntel`) is called out in T3 Step 3 with the constraint "reuse cache only, no fresh gather".

**Type consistency:** `Horizon`/`horizonForEntry` (T1) → `topThreeByHorizon` + reply entries (T3) → horizon badge (T6). Effort constants (T2) → cards (T6). `/api/app/plan/generate` (T4) → button (T7). Consistent.

**Verify-time confirmations (flagged):** the exact draft route the reply card uses (`/api/distribute/draft` vs `/api/content-draft`), the `/api/action` insert helper to factor, and `PlanCalendar`'s current past-day handling — confirm against source at implementation; never fabricate.
