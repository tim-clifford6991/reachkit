// SPEC §5 — a finished setup whose onboarding pass never started (issue #782).
//
// Setup sends `scan/run` once, retried inside the submit, and swallows the
// last failure so the founder is never put back in front of the three
// decisions. The founder now waits for that pass inside the app, so a send
// the queue never received is a side panel that never clears and a first
// page that never comes. This is the query `account/maintenance` asks every
// tick to find those sites; `src/jobs/deep-pass-backstop.ts` re-sends.
//
// **Due:** setup completed more than `TIMING.deepPassBackstopMin` ago, and
// no deep scan row for the site that a pass has ended. A `running` row does
// not count: setup claims the onboarding row when it accepts the address
// (`claimOnboardingPass`), before any pass exists.
//
// **Why a re-send is harmless.** The event carries the key setup's own send
// carries, and `scan/run` is idempotent on it — a pass that is queued or
// still running is not started twice. The query only looks back
// `TIMING.deepPassBackstopH` hours, the platform's idempotency window, so a
// pass that ran and crashed is not re-sent past it on every tick for ever.
//
// **A pass a ceiling stopped is measured again** (issue 855, owner). A first
// pass that ended on `time_ceiling` or `spend_ceiling` did not finish reading
// the market; it is not a market too small and the founder is not asked to
// change a category. Where the site's newest deep pass ended that way, the
// same tick starts it again as a re-measure (`startRemeasure`, issue 837) —
// a fresh row under that bound: one pass at a time, at most
// `REMEASURE.perDay` in a day, the onboarding pass included — inside the same
// `TIMING.deepPassBackstopH` window after setup.
//
// **Why a re-measure is harmless too** (issue 886). `account/maintenance` is
// a clock tick and carries no idempotency key, so the same tick can be
// delivered twice. 837's bound refuses the second start once the first has
// claimed its row, but it reads before it writes, so two deliveries arriving
// together would both read no running pass and both claim one. The key that
// does not decay with a clock is the cut-short pass itself: this file hands
// its id back, the re-measure records it as `scans.remeasure_of`, and
// `scans_one_remeasure_per_pass` lets exactly one of them through.
import { TIMING } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  neq(column: string, value: string): MinimalQueryBuilder<T>;
  in(column: string, values: readonly string[]): MinimalQueryBuilder<T>;
  lt(column: string, value: string): MinimalQueryBuilder<T>;
  gt(column: string, value: string): MinimalQueryBuilder<T>;
  limit(n: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

const MS_PER_MINUTE = 60_000;

/** At most this many sites a tick. One day of setups is far below it. */
const SITES_PER_TICK = 200;

/** Every site whose finished setup has no ended deep pass, or whose newest
 *  deep pass a ceiling stopped (issue 855). */
export async function sitesWithoutDeepPass(now: Date): Promise<readonly string[]> {
  const before = new Date(now.getTime() - TIMING.deepPassBackstopMin * MS_PER_MINUTE).toISOString();
  const after = new Date(now.getTime() - TIMING.deepPassBackstopH * 60 * MS_PER_MINUTE).toISOString();

  const sites = await untyped()
    .from<{ id: string }>("sites")
    .select("id")
    .lt("setup_completed_at", before)
    .gt("setup_completed_at", after)
    .limit(SITES_PER_TICK);
  if (sites.error) throw new Error(`sitesWithoutDeepPass: could not read sites: ${sites.error.message}`);
  const ids = (sites.data ?? []).map((row) => row.id);
  if (ids.length === 0) return [];

  const passes = await untyped()
    .from<PassRow>("scans")
    .select("site_id, status, stopped_reason, created_at")
    .eq("tier", "deep")
    .in("site_id", ids);
  if (passes.error) throw new Error(`sitesWithoutDeepPass: could not read scans: ${passes.error.message}`);
  const rows = passes.data ?? [];
  return ids.filter((id) => owed(rows.filter((row) => row.site_id === id)) !== null);
}

interface PassRow {
  id?: string;
  site_id: string;
  status: string;
  stopped_reason?: string | null;
  created_at?: string | null;
}

/** The two ceilings: a pass that stopped on one did not finish. */
const CEILINGS: ReadonlySet<string> = new Set(["time_ceiling", "spend_ceiling"]);

/** The site's newest deep row by claim time. */
function newestOf(rows: readonly PassRow[]): PassRow | undefined {
  return [...rows].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
}

/** What one site's deep rows owe it: its onboarding pass (`never_ran`), the
 *  pass again because a ceiling stopped the newest (`cut_short`), or nothing
 *  — a pass that finished, or one still under way. */
function owed(rows: readonly PassRow[]): "never_ran" | "cut_short" | null {
  const ended = rows.filter((row) => row.status !== "running");
  if (ended.length === 0) return "never_ran";
  const newest = newestOf(rows);
  if (newest === undefined || newest.status === "running") return null;
  return CEILINGS.has(String(newest.stopped_reason ?? "")) ? "cut_short" : null;
}

/**
 * The pass a ceiling stopped, where that is what a site the query named is
 * owed, rather than its onboarding pass never having run — which decides
 * whether the tick re-sends setup's event or re-measures.
 *
 * It answers the **row's id**, not a yes (issue 886): the id is the key the
 * re-measure it starts is unique on (`scans.remeasure_of`), so two
 * deliveries of one maintenance tick that both read this pass race on that
 * column and exactly one of them starts a paid pass.
 */
export async function deepPassCutShort(siteId: string): Promise<string | null> {
  const { data, error } = await untyped()
    .from<PassRow>("scans")
    .select("id, site_id, status, stopped_reason, created_at")
    .eq("tier", "deep")
    .eq("site_id", siteId);
  if (error) throw new Error(`deepPassCutShort: could not read scans: ${error.message}`);
  const rows = data ?? [];
  if (owed(rows) !== "cut_short") return null;
  return newestOf(rows)?.id ?? null;
}

/** The address a site's pass runs against, or `null` for a site gone since
 *  the query. */
export async function deepPassDomain(siteId: string): Promise<string | null> {
  const { data, error } = await untyped()
    .from<{ domain: string }>("sites")
    .select("domain")
    .eq("id", siteId)
    .limit(1);
  if (error) throw new Error(`deepPassDomain: could not read site ${siteId}: ${error.message}`);
  return data?.[0]?.domain ?? null;
}
