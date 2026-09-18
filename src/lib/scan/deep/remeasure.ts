// SPEC §6 (owner ruling 2026-09-17, issue 837) — a thin market is measured
// again now, never "on Monday".
//
// "Picking one re-measures right away as a background job with the
// side-panel loader, then fills the calendar. A category change in Settings
// also re-measures right away." And, from the issue: bounded to a sensible
// rate per site per day so it cannot be spammed.
//
// **There is no second pipeline here.** A re-measure is the onboarding pass
// again — `scan/run` at the deep tier, through `runDeepPass`, with its stages
// on `sites.setup_stage` and the first draft it starts before it ends — on a
// fresh claimed row instead of the site's onboarding row. This file decides
// whether the site may start one, claims the row, and sends the event.
//
// **The rate is read from `scans`, not from a counter.** Every paid deep pass
// is a row with the site's id and the instant it was claimed, so "how many
// started in the last day" and "is one still under way" are both questions
// about rows that already exist; no column records a request that could
// drift from the passes it started.
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

/** `scans.status` and `sites.setup_stage` are outside the generated
 *  `Database` type — the same narrow cast `release.ts` documents. */
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

/**
 * Claims a fresh `running` deep row for this site before anything is spent,
 * and answers its id — not the onboarding row, which is held by the site's
 * own id and has ended. A new id per press, so the `scan/run` delivery keyed
 * on it starts exactly this pass, and the deep pass adopts it as the site's
 * newest running row. Written here rather than through the pipeline's own
 * claim so that the screens this is sent from reach no vendor client.
 *
 * `remeasureOf` is the cut-short pass this one measures again, where the
 * maintenance tick started it (issue 886). `scans_one_remeasure_per_pass`
 * makes that insert the thing two deliveries of one tick race on: the loser
 * is answered `null` here and starts nothing, having spent nothing.
 */
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

/**
 * Starts one paid pass for this site now, or says why not.
 *
 * `category`, where given, is the founder's choice from the suggestions or
 * their own words: it is saved as the site's confirmed category only once the
 * pass may start, so a refused press changes nothing. Settings saves its own
 * change first and calls this without one.
 *
 * The side panel is told at once — the stage is written before the event is
 * sent, so the founder's next render already shows the loader — and a send
 * that fails closes the row it claimed rather than leaving it to block the
 * next press for the hold.
 */
export async function startRemeasure(a: {
  siteId: string;
  domain: string;
  category?: string;
  /** The cut-short pass this one measures again, where a maintenance tick
   *  started it (issue 886). Absent for a founder's own press. */
  remeasureOf?: string;
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
  // Another delivery of the same maintenance tick claimed this cut-short
  // pass's one re-measure first (issue 886). A pass for this site is under
  // way — the other delivery's — which is the refusal this already has.
  if (scanId === null) return { started: false, because: "running" };

  await untyped()
    .from<{ id: string }>("sites")
    .update({ setup_stage: STAGES[0], setup_stage_times: {} })
    .eq("id", a.siteId);

  try {
    const { sendRemeasure } = await import("@/jobs/deep-pass-backstop");
    await sendRemeasure({ scanId, siteId: a.siteId, domain: a.domain });
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
