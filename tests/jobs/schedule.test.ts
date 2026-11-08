// tests/jobs/schedule.test.ts — the light schedule `/api/health` reads is the registry's, cron for cron.
import { describe, expect, it } from "vitest";
import { stubEnv } from "./env-fixture";
import type { JobDefinition } from "@/jobs/types";

stubEnv(false);
const { jobs } = await import("@/jobs");
const { CRON_JOBS } = await import("@/jobs/schedule");
const { cronIntervalMinutes, scheduleOf } = await import("@/jobs/heartbeat");

type Cron = Pick<JobDefinition, "id" | "trigger">;
const byId = <T extends { jobId: string } | { id: string }>(list: readonly T[]): T[] =>
  [...list].sort((a, b) => ("id" in a ? a.id : a.jobId).localeCompare("id" in b ? b.id : b.jobId));
const cronsOf = (definitions: readonly Cron[]): Cron[] =>
  byId(definitions.filter((d) => d.trigger.kind === "cron").map(({ id, trigger }) => ({ id, trigger })));

describe("the light schedule is the registry's", () => {
  it("names every cron job with the cron its job file sets, and the schedule it yields is the registry's", () => {
    expect(cronsOf(CRON_JOBS)).toEqual(cronsOf(jobs));
    expect(byId(scheduleOf(CRON_JOBS))).toEqual(byId(scheduleOf(jobs)));
  });

  it("differs from a registry with one more cron job, or with one cron changed", () => {
    const extra: Cron = { id: "scan/finish-reads", trigger: { kind: "cron", cron: "*/5 * * * *" } };
    expect(cronsOf(CRON_JOBS)).not.toEqual(cronsOf([...jobs, extra]));
    const changed = jobs.map((d) =>
      d.id === "draft/generate" ? { id: d.id, trigger: { kind: "cron" as const, cron: "4 * * * *" } } : d
    );
    expect(cronsOf(CRON_JOBS)).not.toEqual(cronsOf(changed));
  });

  it("resolves every entry's interval, so no job goes unjudged", () => {
    for (const { trigger } of CRON_JOBS) {
      expect(trigger.kind === "cron" ? cronIntervalMinutes(trigger.cron) : null).not.toBeNull();
    }
    expect(scheduleOf(CRON_JOBS)).toHaveLength(CRON_JOBS.length);
  });
});
