// tests/app/overview/head.test.ts — BUILD §4.5 item 1.
//
// §4.5's head is "backed by the chart directly under" it. The discriminating
// case is the one a fixed sentence cannot pass: a customer whose measured
// series fell must not read the gap-closing line.
import { describe, expect, it } from "vitest";
import { measured, measuredZero, unmeasured } from "@/lib/measure/measured";
import { headDirection, OVERVIEW_HEAD } from "@/app/(account)/app/_overview/head";
import type { WeeklyPoint } from "@/app/(account)/app/_overview/growth";

const AT = (day: number): Date => new Date(Date.UTC(2026, 7, day));
const week = (day: number, value: number): WeeklyPoint => ({
  weekStart: AT(day),
  value: measured(value, AT(day)),
});
const gap = (day: number): WeeklyPoint => ({
  weekStart: AT(day),
  value: unmeasured<number>("not_attempted", AT(day)),
});

describe("the direction is read off the stored series, never asserted", () => {
  it("a series that ends higher than it started is rising", () => {
    expect(headDirection([week(10, 0), week(17, 36), week(24, 81)])).toBe("rising");
  });

  it("a series that ends lower than it started is falling", () => {
    expect(headDirection([week(10, 81), week(17, 60), week(24, 40)])).toBe("falling");
  });

  it("a series that ends where it started is flat", () => {
    expect(headDirection([week(10, 36), week(17, 12), week(24, 36)])).toBe("flat");
  });

  it("one measured week is no_data, not flat — one point is not a direction", () => {
    expect(headDirection([week(10, 36)])).toBe("no_data");
    expect(headDirection([])).toBe("no_data");
  });

  it("an unmeasured week is skipped, not read as a zero", () => {
    // Were the gap read as 0 the series would end higher than its middle and
    // the direction would be computed over a measurement nobody took.
    expect(headDirection([week(10, 81), gap(17), week(24, 40)])).toBe("falling");
  });

  it("a measured zero is a value: a series leaving the floor is rising", () => {
    const floor: WeeklyPoint = { weekStart: AT(10), value: measuredZero(0, AT(10)) };
    expect(headDirection([floor, week(17, 36)])).toBe("rising");
  });
});

describe("a customer whose gap widened never reads the gap-closing line", () => {
  it("the four directions select four distinct keys", () => {
    const keys = Object.values(OVERVIEW_HEAD);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("the falling direction's key is not the rising direction's", () => {
    const falling = headDirection([week(10, 81), week(17, 40)]);
    expect(OVERVIEW_HEAD[falling]).not.toBe(OVERVIEW_HEAD.rising);
  });
});
