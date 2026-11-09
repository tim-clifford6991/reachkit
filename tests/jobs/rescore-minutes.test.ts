// The re-score tick fires hourly at :07: off :00–:02, where the hourly jobs read together, and off every other cron's minute.
import "../generate/env";
import { describe, expect, it } from "vitest";
import { RESCORE_TICK_CRON } from "@/jobs/scan-rescore";
import { CRON_JOBS } from "@/jobs/schedule";

/** The minutes of the hour a cron's minute field fires at: `*`, `*\/N`, `N` and `a,b,…`. */
function firingMinutes(cron: string): number[] {
  const field = cron.trim().split(/\s+/)[0]!;
  const step = /^\*(?:\/(\d+))?$/.exec(field);
  if (step !== null) return Array.from({ length: 60 }, (_, m) => m).filter((m) => m % Number(step[1] ?? 1) === 0);
  return field.split(",").map(Number);
}

describe("the re-score tick", () => {
  it("fires once an hour, every hour and day, at :07, a minute no other cron fires at", () => {
    expect(RESCORE_TICK_CRON.trim().split(/\s+/)).toEqual(["7", "*", "*", "*", "*"]);
    const others = CRON_JOBS.filter((j) => j.id !== "scan/rescore").flatMap((j) => (j.trigger.kind === "cron" ? firingMinutes(j.trigger.cron) : []));
    expect(others).not.toContain(7);
  });
});
