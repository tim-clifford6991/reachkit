/**
 * Pure-helper unit tests for the engagement data layer (§7.3). These exercise the
 * week bucketing and the consecutive-week streak counting WITHOUT a DB — the DB
 * wiring (weeklyStreak / scoreHistory / engagementSummary) is covered by the
 * integration test (tests/integration/engagement.test.ts).
 */

import { describe, expect, test } from "vitest";
import { isoWeekStartDate } from "./weekly-plan";
import { bucketByWeek, countStreak } from "./engagement";

// Real consecutive ISO-week Monday keys, derived via isoWeekStartDate so they
// line up with countStreak's internal previous-week stepping.
const CURRENT = isoWeekStartDate(new Date("2026-06-11T12:00:00Z")); // 2026-06-08
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
function weeksAgo(n: number): string {
  return isoWeekStartDate(new Date(Date.parse(`${CURRENT}T00:00:00.000Z`) - n * WEEK_MS));
}
const WEEK_1 = weeksAgo(1);
const WEEK_2 = weeksAgo(2);

describe("countStreak", () => {
  test("3 consecutive weeks each with >= 3 → streak 3", () => {
    const counts = { [CURRENT]: 3, [WEEK_1]: 4, [WEEK_2]: 3 };
    expect(countStreak(counts, CURRENT)).toBe(3);
  });

  test("counts above the threshold still count (>= 3)", () => {
    const counts = { [CURRENT]: 10, [WEEK_1]: 3 };
    expect(countStreak(counts, CURRENT)).toBe(2);
  });

  test("a gap week (< 3) breaks the streak", () => {
    // current=3, last week=4, but two weeks ago only 2 → streak stops at 2.
    const counts = { [CURRENT]: 3, [WEEK_1]: 4, [WEEK_2]: 2 };
    expect(countStreak(counts, CURRENT)).toBe(2);
  });

  test("a missing (zero) week breaks the streak", () => {
    // current=3, WEEK_1 absent → only the current week counts.
    const counts = { [CURRENT]: 3, [WEEK_2]: 5 };
    expect(countStreak(counts, CURRENT)).toBe(1);
  });

  test("current week < 3 → streak 0 even if earlier weeks were strong", () => {
    const counts = { [CURRENT]: 2, [WEEK_1]: 5, [WEEK_2]: 5 };
    expect(countStreak(counts, CURRENT)).toBe(0);
  });

  test("empty counts → 0", () => {
    expect(countStreak({}, CURRENT)).toBe(0);
    expect(countStreak(new Map<string, number>(), CURRENT)).toBe(0);
  });

  test("works with a Map as well as a record", () => {
    const counts = new Map<string, number>([
      [CURRENT, 3],
      [WEEK_1, 3],
    ]);
    expect(countStreak(counts, CURRENT)).toBe(2);
  });
});

describe("bucketByWeek", () => {
  test("groups observed_at timestamps by their ISO-week Monday", () => {
    // Three in the current ISO week (2026-06-08..14), one in the prior week.
    const counts = bucketByWeek([
      "2026-06-08T00:00:00.000Z",
      "2026-06-11T13:40:00.000Z",
      "2026-06-14T23:59:59.999Z",
      "2026-06-03T10:00:00.000Z", // prior week (Mon 2026-06-01)
    ]);
    expect(counts.get("2026-06-08")).toBe(3);
    expect(counts.get("2026-06-01")).toBe(1);
  });

  test("empty input → empty map", () => {
    expect(bucketByWeek([]).size).toBe(0);
  });
});
