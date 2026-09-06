// tests/jobs/kill-switch.test.ts — BUILD §11 bounds
//
// `BUILD.md` §11: "kill switch env var stops scan+generate+publish".
//
// The three the switch stops must stop **before any spend and before any
// write** — asserted here by giving each job an engine that would record
// both, and proving it was never reached. The four it does not stop must
// still run; widening `KILL_SWITCH_SCOPE` to any of them fails a case
// below, which is the mutation the scope set is worth testing for.
//
// A stopped invocation is not a silent skip: it returns a recorded
// `stopped` outcome naming the kill switch, so the sentence §14 makes the
// product say has a fact to read. (The sentence itself is the copy
// registry's, not this module's.)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubEnv } from "./env-fixture";
import type { JobDefinition, JobId } from "@/jobs/types";

/** Every engine call the seven jobs can make, doubled. Reaching any of them
 *  is "spend or write"; the counter is what the guard must keep at zero. */
const engineCalls = { count: 0 };

function engineDouble(): Record<string, unknown> {
  const ran = async () => {
    engineCalls.count += 1;
    return { done: true as const };
  };
  const none = async () => {
    engineCalls.count += 1;
    return [] as readonly string[];
  };
  return {
    EngineNotBuilt: class extends Error {},
    activeSites: async () => {
      engineCalls.count += 1;
      return [{ siteId: "site-1", timeZone: "UTC" }];
    },
    weeklyDueSites: async () => {
      engineCalls.count += 1;
      return [{ siteId: "site-1", domain: "example.com", zone: "UTC", weekStart: "2026-09-07" }];
    },
    startWeeklyScan: ran,
    runScan: ran,
    generateDraft: ran,
    publishApproved: ran,
    verifyLive: ran,
    advanceSequence: ran,
    paymentsAwaitingSignIn: none,
    chaseSignIn: ran,
    paymentsWithoutAccounts: none,
    backstopProvision: ran,
    sitesDueHostingEndNotice: none,
    noticeHostingEnd: ran,
    sitesDueHostingStop: none,
    stopHosting: ran,
    accountsDueForPurge: none,
    purgeAccount: ran,
    sitesDueSetupReminder: none,
    remindSetup: ran,
  };
}

/** Payloads that satisfy each event-triggered job's own reader, so a job
 *  that is *not* stopped gets far enough to reach the engine. */
const PAYLOADS: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  "scan/run": { scanId: "scan-1", domain: "example.com", tier: "free" },
  "publish/execute": { draftId: "draft-1", destinationId: "dest-1" },
  "publish/verify": { publicationId: "pub-1" },
  "lead/nurture": { leadId: "lead-1", touchIndex: 0 },
};

async function invoke(id: JobId, killSwitch: boolean) {
  stubEnv(killSwitch);
  vi.doMock("@/jobs/engine", () => engineDouble());
  const { jobs } = await import("@/jobs");
  const { runJob } = await import("@/jobs/run");
  const definition = jobs.find((j: JobDefinition) => j.id === id);
  if (definition === undefined) throw new Error(`no definition for ${id}`);
  engineCalls.count = 0;
  // A `weekly/refresh` tick at the site's own Monday 06:00 and a
  // `draft/generate` tick at its own 18:00, so neither is skipped as
  // not-due and the guard is the only thing that can stop them.
  const now = id === "draft/generate" ? new Date("2026-09-07T18:00:00Z") : new Date("2026-09-07T06:00:00Z");
  const outcome = await runJob(definition, { data: PAYLOADS[id] ?? {}, now });
  return { outcome, engineCalls: engineCalls.count };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.doUnmock("@/jobs/engine");
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('BUILD §11 bounds — "kill switch env var stops scan+generate+publish"', () => {
  it("the scope is exactly those three ids", async () => {
    stubEnv(false);
    const { KILL_SWITCH_SCOPE } = await import("@/jobs/kill-switch");
    expect([...KILL_SWITCH_SCOPE]).toEqual(["scan/run", "draft/generate", "publish/execute"]);
  });

  it.each(["scan/run", "draft/generate", "publish/execute"] as const)(
    "%s is stopped before any spend and before any write",
    async (id) => {
      const { outcome, engineCalls: calls } = await invoke(id, true);
      expect(outcome).toEqual({ outcome: "stopped", subjectId: null, by: "kill-switch" });
      expect(calls, "the engine was reached — the guard ran too late").toBe(0);
    }
  );

  it.each(["publish/verify", "weekly/refresh", "lead/nurture", "account/maintenance"] as const)(
    "%s still runs with the switch engaged",
    async (id) => {
      const { outcome, engineCalls: calls } = await invoke(id, true);
      expect(outcome.outcome).not.toBe("stopped");
      expect(calls, "the job did not reach the engine at all").toBeGreaterThan(0);
    }
  );

  it.each(["scan/run", "draft/generate", "publish/execute"] as const)(
    "%s runs normally with the switch off",
    async (id) => {
      const { outcome, engineCalls: calls } = await invoke(id, false);
      expect(outcome.outcome).not.toBe("stopped");
      expect(calls).toBeGreaterThan(0);
    }
  );
});

describe("a stop is recorded, never a silent skip", () => {
  it("emits the one log line, naming the stopped outcome and no payload", async () => {
    const logged: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: string) => void logged.push(line));
    await invoke("scan/run", true);
    expect(logged).toHaveLength(1);
    const line = JSON.parse(logged[0] as string);
    expect(line).toMatchObject({ event: "job", jobId: "scan/run", outcome: "stopped" });
    expect(JSON.stringify(line)).not.toContain("example.com");
  });
});
