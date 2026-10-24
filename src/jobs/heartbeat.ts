// src/jobs/heartbeat.ts — issue #799
//
// The owner can see the scheduled jobs are firing. Every invocation, of
// every job, writes its job's one `job_runs` row: when it last ran and how
// it ended. Then it looks at the other scheduled jobs' rows, and a job that
// has not run for twice its interval is told to `OWNER_EMAILS` through the
// incident mail — once per silence, not once per tick.
//
// **Why the check rides the jobs themselves.** The jobs platform is the
// only clock this product has (Vercel Hobby's crons are daily), so a
// watchdog outside it would need a second scheduler. Inside it, the
// fifteen-minute maintenance tick checks the hourly ones and they check it,
// so one job that stops — unsynced, renamed, broken at registration — is
// caught by the others. What this cannot catch is *every* job stopping:
// nothing runs to notice. That is the case `docs/RUNBOOK.md` §4 "Is it
// firing?" reads the table for.
//
// **Installed by `serve()`, not at import.** The store reaches the
// database; the runner is imported by every job test. So the store exists
// only where the registry is mounted — the `/api/jobs` route — and a
// process that never mounted it records nothing and asks nobody.
//
// **Nothing here throws.** The same rule as every alert beside it: a
// heartbeat that failed must not fail the job it is reporting on.
import type { LoggedOutcome } from "./observability";
import type { JobDefinition, JobId } from "./types";

export interface JobRunRow {
  readonly jobId: string;
  /** As the store returned it — handed back unchanged to `claimAlert`. */
  readonly lastRunAt: string;
  readonly staleAlertedAt: string | null;
}

export interface HeartbeatStore {
  record(jobId: JobId, outcome: LoggedOutcome, at: Date): Promise<void>;
  readAll(): Promise<readonly JobRunRow[]>;
  /** Marks the job told about, only if this silence has not been told
   *  about yet and the job has not run since `row` was read. True when this
   *  caller made the claim — the one that sends the mail. */
  claimAlert(row: JobRunRow, at: Date): Promise<boolean>;
  /** Inserts the (job, error class, Berlin day) row unless it exists. True
   *  when this caller inserted it — the one that sends the mail. */
  claimErrorMail(key: ErrorMailKey, at: Date): Promise<boolean>;
  /** Deletes the claim, so a mail that was not sent does not use up the day. */
  releaseErrorMail(key: ErrorMailKey): Promise<void>;
}

export interface ErrorMailKey {
  readonly jobId: string;
  readonly errorName: string;
  /** The Europe/Berlin calendar day, `YYYY-MM-DD`. */
  readonly day: string;
}

/** A scheduled job and how often it is due. */
export interface ScheduledJob {
  readonly jobId: JobId;
  readonly intervalMinutes: number;
}

export interface StaleJob {
  readonly row: JobRunRow;
  readonly intervalMinutes: number;
}

/**
 * How often a cron expression fires, in minutes — for the shapes the
 * registry uses: `*\/N * * * *`, an evenly spaced `M,M,… * * * *`,
 * `M * * * *`, `M H * * *`, `M H * * D`.
 * `null` for anything else; `tests/jobs/heartbeat.test.ts` asserts every
 * registered cron resolves, so a new shape cannot go unwatched quietly.
 */
export function cronIntervalMinutes(cron: string): number | null {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields as [string, string, string, string, string];
  if (dayOfMonth !== "*" || month !== "*") return null;
  const step = /^\*\/(\d+)$/.exec(minute);
  if (step !== null && hour === "*" && dayOfWeek === "*") {
    const n = Number(step[1]);
    return n >= 1 && n <= 60 ? n : null;
  }
  if (/^\d+(,\d+)+$/.test(minute) && hour === "*" && dayOfWeek === "*") {
    const at = minute.split(",").map(Number);
    const gap = 60 / at.length;
    return at.every((m, i) => m <= 59 && m === at[0]! + i * gap) ? gap : null;
  }
  if (!/^\d+$/.test(minute)) return null;
  if (hour === "*") return dayOfWeek === "*" ? 60 : null;
  if (!/^\d+$/.test(hour)) return null;
  if (dayOfWeek === "*") return 24 * 60;
  return /^\d$/.test(dayOfWeek) ? 7 * 24 * 60 : null;
}

export function scheduleOf(definitions: readonly JobDefinition[]): readonly ScheduledJob[] {
  const scheduled: ScheduledJob[] = [];
  for (const definition of definitions) {
    if (definition.trigger.kind !== "cron") continue;
    const intervalMinutes = cronIntervalMinutes(definition.trigger.cron);
    if (intervalMinutes !== null) scheduled.push({ jobId: definition.id, intervalMinutes });
  }
  return scheduled;
}

/**
 * The scheduled jobs whose last run is more than twice their interval ago.
 * A job with no row has never run on this database and is not judged: there
 * is no last run to be late against (RUNBOOK §4 reads a missing row).
 */
export function overdueJobs(
  schedule: readonly ScheduledJob[],
  rows: readonly JobRunRow[],
  now: Date
): readonly StaleJob[] {
  const byId = new Map(rows.map((row) => [row.jobId, row]));
  const overdue: StaleJob[] = [];
  for (const { jobId, intervalMinutes } of schedule) {
    const row = byId.get(jobId);
    if (row === undefined) continue;
    const lastRun = Date.parse(row.lastRunAt);
    if (Number.isNaN(lastRun)) continue;
    if (now.getTime() - lastRun <= 2 * intervalMinutes * 60_000) continue;
    overdue.push({ row, intervalMinutes });
  }
  return overdue;
}

/** The overdue jobs, other than `self`, whose silence has not been told about. */
export function staleJobs(
  schedule: readonly ScheduledJob[],
  rows: readonly JobRunRow[],
  now: Date,
  self: JobId
): readonly StaleJob[] {
  return overdueJobs(schedule, rows, now).filter(
    ({ row }) =>
      row.jobId !== self &&
      (row.staleAlertedAt === null || !(Date.parse(row.staleAlertedAt) >= Date.parse(row.lastRunAt)))
  );
}

export type JobsHealth =
  | { readonly ok: true }
  | { readonly ok: false; readonly stale: readonly string[] }
  | { readonly ok: false; readonly reason: "no-runs" | "read-failed" };

/** What the outside monitor reads: the one check that still sees every job
 *  stopping, because it runs on a request rather than on a job. Reads only;
 *  an alert already mailed does not hide a job here. */
export async function jobsHealth(definitions: readonly JobDefinition[], now: Date): Promise<JobsHealth> {
  const schedule = scheduleOf(definitions);
  let rows: readonly JobRunRow[];
  try {
    rows = await (installed?.store ?? databaseHeartbeatStore()).readAll();
  } catch {
    return { ok: false, reason: "read-failed" };
  }
  if (!schedule.some(({ jobId }) => rows.some((row) => row.jobId === jobId))) return { ok: false, reason: "no-runs" };
  const overdue = overdueJobs(schedule, rows, now);
  return overdue.length === 0 ? { ok: true } : { ok: false, stale: overdue.map(({ row }) => row.jobId) };
}

let installed: { store: HeartbeatStore; schedule: readonly ScheduledJob[] } | null = null;

/** The swap door. `null` uninstalls: nothing is recorded and nothing asked. */
export function setHeartbeatStore(store: HeartbeatStore | null, definitions: readonly JobDefinition[] = []): void {
  installed = store === null ? null : { store, schedule: scheduleOf(definitions) };
}

export function heartbeatInstalled(): boolean {
  return installed !== null;
}

/** Called by `serve()` with the registry it mounts. Keeps a store a test
 *  stood in; installs the database one otherwise. */
export function installHeartbeat(definitions: readonly JobDefinition[]): void {
  setHeartbeatStore(installed?.store ?? databaseHeartbeatStore(), definitions);
}

function warn(event: string, outcome: string): void {
  console.warn(JSON.stringify({ event, outcome }));
}

/** Records this invocation, then tells the owner of any scheduled job gone
 *  quiet. Never throws. */
export async function beat(jobId: JobId, outcome: LoggedOutcome, now: Date): Promise<void> {
  if (installed === null) return;
  const { store, schedule } = installed;
  try {
    await store.record(jobId, outcome, now);
  } catch {
    warn("job_heartbeat", "record-failed");
  }
  let stale: readonly StaleJob[];
  try {
    stale = staleJobs(schedule, await store.readAll(), now, jobId);
  } catch {
    warn("job_heartbeat", "read-failed");
    return;
  }
  for (const { row, intervalMinutes } of stale) {
    try {
      if (!(await store.claimAlert(row, now))) continue;
      const { reportIncident } = await import("@/lib/mail/ops");
      await reportIncident({ occasion: "job-stale", jobId: row.jobId, lastRunAt: row.lastRunAt, intervalMinutes });
    } catch {
      warn("job_stale_alert", "threw");
    }
  }
}

/** Whether this tick mails the owner about a failing job. A store that
 *  cannot answer mails anyway: a duplicate alert is better than a missing one.
 *  With no store installed there is nothing to claim against, so it mails. */
export async function claimErrorMail(key: ErrorMailKey, now: Date): Promise<"claimed" | "taken" | "unclaimed"> {
  if (installed === null) return "unclaimed";
  try {
    return (await installed.store.claimErrorMail(key, now)) ? "claimed" : "taken";
  } catch {
    warn("ops_incident_alert", "claim_unavailable");
    return "unclaimed";
  }
}

/** Never throws: a claim left behind costs one day's mail, never the job. */
export async function releaseErrorMail(key: ErrorMailKey): Promise<void> {
  if (installed === null) return;
  try {
    await installed.store.releaseErrorMail(key);
  } catch {
    warn("ops_incident_alert", "release_failed");
  }
}

/** The generated `Database` type does not carry `job_runs` — the same
 *  narrow cast `src/lib/site-profile/store.ts` documents. */
interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  upsert(values: Record<string, unknown>, options: { onConflict: string; ignoreDuplicates?: boolean }): MinimalQuery<T>;
  delete(): MinimalQuery<T>;
  update(values: Record<string, unknown>): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  or(filters: string): MinimalQuery<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

interface Row {
  job_id: string;
  last_run_at: string;
  stale_alerted_at: string | null;
}

/** `job_runs` through `dbAdmin()`, imported at the call: a static import
 *  would put a database client on the runner's module graph. */
function databaseHeartbeatStore(): HeartbeatStore {
  // The client, not the query: a query is thenable, and an async function
  // returning one would run it.
  async function client(): Promise<MinimalClient> {
    const { dbAdmin } = await import("@/lib/db");
    return dbAdmin() as unknown as MinimalClient;
  }
  return {
    async record(jobId, outcome, at) {
      const { error } = await (await client()).from<Row>("job_runs").upsert(
        { job_id: jobId, last_run_at: at.toISOString(), last_outcome: outcome },
        { onConflict: "job_id" }
      );
      if (error !== null) throw new Error(error.message);
    },
    async readAll() {
      const { data, error } = await (await client()).from<Row>("job_runs").select("job_id, last_run_at, stale_alerted_at");
      if (error !== null) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        jobId: row.job_id,
        lastRunAt: row.last_run_at,
        staleAlertedAt: row.stale_alerted_at,
      }));
    },
    async claimAlert(row, at) {
      const { data, error } = await (await client()).from<Row>("job_runs")
        .update({ stale_alerted_at: at.toISOString() })
        .eq("job_id", row.jobId)
        .eq("last_run_at", row.lastRunAt)
        .or(`stale_alerted_at.is.null,stale_alerted_at.lt."${row.lastRunAt}"`)
        .select("job_id");
      if (error !== null) throw new Error(error.message);
      return (data ?? []).length === 1;
    },
    async claimErrorMail(key, at) {
      // `ignoreDuplicates` is `insert … on conflict do nothing returning`: only the inserting tick gets a row back.
      const { data, error } = await (await client()).from<Row>("job_error_mails")
        .upsert(
          { job_id: key.jobId, error_name: key.errorName, day: key.day, mailed_at: at.toISOString() },
          { onConflict: "job_id,error_name,day", ignoreDuplicates: true }
        )
        .select("job_id");
      if (error !== null) throw new Error(error.message);
      return (data ?? []).length === 1;
    },
    async releaseErrorMail(key) {
      const { error } = await (await client()).from<Row>("job_error_mails")
        .delete()
        .eq("job_id", key.jobId)
        .eq("error_name", key.errorName)
        .eq("day", key.day);
      if (error !== null) throw new Error(error.message);
    },
  };
}
