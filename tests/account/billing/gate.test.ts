// tests/account/billing/gate.test.ts — paid means paid through today, with no
// outstanding invoice (docs/SPEC.md §3 Paid means no outstanding invoice).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { hasActiveAccess, setBillingStore, sitesWithActiveAccess } = await import("@/lib/account/billing");
const { payingSitesAt } = await import("@/lib/account/billing/gate");
const { account, memoryBillingStore, newMemoryBilling, site } = await import("./memory-store");

let state = newMemoryBilling();
const NOW = new Date("2026-09-06T12:00:00.000Z");
const IN_A_MONTH = new Date("2026-10-06T12:00:00.000Z");
const LAST_MONTH = new Date("2026-08-06T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  state = newMemoryBilling();
  setBillingStore(memoryBillingStore(state));
});

afterEach(() => {
  vi.useRealTimers();
  setBillingStore(null);
});

/** One site whose owner is in the given state. */
function given(a: { paidThrough: Date; planStatus?: "active" | "past_due" | "canceled" }): string {
  state.sites.push(site({ id: "site-1", user_id: "u-1", owner_paid_through: a.paidThrough.toISOString() }));
  if (a.planStatus) state.users.push(account({ id: "u-1", plan_status: a.planStatus, paid_through: a.paidThrough.toISOString() }));
  return "site-1";
}

describe("paid through today, with no outstanding invoice", () => {
  it("past_due with a future paid_through is not paid; active is; canceled keeps its paid month", async () => {
    const cases = [["past_due", false], ["active", true], ["canceled", true]] as const;
    for (const [planStatus, paid] of cases) {
      state = newMemoryBilling();
      setBillingStore(memoryBillingStore(state));
      expect(await hasActiveAccess(given({ paidThrough: IN_A_MONTH, planStatus })), planStatus).toBe(paid);
      expect(await payingSitesAt(NOW), planStatus).toBe(paid ? 1 : 0);
    }
  });

  it("active with a past paid_through is not paid", async () => {
    expect(await hasActiveAccess(given({ paidThrough: LAST_MONTH, planStatus: "active" }))).toBe(false);
  });
});

describe("REQ-076 c4 — the gate turns false at the instant the date passes", () => {
  it("true one millisecond before, false at the instant itself", async () => {
    const siteId = given({ paidThrough: NOW });

    vi.setSystemTime(new Date(NOW.getTime() - 1));
    expect(await hasActiveAccess(siteId)).toBe(true);

    // The boundary is exclusive: `paid_through > now()`, so the instant
    // itself is not access.
    vi.setSystemTime(NOW);
    expect(await hasActiveAccess(siteId)).toBe(false);

    vi.setSystemTime(new Date(NOW.getTime() + 1));
    expect(await hasActiveAccess(siteId)).toBe(false);
  });
});

describe("the gate fails closed", () => {
  it("a site that does not exist has no access", async () => {
    expect(await hasActiveAccess("site-nobody")).toBe(false);
  });

  it("a store that cannot be read has no access", async () => {
    given({ paidThrough: IN_A_MONTH });
    state.failHostingRead = true;
    // Three loops spend money on a `true`. Spending a departed customer's
    // money because a read failed is the worse of the two errors.
    expect(await hasActiveAccess("site-1")).toBe(false);
  });
});

describe("the count and the per-site answer are one comparison", () => {
  it("over one set of sites, the day's count is the number of sites the gate admits", async () => {
    for (const [id, paidThrough] of [
      ["saas-site", IN_A_MONTH],
      ["local-cafe", new Date(NOW.getTime() + 1)],
      ["at-the-instant", NOW],
      ["lapsed-site", LAST_MONTH],
    ] as const) {
      state.sites.push(site({ id, user_id: `u-${id}`, owner_paid_through: paidThrough.toISOString() }));
    }
    const ids = [...state.sites.map((s) => s.id), "site-nobody"];
    const admitted = await sitesWithActiveAccess(ids);
    expect([...admitted].sort()).toEqual(["local-cafe", "saas-site"]);
    for (const id of ids) expect(admitted.has(id), id).toBe(await hasActiveAccess(id));
    expect(await payingSitesAt(NOW)).toBe(admitted.size);
  });
});
