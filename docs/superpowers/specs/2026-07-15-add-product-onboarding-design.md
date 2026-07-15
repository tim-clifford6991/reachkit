# Add-a-product onboarding for paid users (in-shell, non-blocking, one dedupe policy)

**Date:** 2026-07-15 · **Status:** approved design, pre-plan · **Owner decisions:** captured inline

## Context

A paid user adding a second product today goes: `AppSwitcher → "+ Add product"` → **`/scan`** (the public marketing scan page) → on submit, `router.push('/scan/{slug}')` → **`PublicReport`**.

`PublicReport` is *deliberately* entitlement-blind. Its own header:

> *"it must NEVER branch on viewer entitlement… No `currentUser`/`entitlementsFor` import on purpose… **PUBLIC-SAFE: always redact to 'free'** — no viewer/entitlement lookup, ever… **No hideUnlock: the locked band + upgrade CTA always show**"*

So a paying Growth user adding their second product is shown a **redacted free report with an "Unlock full report" upgrade CTA — for a product they already pay for.**

That is not a bug in `PublicReport`. Its public-safety binding is a security property: a shareable report must never leak paid data based on who is looking. **The bug is routing an authenticated, paid action through the public funnel at all.** The scan itself is already correct (`/api/scan` gives a paid viewer `tier: 'full'`, links the app, runs the deep pass) — only the destination is wrong.

Two adjacent defects surfaced while specifying this, and this spec closes both:

1. **`addFirstTrackedProduct` triggers no scan.** Its own doc says *"The new, **unscanned** app now occupying the user's tracked slot."* A paid user with 0 apps who uses Settings' `AddProductForm` lands on an **empty dashboard**. It also hard-throws when `app_ids.length > 0`, so it is zero→one only.
2. **Two paths already disagree on dedupe.** `/api/scan` does *find-or-create by URL*; `addFirstTrackedProduct` *always inserts*. That disagreement is exactly what produced the incoherent live state on `nudgi.ai` (an anonymous free scan hand-attached to a paid account: paid dashboard over free data, `tier:'free'`, `deepened_at: null`).

## Goals

1. A paid user adds a product **inside the app** and never sees the public funnel or an upgrade CTA for something they pay for.
2. Reuse the existing post-upgrade onboarding **where it genuinely applies**, with a first step for choosing the product.
3. **One** dedupe/staleness policy, shared by every caller — so paths cannot re-diverge.
4. Adding product #2 **never blocks** product #1.
5. Adding a product **always** results in a scan (no more unscanned apps).

## Non-goals / out of scope

- Competitor discovery/selection internals (`CompetitorSetup`, `MAX_SELECTED`) and the scan pipeline's cost/scoring invariants — untouched.
- `PublicReport`'s entitlement-blindness — **deliberately preserved**; we route around it, never weaken it.
- Changing what the free/public `/scan` page does for anonymous visitors.
- Multi-tenancy of shared `apps` rows (two users tracking one URL share an `app_id`). Real, pre-existing, and out of scope — noted in Risks.

## Owner decisions (locked)

| Question | Decision |
|---|---|
| What does the user see while product #2 scans? | **Non-blocking, in-shell.** Land on the new app's dashboard with live progress; product #1 stays usable and switchable. |
| URL already has an app/scan? | **Reuse the app and deepen it** — but with a **freshness check**, so we never present months-old data as current. |
| Staleness threshold | **14 days.** Weekly refresh means a healthy tracked app is never >7 days old; 14 gives a grace margin. |

## Prior art this builds on (verified against the code)

- **The profile step is per-USER, not per-app** (`users.onboarded_at` / `distribution_goal` / `icp_confirmed`). It must **never** re-run for an existing user. Only the **competitors** step is per-app. So "the same onboarding as after upgrading to Solo" is *not* the target — a subset is.
- **The setup gate already anticipates new apps.** `app/(app)/app/layout.tsx`:
  > *"This is also what keeps a freshly-switched product (new app, no scan) out of the discovery overlay: its single on-demand scan seeds the candidates, and the competitor pick becomes the normal cheap post-scan beat."*

  `setupState` = `profile` (until `onboarded_at`) → `competitors` (active app has a completed scan but no selected cohort) → `ready`. A new app with no scan is already `ready`.
- `/api/scan` already does the hard part for a paid viewer: `tier: 'full'` at creation, `linkScanToUser`, deep pass inline. `ensureDeepScan` flips `tier` to `full` **before** emitting `scan/deepen`.

## Design

### 1. Entry points — one flow

- `AppSwitcher` `"+ Add product"`: `href` becomes **`/app/add`** when `canAddApp`. At the cap it keeps today's upgrade path (`addAppUpgradePlan` → checkout, else `/app/billing`) — unchanged.
- Settings' zero-app `AddProductForm` routes to the **same** flow, retiring `addFirstTrackedProduct`'s role. This is what removes the unscanned-app hole: 0→1 and N→N+1 become one path that always scans.

### 2. The shared policy — `lib/app/add-product.ts`

The load-bearing piece. One function decides what a URL means; every caller obeys it.

```ts
export const SCAN_STALE_DAYS = 14;

export type ProductScanPlan =
  | { kind: "deepen"; appId: string; scanId: string }  // completed scan ≤14d → reuse
  | { kind: "rescan"; appId: string }                  // app exists; scan stale/absent/failed
  | { kind: "fresh" };                                 // no app for this URL

export async function resolveProductScan(
  url: string,
  opts: { paid: boolean; now?: Date },
): Promise<ProductScanPlan>;
```

Rules:
- No `apps` row for the normalised URL → `fresh`.
- App exists, newest **completed** scan is ≤ `SCAN_STALE_DAYS` old → `deepen` (cheap: `ensureDeepScan` reuses the collect).
- App exists, newest completed scan is older than the threshold, or there is no completed scan (only `queued`/`failed`) → `rescan`.
- `now` is injectable so the rule is unit-testable without clock games.

**Both `/api/scan` (paid dedupe branch) and the add action call this.** Anonymous/free `/api/scan` dedupe is unchanged (`opts.paid=false` → never re-scans for a free viewer; that's the existing cost guard).

### 3. The route + server action

`app/(app)/app/add/page.tsx` — rendered **inside the app layout**, so it inherits the sidebar and is not a funnel page. A URL field (+ the platform hint `classifyUrl` already derives) → server action `addProduct(url)`:

1. `requireUser()` + `assertPaid()` — 401/402.
2. **Tier cap → explicit refusal.** Today `linkScanToUser` *silently* returns false at the cap (`"…left untracked"`), so the scan runs, spends money, and the product never appears. Here it is a real, actionable message before anything is created.
3. **Already tracked → friendly refusal.** No slot burned, no spend.
4. `classifyUrl(url)` → normalise/validate (400 on invalid).
5. `resolveProductScan(url, { paid: true })` → plan.
6. Execute the plan:
   - `fresh` → create `apps` row → insert `scans` row `tier:'full'` → `inngest.send("scan/requested")` (the paid path already runs `full-scan` inline for `tier:'full'`).
   - `rescan` → insert a new `scans` row `tier:'full'` on the existing app → same event.
   - `deepen` → `ensureDeepScan(scanId)` (flips `tier` → `full`, emits `scan/deepen`).
7. Link the app to `users.app_ids` (reusing `linkScanToUser`'s semantics, but with the cap already enforced above).
8. `setActiveApp(appId)` → redirect to `/app/dashboard`.

### 4. Non-blocking progress

The new app's dashboard renders **live scan progress in place** when the active app's latest scan is in-flight (`queued`/`collecting`), driven by the existing `/api/scan/[id]/stream` SSE. The shell, sidebar and switcher stay live — product #1 is one click away mid-scan.

This needs no change to `setupState`: a new app with no completed scan is already `ready` (§Prior art), so the overlay does not fire during the scan.

### 5. The overlay change (the one behavioural change to existing first-run)

When the scan completes, `setupState` flips to `competitors` — and `SetupOverlay` today **inerts the entire app**. Left alone, product #2's competitor pick would lock product #1, undoing the non-blocking decision at the last moment.

**Rule:** the blocking overlay is **first-run only**.

- Block when `!user.onboarded_at` (profile — genuinely first run), **or** when the competitor pick is needed and this is the user's **only** app.
- With **≥2 apps**, never block. The competitor pick renders as an **in-page card** on that app's dashboard — the "normal cheap post-scan beat" the layout comment already describes.

### 6. Error handling

| Case | Behaviour |
|---|---|
| At tier cap | Explicit message + upgrade CTA (never a silent untracked scan) |
| Already tracked | Friendly refusal; no slot, no spend |
| Invalid URL | `classifyUrl` error surfaced on the field |
| **Scan trigger fails** | App is still created + linked; the dashboard offers **retry**. Never strand a paid slot on a transient Inngest blip. |
| `SCANNING_ENABLED=false` | The P4 "scans are paused" message — the kill switch must hold here too |

## Guards (ship with the change)

- **Unit — `resolveProductScan`**, table-driven with injected `now`: ≤14d → `deepen` · >14d → `rescan` · no app → `fresh` · app with no completed scan → `rescan` · `paid:false` → never `rescan`.
- **Unit** — cap refuses at the limit; already-tracked refuses; neither creates a row.
- **Integration** (real Supabase) — `addProduct` end-to-end: app created, `app_ids` linked, active app set, correct plan chosen.
- **Tripwire** — a source check that **`/api/scan` and `addProduct` both call `resolveProductScan`**, in the idiom of `app/api/costed-routes.test.ts` / `entitlement-gates.test.ts`. This is the guard that stops the policy re-diverging; without it, this spec's central goal decays silently.
- **Bundle** — `/app/add` is a new page in the bundle-budgeted `(app)` group: must stay ≤275 KB and must not raise any pinned baseline.

## Risks / accepted

- **Shared `apps` rows.** `apps` is keyed by URL globally, so two users tracking the same URL share an `app_id` — and therefore scans/actions/competitors. Real, pre-existing (this is how the anonymous nudgi.ai scan became a tracked app), and **not** introduced here: `deepen`/`rescan` reuse the row exactly as `/api/scan` already does. Out of scope; flagged for a future multi-tenancy pass.
- **Cost.** `rescan`/`fresh` cost a full scan (~£1–3); `deepen` is cheap. The 14-day rule is the lever. All spend attributes to the scan row and rolls up to the user (invariant #2, incl. the LLM path fixed in #68).
- **Retiring `addFirstTrackedProduct`** changes the zero-app Settings path. Its integration test (`tests/integration/add-first-product.test.ts`) must be migrated, not deleted — the zero→one transition still needs coverage.
