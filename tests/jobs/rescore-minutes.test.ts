// The re-score tick stays off :00–:02, where the hourly jobs read together,
// and still fires every 15 minutes.
import "../generate/env";
import { describe, expect, it } from "vitest";
import { RESCORE_TICK_CRON } from "@/jobs/scan-rescore";

/** The minutes of the hour a cron's minute field fires at: `*`, `*\/N`, `N` and `a,b,…`. */
function firingMinutes(cron: string): number[] {
  const field = cron.trim().split(/\s+/)[0]!;
  const step = /^\*(?:\/(\d+))?$/.exec(field);
  if (step !== null) return Array.from({ length: 60 }, (_, m) => m).filter((m) => m % Number(step[1] ?? 1) === 0);
  return field.split(",").map(Number);
}

describe("the re-score tick", () => {
  it("fires every hour and day, four times an hour, 15 minutes apart, never in minute 0, 1 or 2", () => {
    expect(RESCORE_TICK_CRON.trim().split(/\s+/).slice(1)).toEqual(["*", "*", "*", "*"]);
    const minutes = firingMinutes(RESCORE_TICK_CRON);
    expect(minutes).toHaveLength(4);
    minutes.forEach((m, i) => expect((m - minutes[(i + 3) % 4]! + 60) % 60).toBe(15));
    expect(minutes.filter((m) => m <= 2)).toEqual([]);
  });
});
