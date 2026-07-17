# Onboarding, Free-Report Reveal, Score Coherence & Product Removal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four remaining user-facing defects from the 2026-07-17 owner review — a disconnected onboarding, a free report that feels slow, a dashboard showing four contradictory numbers, and a product cap that dead-ends a paying customer.

**Architecture:** Every task here is **render/flow only**. No task changes the v5 score math, the scan pipeline's stages, or external spend. The one structural change is that per-product onboarding moves *into* the `/app/add` route so the global blocking overlay can drop to profile-only — which deletes a special case rather than adding one.

**Tech Stack:** TypeScript, Next.js 16 App Router (RSC by default), Vitest, Supabase (Postgres + RLS), Inngest, `@base-ui/react` + the `--c-*` intel kit.

---

## ⚠️ Read this first: this is ONE OF THREE plans. Do not cross the lines.

| Plan | Owns | Status |
|---|---|---|
| `2026-07-17-grounding-honesty-and-flag-removal.md` | **Fabricated evidence** (`runSynth` inventing reviews for an unlaunched product; Tavily's `answer` laundered into review snippets) **+ `REACHKIT_USE_FIXTURES` removal**. Carries a **Tim ruling** that supersedes two CLAUDE.md rules. | Written, in flight |
| *(in progress, another agent)* | **Free↔deep inconsistency.** | Being written |
| **THIS PLAN** | Onboarding flow · free-report reveal timing · dashboard score coherence · product removal | You are here |

**This plan must not touch:** grounding/fabrication, `REACHKIT_USE_FIXTURES`, the fixtures seam, or free↔deep data consistency. If a task here appears to require one of those, **stop and escalate** — it means a boundary is wrong, and two plans silently fixing one thing is the drift this repo keeps re-learning.

---

## State of play (2026-07-17) — what a fresh session needs to know

**Shipped and live on prod today** (commit `64410d1`):

- **PR #88** — one post-checkout provisioning policy. The in-app upgrade *never* deepened (`onCheckoutCompleted`'s legacy branch returned before `provisionCheckoutUser`, the only caller of `ensureDeepScan`), so a logged-in free user upgrading from the paywall kept a free report forever. Also: the onboarding magic link could silently never send (both `stripe_customer_id` and "did we create the account?" are poisoned by `subscription.*`'s defensive create). Fixed by recording `users.onboarding_link_sent_at` instead of inferring. Plus a weekly-refresh **self-heal** so no paid app is ever stranded on a non-deep scan.
- **PR #90** — progress honesty. The dashboard's in-flight gate asked `score_total == null` ("was this app ever scanned?") not "is a scan running?", so progress was structurally unreachable for every re-scan/deepen. The ring was `done / steps.length` — no time basis. Now time-based with the checklist as a forward-only ratchet; 100 reserved for the terminal event; SSE resumes from the last terminal event id (the stale-`done` replay would otherwise infinite-loop).

**Measured on prod, 2026-07-17** — use these numbers, don't re-derive them:

| Scan | Wall clock | Notes |
|---|---|---|
| free (`plausible.io`) | **40.2s**, 5¢ | `facts` at **t+8.1s**; ONE `runSynth` call spans t+14.3→36.8s = **22.4s, 56% of the scan** |
| free p50 / p95 (n=7) | **41.2s / 57.4s** | range 29.7–59.6s |
| deep (`ship-or-die.com`) | **137.8s**, 11¢ | `"Finalising your report"` t+89.3s, `done` t+136.4s → **47.1s dead zone** |

**Owner account state:** `timclifford101@gmail.com`, `growth`/`active`, **0 apps** (deliberately cleared for the dogfood test). `reachkit.app` has a free scan (`tier=free`, score 9, 2026-07-16) — adding it hits `resolveProductScan` → `deepen`.

**Not live-verified:** #88 (needs a real €59 checkout) and #90 (needs the reachkit.app dogfood add).

---

## Global Constraints

Copied from `CLAUDE.md`; every task inherits these.

- **Change Protocol** — to change an invariant/token/boundary on purpose, update in the SAME commit: (1) the source constant/rule, (2) its guard/parity check, (3) `CLAUDE.md`, (4) `docs/architecture.md` if structural.
- **"A guard you have not SEEN FAIL is not a guard."** Mutation-prove every new guard: break the production code, watch it fail **with real output**, revert, confirm green. Verify the mutation actually applied before trusting the result.
- **Source tripwires go through `expectCallsSymbol`** (`lib/testing/tripwire.ts`). Never hand-roll `readFileSync` + `toMatch`.
- **Fix the CLASS, never the case** (owner rule, 2026-07-17). Name the class first: "what else fails this same way?" A fix needing a new special case means the process is wrong — fix the process.
- **Look for what nobody is looking for** (owner rule, 2026-07-17). Report the sibling defect, the vacuous guard, the dead branch — verified against reality, never a hunch.
- **Degrade, never invent.** When a call flakes, degrade; never fabricate.
- **Tokens only** — no arbitrary Tailwind values, no raw hex. `--c-*` / `--color-*` / `--radius-*`.
- **Reuse before you build** — check `@/components/ui` + `@/components/app/intel/kit.tsx` + `.design-sync/INVENTORY.md` first.
- **Baselines only ever shrink:** `KNOWN_CYCLES`, `coverage-baseline.json`, `label-drift-baseline.json`, `KNOWN_OVERAGES_KB`.
- **Never run `pnpm build` while `next dev` is running.**
- **`git add -A` is UNSAFE here** — another session shares this tree. It swept that session's plan file into PR #90 on 2026-07-17. Stage explicit paths.
- **Bundle:** 4 `(app)` pages are already over the 275 KB budget and pinned in `KNOWN_OVERAGES_KB`. Never add entries. WS1/WS4 touch the dashboard — check `pnpm check:bundle`.

---

## File Structure

**WS6 — product removal** (do first; smallest, and it's a live customer dead end)
- Create: `lib/app/remove-product.ts` — `removeTrackedProduct(userId, appId)`
- Create: `lib/app/remove-product.test.ts`
- Modify: `app/(app)/app/settings/actions.ts` — `removeProduct` server action
- Modify: `components/app/captured/settings-main.tsx` — the tracked-products list + remove control
- Modify: `lib/app/add-product.ts:86` — the cap copy, once removal exists

**WS4 — score coherence** (render-only; no math change)
- Modify: `components/app/intel/dashboard-hero.tsx` — drop the Outreach bar, Market Position into the header, relabel bars, fix `estGain`
- Modify: `components/app/intel/kit.tsx:93-109` — gauge legibility
- Modify: `app/(app)/app/dashboard/page.tsx:128-133` — delete the stale v4 comment
- Modify: `.design-sync/ds-src/DashboardScreen.tsx`, `.design-sync/ds-src/LeverBanner.tsx` — mirrors (already STALE)
- Test: `components/app/intel/dashboard-hero.test.tsx`

**WS1 — onboarding** (the big one)
- Modify: `app/(app)/app/add/page.tsx` — 3-step route
- Create: `app/(app)/app/add/add-flow.tsx` — client stepper
- Modify: `app/(app)/app/add/actions.ts` — return `{ appId, scanId }`, do not redirect
- Modify: `lib/app/setup-state.ts` — drop `appCount <= 1`; overlay = profile only
- Modify: `app/(app)/app/layout.tsx` — setupState no longer computes `competitors`
- Modify: `components/app/setup/setup-overlay.tsx` — profile step only
- Reuse: `components/app/setup/competitor-setup.tsx` (do NOT reimplement)
- Test: `lib/app/setup-state.test.ts`, `app/(app)/app/add/actions.test.ts`

**WS3 — free reveal**
- Modify: `lib/scan/free-report.ts:134-237` — emit artifacts (currently emits NONE)
- Modify: `app/(funnel)/scan/[id]/handoff.ts` — hand off at facts
- Modify: `app/(funnel)/scan/[id]/scan-stream.tsx` — progressive reveal
- Test: `app/(funnel)/scan/[id]/handoff.test.ts`

---

## WS6 — A paying customer can remove a product

**The class:** the app tells the user to do something it cannot do. Same shape as the Outreach row (735dbae reworded a structurally unreachable branch) and the dead landing CTAs.

**The evidence:** `lib/app/add-product.ts:86` throws *"You're tracking 3 of 3 products on growth. **Upgrade or remove one to add another.**"* Verified 2026-07-17: the ONLY code that shrinks `users.app_ids` is `lib/account/delete.ts` — **whole-account deletion**. And `growth` is the top tier, so "upgrade" leads nowhere either. **Both exits are fake.** A growth customer at 3/3 is permanently capped.

### Task 6.1: `removeTrackedProduct` — the policy

**Files:**
- Create: `lib/app/remove-product.ts`
- Test: `lib/app/remove-product.test.ts`

**Interfaces:**
- Produces: `removeTrackedProduct(userId: string, appId: string): Promise<void>`; `RemoveProductError` with `code: "not_tracked" | "last_product"`

- [ ] **Step 1: Write the failing test**

```ts
// lib/app/remove-product.test.ts
import { beforeEach, expect, test, vi } from "vitest";
beforeEach(() => vi.resetModules());

function db(appIds: string[]) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { app_ids: appIds }, error: null });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) });
  const from = vi.fn().mockReturnValue({ select, update });
  return { serverDb: vi.fn().mockReturnValue({ from }), update, from };
}

test("removeTrackedProduct unlinks the app, leaving the shared apps row intact", async () => {
  const d = db(["app-1", "app-2"]);
  vi.doMock("@/lib/db/client", () => ({ serverDb: d.serverDb }));
  const { removeTrackedProduct } = await import("./remove-product");

  await removeTrackedProduct("user-1", "app-1");

  // Unlink ONLY. `apps` is keyed by URL GLOBALLY — two users tracking one URL
  // share an app_id (spec 2026-07-15 Risks), so deleting the row would destroy
  // another user's scans. Unlink is the whole operation.
  expect(d.update).toHaveBeenCalledWith({ app_ids: ["app-2"] });
  expect(d.from).not.toHaveBeenCalledWith("apps");
  expect(d.from).not.toHaveBeenCalledWith("scans");
});

test("removing an app the user does not track is refused (never silently no-ops)", async () => {
  const d = db(["app-2"]);
  vi.doMock("@/lib/db/client", () => ({ serverDb: d.serverDb }));
  const { removeTrackedProduct, RemoveProductError } = await import("./remove-product");

  await expect(removeTrackedProduct("user-1", "app-1")).rejects.toThrow(RemoveProductError);
  expect(d.update).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/app/remove-product.test.ts`
Expected: FAIL — `Cannot find module './remove-product'`

- [ ] **Step 3: Implement**

```ts
// lib/app/remove-product.ts
/**
 * Stop tracking a product. The counterpart to `addTrackedProduct` — and the
 * reason the cap copy ("Upgrade or remove one to add another") was a dead end
 * for a year: no such path existed. The ONLY code that shrank `users.app_ids`
 * was `lib/account/delete.ts`, i.e. deleting your whole account.
 *
 * UNLINK ONLY. `apps` is keyed by URL globally, so two users tracking one URL
 * share an `app_id` (and therefore its scans/actions/competitors). Deleting the
 * row would destroy another user's data. Removal is a per-user link operation.
 */
import { serverDb } from "@/lib/db/client";

export class RemoveProductError extends Error {
  constructor(public code: "not_tracked", message: string) {
    super(message);
    this.name = "RemoveProductError";
  }
}

export async function removeTrackedProduct(userId: string, appId: string): Promise<void> {
  const db = serverDb();
  const { data: user } = await db.from("users").select("app_ids").eq("id", userId).maybeSingle();
  const appIds: string[] = user?.app_ids ?? [];
  if (!appIds.includes(appId)) {
    throw new RemoveProductError("not_tracked", "You're not tracking that product.");
  }
  const { error } = await db
    .from("users")
    .update({ app_ids: appIds.filter((id) => id !== appId) })
    .eq("id", userId);
  if (error) throw new Error(`removeTrackedProduct: unlink failed — ${error.message}`);
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run lib/app/remove-product.test.ts`

- [ ] **Step 5: Mutation-prove the guard**

Replace `appIds.filter((id) => id !== appId)` with `appIds`. Run the test. **Expected: FAIL.** Revert; confirm green. If it passes, the test is vacuous — fix it before continuing.

- [ ] **Step 6: Commit**

```bash
git add lib/app/remove-product.ts lib/app/remove-product.test.ts
git commit -m "feat(app): removeTrackedProduct — the path the cap error already promised"
```

### Task 6.2: Wire removal into Settings + fix the cap copy

**Files:**
- Modify: `app/(app)/app/settings/actions.ts`
- Modify: `components/app/captured/settings-main.tsx`
- Modify: `lib/app/add-product.ts:86`

- [ ] **Step 1: Add the server action**

In `app/(app)/app/settings/actions.ts`, mirroring the existing `addFirstProduct` idiom (`requireUser()`, returns `{ error }` rather than throwing):

```ts
export async function removeProduct(appId: string): Promise<{ error?: string }> {
  const user = await requireUser();
  try {
    await removeTrackedProduct(user.id, appId);
  } catch (e) {
    if (e instanceof RemoveProductError) return { error: e.message };
    throw e;
  }
  revalidatePath("/app/settings");
  revalidatePath("/app/dashboard");
  return {};
}
```

- [ ] **Step 2: Render the tracked-products list with a remove control**

In `components/app/captured/settings-main.tsx`, list the user's tracked products with a "Stop tracking" control per row. Confirm before removing (destructive, and the scan history stops being reachable from their account). Tokens only — reuse the existing settings row styling; do not introduce new atoms.

- [ ] **Step 3: Fix the cap copy so it only promises what exists**

`lib/app/add-product.ts:86` — "upgrade" is a dead end on `growth` (top tier). Make the message conditional:

```ts
const canUpgrade = tier !== "growth";
throw new AddProductError(
  "cap",
  `You're tracking ${appIds.length} of ${cap} products on ${tier}. ` +
    (canUpgrade
      ? "Upgrade for more, or remove one in Settings to add another."
      : "Remove one in Settings to add another."),
);
```

- [ ] **Step 4: Guard — the copy may only name exits that exist**

```ts
// app/(app)/app/settings/settings-actions.test.ts (or the nearest existing settings test)
import { expectCallsSymbol } from "@/lib/testing/tripwire";

it("settings' removeProduct calls removeTrackedProduct — the cap copy points here", () => {
  expect(() =>
    expectCallsSymbol("app/(app)/app/settings/actions.ts", "removeTrackedProduct", { within: "removeProduct" }),
  ).not.toThrow();
});

it("the growth cap message never offers an upgrade that does not exist", () => {
  // growth is the top tier — "Upgrade" there is a dead end, the same class as
  // the Outreach row 735dbae reworded instead of removing.
  const msg = capMessage({ tier: "growth", count: 3, cap: 3 });
  expect(msg).not.toMatch(/upgrade/i);
  expect(msg).toMatch(/remove one/i);
});
```

Extract the message into an exported `capMessage({ tier, count, cap })` in `lib/app/add-product.ts` so the test asserts the real string rather than a copy of it.

- [ ] **Step 5: Mutation-prove both guards**

Delete the `removeTrackedProduct(...)` call from `removeProduct` but KEEP the import → the tripwire must FAIL (this is the exact false-negative that shipped in `add-product-policy.test.ts`). Then make `capMessage` unconditional → the copy test must FAIL. Revert both; confirm green.

- [ ] **Step 6: Verify the rendered effect, not the source**

Run the app, sign in as a growth user at cap, and confirm: the error names only real exits; Settings shows the products; removing one frees a slot and `/app/add` then accepts a product.

- [ ] **Step 7: Commit**

```bash
git add lib/app/add-product.ts "app/(app)/app/settings/actions.ts" \
        components/app/captured/settings-main.tsx app/\(app\)/app/settings/settings-actions.test.ts
git commit -m "fix(app): the cap error's exits both exist now — removal shipped, copy honest"
```

---

## WS4 — One score story

**The class:** four different bases rendered as one number, all painted with the same 0–100 bands.

**Evidence (ship-or-die, measured):** `score_total=8`, `searchVisibility=0`, `marketPosition=14`, pillars Content 74 / SEO 60. The `8` is arithmetically correct — `√(66 × 1)`, exactly what invariant #1 was written to produce. **The math is right; the presentation lies.**

| # | Rendered | Source | Basis |
|---|---|---|---|
| 1 | Gauge `8` + `/100` | `discoverabilityScore(reg.total, sv.score)` | v5 geomean |
| 2 | `On-page 66` | `headlineScore` | v4 on-site 8-signal |
| 3 | `Search 0` | `report_payload.searchVisibility.score` | category-strength |
| 4 | `Market Position 14` | `report_payload.marketPosition.total` | off-site cohort-relative |
| 5 | Pillars `Content 74 / SEO 60` | `reg.breakdown` | **decompose #2, NOT #1** |
| 6 | "You vs competitors" | `entityScore` | traffic-dominated — a 4th basis |

> **Invariant #1 is NOT changed by this workstream.** If any task here would move a persisted `score_total`, **stop** and re-open the Change Protocol. Render only.

### Task 4.1: 🔴 BLOCKED — the Outreach bar. Do not execute without the C1 ruling.

**See `plans/2026-07-17-MERGE-CONTRACT-three-plans.md` § C1.**

**This task was WRONG as first written and is retained only so the error isn't repeated.** It said *"delete the Outreach bar — it can never render"*, on the premise that `headlineScore` filters to `FIXED_BASIS_SIGNAL_KEYS` (5 SEO + 3 content, zero outreach) so `outreach.assessed` is always false.

**The premise is false.** Verified 2026-07-17 against `scan_signals` for resend's **free** scan `14533748…`:

```
outreach | fail       | 1 row  | comparison_pages     ← MEASURED, and FAILING
outreach | unmeasured | 4 rows | community_presence, marketplace_presence, press_mentions, share_of_voice
```

`comparison_pages` (`pillar: outreach`, weight 0.15, `lib/scan/signals.ts:92`) **is measured on a free scan and it fails**. The bar is unrenderable only because the dashboard decomposes the *headline's* fixed basis, which excludes it by design (invariant #1). Deleting the bar would **hide a real failing signal** — and would silently pre-empt Plan B's deferred item on the same disagreement.

That is the `735dbae` class repeating: reword/remove a dead row without asking **why** it's dead. The real class is that the pillar bars present as *"your pillars"* while decomposing a basis that is deliberately on-page-only, so any measured off-site signal is invisible by construction.

- [ ] **Step 1: Get the C1 ruling** (merge contract § C1 — options 1/2/3; recommendation is 3, or 1 with Plan B's deferred item closed in the same release).
- [ ] **Step 2: Adopt Plan B §6's `Measured` contract** rather than inventing a parallel basis label (merge contract § S3).
- [ ] **Step 3:** Implement the ruling TDD, guard mutation-proven, DS mirrors diffed (Task 4.5).

### Task 4.2: Market Position into the header, framed "vs rivals"

- [ ] Render `marketPosition` beside the gauge as the explicit **off-site** number, labelled "vs rivals". Keep its null states (free scan / deep pass not yet run → `marketPosition: null`).
- [ ] Test both states render without contradicting the gauge.
- [ ] Commit.

### Task 4.3: Gauge legibility + honest bar labels

- [ ] `components/app/intel/kit.tsx:102-103` — `8` at 42px over `/ 100` at 11px reads as **8/10** (owner report, 2026-07-17). Rebalance so the denominator is legible. Tokens only.
- [ ] Relabel the pillar bars to say they decompose **on-page readiness**, not the gauge.
- [ ] Delete the stale comment at `app/(app)/app/dashboard/page.tsx:128-133` — it claims "gauge == pillar average", true under v4, false since v5, sitting 25 lines above the code that disproves it.
- [ ] Commit.

### Task 4.4: `estGain` is quoted in a currency that cannot move the gauge

`components/app/intel/dashboard-hero.tsx:210` promises *"could add ~+6 pts to your score"*, computed as `PILLAR_WEIGHTS[weakest] × gap` — **v4 on-site points**. Under the geomean with `search = 0`, on-page 66→72 moves the gauge **8 → 8**. The advertised gain cannot materialise.

- [ ] **Step 1: Failing test**

```ts
it("never promises points the geomean cannot deliver while search presence is 0", () => {
  render(<DashboardHero {...baseProps} onPageReadiness={66} searchPresence={0} score={8} />);
  expect(screen.queryByText(/\+\d+ pts/)).toBeNull();
});
```

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3:** Compute the gain in the **gauge's** currency: `discoverabilityScore(onPage + gap, searchPresence) − discoverabilityScore(onPage, searchPresence)`. When it rounds to 0, say what actually moves the number (search presence) instead of quoting a fake delta. **Degrade, never invent.**
- [ ] **Step 4: Run — expect PASS**; **Step 5:** mutation-prove; **Step 6:** commit.

### Task 4.5: Reconcile the DS mirrors + docs (Change Protocol, same commit)

- [ ] `DashboardScreen` and `LeverBanner` mirror `dashboard-hero.tsx` and are **already STALE**. Diff each against the live file and update. **Never bless a card you have not diffed** — a bless re-pins a hash and verifies nothing.
- [ ] `node .design-sync/ds-src/build.mjs && node .design-sync/ds-src/layout.mjs && node scripts/gen-card-labels.mjs`, then `pnpm check:design`.
- [ ] `pnpm bless:design -- DashboardScreen LeverBanner` (scoped to the cards actually diffed).
- [ ] Update `CLAUDE.md` invariant #1's rendering note + `docs/architecture.md`.
- [ ] Commit everything together.

---

## WS1 — One onboarding, every product

**The ask (owner, 2026-07-17):** *"Onboarding should always be a single entry point where the user gives the app they want to scan, it processes a little, then gives them the options to select their competitors and finish the scan."* And for add-product: *"the only additional step in the onboarding is that they give the URL."*

**This is not an override — it completes spec `2026-07-15`'s own Goal 2** (*"reuse the existing post-upgrade onboarding where it genuinely applies, with a first step for choosing the product"*). §47 already establishes profile is per-USER and only competitors is per-app.

**The whole divergence is one line** — `lib/app/setup-state.ts:16`: `return args.appCount <= 1`.

**Preserve PR #72's real invariant:** *adding product #2 never inerts product #1*. Satisfied by putting the step on the `/app/add` **route** (navigable away from), not the global overlay — so `appCount <= 1` **disappears rather than inverting**.

**Already works, do not rebuild:** the upgrade path (`SetupOverlay`: Profile → Competitors → Calculating) with a background deepen from the webhook. Competitor candidates seed from the **free** scan's collect phase (`/api/competitors/candidates`), so they do **not** need the deep pass — the two are correctly decoupled and the pick can overlap the deep scan (`lib/scan/full-scan.ts:680-684`: the pipeline does not consume user-selected competitors).

### Task 1.1: `/app/add` becomes a 3-step route

**Files:** `app/(app)/app/add/page.tsx`, create `app/(app)/app/add/add-flow.tsx`, modify `app/(app)/app/add/actions.ts`

- [ ] **Step 1:** `addProduct` returns `{ appId, scanId }` instead of `redirect("/app/dashboard")`. Update `app/(app)/app/add/actions.test.ts` — the existing cap/already-tracked/paused tests must still pass.
- [ ] **Step 2:** `add-flow.tsx` — a client stepper: **URL** → **Scanning** → **Competitors**.
  - Scanning: reuse `DashboardScanProgress`'s SSE wiring. **Do not re-implement it** — it now carries the `sinceId` cursor and the time-based ring from PR #90.
  - Advance to Competitors on the **`facts`** event, not `done` (facts lands at t+8.1s measured; `done` at 40–137s). Candidates come from collect, which is finished by then.
  - Competitors: reuse `components/app/setup/competitor-setup.tsx`. **Do not reimplement.**
  - Skippable: "I'll do this later" → `/app/dashboard`. The shell is **never** `inert`.
- [ ] **Step 3:** On finish → `/app/dashboard`.
- [ ] **Step 4:** Verify by rendering, not by reading source. Product #1 must stay reachable in the switcher throughout.
- [ ] **Step 5:** Commit.

### Task 1.2: Retire `appCount <= 1`; the overlay becomes profile-only

**Files:** `lib/app/setup-state.ts`, `lib/app/setup-state.test.ts`, `app/(app)/app/layout.tsx`, `components/app/setup/setup-overlay.tsx`

- [ ] **Step 1: Rewrite the test to the NEW rule first**

```ts
// The competitor step is per-PRODUCT and lives in /app/add (2026-07-17).
// The global overlay blocks for `profile` ONLY — genuinely per-user, first-run.
// `appCount` is no longer consulted: PR #72's invariant (never inert product #1)
// is preserved by WHERE the step lives, not by counting apps.
it("blocks for profile regardless of app count", () => {
  expect(shouldBlockSetup({ onboardedAt: null, setupState: "profile", appCount: 0 })).toBe(true);
  expect(shouldBlockSetup({ onboardedAt: null, setupState: "profile", appCount: 3 })).toBe(true);
});
it("never blocks for competitors — /app/add owns that step now", () => {
  expect(shouldBlockSetup({ onboardedAt: "x", setupState: "competitors", appCount: 1 })).toBe(false);
});
```

- [ ] **Step 2: Run — expect FAIL** (`appCount: 1` + `competitors` currently returns `true`)
- [ ] **Step 3:** Drop the `appCount <= 1` line; simplify `setupState` in `layout.tsx` to `profile | ready`; reduce `SetupOverlay` to the profile step.
- [ ] **Step 4: Run — expect PASS**
- [ ] **Step 5:** Mutation-prove: restore `appCount <= 1` → test FAILS. Revert.
- [ ] **Step 6: ⚠️ The upgrade path must still reach competitors.** Removing the overlay's competitor step means a freshly-upgraded user (Profile → ??? → dashboard) must be routed to the competitor pick. **Verify by driving the flow**, not by reading code — this is the task most likely to silently regress the money path.
- [ ] **Step 7: Change Protocol** — `lib/app/setup-state.ts` doc comment, `CLAUDE.md`, `docs/architecture.md`, and a superseding note in `docs/superpowers/specs/2026-07-15-add-product-onboarding-design.md` recording that the step moved per-product and *why* PR #72's invariant still holds. **Same commit.**
- [ ] **Step 8: Commit.**

---

## WS3 — The free report is usable at ~8s

**Owner target:** 10–15s. **Measured:** total 40.2s — but `facts` (page read, 5 competitors found, real data) lands at **t+8.1s**, already inside the window. Total-under-15s is arithmetically impossible without removing the 22.4s synth call from the critical path; collect is only 6–12s. **Owner decision: reveal at facts, stream the score in. No pipeline cuts.**

### Task 3.1: `runFreeReport` emits progress at all

`lib/scan/free-report.ts:134-237` emits **no scan events whatsoever** — so the free ring is dead from `findings` to `done` (~3–7s), on top of the 22.4s synth gap.

- [ ] Emit an artifact at the **start** of each stage (not the end — the systemic off-by-one: every artifact today is emitted before the work it names, marking a step `done` that hasn't started).
- [ ] Wrap `gatherFreeSearchVisibility` and `persistReport`.
- [ ] Verify against the DB: `select type, payload->>'label', created_at from scan_events where scan_id=… order by id` — **no gap >15s without an artifact.**
- [ ] Commit.

### Task 3.2: Hand off at facts

- [ ] `app/(funnel)/scan/[id]/handoff.ts:27-31` currently `return args.reportReady`. Reveal a usable report shell at `facts`; stream the score in when `findings` lands.
- [ ] Guard: `handoff.test.ts` — facts-ready hands off; a failed scan never does.
- [ ] **Verify by RENDERING the live page** (`chrome --headless --dump-dom --virtual-time-budget`), reading the actual text. The free report is the conversion surface; checking `report_payload` in the DB is how real render bugs shipped before.
- [ ] Commit.

---

## Verification

**Fixtures/eval/code-review all mask real-adapter bugs.** Live-test against real adapters. *(Note: the fixtures flag's status is being changed by the grounding plan's ruling — follow that plan's successor rule, not the old `REACHKIT_USE_FIXTURES=false` wording.)*

1. **Every new guard mutation-proven** — break it, see real failure output, revert, green. Verify the mutation applied.
2. **Gates:** `pnpm test` · `pnpm check:arch` · `pnpm lint` · `pnpm check:design` · `pnpm eval` · `pnpm check:bundle`.
3. **Live E2E** (owner account: `growth`/`active`, 0 apps; `reachkit.app` free scan from 2026-07-16 → hits `deepen`):
   - Add `reachkit.app` at `/app/add` → URL → scanning → competitors → dashboard, one flow, product #1 reachable throughout.
   - A "Refreshing" progress card appears (PR #90); ring climbs smoothly; never sticks at 100%.
   - `tier` free→full, `deepened_at` stamped, score moves off 9.
   - Growth at cap → the error names only exits that exist → remove in Settings → add succeeds.
   - Dashboard shows ONE score story: no Outreach bar, legible `/100`, Market Position "vs rivals", no fake `+N pts`.
4. **Measure, don't assume:**
   ```sql
   select e.type, coalesce(e.payload->>'label','') as label,
          round(extract(epoch from (e.created_at - s.started_at))::numeric,1) as t_plus_s,
          round(extract(epoch from (e.created_at - lag(e.created_at) over (order by e.id)))::numeric,1) as gap_s
   from scan_events e join scans s on s.id = e.scan_id
   where e.scan_id = '<uuid>' order by e.id;
   ```
5. **Render the page, don't read the DB** — free report + dashboard verified by headless render.

---

## Known open risks this plan does NOT close

- **Score calibration** is unresolved and unenforced (the one red rule): SPA-fetch→SEO=0 gives false lows; tidy pages give false 100s. `scripts/score-calibration.mts` is a live tool, not CI.
- **`audienceProxy` always 0** — creator reach is a placeholder.
- **Market-pass parallelization** (`lib/scan/gap/run.ts:32-72`, fully sequential) — owner chose progress-only. Touches the heaviest external-spend path; cohort cache-key drift silently doubles DataForSEO spend.
- **4 `(app)` pages over the bundle budget**, pinned in `KNOWN_OVERAGES_KB`.
- **`.env.prodcheck` sensitive values are empty** (`vercel env pull` won't return them) — no local prod credentials, so no local dispatch of Inngest events.
- **PR #88 is not live-verified** — needs a real €59 checkout.

---

## Self-Review

- **Coverage:** WS1 (onboarding), WS3 (free reveal), WS4 (score coherence), WS6 (removal) — all four outstanding items have tasks. Grounding/fabrication, the fixtures flag, and free↔deep consistency are explicitly **out of scope**, owned by the other two plans.
- **Placeholders:** none — every code step carries real code; every guard step names the mutation to apply.
- **Type consistency:** `removeTrackedProduct(userId, appId)` / `RemoveProductError` / `capMessage({tier,count,cap})` are used consistently across Tasks 6.1, 6.2. `shouldBlockSetup({onboardedAt, setupState, appCount})` keeps its existing signature (the `appCount` field stays in the type; the *rule* stops consulting it) so `layout.tsx`'s call site needs no change beyond the state it can produce.
- **Riskiest task:** 1.2 Step 6 — removing the overlay's competitor step could silently strand freshly-upgraded users. It carries an explicit drive-the-flow verification for that reason.
