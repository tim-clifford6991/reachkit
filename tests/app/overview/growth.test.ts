// tests/app/overview/growth.test.ts — BUILD §4.5 item 2.
//
// The two rules the growth module exists to keep: a week that was not
// measured is a break rather than a segment, and where nothing has been
// measured there is no chart at all.
import { describe, expect, it } from "vitest";
import { measured, measuredZero, unmeasured } from "@/lib/measure/measured";
import { OVERVIEW_TRAILING_WEEKS } from "@/lib/config/constants";
import { readGrowth, type WeeklyPoint } from "@/app/(account)/app/_overview/growth";

const AT = (day: number): Date => new Date(Date.UTC(2026, 7, day));
const week = (day: number, value: number): WeeklyPoint => ({
  weekStart: AT(day),
  value: measured(value, AT(day)),
});
const gap = (day: number): WeeklyPoint => ({
  weekStart: AT(day),
  value: unmeasured<number>("not_attempted", AT(day)),
});
const FIRST_DUE = new Date(Date.UTC(2026, 8, 7));

describe("the series arm", () => {
  it("keeps the unmeasured week in its own place rather than dropping it", () => {
    const growth = readGrowth({ points: [week(10, 0), gap(17), week(24, 81)], firstDueOn: FIRST_DUE });
    expect(growth.kind).toBe("series");
    if (growth.kind !== "series") return;
    expect(growth.points).toHaveLength(3);
    expect(growth.points[1]?.value.kind).toBe("unmeasured");
  });

  it("never carries a value forward: the gap has no value field at all", () => {
    const growth = readGrowth({ points: [week(10, 36), gap(17)], firstDueOn: FIRST_DUE });
    if (growth.kind !== "series") throw new Error("expected the series arm");
    const hole = growth.points[1]?.value;
    expect(hole && "value" in hole).toBe(false);
  });

  it("no week's value is ever labelled with another week's date", () => {
    const growth = readGrowth({ points: [week(10, 36), week(17, 81)], firstDueOn: FIRST_DUE });
    if (growth.kind !== "series") throw new Error("expected the series arm");
    for (const point of growth.points) {
      expect(point.value.at.getTime()).toBe(point.weekStart.getTime());
    }
  });

  it("a measured zero is a point, not a gap — the line leaving the floor", () => {
    const floor: WeeklyPoint = { weekStart: AT(10), value: measuredZero(0, AT(10)) };
    const growth = readGrowth({ points: [floor], firstDueOn: FIRST_DUE });
    expect(growth.kind).toBe("series");
  });

  it("trims to the trailing window rather than drawing every week ever measured", () => {
    const many = Array.from({ length: OVERVIEW_TRAILING_WEEKS + 5 }, (_, i) => week(i + 1, i));
    const growth = readGrowth({ points: many, firstDueOn: FIRST_DUE });
    if (growth.kind !== "series") throw new Error("expected the series arm");
    expect(growth.points).toHaveLength(OVERVIEW_TRAILING_WEEKS);
    expect(growth.points.at(-1)?.weekStart).toEqual(many.at(-1)?.weekStart);
  });
});

describe("the none arm", () => {
  it("with no week measured there is no chart, and the first-due date is carried", () => {
    const growth = readGrowth({ points: [], firstDueOn: FIRST_DUE });
    expect(growth).toEqual({ kind: "none", firstDueOn: FIRST_DUE });
  });

  it("a window of weeks that all failed to measure is still the none arm", () => {
    const growth = readGrowth({ points: [gap(10), gap(17)], firstDueOn: FIRST_DUE });
    expect(growth.kind).toBe("none");
  });

  it("the date it carries is the one it was handed, never one it computed", () => {
    const other = new Date(Date.UTC(2027, 0, 4));
    const growth = readGrowth({ points: [], firstDueOn: other });
    if (growth.kind !== "none") throw new Error("expected the none arm");
    expect(growth.firstDueOn).toBe(other);
  });
});
