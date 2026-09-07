// BUILD §4.4 — the shell's facts, for a real signed-in account.
//
// The other half of `provider.ts`: what `readShell` assembles from when the
// account is a customer's rather than the reserved fixture account. Every
// value here is a projection of rows another block already wrote — this
// file measures nothing, buys nothing and **creates nothing**.
//
// Each fact and whose rows it comes from:
//
//   weeks / firstDueOn   §11's weekly measurement — `weeksAlreadyStamped`
//                        over this site's own Mondays, and `nextDueOn`
//   waiting              §9's `in_review` and `needs_attention` drafts
//   next / causes        §9's scheduled publish, the site's own switch,
//                        and the kill switch
//   stopped              §6.5 / §11's stop, through `stopCause`
//
// **A site with nothing yet reads empty, and that is the right answer.** A
// customer who signed in the day they paid has no measured week, no page
// waiting and no scheduled publish; §4.4's frame and ADR-061's arms are
// designed for exactly that, and the alternative — a fixture standing in —
// is what this issue exists to remove.
//
// **`capHit` is not read separately, and that is deliberate.** §6.5 records
// a spend ceiling by marking the scan `degraded` ("skip remaining optional
// work, mark scan `degraded`, never throw"), so the fact reaches this file
// through the last run's status rather than through a second ledger read
// that could disagree with it. `stopCause` still classifies it — as
// `step-failed` rather than `spend-ceiling` — and both render a stop; when
// a per-account cap-hit reader exists, this is the one call site to change.
import { dbAdmin } from "@/lib/db";
import { stopCause, type WorkStop } from "@/lib/presentation/stopped";
import { nextDueOn } from "@/lib/scan/weekly";
import { measuredWeeksOf } from "./week-rows";
import type { ShellFacts } from "./model";

/** One site's account, as the shell needs it. Declared by the caller
 *  (`_session/account.ts`) and narrowed here to the members this file
 *  reads — there is nothing on it a credential could ride in on. */
export interface ShellSite {
  siteId: string;
  domain: string;
  timeZone: string;
  mode: "autopilot" | "copilot";
  createdAt: Date;
}

interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string, options?: Record<string, unknown>): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  in(column: string, values: readonly unknown[]): MinimalQuery<T>;
  not(column: string, operator: string, value: unknown): MinimalQuery<T>;
  order(column: string, opts: { ascending: boolean }): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

function client(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

/** §9's two states that wait on the customer, and no third: `in_review` is
 *  a page in the veto window and `needs_attention` is one that came to rest
 *  needing them. A page that is merely planned waits on nobody. */
const WAITING_STATES = ["in_review", "needs_attention"] as const;

/** The states a scheduled publish can still be in. A page already
 *  `published` is not next, and a `skipped` one never was. */
const SCHEDULED_STATES = ["approved", "publishing"] as const;

interface DraftStateRow {
  id: string;
  state: string;
  scheduled_for: string | null;
}

/** How many pages are waiting on this customer right now. A true count,
 *  derived; never a sentence. */
async function waitingCount(siteId: string): Promise<number> {
  const { data, error } = await client()
    .from<DraftStateRow>("drafts")
    .select("id, state, scheduled_for")
    .eq("site_id", siteId)
    .in("state", WAITING_STATES);
  if (error !== null || data === null) return 0;
  return data.length;
}

/** The next scheduled publish, or `null`. The date is the draft's own
 *  `scheduled_for`; the *time* of day is §4.7's publish time, which the
 *  shell does not state — it states the day. */
async function nextScheduled(siteId: string): Promise<Date | null> {
  const { data, error } = await client()
    .from<DraftStateRow>("drafts")
    .select("id, state, scheduled_for")
    .eq("site_id", siteId)
    .in("state", SCHEDULED_STATES)
    .not("scheduled_for", "is", null)
    .order("scheduled_for", { ascending: true })
    .limit(1);
  if (error !== null || data === null) return null;
  const scheduled = data[0]?.scheduled_for;
  return scheduled === undefined || scheduled === null ? null : new Date(scheduled);
}

/** Whether this site has any page at all that a publish could reach —
 *  §4.4's `nothing_planned`, which is a different fact from "nothing is
 *  approved". */
async function plannedCount(siteId: string): Promise<number> {
  const { data, error } = await client()
    .from<DraftStateRow>("drafts")
    .select("id, state, scheduled_for")
    .eq("site_id", siteId)
    .in("state", ["planned", "generating", "in_review", "approved", "publishing"]);
  if (error !== null || data === null) return 0;
  return data.length;
}

interface LastScanRow {
  id: string;
  status: string;
}

/** The last run this site made, as `stopCause` reads it. A site that has
 *  never run has nothing to report — `ok`, because no run has failed. */
async function lastRunStatus(siteId: string): Promise<"ok" | "degraded" | "failed"> {
  const { data, error } = await client()
    .from<LastScanRow>("scans")
    .select("id, status")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error !== null || data === null) return "ok";
  const status = data[0]?.status;
  if (status === "degraded") return "degraded";
  if (status === "failed") return "failed";
  return "ok";
}

/**
 * §11's stop, for this account.
 *
 * `resumes` and `needs` are the two REQ-092 requires to be stated rather
 * than omitted. A kill switch promises no time (an operator lifts it, and
 * ReachKit does not know when) and needs nothing from the customer — it is
 * ReachKit's own stop, and REQ-092 c2's "when nothing is, says so" is what
 * the `nothing` arm renders.
 */
async function readStop(siteId: string): Promise<WorkStop | null> {
  const { reachKitStopped } = await import("@/lib/publish/switch");
  const [killSwitch, lastRun] = await Promise.all([reachKitStopped(), lastRunStatus(siteId)]);
  const cause = stopCause({ capHit: false, killSwitch, lastRun });
  if (cause === null) return null;
  return {
    since: new Date(),
    resumes: { promised: false },
    needs: { kind: "nothing" },
    // REQ-092 c6: a run that was cut short still produced its page, and the
    // day says part of the measurement behind it was not done.
    partial: lastRun === "degraded",
  };
}

/**
 * Everything §4.4's frame states about one real account.
 *
 * Six reads, all of them projections, run together: nothing here depends on
 * anything else here, and a screen that waited on them in sequence would be
 * six round trips deep before it drew a sidebar.
 */
export async function readShellFacts(site: ShellSite): Promise<ShellFacts> {
  const { isPublishingOn } = await import("@/lib/publish/switch");
  const now = new Date();

  const [weeks, firstDueOn, waiting, next, planned, publishingOn, stopped] = await Promise.all([
    measuredWeeksOf({ site, now }),
    nextDueOn({ siteId: site.siteId, now }),
    waitingCount(site.siteId),
    nextScheduled(site.siteId),
    plannedCount(site.siteId),
    isPublishingOn(site.siteId),
    readStop(site.siteId),
  ]);

  return {
    domain: site.domain,
    timeZone: site.timeZone,
    mode: site.mode,
    weeks,
    firstDueOn,
    waiting,
    next,
    stopped,
    // The four causes, each read as its own fact. `resolveNoPublish` picks
    // between them by ADR-011's precedence — never by whichever this file
    // tested first.
    noPublishCauses: {
      reachkit_stopped: stopped !== null,
      publishing_paused: !publishingOn,
      nothing_approved: next === null && planned > 0,
      nothing_planned: planned === 0,
    },
  };
}
