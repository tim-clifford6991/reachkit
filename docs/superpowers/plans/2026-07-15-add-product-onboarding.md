# Add-a-product Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A paid user adds a product **inside the app** — never through the public funnel, never shown an upgrade CTA for something they already pay for — and every added product always gets a scan.

**Architecture:** One new in-shell route (`/app/add`) + one server action, both sitting on a **single shared policy** (`resolveProductScan`) that `/api/scan` also calls, so the two paths cannot disagree again. The policy *builds on* the existing dedupe primitives (`classifyUrl` → `findAppByUrl` → `findExistingScanForApp`) and adds exactly one new rule: a 14-day freshness threshold. `SetupOverlay` becomes first-run-only so product #2 can't inert product #1.

**Tech Stack:** Next.js 16 App Router (server actions, RSC), Supabase (service-role `serverDb`), Inngest (`scan/requested`, `scan/deepen`), Vitest (unit + integration).

## Global Constraints

Copied verbatim from CLAUDE.md / the spec. **Every task's requirements implicitly include this section.**

- **Every behavioural change ships a guard in the SAME commit** (test / arch rule / parity check). No exceptions.
- **Ratchets only tighten.** `label-drift-baseline.json`, `coverage-baseline.json`, `KNOWN_CYCLES`, `KNOWN_OVERAGES_KB` only ever shrink. **Never add an entry to a bundle baseline.**
- **Change Protocol** — if an invariant/token/boundary moves: source constant + guard + `CLAUDE.md` + `docs/architecture.md` in the SAME commit.
- **`PublicReport` must stay entitlement-blind.** Never add `currentUser`/`entitlementsFor` to it. We route around it.
- **Honesty:** degrade, never invent. No fabricated numbers, ever.
- **Invariant #2:** every cost-bearing call attributes to a scan → user. New paid work runs under `costedStep`/`costedIntelStep`, and `callModel` inherits `currentScanId()`.
- **Bundle:** `/app/add` is new in the budgeted `(app)` group — must be ≤275 KB and **must not raise any pinned baseline**.
- **`SCAN_STALE_DAYS = 14`** (owner decision, locked).
- **Never run `pnpm build` while `next dev` is running** (corrupts `.next`).
- **Live-test with `REACHKIT_USE_FIXTURES=false`** before trusting the change (Task 8).
- Local runs need `INNGEST_SIGNING_KEY=local-dummy` prefixed (`.env.local` lacks it; env parse fails otherwise).

---

## Findings that change the spec (verified against code — read before starting)

These were confirmed by reading the source. **Two contradict the spec's assumptions.**

1. **⚠ `assertPaid` on `/app/add` would be a REGRESSION.** `addFirstProduct` (`app/(app)/app/settings/actions.ts:121`) uses **`requireUser()` only — no `assertPaid`**. A **free** user with 0 apps can add their first product today. `TIER_LIMITS.free.apps = 1`.
   → **Decision: gate on the TIER CAP, not on `assertPaid`.** Free users keep their 1 slot; Solo 1; Growth 3. The scan's *tier* is set by entitlement (`entitlementsFor(...).active ? "full" : "free"`), exactly as `/api/scan` already does. This preserves today's behaviour and still enforces the cap.

2. **URL collisions are already solved.** `classifyUrl` (`lib/scan/router.ts:5-13`) canonicalises to `https://${bare}/` — scheme added, host lowercased, `www.` stripped, path/query/trailing-slash dropped. `findAppByUrl` matches that exact canonical string. So `nudgi.ai`, `https://nudgi.ai/`, `www.nudgi.ai/x?q=1` → **one app**, *provided we classify BEFORE resolving*. No new normalisation code — but Task 1 pins it with a test.

3. **In-flight + failed scans are already handled.** `findExistingScanForApp` (`lib/scan/abuse.ts:97`) returns: a `done` scan (reuse); else a **running** scan (`queued`/`collecting`/`synthesizing`) created within `IN_FLIGHT_WINDOW_MS` (15 min) — avoiding a duplicate concurrent run; else `null` (failed/stuck ⇒ fresh scan owed).
   → **`resolveProductScan` builds on it.** We do **not** re-implement status logic. We need one extra distinction it doesn't make: *is the reusable scan `done`-and-fresh (deepen) or `done`-but-stale (rescan)?*

4. **Ordering is load-bearing.** `setActiveApp` now (PR #68) **silently returns** if the appId isn't in `user.app_ids`. So the action MUST link to `app_ids` **before** `setActiveApp`, or the active-app set is a no-op and the user lands on the wrong product.

## File Structure

| File | Responsibility |
|---|---|
| `lib/app/add-product.ts` **(create)** | `SCAN_STALE_DAYS`, `ProductScanPlan`, `resolveProductScan()`, `addTrackedProduct()`. The single policy + executor. |
| `lib/app/add-product.test.ts` **(create)** | Unit: the policy's table-driven rules (injected `now`). |
| `app/(app)/app/add/page.tsx` **(create)** | In-shell route: URL field + submit. Server component shell. |
| `app/(app)/app/add/add-product-form.tsx` **(create)** | Client island: the form + inline errors. |
| `app/(app)/app/add/actions.ts` **(create)** | `addProduct(url)` server action: gate → classify → resolve → execute → link → activate → redirect. |
| `app/api/scan/route.ts` **(modify)** | Paid dedupe branch calls `resolveProductScan` instead of its inline logic. |
| `app/api/add-product-policy.test.ts` **(create)** | **Tripwire**: both callers use `resolveProductScan` (idiom of `costed-routes.test.ts`). |
| `components/app/captured/app-switcher-menu.tsx` **(modify)** | `+ Add product` → `/app/add` (at-cap upgrade path unchanged). |
| `app/(app)/app/layout.tsx` **(modify)** | `SetupOverlay` blocks first-run only. |
| `app/(app)/app/settings/actions.ts` **(modify)** | `addFirstProduct` delegates to `addTrackedProduct`. |
| `lib/app/add-first-product.ts` **(delete)** | Retired into `add-product.ts`. |
| `tests/integration/add-first-product.test.ts` **(modify→rename)** | **Migrate, don't delete** — zero→one still needs coverage. |
| `tests/integration/add-product.test.ts` **(create)** | Integration: end-to-end against real Supabase. |

---

### Task 1: The shared policy — `resolveProductScan`

**Files:**
- Create: `lib/app/add-product.ts`
- Test: `lib/app/add-product.test.ts`

**Interfaces:**
- Consumes: `findAppByUrl`, `findExistingScanForApp` (`@/lib/scan/abuse`); `serverDb` (`@/lib/db/client`).
- Produces: `SCAN_STALE_DAYS: 14`; `type ProductScanPlan = {kind:"deepen";appId:string;scanId:string} | {kind:"rescan";appId:string} | {kind:"attach";appId:string;scanId:string} | {kind:"fresh"}`; `resolveProductScan(canonicalUrl: string, opts: { paid: boolean; now?: Date }): Promise<ProductScanPlan>`.

> **`attach` is a fourth kind the spec didn't name.** `findExistingScanForApp` can return a **running** scan (<15 min). Triggering another scan on it would duplicate a paid run. `attach` = "a scan is already in flight; link + watch it, trigger nothing."

- [ ] **Step 1: Write the failing test**

```ts
// lib/app/add-product.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const findAppByUrl = vi.fn();
const findExistingScanForApp = vi.fn();
vi.mock("@/lib/scan/abuse", () => ({ findAppByUrl: (...a: unknown[]) => findAppByUrl(...a), findExistingScanForApp: (...a: unknown[]) => findExistingScanForApp(...a) }));

const scanRow = vi.fn();
vi.mock("@/lib/db/client", () => ({
  serverDb: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => scanRow() }) }) }) }),
}));

const NOW = new Date("2026-07-15T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

describe("resolveProductScan (invariant: ONE dedupe/staleness policy)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("no app for the URL → fresh", async () => {
    findAppByUrl.mockResolvedValue(null);
    const { resolveProductScan } = await import("./add-product");
    expect(await resolveProductScan("https://x.com/", { paid: true, now: NOW })).toEqual({ kind: "fresh" });
  });

  it("done scan 4 days old → deepen (reuse; nudgi.ai's real case)", async () => {
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue("scan1");
    scanRow.mockReturnValue({ data: { status: "done", created_at: daysAgo(4) } });
    const { resolveProductScan } = await import("./add-product");
    expect(await resolveProductScan("https://x.com/", { paid: true, now: NOW })).toEqual({ kind: "deepen", appId: "app1", scanId: "scan1" });
  });

  it("done scan 15 days old → rescan (never present stale data as current)", async () => {
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue("scan1");
    scanRow.mockReturnValue({ data: { status: "done", created_at: daysAgo(15) } });
    const { resolveProductScan } = await import("./add-product");
    expect(await resolveProductScan("https://x.com/", { paid: true, now: NOW })).toEqual({ kind: "rescan", appId: "app1" });
  });

  it("exactly 14 days → deepen (boundary is inclusive)", async () => {
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue("scan1");
    scanRow.mockReturnValue({ data: { status: "done", created_at: daysAgo(14) } });
    const { resolveProductScan } = await import("./add-product");
    expect((await resolveProductScan("https://x.com/", { paid: true, now: NOW })).kind).toBe("deepen");
  });

  it("app exists but no reusable scan (failed/stuck) → rescan", async () => {
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue(null);
    const { resolveProductScan } = await import("./add-product");
    expect(await resolveProductScan("https://x.com/", { paid: true, now: NOW })).toEqual({ kind: "rescan", appId: "app1" });
  });

  it("a scan is already RUNNING → attach, never trigger a duplicate paid run", async () => {
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue("scan1");
    scanRow.mockReturnValue({ data: { status: "collecting", created_at: daysAgo(0) } });
    const { resolveProductScan } = await import("./add-product");
    expect(await resolveProductScan("https://x.com/", { paid: true, now: NOW })).toEqual({ kind: "attach", appId: "app1", scanId: "scan1" });
  });

  it("free viewer NEVER rescans a stale scan (cost guard: free dedupe is unchanged)", async () => {
    findAppByUrl.mockResolvedValue("app1");
    findExistingScanForApp.mockResolvedValue("scan1");
    scanRow.mockReturnValue({ data: { status: "done", created_at: daysAgo(90) } });
    const { resolveProductScan } = await import("./add-product");
    expect(await resolveProductScan("https://x.com/", { paid: false, now: NOW })).toEqual({ kind: "attach", appId: "app1", scanId: "scan1" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/app/add-product.test.ts`
Expected: FAIL — `Failed to resolve import "./add-product"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/app/add-product.ts
/**
 * The SINGLE product-resolution policy (spec: 2026-07-15-add-product-onboarding).
 *
 * Two paths already disagreed on what a URL means — `/api/scan` find-or-creates,
 * `addFirstTrackedProduct` always inserted — and that disagreement is what
 * produced nudgi.ai's incoherent live state (an anonymous free scan hand-attached
 * to a paid account: paid dashboard over free data). Every caller now asks this.
 *
 * It BUILDS ON the existing dedupe primitives rather than re-implementing them:
 * `findExistingScanForApp` already resolves done-vs-running-vs-dead. The only new
 * rule here is freshness.
 */
import { findAppByUrl, findExistingScanForApp } from "@/lib/scan/abuse";
import { serverDb } from "@/lib/db/client";

/** Deepen a scan at most this old; older ⇒ re-scan. Weekly refresh keeps a healthy
 *  tracked app <7d, so 14 is a grace margin (owner decision 2026-07-15). */
export const SCAN_STALE_DAYS = 14;

export type ProductScanPlan =
  | { kind: "deepen"; appId: string; scanId: string }
  | { kind: "rescan"; appId: string }
  | { kind: "attach"; appId: string; scanId: string }
  | { kind: "fresh" };

export async function resolveProductScan(
  canonicalUrl: string,
  opts: { paid: boolean; now?: Date },
): Promise<ProductScanPlan> {
  const now = opts.now ?? new Date();
  const appId = await findAppByUrl(canonicalUrl);
  if (!appId) return { kind: "fresh" };

  const scanId = await findExistingScanForApp(appId);
  if (!scanId) return { kind: "rescan", appId }; // failed/stuck ⇒ owed a scan

  const { data } = await serverDb().from("scans").select("status, created_at").eq("id", scanId).maybeSingle();
  // Running (<15min per findExistingScanForApp) — never trigger a duplicate run.
  if (!data || data.status !== "done") return { kind: "attach", appId, scanId };

  // A free viewer never pays for a re-scan: existing dedupe semantics, unchanged.
  if (!opts.paid) return { kind: "attach", appId, scanId };

  const ageDays = (now.getTime() - new Date(data.created_at as string).getTime()) / 86_400_000;
  return ageDays <= SCAN_STALE_DAYS ? { kind: "deepen", appId, scanId } : { kind: "rescan", appId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/app/add-product.test.ts`
Expected: PASS — 7 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/app/add-product.ts lib/app/add-product.test.ts
git commit -m "feat(add-product): one shared resolveProductScan policy (14d staleness)"
```

---

### Task 2: Pin URL canonicalisation (the collision edge case)

**Files:**
- Modify: `lib/app/add-product.test.ts`

**Interfaces:**
- Consumes: `classifyUrl` (`@/lib/scan/router`), `resolveProductScan` (Task 1).
- Produces: nothing new — a guard.

> Canonicalisation already works, but nothing pins the **contract that callers must classify BEFORE resolving**. Without that, a caller passing a raw URL silently creates a duplicate app per variant, which breaks the per-domain cache dedupe and doubles DataForSEO spend.

- [ ] **Step 1: Write the failing test**

```ts
// append to lib/app/add-product.test.ts
import { classifyUrl } from "@/lib/scan/router";

describe("URL canonicalisation contract (classify BEFORE resolve)", () => {
  it("every variant of one domain canonicalises to ONE app key", () => {
    const variants = ["nudgi.ai", "https://nudgi.ai", "https://nudgi.ai/", "https://www.nudgi.ai/", "HTTPS://WWW.Nudgi.AI/pricing?utm=x"];
    const canon = variants.map((v) => classifyUrl(v).url);
    expect(new Set(canon).size).toBe(1);
    expect(canon[0]).toBe("https://nudgi.ai/");
  });

  it("resolveProductScan is called with the CANONICAL url, so lookups can't miss", async () => {
    findAppByUrl.mockResolvedValue(null);
    const { resolveProductScan } = await import("./add-product");
    await resolveProductScan(classifyUrl("WWW.Nudgi.AI/x?q=1").url, { paid: true, now: NOW });
    expect(findAppByUrl).toHaveBeenCalledWith("https://nudgi.ai/");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/app/add-product.test.ts`
Expected: FAIL initially only if canonicalisation regresses. If it passes immediately, that is correct — it is a **pinning** test for existing behaviour. Confirm it bites by temporarily changing `lib/scan/router.ts:12` to `const bare = host;` (keep `www.`), re-run → FAIL, then revert.

- [ ] **Step 3: No implementation needed**

Behaviour already correct (`lib/scan/router.ts:5-13`). This task only adds the guard.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/app/add-product.test.ts`
Expected: PASS — 9 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/app/add-product.test.ts
git commit -m "test(add-product): pin URL canonicalisation contract (one app per domain)"
```

---

### Task 3: `addTrackedProduct` — the executor (cap, race, ordering)

**Files:**
- Modify: `lib/app/add-product.ts`
- Test: `lib/app/add-product.test.ts`

**Interfaces:**
- Consumes: `resolveProductScan` (Task 1); `entitlementsFor` (`@/lib/billing/entitlements`); `TIER_LIMITS` (`@/lib/billing/tiers`); `ensureDeepScan` (`@/lib/scan/deepen`); `inngest` (`@/lib/inngest/client`); `env` (`@/lib/config/env`).
- Produces: `class AddProductError extends Error { code: "cap" | "already_tracked" | "invalid_url" | "paused" }`; `addTrackedProduct(userId: string, rawUrl: string): Promise<{ appId: string; scanId: string | null }>`.

> **Three edge cases handled here:**
> 1. **Cap** — refuse BEFORE creating anything. Today `linkScanToUser` *silently* returns false at the cap, so the scan runs, spends money, and the product never appears.
> 2. **Concurrent-add race** — cap is check-then-act. Two tabs can both pass. We re-read `app_ids` immediately before the write and re-assert; a true simultaneous double-write is bounded by the cap re-check (full DB-level enforcement would need a constraint — noted as a follow-up, not shipped here).
> 3. **`SCANNING_ENABLED=false`** — the P4 kill switch must hold on this path too.

- [ ] **Step 1: Write the failing test**

```ts
// append to lib/app/add-product.test.ts
describe("addTrackedProduct (cap · already-tracked · paused)", () => {
  it("refuses at the tier cap WITHOUT creating anything (no silent untracked scan)", async () => {
    const { addTrackedProduct, AddProductError } = await import("./add-product");
    setUser({ tier: "growth", app_ids: ["a", "b", "c"] }); // growth cap = 3
    await expect(addTrackedProduct("u1", "https://new.com/")).rejects.toMatchObject({ code: "cap" });
    expect(findAppByUrl).not.toHaveBeenCalled();
  });

  it("refuses a URL the user already tracks (no slot burned, no spend)", async () => {
    const { addTrackedProduct } = await import("./add-product");
    setUser({ tier: "growth", app_ids: ["app1"] });
    findAppByUrl.mockResolvedValue("app1");
    await expect(addTrackedProduct("u1", "https://x.com/")).rejects.toMatchObject({ code: "already_tracked" });
  });

  it("refuses when SCANNING_ENABLED=false (P4 kill switch holds here too)", async () => {
    vi.doMock("@/lib/config/env", () => ({ env: { scanningEnabled: false } }));
    const { addTrackedProduct } = await import("./add-product");
    setUser({ tier: "growth", app_ids: [] });
    await expect(addTrackedProduct("u1", "https://x.com/")).rejects.toMatchObject({ code: "paused" });
  });

  it("a FREE zero-app user CAN add their first product (no assertPaid regression)", async () => {
    const { addTrackedProduct } = await import("./add-product");
    setUser({ tier: "free", app_ids: [] }); // free cap = 1
    findAppByUrl.mockResolvedValue(null);
    await expect(addTrackedProduct("u1", "https://x.com/")).resolves.toMatchObject({ appId: expect.any(String) });
  });
});
```
`setUser` is a helper the implementer adds to the existing `serverDb` mock: it makes `from("users").select("tier, app_ids").eq("id").maybeSingle()` return the given row.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/app/add-product.test.ts`
Expected: FAIL — `addTrackedProduct is not a function`.

- [ ] **Step 3: Write the implementation**

```ts
// append to lib/app/add-product.ts
import { classifyUrl } from "@/lib/scan/router";
import { entitlementsFor } from "@/lib/billing/entitlements";
import { TIER_LIMITS, isTier } from "@/lib/billing/tiers";
import { ensureDeepScan } from "@/lib/scan/deepen";
import { inngest } from "@/lib/inngest/client";
import { env } from "@/lib/config/env";

export class AddProductError extends Error {
  constructor(public code: "cap" | "already_tracked" | "invalid_url" | "paused", message: string) {
    super(message);
    this.name = "AddProductError";
  }
}

/**
 * Add a tracked product for `userId`, always producing a scan.
 *
 * NOT assertPaid-gated — deliberately. `addFirstProduct` (the Settings zero-app
 * form this replaces) is `requireUser`-only, so a FREE user can add their first
 * product today; gating on payment here would be a REGRESSION. The TIER CAP is
 * the real limit (free 1 / solo 1 / growth 3), and entitlement decides the scan's
 * TIER, mirroring /api/scan.
 */
export async function addTrackedProduct(userId: string, rawUrl: string): Promise<{ appId: string; scanId: string | null }> {
  if (!env.scanningEnabled) throw new AddProductError("paused", "Scanning is temporarily paused. Please try again shortly.");

  let routed;
  try { routed = classifyUrl(rawUrl); }
  catch { throw new AddProductError("invalid_url", "That doesn't look like a valid website address."); }

  const db = serverDb();
  const { data: user } = await db.from("users").select("tier, app_ids").eq("id", userId).maybeSingle();
  if (!user) throw new AddProductError("invalid_url", "Account not found.");

  const appIds: string[] = user.app_ids ?? [];
  const tier = isTier(user.tier as string) ? (user.tier as keyof typeof TIER_LIMITS) : "free";
  const cap = TIER_LIMITS[tier].apps;
  // Cap FIRST — before any lookup/create/spend. (linkScanToUser fails silently here.)
  if (appIds.length >= cap) {
    throw new AddProductError("cap", `You're tracking ${appIds.length} of ${cap} products on ${tier}. Upgrade or remove one to add another.`);
  }

  const { active: paid } = await entitlementsFor(userId);
  const plan = await resolveProductScan(routed.url, { paid });

  const existingAppId = "appId" in plan ? plan.appId : null;
  if (existingAppId && appIds.includes(existingAppId)) {
    throw new AddProductError("already_tracked", "You're already tracking this product.");
  }

  let appId: string;
  let scanId: string | null = null;
  if (plan.kind === "fresh") {
    const app = await db.from("apps").insert({ store_url: routed.url, platform: routed.platform }).select("id").single();
    if (app.error || !app.data) throw new Error(`addTrackedProduct: create app failed — ${app.error?.message}`);
    appId = app.data.id;
    scanId = await startScan(appId, paid);
  } else if (plan.kind === "rescan") {
    appId = plan.appId;
    scanId = await startScan(appId, paid);
  } else if (plan.kind === "deepen") {
    appId = plan.appId;
    scanId = plan.scanId;
    if (paid) await ensureDeepScan(plan.scanId); // flips tier→full, emits scan/deepen
  } else {
    appId = plan.appId;   // attach — a scan is already running; watch it
    scanId = plan.scanId;
  }

  // Re-read + re-assert the cap immediately before the write (check-then-act race).
  const { data: fresh } = await db.from("users").select("app_ids").eq("id", userId).maybeSingle();
  const nowIds: string[] = fresh?.app_ids ?? [];
  if (nowIds.includes(appId)) return { appId, scanId };
  if (nowIds.length >= cap) throw new AddProductError("cap", `You're tracking ${nowIds.length} of ${cap} products on ${tier}.`);

  // ORDER IS LOAD-BEARING: link BEFORE any setActiveApp — setActiveApp silently
  // no-ops when the appId isn't yet in app_ids (PR #68 ownership check).
  const { error: linkErr } = await db.from("users").update({ app_ids: [...nowIds, appId] }).eq("id", userId);
  if (linkErr) throw new Error(`addTrackedProduct: link failed — ${linkErr.message}`);

  return { appId, scanId };
}

/** Insert a scan row at the viewer's tier and kick the pipeline. Mirrors /api/scan. */
async function startScan(appId: string, paid: boolean): Promise<string | null> {
  const scan = await serverDb().from("scans").insert({ app_id: appId, status: "queued", tier: paid ? "full" : "free" }).select("id").single();
  if (scan.error || !scan.data) {
    console.error("[add-product] scan row insert failed", scan.error?.message);
    return null; // app still links; the dashboard offers retry (never strand a slot)
  }
  await inngest.send({ name: "scan/requested", data: { scanId: scan.data.id } });
  return scan.data.id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/app/add-product.test.ts`
Expected: PASS — 13 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/app/add-product.ts lib/app/add-product.test.ts
git commit -m "feat(add-product): addTrackedProduct — cap-gated (not paid-gated), race re-check, link before activate"
```

---

### Task 4: Point `/api/scan` at the shared policy + tripwire

**Files:**
- Modify: `app/api/scan/route.ts:56-72` (the dedupe branch)
- Create: `app/api/add-product-policy.test.ts`

**Interfaces:**
- Consumes: `resolveProductScan` (Task 1).
- Produces: nothing — convergence + a guard.

> Without the tripwire the two paths drift apart again, which is the whole reason this spec exists.

- [ ] **Step 1: Write the failing tripwire**

```ts
// app/api/add-product-policy.test.ts
/**
 * ONE product-resolution policy (spec 2026-07-15). `/api/scan` and the in-app add
 * MUST both ask `resolveProductScan`. They disagreed before — /api/scan
 * find-or-created while addFirstTrackedProduct always inserted — and that
 * disagreement produced nudgi.ai's incoherent state (paid dashboard over an
 * anonymous free scan). Source tripwire, same idiom as costed-routes.test.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CALLERS = ["app/api/scan/route.ts", "lib/app/add-product.ts"];

describe("single product-resolution policy (ratchet)", () => {
  for (const rel of CALLERS) {
    it(`${rel} resolves products through resolveProductScan`, () => {
      const src = readFileSync(resolve(process.cwd(), rel), "utf8");
      expect(src, `${rel} must use resolveProductScan — never its own dedupe/staleness logic`).toMatch(/resolveProductScan/);
    });
  }

  it("addFirstTrackedProduct is gone (its always-insert contradicted the policy)", () => {
    expect(() => readFileSync(resolve(process.cwd(), "lib/app/add-first-product.ts"), "utf8")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test app/api/add-product-policy.test.ts`
Expected: FAIL — `app/api/scan/route.ts must use resolveProductScan`.

- [ ] **Step 3: Rewire the dedupe branch**

Replace the existing block in `app/api/scan/route.ts`:

```ts
  // Resolve what this URL means through the ONE shared policy (spec 2026-07-15)
  // so the public scan route and the in-app add can never disagree again.
  const plan = await resolveProductScan(routed.url, { paid: viewerIsPaid });
  if (plan.kind === "deepen" || plan.kind === "attach") {
    if (viewer) await linkScanToUser(plan.scanId, viewer.user.id);
    if (viewerIsPaid && plan.kind === "deepen") await ensureDeepScan(plan.scanId);
    const slug = slugForScan({ storeUrl: routed.url, platform: routed.platform, scanId: plan.scanId });
    return NextResponse.json({ scan_id: plan.scanId, slug, deduped: true });
  }
  // fresh | rescan → fall through to create the scan row below.
  let appId = plan.kind === "rescan" ? plan.appId : null;
  if (!appId) {
    const app = await db.from("apps").insert({ store_url: routed.url, platform: routed.platform }).select("id").single();
    if (app.error) return NextResponse.json({ error: app.error.message }, { status: 500 });
    appId = app.data.id;
  }
```
Add `import { resolveProductScan } from "@/lib/app/add-product";` and drop the now-unused `findAppByUrl`/`findExistingScanForApp` imports.

> **Behaviour change to note in the PR body:** a paid viewer re-opening a >14-day-old scan now gets a **re-scan** rather than a deepen of stale data. That is the owner's explicit intent.

- [ ] **Step 4: Run the tripwire + the route's existing tests**

Run: `pnpm test app/api/add-product-policy.test.ts app/api/scan/route.test.ts app/api/scan/route.tier.test.ts`
Expected: PASS. If `route.tier.test.ts` fails, its `serverDb` mock needs `resolveProductScan`'s lookups mocked — mock `@/lib/app/add-product` to return `{kind:"fresh"}` in those tier tests (they assert scan-row tier, not dedupe).

- [ ] **Step 5: Commit**

```bash
git add app/api/scan/route.ts app/api/add-product-policy.test.ts
git commit -m "refactor(scan): /api/scan resolves via the shared policy + tripwire pinning both callers"
```

---

### Task 5: The `/app/add` route + server action

**Files:**
- Create: `app/(app)/app/add/page.tsx`, `app/(app)/app/add/add-product-form.tsx`, `app/(app)/app/add/actions.ts`
- Modify: `components/app/captured/app-switcher-menu.tsx:100`

**Interfaces:**
- Consumes: `addTrackedProduct`, `AddProductError` (Task 3); `setActiveApp` (`@/lib/app/set-active-app`); `requireUser` (`@/lib/auth/server`).
- Produces: `addProduct(_prev: AddState, form: FormData): Promise<AddState>` where `type AddState = { error: string | null }`.

- [ ] **Step 1: Write the server action**

```ts
// app/(app)/app/add/actions.ts
"use server";
import { redirect } from "next/navigation";
import { requireUser, AuthError } from "@/lib/auth/server";
import { addTrackedProduct, AddProductError } from "@/lib/app/add-product";
import { setActiveApp } from "@/lib/app/set-active-app";

export type AddState = { error: string | null };

export async function addProduct(_prev: AddState, form: FormData): Promise<AddState> {
  const url = String(form.get("url") ?? "").trim();
  if (!url) return { error: "Enter your product's website address." };

  let userId: string;
  try { ({ user: { id: userId } } = await requireUser()); }
  catch (e) { if (e instanceof AuthError) redirect("/login?next=/app/add"); throw e; }

  let appId: string;
  try { ({ appId } = await addTrackedProduct(userId, url)); }
  catch (e) {
    if (e instanceof AddProductError) return { error: e.message };
    console.error("[add-product] failed", e);
    return { error: "Couldn't add that product. Please try again." };
  }

  // Link happened inside addTrackedProduct — REQUIRED before this call, which
  // silently no-ops for an app the user doesn't own (PR #68 ownership check).
  await setActiveApp(appId);
  redirect("/app/dashboard");
}
```

- [ ] **Step 2: Write the client form**

```tsx
// app/(app)/app/add/add-product-form.tsx
"use client";
import { useActionState } from "react";
import { addProduct, type AddState } from "./actions";

const PJ = "var(--font-sans)";

export function AddProductForm() {
  const [state, action, pending] = useActionState<AddState, FormData>(addProduct, { error: null });
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
      <label htmlFor="url" style={{ fontSize: 13, fontWeight: 600, color: "var(--c-ink)" }}>Product website</label>
      <input id="url" name="url" placeholder="yourproduct.com" autoComplete="off" required
        style={{ fontFamily: PJ, fontSize: 14, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-surface)", color: "var(--c-ink)" }} />
      {state.error && <div role="alert" style={{ fontSize: 12.5, color: "#B23B3B" }}>{state.error}</div>}
      <button type="submit" disabled={pending}
        style={{ alignSelf: "flex-start", fontFamily: PJ, fontWeight: 600, fontSize: 13, color: "#fff", background: pending ? "#A99BF3" : "var(--c-action)", border: "none", borderRadius: 8, padding: "9px 16px", cursor: pending ? "not-allowed" : "pointer" }}>
        {pending ? "Adding…" : "Add product"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Write the page + repoint the switcher**

```tsx
// app/(app)/app/add/page.tsx
/**
 * /app/add — add a tracked product from INSIDE the app.
 *
 * Replaces the switcher's old link to the PUBLIC /scan page, which pushed a
 * paying user to /scan/{slug} — an entitlement-blind PublicReport that always
 * redacts to free and always shows an "Unlock full report" CTA, for a product
 * they already pay for. PublicReport is deliberately public-safe; we route
 * around it rather than weaken it.
 */
import { buildMetadata } from "@/lib/seo";
import { AddProductForm } from "./add-product-form";

export const metadata = buildMetadata({ title: "Add a product", path: "/app/add" });

export default function AddProductPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 640 }}>
      <p style={{ fontSize: 14, color: "var(--c-muted)", margin: 0 }}>
        We'll scan it and start tracking its discoverability. This takes about a minute — you can keep using your other products while it runs.
      </p>
      <div style={{ marginTop: 10 }}><AddProductForm /></div>
    </div>
  );
}
```
In `components/app/captured/app-switcher-menu.tsx:100`, change `href={canAddApp ? "/scan" : "/app/billing"}` → `href={canAddApp ? "/app/add" : "/app/billing"}`. Leave the `!canAddApp && addAppUpgradePlan` checkout branch untouched.

- [ ] **Step 4: Verify — build, bundle, and that the switcher no longer points at the public funnel**

```bash
pkill -f "next dev"; rm -rf .next
INNGEST_SIGNING_KEY=local-dummy pnpm build && node scripts/check-bundle.mjs; echo "bundle exit=$?"
grep -c '"/scan"' components/app/captured/app-switcher-menu.tsx   # expect 0
```
Expected: build exit 0 · bundle exit 0 · `/app/add` ≤275 KB · **no pinned baseline raised** · grep prints `0`.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/app/add" components/app/captured/app-switcher-menu.tsx
git commit -m "feat(add-product): in-shell /app/add route — paid adds never touch the public funnel"
```

---

### Task 6: Retire `addFirstTrackedProduct` + migrate its test

**Files:**
- Modify: `app/(app)/app/settings/actions.ts:146`
- Delete: `lib/app/add-first-product.ts`
- Modify→rename: `tests/integration/add-first-product.test.ts` → `tests/integration/add-product.test.ts`

**Interfaces:**
- Consumes: `addTrackedProduct` (Task 3).
- Produces: nothing.

> **Migrate, don't delete.** The zero→one transition still needs coverage; deleting the test to make a refactor pass is exactly the ratchet violation CLAUDE.md forbids. Retiring this also fixes the unscanned-app hole (its own doc: *"the new, **unscanned** app"*).

- [ ] **Step 1: Rewrite the integration test against the new lib**

```ts
// tests/integration/add-product.test.ts  (renamed from add-first-product.test.ts)
/**
 * addTrackedProduct — zero→one AND N→N+1 (supersedes add-first-product.test.ts).
 * Run: INNGEST_SIGNING_KEY=local-dummy pnpm test:int tests/integration/add-product.test.ts
 */
import { afterAll, expect, test } from "vitest";
import { serverDb } from "@/lib/db/client";
import { addTrackedProduct, AddProductError } from "@/lib/app/add-product";

const db = serverDb();
const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const users: string[] = []; const apps: string[] = [];
afterAll(async () => {
  for (const id of users) await db.from("users").delete().eq("id", id);
  for (const id of apps) await db.from("apps").delete().eq("id", id);
});
async function seedUser(tier: string, appIds: string[] = []) {
  const { data } = await db.from("users").insert({ email: `add-${stamp()}@test.local`, tier, app_ids: appIds }).select("id").single();
  users.push(data!.id); return data!.id as string;
}

test("zero-app user: creates the app, links it, AND starts a scan (the old lib created an UNSCANNED app)", async () => {
  const userId = await seedUser("growth");
  const url = `https://add-${stamp()}.example.com/`;
  const { appId, scanId } = await addTrackedProduct(userId, url);
  apps.push(appId);
  const { data: user } = await db.from("users").select("app_ids").eq("id", userId).single();
  expect(user!.app_ids).toEqual([appId]);
  expect(scanId, "a product must never be added without a scan").toBeTruthy();
  const { data: scan } = await db.from("scans").select("tier, app_id").eq("id", scanId!).single();
  expect(scan!.app_id).toBe(appId);
});

test("N→N+1: a growth user adds a SECOND product (the old lib threw here)", async () => {
  const first = await db.from("apps").insert({ store_url: `https://first-${stamp()}.com/`, platform: "web" }).select("id").single();
  apps.push(first.data!.id);
  const userId = await seedUser("growth", [first.data!.id]);
  const { appId } = await addTrackedProduct(userId, `https://second-${stamp()}.example.com/`);
  apps.push(appId);
  const { data: user } = await db.from("users").select("app_ids").eq("id", userId).single();
  expect(user!.app_ids).toHaveLength(2);
});

test("at the tier cap: refuses and creates NOTHING", async () => {
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const a = await db.from("apps").insert({ store_url: `https://cap${i}-${stamp()}.com/`, platform: "web" }).select("id").single();
    apps.push(a.data!.id); ids.push(a.data!.id);
  }
  const userId = await seedUser("growth", ids); // growth cap = 3
  const url = `https://over-${stamp()}.example.com/`;
  await expect(addTrackedProduct(userId, url)).rejects.toBeInstanceOf(AddProductError);
  const { data: app } = await db.from("apps").select("id").eq("store_url", url).maybeSingle();
  expect(app, "a capped add must not leave an orphan app row").toBeNull();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `INNGEST_SIGNING_KEY=local-dummy pnpm test:int tests/integration/add-product.test.ts`
Expected: FAIL — settings still import the old lib / file not yet deleted.

- [ ] **Step 3: Delegate the settings action and delete the old lib**

In `app/(app)/app/settings/actions.ts`, replace the `addFirstTrackedProduct(userId, routed.url, routed.platform)` call with:
```ts
    const { appId } = await addTrackedProduct(userId, url);
    newAppId = appId;
```
and swap the import to `import { addTrackedProduct } from "@/lib/app/add-product";`. Then:
```bash
git rm lib/app/add-first-product.ts tests/integration/add-first-product.test.ts
```

- [ ] **Step 4: Run the suites**

Run: `pnpm test && INNGEST_SIGNING_KEY=local-dummy pnpm test:int tests/integration/add-product.test.ts`
Expected: PASS both. The Task-4 tripwire's "addFirstTrackedProduct is gone" assertion now passes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(add-product): retire addFirstTrackedProduct (always-insert + no scan); migrate its coverage"
```

---

### Task 7: `SetupOverlay` becomes first-run-only

**Files:**
- Modify: `app/(app)/app/layout.tsx:115-127` (the setup gate)
- Test: `lib/app/setup-state.test.ts` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces: `shouldBlockSetup(args: { onboardedAt: string | null; setupState: "profile" | "competitors" | "ready"; appCount: number }): boolean` in `lib/app/setup-state.ts` (create) — extracted so it is testable without rendering the layout.

> Without this the non-blocking decision is undone the moment product #2's scan finishes: `setupState` flips to `competitors` and the overlay **inerts the whole app**, locking the healthy product #1.

- [ ] **Step 1: Write the failing test**

```ts
// lib/app/setup-state.test.ts
import { describe, it, expect } from "vitest";
import { shouldBlockSetup } from "./setup-state";

describe("shouldBlockSetup — the overlay is FIRST-RUN only", () => {
  it("blocks a genuine first run (no profile yet)", () => {
    expect(shouldBlockSetup({ onboardedAt: null, setupState: "profile", appCount: 1 })).toBe(true);
  });
  it("blocks the competitor pick on the user's ONLY app (first run)", () => {
    expect(shouldBlockSetup({ onboardedAt: "2026-07-01", setupState: "competitors", appCount: 1 })).toBe(true);
  });
  it("NEVER blocks when the user has 2+ apps — product #2's setup must not inert product #1", () => {
    expect(shouldBlockSetup({ onboardedAt: "2026-07-01", setupState: "competitors", appCount: 2 })).toBe(false);
  });
  it("never blocks when ready", () => {
    expect(shouldBlockSetup({ onboardedAt: "2026-07-01", setupState: "ready", appCount: 1 })).toBe(false);
  });
  it("still blocks profile even with many apps (profile is per-USER and mandatory)", () => {
    expect(shouldBlockSetup({ onboardedAt: null, setupState: "profile", appCount: 3 })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/app/setup-state.test.ts`
Expected: FAIL — cannot resolve `./setup-state`.

- [ ] **Step 3: Implement + wire into the layout**

```ts
// lib/app/setup-state.ts
/**
 * Should the blocking SetupOverlay render?
 *
 * The overlay inerts the ENTIRE app. That's right for a genuine first run and
 * wrong for an additional product: locking a healthy product #1 behind product
 * #2's competitor pick is exactly what the non-blocking add flow exists to avoid
 * (spec 2026-07-15). Profile is per-USER and stays mandatory.
 */
export function shouldBlockSetup(args: {
  onboardedAt: string | null;
  setupState: "profile" | "competitors" | "ready";
  appCount: number;
}): boolean {
  if (args.setupState === "ready") return false;
  if (args.setupState === "profile") return true;              // per-user, mandatory
  return args.appCount <= 1;                                    // competitors: first app only
}
```
In `app/(app)/app/layout.tsx`, replace `if (setupState !== "ready") {` with:
```ts
  const appCount = (user.app_ids ?? []).length;
  if (shouldBlockSetup({ onboardedAt: user.onboarded_at as string | null, setupState, appCount })) {
```
(import `shouldBlockSetup` from `@/lib/app/setup-state`). The non-blocking competitor prompt for additional products is the dashboard's existing empty/prompt surface — **no new component in this task**.

- [ ] **Step 4: Run tests**

Run: `pnpm test lib/app/setup-state.test.ts && pnpm typecheck`
Expected: PASS — 5 passed; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add lib/app/setup-state.ts lib/app/setup-state.test.ts "app/(app)/app/layout.tsx"
git commit -m "fix(setup): the blocking overlay is first-run only — product #2 can't inert product #1"
```

---

### Task 8: Full gates + live verification + PR

**Files:** none (verification).

- [ ] **Step 1: Run every gate**

```bash
pkill -f "next dev"; rm -rf .next
pnpm typecheck && pnpm lint && pnpm check:arch && pnpm check:design && pnpm test
INNGEST_SIGNING_KEY=local-dummy pnpm build && node scripts/check-bundle.mjs; echo "bundle exit=$?"
```
Expected: typecheck clean · lint 0 errors · arch 0 violations · design exit 0 (**label-drift baseline not raised**) · all unit tests pass · bundle exit 0.

- [ ] **Step 2: Integration against real Supabase**

Run: `INNGEST_SIGNING_KEY=local-dummy pnpm test:int tests/integration/add-product.test.ts`
Expected: 3 passed.

- [ ] **Step 3: LIVE test (`REACHKIT_USE_FIXTURES=false`) — the hard rule**

Fixtures mask real-adapter bugs. On a preview deploy, signed in as a Growth user:
1. AppSwitcher → **+ Add product** → lands on `/app/add` **inside the shell** (sidebar visible) — **not** `/scan`.
2. Submit a brand-new domain → dashboard shows live scan progress; **switch to product #1 mid-scan and confirm it's fully usable** (the non-blocking requirement).
3. Submit a domain you already track → friendly "already tracking" — no new app row, no spend.
4. As a **Growth user at 3 apps** → explicit cap message + upgrade CTA; confirm **no** `apps`/`scans` row was created.
5. Add a domain with a **recent public scan** (e.g. one scanned today) → deepens (fast, no fresh collect).
6. **Confirm you are never shown "Unlock full report"** anywhere in this flow.

- [ ] **Step 4: Verify cost attribution (invariant #2)**

After step 3.2, check `/app/diagnostics` (owner-gated) or query the new scan: `cost_cents`/`dataforseo_cost_cents` populated and **no `pipeline_runs.scan_id IS NULL`** rows created by the add.

- [ ] **Step 5: Open the PR**

Body must state: the entitlement-blind `PublicReport` was **routed around, not weakened**; `/app/add` is **cap-gated, not `assertPaid`-gated** (gating on payment would regress free zero-app users, who can add today via `requireUser`-only Settings); `/api/scan` behaviour change (a paid viewer re-opening a **>14-day-old** scan now re-scans rather than deepening stale data); `addFirstTrackedProduct` retired with its coverage **migrated**; the `SetupOverlay` first-run-only change.

```bash
git push -u origin feat/add-product-onboarding
gh pr create --base main --title "Add-a-product: in-shell paid onboarding + one dedupe policy" --body "..."
```

---

## Follow-ups (explicitly NOT in this plan)

- **DB-level cap enforcement.** The cap is check-then-act; Task 3 re-reads and re-asserts before the write, which bounds but does not eliminate a simultaneous double-add. A real fix needs a DB constraint or a transaction. Low risk (a user racing themselves), non-trivial fix.
- **Shared `apps` rows.** `apps` is keyed by URL globally: two users tracking one URL share an `app_id`, hence scans/actions/competitors. Pre-existing (this is how nudgi.ai's anonymous scan became a tracked app); reused exactly as `/api/scan` already does. Needs a multi-tenancy pass.
- **A richer in-page competitor prompt** for products 2+ (Task 7 relies on the dashboard's existing prompt surface).

## Self-review

**Spec coverage:** entry points → T5 + T6 · shared policy → T1 + T4 · staleness 14d → T1 · route/action → T5 · cap/already-tracked/paused/invalid → T3 · non-blocking progress → T5 (page copy) + T7 (overlay) · overlay change → T7 · retire addFirstTrackedProduct → T6 · guards → T1–T4, T6, T7 · bundle → T5 S4 + T8 · live test → T8. **No spec section unimplemented.**

**Spec corrections made here:** (1) `assertPaid` → **tier-cap gating** (the spec's `assertPaid` would regress free zero-app users — verified against `settings/actions.ts`); (2) a fourth plan kind **`attach`** (the spec's three miss the already-running scan `findExistingScanForApp` returns, which would trigger a duplicate paid run).

**Placeholder scan:** none — every code step carries real code; no "handle errors appropriately".

**Type consistency:** `ProductScanPlan` (T1) is consumed unchanged in T3/T4; `AddProductError.code` union matches every `throw` and the T3 tests; `addTrackedProduct` returns `{appId, scanId}` in T3, destructured identically in T5/T6; `shouldBlockSetup` args match the layout call in T7.
