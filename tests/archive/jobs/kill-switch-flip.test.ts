// tests/jobs/kill-switch-flip.test.ts — the owner told when the switch is
// engaged (issue #329, BUILD §11 bounds · §6.5).
//
// `kill-switch.test.ts` asserts what the switch *stops*. This file asserts
// what it *reports*, and — as much to the point — what it cannot.
//
// `env` parses `KILL_SWITCH` once at boot, so within one process the
// binding cannot move: a flip is a redeploy, and the only transition
// anything can witness is a new process's first look. A first look that
// finds the switch **engaged** is that transition and is reported. A first
// look that finds it **off** is indistinguishable from every ordinary cold
// start and is reported by nothing — telling a release apart would need a
// durable record of what the last process saw, and BUILD §10 gives this
// product no table to keep one in. Both halves are asserted below so the
// limit is a stated property rather than something found later.
//
// The residual: while the switch is engaged, each new process reports
// once, so a scaled deployment can tell the owner about one flip more than
// once. That is the failure this trades for never reporting it at all, and
// it is bounded — only the job runner asks.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubEnv } from "./env-fixture";
import type { JobDefinition, JobId, JobInput, Outcome } from "@/jobs/types";

async function loadWithSwitch(engaged: boolean) {
  stubEnv(engaged);
  return import("@/jobs/kill-switch");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("issue #329 — observing the switch", () => {
  it("a process that boots with the switch off reports nothing, however often it looks", async () => {
    const mod = await loadWithSwitch(false);
    expect(mod.observeKillSwitchEngaged()).toBe(false);
    expect(mod.observeKillSwitchEngaged()).toBe(false);
    expect(mod.observeKillSwitchEngaged()).toBe(false);
  });

  it("a process that boots with the switch engaged reports it once, and then stops", async () => {
    const mod = await loadWithSwitch(true);
    expect(mod.observeKillSwitchEngaged()).toBe(true);
    expect(mod.observeKillSwitchEngaged()).toBe(false);
    expect(mod.observeKillSwitchEngaged()).toBe(false);
  });

  it("a release is reported by nothing — the boot after it looks like every other boot", async () => {
    // The engaged process reports, and is then gone (a flip is a redeploy).
    const engaged = await loadWithSwitch(true);
    expect(engaged.observeKillSwitchEngaged()).toBe(true);

    // Its successor boots with the switch off. Nothing on this side of the
    // redeploy can tell that from an ordinary cold start, and the module
    // does not pretend otherwise.
    const released = await loadWithSwitch(false);
    expect(released.observeKillSwitchEngaged()).toBe(false);
  });

  it("the reset fixture is the only other writer of what this process last saw", async () => {
    const mod = await loadWithSwitch(true);
    expect(mod.observeKillSwitchEngaged()).toBe(true);
    mod.__resetKillSwitchObservationForTesting();
    expect(mod.observeKillSwitchEngaged()).toBe(true);
  });

  it("observing does not change what the switch stops", async () => {
    const mod = await loadWithSwitch(true);
    mod.observeKillSwitchEngaged();
    expect(mod.stoppedByKillSwitch("scan/run")).toBe(true);
    expect(mod.stoppedByKillSwitch("publish/verify")).toBe(false);
  });
});

describe("issue #329 — the runner reports it, and an alert that fails never fails a job", () => {
  const reportMock = vi.fn();

  beforeEach(() => {
    reportMock.mockReset();
    reportMock.mockResolvedValue(undefined);
  });

  async function loadRunner(engaged: boolean) {
    stubEnv(engaged);
    vi.doMock("@/lib/mail/ops", () => ({ reportKillSwitchEngaged: reportMock }));
    return import("@/jobs/run");
  }

  /** A job the switch does not stop, and one it does — the smallest
   *  definitions `runJob` accepts, so what is asserted is the runner and
   *  not any job's body. */
  function definitionFor(id: JobId): JobDefinition {
    return {
      id,
      trigger: { kind: "cron", cron: "0 * * * *" },
      idempotencyKey: [],
      run: async (): Promise<Outcome> => ({ outcome: "ran", subjectId: null }),
    };
  }

  const definition = definitionFor("publish/verify");
  const INPUT: JobInput = { data: {}, now: new Date("2026-09-09T12:00:00.000Z") };

  it("the first invocation of a process holding an engaged switch reports it", async () => {
    const { runJob } = await loadRunner(true);
    await runJob(definition, INPUT);
    expect(reportMock).toHaveBeenCalledTimes(1);
  });

  it("and reports it once, not on every invocation", async () => {
    const { runJob } = await loadRunner(true);
    await runJob(definition, INPUT);
    await runJob(definition, INPUT);
    await runJob(definition, INPUT);
    expect(reportMock).toHaveBeenCalledTimes(1);
  });

  it("an ordinary process reports nothing at all", async () => {
    const { runJob } = await loadRunner(false);
    await runJob(definition, INPUT);
    expect(reportMock).not.toHaveBeenCalled();
  });

  it("an alert that throws leaves the job's own outcome untouched", async () => {
    reportMock.mockRejectedValue(new Error("mail vendor is down"));
    const warned = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const { runJob } = await loadRunner(true);
      await expect(runJob(definition, INPUT)).resolves.toEqual({
        outcome: "ran",
        subjectId: null,
      });
    } finally {
      warned.mockRestore();
    }
  });

  it("a job the switch stops still reports it — the news is the switch, not the job", async () => {
    const { runJob } = await loadRunner(true);
    const outcome = await runJob(definitionFor("scan/run"), INPUT);
    expect(outcome).toEqual({ outcome: "stopped", subjectId: null, by: "kill-switch" });
    expect(reportMock).toHaveBeenCalledTimes(1);
  });
});
