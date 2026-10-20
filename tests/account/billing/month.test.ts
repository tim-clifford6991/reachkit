// Billing's "What you got this month": the counts come from stored rows for
// the period ending on `paid_through`, and a count nothing measured is null.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { monthGot, periodEnding, setBillingStore } = await import("@/lib/account/billing");
const { HARD_RULES } = await import("@/lib/generate/rules/types");
const { memoryBillingStore, newMemoryBilling, account } = await import("./memory-store");

let state = newMemoryBilling();
const SITE = "site-1";
const OTHER = "site-2";

/** A delivered page, checked by a run that asked every rule and failed `failed`. */
function page(
  at: string,
  a: { refresh?: boolean; failed?: string[]; recorded?: boolean; site?: string; down?: boolean } = {}
) {
  const recorded = a.recorded ?? true;
  return {
    site_id: a.site ?? SITE,
    published_at: at,
    unpublished_at: a.down === true ? "2026-09-20T00:00:00.000Z" : null,
    title: `Page at ${at}`,
    refresh: a.refresh ?? false,
    rule_failures: recorded ? (a.failed ?? []).map((rule) => ({ rule, detail: "fixture" })) : null,
    meta: recorded ? { checks: { asked: [...HARD_RULES], fixed: [] } } : null,
  };
}

beforeEach(() => {
  state = newMemoryBilling();
  setBillingStore(memoryBillingStore(state));
  state.users.push(account({ id: "u1", paid_through: "2026-10-07T12:00:00.000Z" }));
});

afterEach(() => setBillingStore(null));

describe("the period", () => {
  it("is the month that ends on paid_through", () => {
    expect(periodEnding(new Date("2026-10-07T12:00:00.000Z")).from.toISOString()).toBe("2026-09-07T12:00:00.000Z");
  });

  it("ends on the last day of a shorter month before", () => {
    expect(periodEnding(new Date("2026-03-31T00:00:00.000Z")).from.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });
});

describe("the counts, from stored rows", () => {
  it("counts new pages, refreshes, scans and each page's checks inside the period only", async () => {
    state.publications.push(
      page("2026-09-10T00:00:00.000Z", { failed: ["title"] }),
      page("2026-09-20T00:00:00.000Z"),
      page("2026-10-01T00:00:00.000Z", { refresh: true }),
      page("2026-09-06T00:00:00.000Z"),
      page("2026-10-07T12:00:00.000Z"),
      page("2026-09-12T00:00:00.000Z", { site: OTHER }),
      page("2026-09-13T00:00:00.000Z", { down: true })
    );
    state.scans.push(
      { site_id: SITE, created_at: "2026-09-14T00:00:00.000Z", status: "done" },
      { site_id: SITE, created_at: "2026-09-21T00:00:00.000Z", status: "degraded" },
      { site_id: SITE, created_at: "2026-09-28T00:00:00.000Z", status: "running" },
      { site_id: SITE, created_at: "2026-09-01T00:00:00.000Z", status: "done" },
      { site_id: OTHER, created_at: "2026-09-14T00:00:00.000Z", status: "done" }
    );

    const got = await monthGot("u1", SITE);
    expect(got).not.toBeNull();
    expect({ live: got?.live, refreshed: got?.refreshed, scans: got?.scans }).toEqual({ live: 2, refreshed: 1, scans: 2 });
    expect(got?.pages.map((p) => p.checks)).toEqual([
      { passed: HARD_RULES.length - 1, total: HARD_RULES.length },
      { passed: HARD_RULES.length, total: HARD_RULES.length },
      { passed: HARD_RULES.length, total: HARD_RULES.length },
    ]);
  });
});

describe("not measured is never 0", () => {
  it("a period with no scan reads null scans, while zero pages stays a true 0", async () => {
    const got = await monthGot("u1", SITE);
    expect(got?.scans).toBeNull();
    expect(got?.live).toBe(0);
    expect(got?.refreshed).toBe(0);
  });

  it("a page whose run recorded no checks reads null, not 0 of n", async () => {
    state.publications.push(page("2026-09-10T00:00:00.000Z", { recorded: false }));
    const got = await monthGot("u1", SITE);
    expect(got?.pages[0]?.checks).toBeNull();
  });

  it("a store that cannot be read is null, never a month of zeros", async () => {
    state.failHostingRead = true;
    expect(await monthGot("u1", SITE)).toBeNull();
  });
});
