// tests/costs/daily.test.ts — the product-wide daily ceiling's own
// machinery (issue #329, BUILD §6.5).
//
// `withCostContext`'s use of it is `spend-guard.test.ts`; this file is the
// module underneath: the UTC day, the two crossings, the port, and what an
// unreadable ledger means.
//
// Under the `node` project with `@/lib/db` mocked, because the question
// here is arithmetic and publication, not what a row ends up holding — the
// live-schema half (that `fetches_spend_since` exists, sums, and is
// unreachable without the service role) is `context.test.ts`'s.
//
// Every figure is read from `constants.ts`. A test that typed `4000` would
// pass for a while and then be asserting against a ceiling the product no
// longer has.
import "../generate/env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DAILY_PRODUCT_CEILING, SPEND_ALERT_AT } from "@/lib/config/constants";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbAdmin: () => ({ rpc: rpcMock }) }));

type Daily = typeof import("../../src/lib/costs/daily");
let daily: Daily;

/** The ledger answers `cents`; `null` makes the read fail the way an
 *  unreachable database does. */
function ledgerHolds(cents: number | null): void {
  rpcMock.mockReset();
  if (cents === null) {
    rpcMock.mockResolvedValue({ data: null, error: { message: "stubbed read failure" } });
    return;
  }
  rpcMock.mockResolvedValue({ data: cents, error: null });
}

beforeEach(async () => {
  ledgerHolds(0);
  daily = await import("../../src/lib/costs/daily");
  daily.registerSpendAlertSink(null);
  daily.registerPayingSiteCounter(null);
});

// No counter is registered here, so every day is the base day.
const CEILING = DAILY_PRODUCT_CEILING.baseC;
const WARN = CEILING * SPEND_ALERT_AT.warn;

describe("the day is UTC, and what it promises is a duration", () => {
  it("`dayStartedAt` is midnight UTC of the instant's own day, whatever hour it is", () => {
    const lateInTheDay = new Date("2026-09-09T23:41:07.512Z");
    expect(daily.dayStartedAt(lateInTheDay).toISOString()).toBe("2026-09-09T00:00:00.000Z");
    // And an instant one second into the day resolves to the same midnight,
    // not to the one before it.
    expect(daily.dayStartedAt(new Date("2026-09-09T00:00:01.000Z")).toISOString()).toBe(
      "2026-09-09T00:00:00.000Z"
    );
  });

  it("`secondsUntilDayRollsOver` is an elapsed duration and never a clock time", () => {
    const at = new Date("2026-09-09T23:00:00.000Z");
    const seconds = daily.secondsUntilDayRollsOver(at);
    expect(seconds).toBe(3600);
    // The shape REQ-003's refusals promise: a number of seconds, bounded by
    // the day, never an instant.
    expect(seconds).toBeLessThanOrEqual(86_400);
    expect(daily.secondsUntilDayRollsOver(new Date("2026-09-09T00:00:00.000Z"))).toBe(86_400);
  });
});

describe("the two crossings, derived from the one pinned ceiling", () => {
  it("`alertThresholdsCents` is four fifths of the ceiling, and the ceiling", () => {
    expect(daily.alertThresholdsCents(CEILING)).toEqual({ warn: WARN, ceiling: CEILING });
  });

  it("the ceiling is a figure the product spends up to, never through", () => {
    expect(daily.ceilingReached(CEILING - 1, CEILING)).toBe(false);
    expect(daily.ceilingReached(CEILING, CEILING)).toBe(true);
    expect(daily.ceilingReached(CEILING + 1, CEILING)).toBe(true);
  });

  it("a crossing belongs to the one call whose spend carried the total over it", () => {
    expect(daily.crossingOf(WARN - 1, WARN, CEILING)).toBe("warn");
    expect(daily.crossingOf(CEILING - 1, CEILING, CEILING)).toBe("ceiling");
    // The second call past the same line reports nothing: `before` is
    // already over, so there is no crossing left to make. This is the whole
    // of the at-most-once rule — nothing remembers that an alert was sent.
    expect(daily.crossingOf(WARN, WARN + 10, CEILING)).toBe(null);
    expect(daily.crossingOf(CEILING, CEILING + 10, CEILING)).toBe(null);
  });

  it("a call large enough to pass both lines at once reports the ceiling, the more serious", () => {
    expect(daily.crossingOf(0, CEILING, CEILING)).toBe("ceiling");
  });

  it("no movement, no crossing", () => {
    expect(daily.crossingOf(0, 0, CEILING)).toBe(null);
    expect(daily.crossingOf(WARN - 2, WARN - 1, CEILING)).toBe(null);
  });
});

describe("the alert port — the seam publishes and knows nothing about mail", () => {
  it("nothing registered is not an error; the crossing simply reaches nobody", () => {
    expect(() =>
      daily.publishSpendAlert({ crossed: "warn", spentCents: WARN, ceilingCents: CEILING })
    ).not.toThrow();
  });

  it("a registered sink receives the crossing, and unregistering stops it", () => {
    const seen: string[] = [];
    daily.registerSpendAlertSink((a) => seen.push(a.crossed));
    daily.publishSpendAlert({ crossed: "ceiling", spentCents: CEILING, ceilingCents: CEILING });
    daily.registerSpendAlertSink(null);
    daily.publishSpendAlert({ crossed: "warn", spentCents: WARN, ceilingCents: CEILING });
    expect(seen).toEqual(["ceiling"]);
  });

  it("a sink that throws is the alerting path's problem, never the spending path's", () => {
    daily.registerSpendAlertSink(() => {
      throw new Error("mail vendor is down");
    });
    expect(() =>
      daily.publishSpendAlert({ crossed: "warn", spentCents: WARN, ceilingCents: CEILING })
    ).not.toThrow();
  });
});

describe("reading the day's ledger", () => {
  it("`readDaySpendCents` asks for the sum since this day's own midnight", async () => {
    ledgerHolds(1234);
    const spent = await daily.readDaySpendCents(new Date("2026-09-09T13:00:00.000Z"));
    expect(spent).toBe(1234);
    expect(rpcMock).toHaveBeenCalledWith("fetches_spend_since", {
      p_since: "2026-09-09T00:00:00.000Z",
    });
  });

  it("an unreadable ledger is `null` and never 0 — the caller decides, and nothing guesses here", async () => {
    ledgerHolds(null);
    expect(await daily.readDaySpendCents(new Date())).toBe(null);
  });

  it("a sum that is not a number is unreadable, not zero", async () => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: "not a number", error: null });
    expect(await daily.readDaySpendCents(new Date())).toBe(null);
  });
});

describe("the day ledger a pass carries", () => {
  it("an unreadable ledger refuses, and reports nothing — the guard fails closed (issue #792)", async () => {
    const seen: string[] = [];
    daily.registerSpendAlertSink((a) => seen.push(a.crossed));
    ledgerHolds(null);
    const day = await daily.openDayLedger(new Date());
    expect(day.ceilingReached()).toBe(true);
    // No alarm off a figure nobody has.
    day.add(CEILING * 2);
    expect(seen).toEqual([]);
  });

  it("a re-read sees what other passes spent, and counts this pass's calls still in flight", async () => {
    ledgerHolds(0);
    const day = await daily.openDayLedger(new Date());
    expect(day.ceilingReached()).toBe(false);
    ledgerHolds(CEILING - 10);
    await day.refresh(new Date());
    expect(day.spentCents()).toBe(CEILING - 10);
    expect(day.ceilingReached()).toBe(false);
    expect(day.ceilingReached(10)).toBe(true);
  });

  it("a re-read that answers late never takes back a call this pass already ledgered", async () => {
    const seen: string[] = [];
    daily.registerSpendAlertSink((a) => seen.push(a.crossed));
    ledgerHolds(WARN - 1);
    const at = new Date("2026-09-16T12:00:00.000Z");
    const day = await daily.openDayLedger(at);
    day.add(1); // crosses `warn`
    await day.refresh(at); // the read began before the row landed
    expect(day.spentCents()).toBe(WARN);
    day.add(1);
    expect(seen).toEqual(["warn"]);
  });
});

describe("the day's ceiling grows with paying sites: 1,000¢ plus 100¢ each", () => {
  const MIDDAY = new Date("2026-10-20T13:00:00.000Z");

  it.each([
    [0, 1000],
    [40, 5000],
    [100, 11000],
  ])("%i paying sites give a %i¢ day, and the seam's ledger refuses at it", async (sites, cents) => {
    daily.registerPayingSiteCounter(async () => sites);
    expect(await daily.readDayCeilingCents(MIDDAY)).toBe(cents);
    ledgerHolds(cents - 1);
    const day = await daily.openDayLedger(MIDDAY);
    expect(day.ceilingCents()).toBe(cents);
    expect(day.ceilingReached()).toBe(false);
    expect(day.ceilingReached(1)).toBe(true);
  });

  it("counts the sites paying at the day's own midnight, once a day", async () => {
    const asked: string[] = [];
    daily.registerPayingSiteCounter(async (at) => {
      asked.push(at.toISOString());
      return 40;
    });
    await daily.readDayCeilingCents(MIDDAY);
    await daily.openDayLedger(new Date("2026-10-20T23:59:00.000Z"));
    await daily.readDayCeilingCents(new Date("2026-10-21T00:01:00.000Z"));
    expect(asked).toEqual(["2026-10-20T00:00:00.000Z", "2026-10-21T00:00:00.000Z"]);
  });

  it("a count that throws is the 1,000¢ day, is logged, and is asked again on the next call", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let calls = 0;
    daily.registerPayingSiteCounter(async () => {
      calls += 1;
      if (calls === 1) throw new Error("stubbed count failure");
      return 40;
    });
    expect(await daily.readDayCeilingCents(MIDDAY)).toBe(1000);
    expect(warn.mock.calls.map((c) => JSON.parse(String(c[0])))).toContainEqual(
      expect.objectContaining({ event: "daily_ceiling_unreadable", ceilingCents: 1000 })
    );
    expect(await daily.readDayCeilingCents(MIDDAY)).toBe(5000);
    warn.mockRestore();
  });

  it("nothing registered is the 1,000¢ day, never an unlimited one", async () => {
    ledgerHolds(1000);
    const day = await daily.openDayLedger(MIDDAY);
    expect(day.ceilingCents()).toBe(1000);
    expect(day.ceilingReached()).toBe(true);
  });
});
