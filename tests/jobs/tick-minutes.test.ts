// Each hourly tick reads the database in a minute of its own: only
// publish/retry keeps :00, where veto windows end, and the others stay off
// :00–:02 and off every minute another registered job fires in.
import "../generate/env";
import { describe, expect, it } from "vitest";
import { jobs } from "@/jobs";

/** The minutes of the hour a cron's minute field fires at: `*`, `*\/N`, `N` and `a,b,…`. */
function firingMinutes(cron: string): number[] {
  const field = cron.trim().split(/\s+/)[0]!;
  const step = /^\*(?:\/(\d+))?$/.exec(field);
  if (step !== null) return Array.from({ length: 60 }, (_, m) => m).filter((m) => m % Number(step[1] ?? 1) === 0);
  return field.split(",").map(Number);
}

const crons = jobs.flatMap((job) => (job.trigger.kind === "cron" ? [{ id: job.id, cron: job.trigger.cron }] : []));
const minutesOf = (id: string): number[] => firingMinutes(crons.find((c) => c.id === id)!.cron);

describe("the hourly ticks", () => {
  it("publish/retry still fires on the hour, when veto windows end", () => {
    expect(minutesOf("publish/retry")).toEqual([0]);
  });

  for (const id of ["draft/generate", "weekly/refresh", "lead/nurture"]) {
    it(`${id} fires once an hour, never in minute 0, 1 or 2, and in no minute another job uses`, () => {
      const own = crons.find((c) => c.id === id)!;
      expect(own.cron.trim().split(/\s+/).slice(1)).toEqual(["*", "*", "*", "*"]);
      const [minute, ...more] = firingMinutes(own.cron);
      expect(more).toEqual([]);
      expect(minute).toBeGreaterThan(2);
      const taken = crons.filter((c) => c.id !== id).flatMap((c) => firingMinutes(c.cron));
      expect(taken).not.toContain(minute);
    });
  }
});
