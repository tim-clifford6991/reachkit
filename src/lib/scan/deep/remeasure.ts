// A thin market is measured again now, never "on Monday", bounded per site per day so it cannot be spammed.
// No second pipeline: a re-measure is the onboarding pass again (`scan/run` at the deep tier) on a fresh claimed row; this file decides, claims and sends.
// The rate is read from `scans` rows, not a counter that could drift from the passes it started.
import { REMEASURE } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";
import { parseDomain } from "../domain";
import { STAGES } from "../stages";

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

export type RemeasureStart =
  | { started: true; scanId: string }
  /** A pass for this site is still under way; the founder's loader says so. */
  | { started: false; because: "running" }
  /** `REMEASURE.perDay` passes started inside the last day. `nextAt` is when
   *  the oldest of them leaves the window. */
  | { started: false; because: "daily_limit"; nextAt: Date };

interface PassRow {
  id: string;
  status: string;
  created_at: string;
}

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
}

/** Postgres's unique violation, as PostgREST hands it back. */
const UNIQUE_VIOLATION = "23505";

interface MinimalQuery<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQuery<T>;
  update(values: Record<string, unknown>): MinimalQuery<T>;
  insert(values: Record<string, unknown>): MinimalQuery<T>;
  eq(column: string, value: string): MinimalQuery<T>;
  gt(column: string, value: string): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

/** `scans.status` and `sites.setup_stage` are outside the generated `Database` type; the same narrow cast as `release.ts`. */
function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

/** The site's deep passes claimed after `since`, newest window first. */
async function passesSince(siteId: string, since: Date): Promise<PassRow[]> {
  const { data, error } = await untyped()
    .from<PassRow>("scans")
    .select("id, status, created_at")
    .eq("site_id", siteId)
    .eq("tier", "deep")
    .gt("created_at", since.toISOString())
    .limit(REMEASURE.perDay * 4);
  if (error) throw new Error(`remeasure: could not read the site's passes: ${error.message}`);
  return data ?? [];
}

/** A pass claimed inside the hold that has not ended. */
function underWay(rows: readonly PassRow[], now: Date): boolean {
  const since = now.getTime() - REMEASURE.runningHoldMin * MS_PER_MINUTE;
  return rows.some((row) => row.status === "running" && Date.parse(row.created_at) > since);
}

/**
 * Whether a pass measured again now is under way for this site, after
 * `after` — the founder's release, so the onboarding pass itself is never
 * read as one. The progress read asks this for a released founder.
 */
export async function remeasureUnderWay(siteId: string, after: Date, now: Date = new Date()): Promise<boolean> {
  const hold = new Date(now.getTime() - REMEASURE.runningHoldMin * MS_PER_MINUTE);
  const since = after.getTime() > hold.getTime() ? after : hold;
  return underWay(await passesSince(siteId, since), now);
}

/** Whether this site may start a pass now, from its last day of passes. */
export async function remeasureAllowed(siteId: string, now: Date = new Date()): Promise<RemeasureStart | null> {
  const rows = await passesSince(siteId, new Date(now.getTime() - MS_PER_DAY));
  if (underWay(rows, now)) return { started: false, because: "running" };
  if (rows.length >= REMEASURE.perDay) {
    const oldest = Math.min(...rows.map((row) => Date.parse(row.created_at)));
    return { started: false, because: "daily_limit", nextAt: new Date(oldest + MS_PER_DAY) };
  }
  return null;
}

/** Claims a fresh `running` deep row before anything is spent and answers its id; a new id per press, so `scan/run` keyed on it starts exactly this pass.
 *  Written here so the screens this is sent from reach no vendor client. `remeasureOf` makes two deliveries of one tick race on
 *  `scans_one_remeasure_per_pass`: the loser gets `null` and spends nothing. */
async function claimFreshPass(a: {
  siteId: string;
  domain: string;
  remeasureOf?: string;
}): Promise<string | null> {
  const parsed = parseDomain(a.domain);
  if (!parsed.ok) throw new Error(`remeasure: ${parsed.problem}`);
  const scanId = crypto.randomUUID();
  const { error } = await untyped()
    .from<{ id: string }>("scans")
    .insert({
      id: scanId,
      domain: parsed.domain,
      tier: "deep",
      status: "running",
      site_id: a.siteId,
      ...(a.remeasureOf === undefined ? {} : { remeasure_of: a.remeasureOf }),
    });
  if (error?.code === UNIQUE_VIOLATION) return null;
  if (error) throw new Error(`remeasure: could not claim the scan row: ${error.message}`);
  return scanId;
}

/** Starts one paid pass now, or says why not. `category` is saved as confirmed only once the pass may start, so a refused press changes nothing.
 *  The stage is written before the event is sent so the next render shows the loader; a failed send closes the row it claimed. */
export async function startRemeasure(a: {
  siteId: string;
  domain: string;
  category?: string;
  /** The cut-short first pass this one measures again; absent for a founder's press. */
  remeasureOf?: string;
  /** When the pass is sent, where a day's ceiling stopped the one it re-measures; its own stages are written when it runs. */
  at?: Date;
  now?: Date;
}): Promise<RemeasureStart> {
  const now = a.now ?? new Date();
  const refused = await remeasureAllowed(a.siteId, now);
  if (refused !== null) return refused;

  if (a.category !== undefined) {
    const { error } = await untyped().from<{ id: string }>("sites").update({ category: a.category }).eq("id", a.siteId);
    if (error) throw new Error(`remeasure: could not save the category: ${error.message}`);
  }

  const scanId = await claimFreshPass(a);
  // Another delivery of the same tick claimed this pass's one re-measure first, so one is under way.
  if (scanId === null) return { started: false, because: "running" };

  if (a.at === undefined) {
    await untyped()
      .from<{ id: string }>("sites")
      .update({ setup_stage: STAGES[0], setup_stage_times: {} })
      .eq("id", a.siteId);
  }

  try {
    const { sendRemeasure } = await import("@/jobs/scan-run");
    await sendRemeasure({ scanId, siteId: a.siteId, domain: a.domain, ...(a.at === undefined ? {} : { at: a.at }) });
  } catch (error) {
    await untyped()
      .from<{ id: string }>("scans")
      .update({ status: "failed", stopped_reason: "failed", finished_at: new Date().toISOString() })
      .eq("id", scanId);
    await untyped().from<{ id: string }>("sites").update({ setup_stage: null }).eq("id", a.siteId);
    throw error;
  }
  return { started: true, scanId };
}

const CEILINGS: ReadonlySet<string> = new Set(["time_ceiling", "spend_ceiling"]);

/** A first pass a ceiling stopped, or that failed, measured again once: keyed on it (`scans_one_remeasure_per_pass`), so a second
 *  delivery starts none, and sent after the UTC day rolls over where the day's own ceiling, the site's or the product's, stopped it. */
export async function remeasureCutShort(a: { siteId: string; domain: string; scanId: string; now?: Date }): Promise<RemeasureStart | null> {
  const now = a.now ?? new Date();
  const { data, error } = await untyped().from<{ status: string; stopped_reason: string | null }>("scans").select("status, stopped_reason").eq("id", a.scanId).limit(1);
  if (error) throw new Error(`remeasure: could not read ${a.scanId}: ${error.message}`);
  const row = data?.[0];
  if (row === undefined || (row.status !== "failed" && !CEILINGS.has(row.stopped_reason ?? ""))) return null;
  const daily = await import("@/lib/costs/daily");
  const [site, day] = row.stopped_reason === "spend_ceiling" ? await Promise.all([daily.readSiteDaySpendCents(a.siteId, now), daily.readDaySpendCents(now)]) : [null, null];
  const dayHit = (site !== null && daily.siteCeilingReached(site)) || (day !== null && daily.ceilingReached(day, await daily.readDayCeilingCents(now)));
  const at = dayHit ? new Date(now.getTime() + daily.secondsUntilDayRollsOver(now) * 1000) : undefined;
  return startRemeasure({ siteId: a.siteId, domain: a.domain, remeasureOf: a.scanId, now, ...(at === undefined ? {} : { at }) });
}
