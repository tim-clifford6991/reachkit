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

/** Every site whose finished setup has no ended deep pass. */
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
    .from<{ site_id: string }>("scans")
    .select("site_id")
    .eq("tier", "deep")
    .neq("status", "running")
    .in("site_id", ids);
  if (passes.error) throw new Error(`sitesWithoutDeepPass: could not read scans: ${passes.error.message}`);
  const ran = new Set((passes.data ?? []).map((row) => row.site_id));
  return ids.filter((id) => !ran.has(id));
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
