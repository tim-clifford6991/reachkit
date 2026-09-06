// tests/app/calendar/provider.test.ts — BUILD §4.6, §7 (issue #126)
//
// One read, two branches: §7's own rows for a real site, and the fixture
// for the reserved fixture account and nothing else. The mutation this
// suite exists to kill is a fixture that answers for a real site — a
// calendar padded with pages nobody derived, which is the one thing §4.6's
// supply rule forbids.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { supplyLine } from "@/app/(account)/app/calendar/supply";
import type { SupplyNotice } from "@/lib/opportunities";

const readCalendarFacts = vi.fn();
const supplyNotice = vi.fn();

vi.mock("@/app/(account)/app/calendar/store", () => ({
  readCalendarFacts: (...a: unknown[]) => readCalendarFacts(...a),
}));

vi.mock("@/lib/opportunities", () => ({
  supplyNotice: (...a: unknown[]) => supplyNotice(...a),
}));

const provider = await import("@/app/(account)/app/calendar/provider");
const { FIXTURE_MONTH } = await import("@/app/(account)/app/calendar/fixture");

const SITE = { siteId: "site-1", timeZone: "America/New_York" };

beforeEach(() => {
  vi.clearAllMocks();
  provider.setCalendarSiteReader(null);
});

afterEach(() => {
  provider.setCalendarSiteReader(null);
  vi.restoreAllMocks();
});

describe("the fixture answers for the reserved fixture account and for nothing else", () => {
  it("the reserved account is a name no customer can hold", () => {
    // `example.com` is IANA-reserved, which is what makes "fixtures only
    // for the reserved fixture account" a fact about the name rather than
    // a flag someone has to remember to unset.
    expect(provider.RESERVED_FIXTURE_DOMAIN).toBe("example.com");
  });

  it("reads the fixture's own month without touching the live store", async () => {
    const model = await provider.readMonth(FIXTURE_MONTH);
    expect(model.month).toBe(FIXTURE_MONTH);
    expect(readCalendarFacts).not.toHaveBeenCalled();
    expect(model.counts.all).toBeGreaterThan(0);
  });
});

describe("a real site reads its own rows and never the fixture", () => {
  it("assembles the month from the live facts, and asks the fixture for nothing", async () => {
    provider.setCalendarSiteReader(async () => SITE);
    readCalendarFacts.mockResolvedValue({
      timeZone: SITE.timeZone,
      now: new Date(Date.UTC(2026, 8, 15, 14, 0, 0)),
      drafts: [],
      instructions: {},
      stoppedDays: [],
      heldDays: [],
      customerChangeHoldsPages: null,
      unusedSupply: 0,
    });

    const model = await provider.readMonth("2026-09");
    expect(readCalendarFacts).toHaveBeenCalledWith(
      expect.objectContaining({ site: SITE, month: "2026-09" })
    );
    // No page anywhere: the site has no supply, so every date is empty —
    // the fixture's twenty-one pages reach a real site's calendar never.
    expect(model.counts.all).toBe(0);
  });

  it("reads §7's own supply notice for a real site, and never composes one", async () => {
    provider.setCalendarSiteReader(async () => SITE);
    supplyNotice.mockResolvedValue({ kind: "short", days: 3 });
    expect(await provider.readSupplyNotice()).toEqual({ kind: "short", days: 3 });
    expect(supplyNotice).toHaveBeenCalledWith({ siteId: "site-1" });
  });

  it("the reserved fixture account reads its own fixed depth without a database", async () => {
    expect(await provider.readSupplyNotice()).toEqual({
      kind: "exhausted",
      days: 0,
      since: null,
    });
    expect(supplyNotice).not.toHaveBeenCalled();
  });
});

describe("parseMonth — a query string is never trusted into a date parser", () => {
  it("takes a well-formed month and falls back to the current one otherwise", () => {
    expect(provider.parseMonth("2026-11")).toBe("2026-11");
    expect(provider.parseMonth("2026-13")).toBe(provider.currentMonth());
    expect(provider.parseMonth("../../etc")).toBe(provider.currentMonth());
    expect(provider.parseMonth(undefined)).toBe(provider.currentMonth());
  });
});

describe("supplyLine — at most one statement of supply, and never a composed one", () => {
  const zone = "America/New_York";

  it("renders nothing for every arm while the owner has not written the line", () => {
    const arms: (SupplyNotice | null)[] = [
      null,
      { kind: "exhausted", days: 0, since: null },
      { kind: "exhausted", days: 0, since: new Date(Date.UTC(2026, 8, 1, 12, 0, 0)) },
      { kind: "short", days: 3 },
      { kind: "arrival_shortfall", days: 12 },
    ];
    for (const arm of arms) expect(supplyLine(arm, zone)).toBeNull();
  });

  it("no notice is no line — a customer with supply reads nothing about it", () => {
    expect(supplyLine(null, zone)).toBeNull();
  });
});
