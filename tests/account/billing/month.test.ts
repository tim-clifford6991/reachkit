// Billing's "What you got this month": the counts come from stored rows for
// the period ending on `paid_through`, and a count nothing measured is null.
import { readFileSync } from "node:fs";
import path from "node:path";
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

/** A stored report from the customer panel's walk, raw as the `scans.report` column holds it. */
function storedReport(walk: string, domain: string): unknown {
  const file = path.resolve(import.meta.dirname, `../../../docs/walk/free/${walk}.json`);
  const sites = (JSON.parse(readFileSync(file, "utf8")) as { sites: { domain: string; stored: { scan: { report: unknown } } | null }[] }).sites;
  return sites.find((s) => s.domain === domain && s.stored !== null)!.stored!.scan.report;
}

describe("the counts, from stored rows", () => {
  it("counts new pages still up inside the period only, with the day each went live", async () => {
    state.publications.push(
      page("2026-09-10T00:00:00.000Z"),
      page("2026-09-20T00:00:00.000Z"),
      page("2026-10-01T00:00:00.000Z", { refresh: true }),
      page("2026-09-06T00:00:00.000Z"),
      page("2026-10-07T12:00:00.000Z"),
      page("2026-09-12T00:00:00.000Z", { site: OTHER }),
      page("2026-09-13T00:00:00.000Z", { down: true })
    );
    const got = await monthGot("u1", SITE);
    expect(got?.live).toBe(2);
    expect(got?.liveAt.map((at) => at.toISOString())).toEqual(["2026-09-10T00:00:00.000Z", "2026-09-20T00:00:00.000Z"]);
  });

  it("counts the Monday mails sent in the period, with their days", async () => {
    state.scans.push(
      { site_id: SITE, created_at: "2026-09-14T06:00:00.000Z", status: "done", digest_sent_at: "2026-09-14T08:00:00.000Z" },
      { site_id: SITE, created_at: "2026-09-21T06:00:00.000Z", status: "done", digest_sent_at: "2026-09-21T08:00:00.000Z" },
      { site_id: SITE, created_at: "2026-09-28T06:00:00.000Z", status: "done", digest_sent_at: null },
      { site_id: SITE, created_at: "2026-09-01T06:00:00.000Z", status: "done", digest_sent_at: "2026-09-01T08:00:00.000Z" },
      { site_id: OTHER, created_at: "2026-09-14T06:00:00.000Z", status: "done", digest_sent_at: "2026-09-14T08:00:00.000Z" }
    );
    const got = await monthGot("u1", SITE);
    expect(got?.reports.map((at) => at.toISOString())).toEqual(["2026-09-14T08:00:00.000Z", "2026-09-21T08:00:00.000Z"]);
  });

  // The searches with a result read and the questions put, as each stored report holds them.
  it.each([
    ["SaaS", "2026-10-15-1449-after", "savvycal.com", { searches: 5, questions: 0 }],
    ["local", "2026-10-15", "austinplumbery.com", { searches: 7, questions: 0 }],
  ])("states the newest finished pass's searches and AI questions (%s)", async (_, walk, domain, asked) => {
    const newest = storedReport(walk, domain);
    state.scans.push(
      { site_id: SITE, created_at: "2026-09-14T06:00:00.000Z", status: "done", report: domain === "savvycal.com" ? storedReport("2026-10-15", "austinplumbery.com") : storedReport("2026-10-15-1449-after", "savvycal.com") },
      { site_id: SITE, created_at: "2026-09-21T06:00:00.000Z", status: "degraded", report: newest },
      { site_id: SITE, created_at: "2026-09-28T06:00:00.000Z", status: "running", report: null }
    );
    const got = await monthGot("u1", SITE);
    expect(got?.asked).toEqual(asked);
    expect((got?.asked?.searches ?? 0) + (got?.asked?.questions ?? 0)).toBeGreaterThan(0);
  });
});

describe("not measured is never 0", () => {
  it("a period with no finished pass reads null, while zero pages and zero Monday mails stay a true 0", async () => {
    state.scans.push({ site_id: SITE, created_at: "2026-09-14T06:00:00.000Z", status: "failed", report: null });
    const got = await monthGot("u1", SITE);
    expect(got?.asked).toBeNull();
    expect(got?.live).toBe(0);
    expect(got?.reports).toEqual([]);
  });

  it("a store that cannot be read is null, never a month of zeros", async () => {
    state.failHostingRead = true;
    expect(await monthGot("u1", SITE)).toBeNull();
  });
});
