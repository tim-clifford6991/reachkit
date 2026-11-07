// src/jobs/job-days.ts
//
// Each job invocation's count, CPU and wall time, added to one `job_days` row
// per job, UTC day and site. The measure wraps the whole invocation, because
// every step is an invocation of its own and `runJob` sees only the last.
//
// `cpu_ms` is `process.cpuUsage()` over the invocation: invocations sharing an
// instance each see the others' CPU, so it is an upper bound and `wall_ms` is
// kept beside it (`docs/RUNBOOK.md` §4).
//
// Measuring never fails or slows a job: the write starts after the answer is
// ready, is not awaited, stops at `WRITE_DEADLINE_MS`, and a failure is a log.
import { after } from "next/server";
import type { EngineResult } from "./engine";

/** How long a row is kept: past it, `account/maintenance` deletes it. */
export const JOB_DAYS_KEPT_DAYS = 35;

const WRITE_DEADLINE_MS = 2_000;
const SITE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface JobDayAdd {
  readonly jobId: string;
  /** The UTC day, `YYYY-MM-DD`. */
  readonly day: string;
  readonly siteId: string | null;
  readonly cpuMs: number;
  readonly wallMs: number;
}

export type JobDaysStore = (add: JobDayAdd) => Promise<void>;

type Answer = PromiseLike<{ error: { message: string } | null }>;

interface Untyped {
  rpc(fn: string, args: Record<string, unknown>): { abortSignal(signal: AbortSignal): Answer };
  from(table: string): { delete(): { lt(column: string, value: string): Answer } };
}

async function databaseStore(add: JobDayAdd): Promise<void> {
  const { dbAdmin } = await import("@/lib/db");
  const { error } = await (dbAdmin() as unknown as Untyped)
    .rpc("job_days_add", {
      p_job_id: add.jobId,
      p_day: add.day,
      p_site_id: add.siteId,
      p_cpu_ms: add.cpuMs,
      p_wall_ms: add.wallMs,
    })
    .abortSignal(AbortSignal.timeout(WRITE_DEADLINE_MS));
  if (error !== null) throw new Error(error.message);
}

let store: JobDaysStore = databaseStore;

/** Stands a store in for the database; `null` puts the database back. */
export function setJobDaysStore(next: JobDaysStore | null): void {
  store = next ?? databaseStore;
}

/** The run's site, from its event's `siteId`; null for a tick, which has none. */
export function siteOf(data: unknown): string | null {
  const siteId = (data as { siteId?: unknown } | null | undefined)?.siteId;
  return typeof siteId === "string" && SITE_ID.test(siteId) ? siteId : null;
}

function record(add: JobDayAdd): void {
  const write = Promise.resolve()
    .then(() => store(add))
    .catch(() => {
      console.warn(JSON.stringify({ event: "job_days", outcome: "record-failed", jobId: add.jobId }));
    });
  try {
    // Keeps a serverless invocation alive until the write settles.
    after(write);
  } catch {
    // Outside a request scope there is nothing to keep alive; the write is already running.
  }
}

/** Runs one invocation and adds its time to the job's row; the answer is `next`'s, whatever the write does. */
export async function measureInvocation<T>(jobId: string, site: () => string | null, next: () => Promise<T>): Promise<T> {
  const cpu = process.cpuUsage();
  const wall = performance.now();
  try {
    return await next();
  } finally {
    const used = process.cpuUsage(cpu);
    record({
      jobId,
      day: new Date().toISOString().slice(0, 10),
      siteId: site(),
      cpuMs: Math.round((used.user + used.system) / 1000),
      wallMs: Math.round(performance.now() - wall),
    });
  }
}

/** `account/maintenance`'s obligation: rows older than the window go, in one statement, and nothing is handed off.
 *  A failed delete is a log, not a failed tick: the rows are the owner's metering, and the next tick deletes them. */
export const jobDaysPrune = Object.freeze({
  async due(): Promise<readonly string[]> {
    const cutoff = new Date(Date.now() - JOB_DAYS_KEPT_DAYS * 86_400_000).toISOString().slice(0, 10);
    try {
      const { dbAdmin } = await import("@/lib/db");
      const { error } = await (dbAdmin() as unknown as Untyped).from("job_days").delete().lt("day", cutoff);
      if (error !== null) throw new Error(error.message);
    } catch {
      console.warn(JSON.stringify({ event: "job_days", outcome: "prune-failed" }));
    }
    return [];
  },
  async handOff(): Promise<EngineResult> {
    return { done: true };
  },
});
