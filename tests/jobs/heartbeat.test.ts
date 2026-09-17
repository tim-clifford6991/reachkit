// tests/jobs/heartbeat.test.ts — issue #799: the owner can see the
// scheduled jobs are firing.
//
// Driven through the real path: `serve()` installs the heartbeat with the
// registry's own schedule, a real job definition runs through `runJob`, its
// row is written, and a job gone quiet reaches the mail vendor's transport
// through the real incident seam. The doubles are the `job_runs` store
// (in memory), the engine's two due-work reads and the vendor transport.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubEnv } from "./env-fixture";
import type { HeartbeatStore, JobRunRow } from "@/jobs/heartbeat";

interface MemoryRow extends JobRunRow {
  lastOutcome: string;
}

function memoryStore(rows: Map<string, MemoryRow>, failing = false): HeartbeatStore {
  return {
    async record(jobId, outcome, at) {
      if (failing) throw new Error("database down");
      const before = rows.get(jobId);
      rows.set(jobId, {
        jobId,
        lastRunAt: at.toISOString(),
        lastOutcome: outcome,
        staleAlertedAt: before?.staleAlertedAt ?? null,
      });
    },
    async readAll() {
      if (failing) throw new Error("database down");
      return [...rows.values()];
    },
    async claimAlert(row, at) {
      const current = rows.get(row.jobId);
      if (current === undefined || current.lastRunAt !== row.lastRunAt) return false;
      if (current.staleAlertedAt !== null && Date.parse(current.staleAlertedAt) >= Date.parse(current.lastRunAt)) {
        return false;
      }
      rows.set(row.jobId, { ...current, staleAlertedAt: at.toISOString() });
      return true;
    },
  };
}

let requests: { subject: string; text: string }[] = [];

async function load() {
  stubEnv(false);
  vi.doMock("inngest/next", () => ({
    serve: () => ({ GET: () => {}, POST: () => {}, PUT: () => {} }),
  }));
  vi.doMock("@/jobs/engine", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/jobs/engine")>()),
    duePublishRetries: async () => [],
    duePublishApprovals: async () => [],
  }));
  const heartbeat = await import("@/jobs/heartbeat");
  const registry = await import("@/jobs");
  const { runJob } = await import("@/jobs/run");
  const { publishRetry } = await import("@/jobs/publish-retry");
  const { __setVendorTransportForTesting } = await import("@/lib/mail/vendor/resend");
  __setVendorTransportForTesting(async (payload) => {
    requests.push(JSON.parse(payload) as { subject: string; text: string });
    return { status: 200, headers: {}, body: JSON.stringify({ id: "vendor-1" }) };
  });
  return { heartbeat, registry, runJob, publishRetry };
}

beforeEach(() => {
  requests = [];
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("inngest/next");
  vi.doUnmock("@/jobs/engine");
  vi.unstubAllEnvs();
  vi.resetModules();
});

const NOON = new Date("2026-09-16T12:00:00.000Z");

function row(jobId: string, lastRunAt: string, staleAlertedAt: string | null = null): [string, MemoryRow] {
  return [jobId, { jobId, lastRunAt, lastOutcome: "ran", staleAlertedAt }];
}

describe("#799 — each run records its job's last run and outcome", () => {
  it("serve() installs the heartbeat over every scheduled job in the registry", async () => {
    const { heartbeat, registry } = await load();
    expect(heartbeat.heartbeatInstalled()).toBe(false);
    registry.serve();
    expect(heartbeat.heartbeatInstalled()).toBe(true);
    expect(heartbeat.scheduleOf(registry.jobs)).toEqual([
      { jobId: "draft/generate", intervalMinutes: 60 },
      { jobId: "publish/retry", intervalMinutes: 60 },
      { jobId: "weekly/refresh", intervalMinutes: 60 },
      { jobId: "lead/nurture", intervalMinutes: 60 },
      { jobId: "account/maintenance", intervalMinutes: 15 },
    ]);
    heartbeat.setHeartbeatStore(null);
  });

  it("a real tick writes its row with the outcome it returned", async () => {
    const { heartbeat, registry, runJob, publishRetry } = await load();
    const rows = new Map<string, MemoryRow>();
    heartbeat.setHeartbeatStore(memoryStore(rows));
    registry.serve();

    await expect(runJob(publishRetry, { data: {}, now: NOON })).resolves.toMatchObject({ outcome: "skipped" });

    expect(rows.get("publish/retry")).toEqual({
      jobId: "publish/retry",
      lastRunAt: NOON.toISOString(),
      lastOutcome: "skipped",
      staleAlertedAt: null,
    });
    expect(requests).toEqual([]);
  });

  it("a store that fails never changes the job's own outcome", async () => {
    const { heartbeat, registry, runJob, publishRetry } = await load();
    heartbeat.setHeartbeatStore(memoryStore(new Map(), true));
    registry.serve();
    await expect(runJob(publishRetry, { data: {}, now: NOON })).resolves.toMatchObject({ outcome: "skipped" });
  });
});

describe("#799 — a scheduled job quiet for twice its interval is told to the owner, once", () => {
  it("the maintenance tick quiet for an hour reaches the vendor as an incident mail, and the next tick does not repeat it", async () => {
    const { heartbeat, registry, runJob, publishRetry } = await load();
    const rows = new Map<string, MemoryRow>([
      // 60 minutes against a 15-minute interval: stale.
      row("account/maintenance", "2026-09-16T11:00:00.000Z"),
      // 60 minutes against a 60-minute interval: on time.
      row("draft/generate", "2026-09-16T11:00:00.000Z"),
    ]);
    heartbeat.setHeartbeatStore(memoryStore(rows));
    registry.serve();

    await runJob(publishRetry, { data: {}, now: NOON });

    expect(requests).toHaveLength(1);
    const mail = requests[0]!;
    expect(mail.text).toContain("A scheduled job has not run for more than twice its usual interval.");
    expect(mail.text).toContain("account/maintenance");
    expect(mail.text).toContain("2026-09-16 11:00 UTC");
    expect(mail.text).not.toContain("TODO(copy)");
    expect(rows.get("account/maintenance")?.staleAlertedAt).toBe(NOON.toISOString());

    await runJob(publishRetry, { data: {}, now: new Date("2026-09-16T13:00:00.000Z") });
    expect(requests).toHaveLength(1);
  });

  it("a job that runs again and then goes quiet again is told again", async () => {
    const { heartbeat } = await load();
    const schedule = [{ jobId: "account/maintenance" as const, intervalMinutes: 15 }];
    const toldThenRan: JobRunRow = {
      jobId: "account/maintenance",
      lastRunAt: "2026-09-16T11:00:00.000Z",
      staleAlertedAt: "2026-09-16T10:30:00.000Z",
    };
    expect(heartbeat.staleJobs(schedule, [toldThenRan], NOON, "publish/retry")).toHaveLength(1);
    const told: JobRunRow = { ...toldThenRan, staleAlertedAt: "2026-09-16T11:45:00.000Z" };
    expect(heartbeat.staleJobs(schedule, [told], NOON, "publish/retry")).toEqual([]);
  });

  it("a job with no row has never run here and is not judged; a job is never judged by its own run", async () => {
    const { heartbeat } = await load();
    const schedule = [{ jobId: "account/maintenance" as const, intervalMinutes: 15 }];
    expect(heartbeat.staleJobs(schedule, [], NOON, "publish/retry")).toEqual([]);
    const quiet: JobRunRow = { jobId: "account/maintenance", lastRunAt: "2026-09-16T09:00:00.000Z", staleAlertedAt: null };
    expect(heartbeat.staleJobs(schedule, [quiet], NOON, "account/maintenance")).toEqual([]);
  });

  it("reads the interval of every cron shape it names, and refuses one it does not", async () => {
    const { heartbeat } = await load();
    expect(heartbeat.cronIntervalMinutes("*/15 * * * *")).toBe(15);
    expect(heartbeat.cronIntervalMinutes("0 * * * *")).toBe(60);
    expect(heartbeat.cronIntervalMinutes("0 6 * * *")).toBe(1440);
    expect(heartbeat.cronIntervalMinutes("0 6 * * 1")).toBe(10080);
    expect(heartbeat.cronIntervalMinutes("0 6 1 * *")).toBeNull();
  });
});
