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
import { CAPS, SPEND_ALERT_AT } from "@/lib/config/constants";

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
});

const CEILING = CAPS.DAILY_PRODUCT_C;
const WARN = CAPS.DAILY_PRODUCT_C * SPEND_ALERT_AT.warn;

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
    expect(daily.alertThresholdsCents()).toEqual({ warn: WARN, ceiling: CEILING });
  });

  it("the ceiling is a figure the product spends up to, never through", () => {
    expect(daily.ceilingReached(CEILING - 1)).toBe(false);
    expect(daily.ceilingReached(CEILING)).toBe(true);
    expect(daily.ceilingReached(CEILING + 1)).toBe(true);
  });

  it("a crossing belongs to the one call whose spend carried the total over it", () => {
    expect(daily.crossingOf(WARN - 1, WARN)).toBe("warn");
    expect(daily.crossingOf(CEILING - 1, CEILING)).toBe("ceiling");
    // The second call past the same line reports nothing: `before` is
    // already over, so there is no crossing left to make. This is the whole
    // of the at-most-once rule — nothing remembers that an alert was sent.
    expect(daily.crossingOf(WARN, WARN + 10)).toBe(null);
    expect(daily.crossingOf(CEILING, CEILING + 10)).toBe(null);
  });

  it("a call large enough to pass both lines at once reports the ceiling, the more serious", () => {
    expect(daily.crossingOf(0, CEILING)).toBe("ceiling");
  });

  it("no movement, no crossing", () => {
    expect(daily.crossingOf(0, 0)).toBe(null);
    expect(daily.crossingOf(WARN - 2, WARN - 1)).toBe(null);
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
  it("opens on what the day already held, and refuses at the ceiling", async () => {
    ledgerHolds(CEILING);
    const day = await daily.openDayLedger(new Date());
    expect(day.spentCents()).toBe(CEILING);
    expect(day.ceilingReached()).toBe(true);
  });

  it("a pass's own spend can carry the day over on its own", async () => {
    ledgerHolds(CEILING - 5);
    const day = await daily.openDayLedger(new Date());
    expect(day.ceilingReached()).toBe(false);
    day.add(5);
    expect(day.ceilingReached()).toBe(true);
    expect(day.spentCents()).toBe(CEILING);
  });

  it("publishes each crossing once — the call that made it, and no call after", async () => {
    const seen: number[] = [];
    daily.registerSpendAlertSink((a) => seen.push(a.spentCents));
    ledgerHolds(WARN - 1);
    const day = await daily.openDayLedger(new Date());
    day.add(1); // crosses `warn`
    day.add(1); // already over `warn`, nothing to report
    expect(seen).toEqual([WARN]);
  });

  it("carries the ceiling it crossed, so the alert never has to look one up", async () => {
    const seen: Array<{ crossed: string; ceilingCents: number }> = [];
    daily.registerSpendAlertSink((a) => seen.push({ crossed: a.crossed, ceilingCents: a.ceilingCents }));
    ledgerHolds(CEILING - 1);
    const day = await daily.openDayLedger(new Date());
    day.add(1);
    expect(seen).toEqual([{ crossed: "ceiling", ceilingCents: CEILING }]);
  });

  it("an unreadable ledger refuses nothing and reports nothing — the guard fails open", async () => {
    const seen: string[] = [];
    daily.registerSpendAlertSink((a) => seen.push(a.crossed));
    ledgerHolds(null);
    const day = await daily.openDayLedger(new Date());
    expect(day.ceilingReached()).toBe(false);
    // Even spending past the ceiling: a guard that cannot see is not a
    // licence to stop the product, and it is not a licence to raise an
    // alarm off a figure nobody has either.
    day.add(CEILING * 2);
    expect(day.ceilingReached()).toBe(false);
    expect(seen).toEqual([]);
  });
});
