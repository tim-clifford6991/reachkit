// tests/costs/site-day.test.ts — issue 1478: the owner's cost page, from
// stored rows. Every figure is a sum of the rows it was read from; a charge
// nobody reported stays unreported; a site's month is set against its net
// price; and the day is judged on billed spend where it is known.
import "../generate/env";
import { describe, expect, it } from "vitest";
import { costPage, type SiteDayRow, type VendorDay } from "../../src/lib/costs/site-day";

const NOW = new Date("2026-10-17T12:00:00.000Z");

function line(a: Partial<SiteDayRow> & Pick<SiteDayRow, "day" | "estimated_cents">): SiteDayRow {
  return {
    site_id: null,
    segment: "free",
    vendor: "dataforseo",
    activity: "free_scan",
    calls: 1,
    billed_cents: null,
    billed_calls: 0,
    judged_cents: a.billed_cents ?? a.estimated_cents,
    failed_calls: 0,
    timeout_calls: 0,
    ...a,
  };
}

const ROWS: SiteDayRow[] = [
  line({ day: "2026-10-17", site_id: "site-a", segment: null, activity: "weekly", calls: 10, estimated_cents: "30.0000", billed_cents: "27.0000", billed_calls: 10, judged_cents: "27.0000" }),
  line({ day: "2026-10-16", site_id: "site-a", segment: null, vendor: "anthropic", activity: "draft", calls: 5, estimated_cents: "15.0000", judged_cents: "15.0000" }),
  line({ day: "2026-10-16", estimated_cents: "6.0000", calls: 4, timeout_calls: 1 }),
  // Outside the week: not counted.
  line({ day: "2026-10-09", estimated_cents: "500.0000" }),
];

const VENDORS: VendorDay[] = [
  { vendor: "dataforseo", day: "2026-10-16", kind: "usage", domain: "", billed_cents: "10.0000", currency: "usd", estimated_cents: null },
  { vendor: "dataforseo", day: "2026-10-16", kind: "box", domain: "panel-site.com", billed_cents: null, currency: "usd", estimated_cents: "3.0000" },
  { vendor: "stripe", day: "2026-09-01", kind: "fixed", domain: "", billed_cents: "99", currency: "eur", estimated_cents: null },
];

const page = costPage({ now: NOW, rows: ROWS, vendorDays: VENDORS, domains: new Map([["site-a", "plumber-fixture.com"]]) });

describe("the week", () => {
  it("is seven UTC days, and its total is the sum of their rows", () => {
    expect(page.days).toEqual(["2026-10-17", "2026-10-16", "2026-10-15", "2026-10-14", "2026-10-13", "2026-10-12", "2026-10-11"]);
    expect(page.total.estimatedCents).toBe(54);
    expect(page.total.judgedCents).toBe(51);
    expect(page.total.billedCents).toBe(27);
    expect(page.total.billedCalls).toBe(10);
  });

  it("names a site by its domain and a free scan by its segment, and a charge nobody reported stays unreported", () => {
    const site = page.week.find((week) => week.who.kind === "site");
    expect(site?.who).toEqual({ kind: "site", siteId: "site-a", domain: "plumber-fixture.com" });
    expect(site?.cell).toMatchObject({ estimatedCents: 45, billedCents: 27, judgedCents: 42 });
    const free = page.week.find((week) => week.who.kind === "segment" && week.who.segment === "free");
    expect(free?.cell).toMatchObject({ billedCents: null, timeoutCalls: 1 });
    expect(free?.monthEurCents).toBeNull();
  });

  it("sets a site's month, its fixed share included, against its net price", () => {
    const site = page.week.find((week) => week.who.kind === "site");
    // 42¢ a week × 4.348 in euros, plus the one site's share of €0.99 Stripe fees.
    const expected = Math.round((42 / 100 / 1.1206) * 100 * 4.348 + 99);
    expect(site?.monthEurCents).toBe(expected);
    expect(site?.shareOfNet).toBeCloseTo(expected / 4050, 6);
  });

  it("counts the box's spend as its own segment", () => {
    expect(page.week.find((week) => week.who.kind === "segment" && week.who.segment === "box")?.cell.judgedCents).toBe(3);
  });
});

describe("against the vendors", () => {
  it("sets the vendor's own bill beside what the ledger and the box recorded, and says nothing where it was not read", () => {
    const day = page.vendors.find((v) => v.day === "2026-10-16" && v.vendor === "dataforseo");
    expect(day).toEqual({ day: "2026-10-16", vendor: "dataforseo", recordedCents: 9, vendorBilledCents: 10, gapCents: 1 });
    const today = page.vendors.find((v) => v.day === "2026-10-17" && v.vendor === "dataforseo");
    expect(today?.vendorBilledCents).toBeNull();
    expect(today?.gapCents).toBeNull();
    expect(page.aiBilled).toBe(false);
  });
});

describe("the two euros a day", () => {
  it("judges each day on billed spend where it is known", () => {
    const today = page.capDays[0];
    expect(today).toMatchObject({ day: "2026-10-17", judgedCents: 27, state: "ok" });
    const over = costPage({ now: NOW, rows: [line({ day: "2026-10-17", estimated_cents: "300.0000" })], vendorDays: [], domains: new Map() });
    expect(over.capDays[0]?.state).toBe("over");
  });
});

describe("the fixed costs", () => {
  it("are last month's, and a vendor that reported nothing is not a zero", () => {
    expect(page.fixedMonth).toBe("2026-09-01");
    expect(page.fixed.find((f) => f.vendor === "stripe")).toEqual({ vendor: "stripe", cents: 99, currency: "eur" });
    expect(page.fixed.find((f) => f.vendor === "vercel")?.cents).toBeNull();
  });
});
