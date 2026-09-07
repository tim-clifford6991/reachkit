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
import { readStop } from "./stop";
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

/**
 * The next scheduled publish, or `null`. The date is the draft's own
 * `scheduled_for`; the *time* of day is §4.7's publish time, which the
 * shell does not state — it states the day.
 *
 * **A site whose publishing is switched off has no next publish**, and
 * that guard lives here rather than in the model. `publishingOf` gives a
 * `next` precedence over every cause except ReachKit's own stop (REQ-092
 * c7 names that one and no other), so a row still carrying a
 * `scheduled_for` would be announced as "the next page goes live" while
 * §9's switch holds it — "pause is one click and instant", and the page is
 * in `heldPages`, not on its way out. Nothing the fixture could produce
 * exercised that pair, which is why it surfaces here first: this is the
 * first feeder that reads both facts from real rows.
 *
 * Answering `null` puts the shell on the `publishing_paused` cause, which
 * is the true statement and the one the customer can act on.
 */
async function nextScheduled(siteId: string, publishingOn: boolean): Promise<Date | null> {
  if (!publishingOn) return null;
  return firstScheduled(siteId);
}

async function firstScheduled(siteId: string): Promise<Date | null> {
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

  // The switch is read first: whether there is a next publish at all
  // depends on it (see `nextScheduled`), so it cannot be read beside it.
  const publishingOn = await isPublishingOn(site.siteId);

  const [weeks, firstDueOn, waiting, next, planned, stopped] = await Promise.all([
    measuredWeeksOf({ site, now }),
    nextDueOn({ siteId: site.siteId, now }),
    waitingCount(site.siteId),
    nextScheduled(site.siteId, publishingOn),
    plannedCount(site.siteId),
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
