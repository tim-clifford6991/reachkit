// "A regression is shown, never hidden" (BUILD §9, REQ-063 c3).
//
// A test that only checked `declined` would survive a substituted `from`
// value — the "replaced by the better earlier figure" half of the
// criterion — so both raw values are asserted on every decline case.
import { describe, expect, it } from "vitest";
import { measured, measuredZero, unmeasured } from "../../../src/lib/measure/measured";
import { movementFor, weeksBetween } from "../../../src/lib/opportunities/verdicts/movement";
import { AT } from "../fixtures";

const WEEK = "2026-08-31";
const LAST_WEEK = "2026-08-24";
const TWO_WEEKS_BACK = "2026-08-17";

describe("REQ-063 c3 — a decline is carried, not smoothed", () => {
  it("a worse place sets declined and carries both raw values", () => {
    const movement = movementFor({
      previous: { week: LAST_WEEK, value: measured(3, AT) },
      current: measured(9, AT),
      week: WEEK,
    });
    expect(movement).toEqual({
      previousWeek: LAST_WEEK,
      spansWeeks: 1,
      from: measured(3, AT),
      to: measured(9, AT),
      declined: true,
    });
  });

  it("the better earlier figure is never substituted for the worse current one", () => {
    const movement = movementFor({
      previous: { week: LAST_WEEK, value: measured(1, AT) },
      current: measured(18, AT),
      week: WEEK,
    });
    expect(movement?.to).toEqual(measured(18, AT));
    expect(movement?.from).toEqual(measured(1, AT));
  });

  it("nothing is rounded: a place is carried as the integer it was measured at", () => {
    const movement = movementFor({
      previous: { week: LAST_WEEK, value: measured(2, AT) },
      current: measured(3, AT),
      week: WEEK,
    });
    expect(movement?.from.kind === "measured" && movement.from.value).toBe(2);
    expect(movement?.to.kind === "measured" && movement.to.value).toBe(3);
  });

  it("an improvement does not read as a decline", () => {
    const movement = movementFor({
      previous: { week: LAST_WEEK, value: measured(9, AT) },
      current: measured(3, AT),
      week: WEEK,
    });
    expect(movement?.declined).toBe(false);
  });

  it("losing the place entirely is the worst move there is", () => {
    const lost = movementFor({
      previous: { week: LAST_WEEK, value: measured(9, AT) },
      current: measuredZero(0, AT),
      week: WEEK,
    });
    expect(lost?.declined).toBe(true);
    // And arriving from nowhere is not a decline.
    const arrived = movementFor({
      previous: { week: LAST_WEEK, value: measuredZero(0, AT) },
      current: measured(9, AT),
      week: WEEK,
    });
    expect(arrived?.declined).toBe(false);
  });

  it("an unmeasured value on either side is not a comparison — nothing declined, because nothing was measured to decline", () => {
    const movement = movementFor({
      previous: { week: LAST_WEEK, value: unmeasured<number>("undeterminable", AT) },
      current: measured(30, AT),
      week: WEEK,
    });
    expect(movement?.declined).toBe(false);
    expect(movement?.from).toEqual(unmeasured<number>("undeterminable", AT));
  });
});

describe("REQ-063 c4 — the interval a change spans", () => {
  it("a previous measurement two weeks back gives spansWeeks 2", () => {
    const movement = movementFor({
      previous: { week: TWO_WEEKS_BACK, value: measured(4, AT) },
      current: measured(4, AT),
      week: WEEK,
    });
    expect(movement?.spansWeeks).toBe(2);
    expect(movement?.previousWeek).toBe(TWO_WEEKS_BACK);
  });

  it("no previous measurement gives null — there is nothing to compare against", () => {
    expect(movementFor({ previous: null, current: measured(4, AT), week: WEEK })).toBeNull();
  });

  it("a week shortened by a daylight-saving transition still reads as one week", () => {
    // 2026-03-29 is the European spring-forward Sunday; the Monday-to-Monday
    // interval across it is 6 days 23 hours in a zone that observes it, and
    // one week in the customer's own calendar.
    expect(weeksBetween("2026-03-23", "2026-03-30")).toBe(1);
  });
});
