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
import { COPY, TODO_COPY_MARKER, type CopyKey } from "@/lib/presentation/copy";

const readCalendarFacts = vi.fn();
const supplyNotice = vi.fn();

vi.mock("@/app/(account)/app/calendar/store", () => ({
  readCalendarFacts: (...a: unknown[]) => readCalendarFacts(...a),
}));

vi.mock("@/lib/opportunities", () => ({
  supplyNotice: (...a: unknown[]) => supplyNotice(...a),
  supplyMeasured: async () => true,
  supplyState: async () => "measured",
}));

const { resetAccount, signedInAs } = await import("../account-door");
const provider = await import("@/app/(account)/app/calendar/provider");
const { FIXTURE_MONTH } = await import("@/app/(account)/app/calendar/fixture");

const SITE = { siteId: "site-1", timeZone: "America/New_York" };

// Issue #169: `setCalendarSiteReader(null)` now restores the
// session-backed reader, so the suite signs in as well — as the reserved
// fixture account, which is the branch these rows are about.
beforeEach(() => {
  vi.clearAllMocks();
  signedInAs();
  provider.setCalendarSiteReader(null);
});

afterEach(() => {
  provider.setCalendarSiteReader(null);
  resetAccount();
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
      changeHoldsGeneration: null,
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
    // Its supply holds the week's spares, so there is nothing to state.
    expect(await provider.readSupplyNotice()).toBeNull();
    expect(supplyNotice).not.toHaveBeenCalled();
  });
});

describe("planToday — the reserved fixture account keeps its own day; a real site gets today's", () => {
  it("draws the fixture's frozen day for the fixture account and the site's zone for a real one", async () => {
    // A real site is never given the fixture clock — that was the last one
    // behind a real session (#197).
    provider.setCalendarSiteReader(null);
    expect(await provider.planToday()).toBe("2026-09-15");

    provider.setCalendarSiteReader(async () => ({ siteId: "s1", timeZone: "Pacific/Auckland" }));
    expect(await provider.planToday()).toBe(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(new Date())
    );
    provider.setCalendarSiteReader(null);
  });
});

describe("supplyLine — at most one statement of supply, and never a composed one", () => {
  const zone = "America/New_York";

  it("speaks the owner's written line for every arm (#460), each from its own key", () => {
    // The three sentences were owed until 2026-09-10 and every arm rendered
    // nothing. They are written now, so each arm is read back against its
    // own key's words with the slots filled — never the marker, never a
    // bare `{slot}`.
    const since = new Date(Date.UTC(2026, 8, 1, 12, 0, 0));
    const arms: [SupplyNotice, CopyKey][] = [
      [{ kind: "exhausted", days: 0, since }, "calendar.supply.exhausted"],
      [{ kind: "short", days: 3 }, "calendar.supply.short"],
      [{ kind: "arrival_shortfall", days: 12 }, "calendar.supply.first-arrival"],
    ];
    for (const [arm, key] of arms) {
      const line = supplyLine(arm, zone);
      expect(line, key).not.toBeNull();
      expect(line, key).not.toBe(TODO_COPY_MARKER);
      expect(line, key).not.toContain("{");
      expect(line?.startsWith(COPY[key].split("{")[0] ?? ""), key).toBe(true);
    }
    expect(supplyLine({ kind: "short", days: 3 }, zone)).toContain("3");
    expect(supplyLine({ kind: "arrival_shortfall", days: 12 }, zone)).toContain("12");
  });

  it("an exhausted notice with no recorded date speaks its own sentence, never a blank slot (owner, PR #961)", () => {
    // `SupplyNotice`'s `since` is `Date | null` by declaration, so this is
    // a state a real site reaches. It used to render the dated key with an
    // empty `{since}`, which read "… in your market, since . Monday’s
    // re-measure…" on every screen the fixture account draws.
    const line = supplyLine({ kind: "exhausted", days: 0, since: null }, zone);
    expect(line).toBe(COPY["calendar.supply.exhausted.undated"]);
    expect(line).not.toBeNull();
    expect(line).not.toBe(TODO_COPY_MARKER);
    // The claim is the same claim; what is gone is the clause naming a date
    // the product does not have.
    expect(line).toContain("Nothing worth publishing is left");
    expect(line).not.toContain("since");
    expect(line).not.toContain("{");
    // And the dated arm still names its date.
    const dated = supplyLine(
      { kind: "exhausted", days: 0, since: new Date(Date.UTC(2026, 8, 1, 12, 0, 0)) },
      zone
    );
    expect(dated).toContain("since");
    expect(dated).not.toBe(line);
  });

  it("no notice is no line — a customer with supply reads nothing about it", () => {
    expect(supplyLine(null, zone)).toBeNull();
  });
});
