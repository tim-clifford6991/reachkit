// tests/app/api/health.test.ts — GET and HEAD /api/health over the real
// registry's schedule. The double is the `job_runs` store only.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { stubEnv } from "../../jobs/env-fixture";
import type { HeartbeatStore, JobRunRow } from "@/jobs/heartbeat";

stubEnv(false);
const { GET, HEAD } = await import("@/app/api/health/route");
const { setHeartbeatStore, scheduleOf } = await import("@/jobs/heartbeat");
const { jobs } = await import("@/jobs");

const NOW = new Date("2026-09-16T12:00:00.000Z");
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000).toISOString();

let writes = 0;
function store(rows: readonly JobRunRow[] | Error): HeartbeatStore {
  return {
    async record() {
      writes += 1;
    },
    async readAll() {
      if (rows instanceof Error) throw rows;
      return rows;
    },
    async claimAlert() {
      writes += 1;
      return true;
    },
    async claimErrorMail() {
      return true;
    },
    async releaseErrorMail() {},
  };
}

function freshRows(): JobRunRow[] {
  return scheduleOf(jobs).map(({ jobId }) => ({ jobId, lastRunAt: minutesAgo(5), staleAlertedAt: null }));
}

function withRow(rows: JobRunRow[], row: JobRunRow): JobRunRow[] {
  return rows.map((r) => (r.jobId === row.jobId ? row : r));
}

async function get(): Promise<{ status: number; cache: string | null; body: Record<string, unknown> }> {
  const response = await GET(new Request("https://reachkit.example/api/health"), undefined);
  return { status: response.status, cache: response.headers.get("cache-control"), body: await response.json() };
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
beforeEach(() => {
  writes = 0;
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  setHeartbeatStore(null);
});

describe("/api/health turns job_runs into a status code", () => {
  it("every scheduled job within twice its interval answers 200 {ok:true}, uncached", async () => {
    setHeartbeatStore(store(freshRows()));
    await expect(get()).resolves.toEqual({ status: 200, cache: "no-store", body: { ok: true } });
  });

  it("a job 31 minutes quiet on the 15-minute tick answers 503 and names it, mailed or not", async () => {
    const quiet = { jobId: "account/maintenance", lastRunAt: minutesAgo(31), staleAlertedAt: null };
    setHeartbeatStore(store(withRow(freshRows(), quiet)));
    await expect(get()).resolves.toMatchObject({ status: 503, body: { ok: false, stale: ["account/maintenance"] } });

    setHeartbeatStore(store(withRow(freshRows(), { ...quiet, staleAlertedAt: minutesAgo(1) })));
    await expect(get()).resolves.toMatchObject({ status: 503, body: { ok: false, stale: ["account/maintenance"] } });
  });

  it("every job silent answers 503 naming each of them", async () => {
    setHeartbeatStore(store(freshRows().map((r) => ({ ...r, lastRunAt: minutesAgo(24 * 60) }))));
    const { status, body } = await get();
    expect(status).toBe(503);
    expect(body.stale).toEqual(scheduleOf(jobs).map(({ jobId }) => jobId));
  });

  it("no rows answers 503 no-runs; a failed read answers 503 read-failed, with no error text", async () => {
    setHeartbeatStore(store([]));
    await expect(get()).resolves.toMatchObject({ status: 503, body: { ok: false, reason: "no-runs" } });

    setHeartbeatStore(store(new Error("password=secret host=db.internal")));
    const failed = await get();
    expect(failed).toMatchObject({ status: 503, body: { ok: false, reason: "read-failed" } });
    expect(JSON.stringify(failed.body)).not.toContain("secret");
  });

  it("the body carries only ok and stale or reason", async () => {
    const quiet = { jobId: "account/maintenance", lastRunAt: minutesAgo(31), staleAlertedAt: null };
    for (const rows of [freshRows(), withRow(freshRows(), quiet), [], new Error("x")]) {
      setHeartbeatStore(store(rows));
      const keys = Object.keys((await get()).body).sort();
      expect([["ok"], ["ok", "stale"], ["ok", "reason"]]).toContainEqual(keys);
    }
  });

  it("HEAD answers the same status with no body", async () => {
    for (const rows of [freshRows(), []]) {
      setHeartbeatStore(store(rows));
      const head = await HEAD(new Request("https://reachkit.example/api/health", { method: "HEAD" }), undefined);
      expect(head.status).toBe((await get()).status);
      expect(head.headers.get("cache-control")).toBe("no-store");
      expect(await head.text()).toBe("");
    }
  });

  it("never writes: no row recorded and no alert claimed", async () => {
    const quiet = { jobId: "account/maintenance", lastRunAt: minutesAgo(31), staleAlertedAt: null };
    setHeartbeatStore(store(withRow(freshRows(), quiet)));
    await get();
    expect(writes).toBe(0);
  });
});
