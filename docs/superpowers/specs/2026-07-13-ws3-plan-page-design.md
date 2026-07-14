# WS3 — Plan page redesign (calendar-first, horizon actions, thread-specific drafts)

**Date:** 2026-07-13 · **Status:** design approved (mockup), pre-plan · **Workstream:** 3 of 6

## Context

The paid Plan page (`app/(app)/app/plan/page.tsx` → `components/app/intel/plan-timeline-view.tsx`) shows a score/verify summary strip, a month calendar, the selected day's action cards (`plan-entry-card.tsx`), and verifying/done sections. User feedback (2026-07-11): keep the calendar (intuitive) but move it to the top; the score/to-do/verify/verified strip is too tall — slim + relocate it; grey out past days but keep them clickable (review past work); keep the 3-actions-a-day shape but reframe as **short / medium / long-horizon**; the effort times are unrealistic (daily post "10 min" for a click-and-post; community "60 min" is way too much); make actions **actionable + specific** ("reply *here* in this thread, with *this* comment"); and let the user **generate more / higher-impact actions** on a given day. Approved mockup: Artifact `cbf5ada5-cc5c-4a9e-a8dd-750ec808449e`.

## Goals

1. **Calendar-first layout**; the score/verify block slimmed to one line and relocated.
2. **Past days greyed but clickable** (review what was done / due).
3. The day's work = **top 3 actions across three horizons** — Quick win (short) / This week (medium) / Compounding (long).
4. **Realistic effort times** (recalibrate the effort model down).
5. **Thread-specific, draft-attached actions** — reply to a *specific* buyer thread with a *ready draft*, wired from the demand "where they hang out" intent data.
6. **Generate more actions** on a day (+ a "higher-impact only" option), on demand.

## Design

### Layout (rework of `PlanTimelineBody`)

Top → bottom:
1. **Slim status line** (one row, `~44 · 12 to do · 2 verifying · 3 verified +6 pts`) — replaces the tall summary `Card`.
2. **Calendar** (`PlanCalendar`, kept) — month grid; **past days greyed (`opacity`) but clickable**; today highlighted; day cells show horizon-coloured chips.
3. **Selected-day panel** — the day's **top 3 actions as horizon cards** (below).
4. **Verifying / Done** (`LifecycleRow`) — kept, below.

### Horizon framing (the day's 3 actions)

Each scheduled day surfaces its **top 3 open entries**, each labelled by **impact horizon**, not kind:
- **Quick win (short)** — do-now, instant payoff: a **reply to a specific buyer thread** (from demand) or a daily post. Low effort.
- **This week (medium)** — pays off this week: a comparison/content piece targeting a keyword gap.
- **Compounding (long)** — pays off over time: a directory/marketplace listing or backlink placement.

**Horizon assignment** = a deterministic mapping from the entry's kind + payoff character (a pure helper, unit-tested):
- `post` / thread-reply → **short**; `content` → **medium**; `distribution` (directory/marketplace/partner/backlink) → **long**; with a fallback by effort when kind is ambiguous. The day shows at most one per horizon when available, else fills by priority. (Exact rule pinned in the plan; must be total + deterministic.)

### Realistic effort recalibration

Recalibrate `lib/scan/plan-schedule.ts` (and the daily-post constant) to human-honest times:
- Daily post: `10` → **`3`** (click-and-post).
- A thread reply: **`~3–5`**.
- `EFFORT_MIN`: `{ low: 15→8, medium: 60→20, high: 180→45 }` (community reply/comment ≈ short; a directory submission ≈ 10–15; deep outreach ≈ 45).
- `CONTENT_EFFORT_MIN`: `150` → **`45`** (a focused comparison page, not a magnum opus).
- The LLM clamp `ACTION_EFFORT_MIN/MAX` in `lib/llm/actions.ts` (`[5, 90]`) — lower the ceiling so the model can't emit "120 min" (already clamped; tighten `MAX` to ~60). Pin the new constants in a guard test. **Change Protocol**: these are load-bearing constants — update the constant + its guard test + this file together.

### Thread-specific, draft-attached actions (the biggest value)

Turn generic "post daily" into "**reply to THIS thread with THIS draft**":
- Source the highest-**buyer-intent** threads from the demand layer (`community.pockets[].topThreads`, already gathered + now intent-ranked from WS2.1) — the same threads shown on the Customers page.
- Surface a **Quick-win reply action** per day that carries the specific `targetUrl` (the thread) + a **generated draft reply** (via the existing draft infra — `plan-entry-card.tsx`'s `generate()` → `/api/distribute/draft`, reusing the review-required composer + `draftRequiresEdit=true`, §11 invariant #7).
- The action's target/verify URL is the thread; "Open in Reddit →" opens the real thread; the draft is the suggested comment. **Never auto-posts** (invariant #7).
- Honesty: only surface a thread-reply when a real high-intent thread exists; else fall back to a daily-post angle. No invented threads.

### Generate more actions

A **"Generate more actions for today"** control (+ "higher-impact only"):
- A new authenticated, **paid + cost-contexted** endpoint (`/api/app/plan/generate` or similar) that produces N additional grounded actions for the app from the existing competitor + demand + keyword-gap data (reuse the synthesis/action-generation path; NO fresh external scan — draw on already-gathered intel). Returns actions appended to the day (persisted to `actions` so they enter the normal lifecycle).
- Must run under `costedIntelStep` (invariant #2) + `assertPaid` (invariant #5b), bounded (cap N), and floor/critic rules apply (invariants #4/#5). "Higher-impact only" filters to the top expected-delta actions.
- Guard: the new route in the `costed-routes` + `entitlement-gates` tripwires.

## Data / model changes

- `PlanEntry` gains a `horizon: "short" | "medium" | "long"` (derived; optional/back-compat).
- Effort constants recalibrated (above) + pinned.
- The plan builder (`buildPlanDays`) selects the day's top-3-by-horizon and wires thread-reply entries from demand threads (a new input: the demand pockets, passed through the plan page's data load).
- New generate-more endpoint + its persistence to `actions`.

## Files (indicative — plan finalises)

- `components/app/intel/plan-timeline-view.tsx` (layout reorder, slim strip, horizon cards, generate-more button), `plan-entry-card.tsx` (horizon badge, thread-reply target + draft), `plan-kind-style.ts` (horizon colours), `plan-calendar` (greyed-clickable past).
- `lib/scan/plan-schedule.ts` (effort recalibration + horizon assignment + top-3-by-horizon + thread-reply entries), `lib/llm/actions.ts` (clamp), a horizon guard test.
- New `app/api/app/plan/generate/route.ts` (paid, costed, grounded action generation) + its tripwire entries.
- Claude Design: mirror the changed plan components + `INVENTORY.md`; `check:design` 0 STALE + bless.

## Cost & invariants

- Generate-more: `assertPaid` + `costedIntelStep` (invariants #2, #5b), bounded, floors/critic (#4/#5), `draftRequiresEdit`/§11 (#7). Guards in `costed-routes.test.ts` + `entitlement-gates.test.ts`.
- Effort constants pinned by a guard test (Change Protocol).
- Impact honesty (#5a): any surfaced `expectedOutcome.delta` stays model-computed (`recomputeActionImpacts`), never LLM free-choice.
- Bundle: the plan page is pinned in `KNOWN_OVERAGES_KB` (293) — must not grow past it (dynamic-import heavy bits if needed).
- Tokens only; additive/null-coalesced; live-test fixtures-false by rendering `/app/plan`.

## Open decisions (flagged; my recommendation in each — confirm or override)

1. **Horizon assignment** — kind-based (post→short, content→medium, distribution→long) with an effort fallback. *Rec: yes, deterministic + honest.*
2. **Thread-reply source** — the demand `topThreads` (buyer-intent-ranked). *Rec: yes; reuse WS2 data, no new fetch.*
3. **Generate-more** — a new paid/costed endpoint reusing the synthesis action path, no fresh external scan. *Rec: yes; bounded N (e.g. ≤5), higher-impact = top expected-delta.*

## Success criteria

Calendar sits at the top with a one-line status; past days grey but clickable; each day shows ≤3 horizon-labelled actions with **realistic** times; a Quick-win reply carries a specific thread + ready draft (never auto-posted); "generate more" produces bounded, grounded, paid+costed actions; all gates green; cost attributed + capped.

## Out of scope

- Auto-posting / scheduling to external platforms (invariant #7 forbids auto-send).
- The `audienceProxy`/outreach-measurement gap (WS4).
- Reddit OAuth for thread engagement (separate, deferred).
