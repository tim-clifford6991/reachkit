// BUILD §4.5 — Overview's facts, for a real signed-in account.
//
// The other half of `provider.ts`: what `readOverview` assembles from when
// the account is a customer's rather than the reserved fixture account. It
// measures nothing, buys nothing and creates nothing — every value is a
// projection of rows another block already wrote, or the honest statement
// that no such row exists yet.
//
// **What is read, and whose rows it is:**
//
//   firstDueOn        §11's weekly clock — `nextDueOn`
//   pagesPublished    §9's live `publications`
//   supply            §7's own count — `supplyDepth`
//   waiting           §9's `in_review` and `needs_attention` drafts
//
// **What is honestly unmeasured, and why that is the right answer.** The
// weekly series, the AI-answer presence and the rival set are read out of
// the stored weekly reports, and the reader that turns a `StoredReport`
// into a screen's series is §11's and §6.6's (#41, #27) — it does not exist
// yet. So this file states `unmeasured` for them rather than a number, and
// REQ-004 is exactly why that is a value and not a `null`: an unmeasured
// reading says *that* it was not measured, and every module on this screen
// already draws that arm. A customer who signed in today has no measured
// week in any case, so the arm they see is the one the screen was designed
// to open on — and it is theirs, which is the whole of this issue.
//
// A fixture in its place would put another account's numbers on their
// screen, which is the defect being removed here; a fabricated zero would
// be worse still, because a zero is a claim (`measuredZero`) and this
// product does not make claims it has not measured.
import { SUPPLY_SHORT_BELOW } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";
import { unmeasured, measured, type Measured } from "@/lib/measure/measured";
import { nextDueOn } from "@/lib/scan/weekly";
import type { OverviewFacts } from "./model";
import type { WaitingItem } from "./alerts";

export interface OverviewSite {
  siteId: string;
  timeZone: string;
}

interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  in(column: string, values: readonly unknown[]): MinimalQuery<T>;
  is(column: string, value: null): MinimalQuery<T>;
  not(column: string, operator: string, value: unknown): MinimalQuery<T>;
  order(column: string, opts: { ascending: boolean }): MinimalQuery<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

function client(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

/** §9's live pages: delivered, not taken down. The same predicate the
 *  hosted edge's sitemap reads, so the count on this screen and the pages
 *  actually being served cannot disagree. */
async function pagesPublished(siteId: string, at: Date): Promise<Measured<number>> {
  const { data, error } = await client()
    .from<{ id: string }>("publications")
    .select("id")
    .eq("site_id", siteId)
    .not("published_at", "is", null)
    .is("unpublished_at", null);
  if (error !== null || data === null) {
    // A count we could not take is not a count of zero. `undeterminable`
    // renders the dash and its own line; a `0` would be a claim that this
    // customer has published nothing (REQ-004).
    return unmeasured<number>("undeterminable", at);
  }
  return measured(data.length, at);
}

/** §9's two states that wait on the customer. `needs_you` outranks
 *  `pending_veto` and `readAlerts` applies that order — this file supplies
 *  the items and chooses nothing. */
async function waitingItems(siteId: string): Promise<readonly WaitingItem[]> {
  const { data, error } = await client()
    .from<{ id: string; state: string; title: string; created_at: string }>("drafts")
    .select("id, state, title, created_at")
    .eq("site_id", siteId)
    .in("state", ["in_review", "needs_attention"])
    .order("created_at", { ascending: true });
  if (error !== null || data === null) return [];
  return data.map((row) => ({
    kind: row.state === "needs_attention" ? ("needs_you" as const) : ("pending_veto" as const),
    // The customer's own words for their page, never a sentence this
    // product composed.
    title: row.title,
    since: new Date(row.created_at),
    href: `/app/draft/${row.id}`,
  }));
}

/**
 * Everything §4.5 states about one real account.
 *
 * The reads are independent, so they run together rather than four round
 * trips deep.
 */
export async function readOverviewFacts(site: OverviewSite): Promise<OverviewFacts> {
  const now = new Date();
  const { supplyDepth } = await import("@/lib/opportunities");

  const [firstDueOn, published, depth, waiting] = await Promise.all([
    nextDueOn({ siteId: site.siteId, now }),
    pagesPublished(site.siteId, now),
    supplyDepth(site.siteId),
    waitingItems(site.siteId),
  ]);

  return {
    timeZone: site.timeZone,
    // §11's series and §6.6's rival set, once a reader for the stored
    // weekly reports exists (#41, #27). Empty is not a claim: `readGrowth`
    // answers its `none` arm from `firstDueOn`, which is a real date.
    points: [],
    firstDueOn,
    aiPresence: [],
    pagesPublished: published,
    rivals: {
      own: unmeasured<number>("not_attempted", now),
      rivals: [],
    },
    today: now,
    supply: {
      exhausted: depth.unused === 0,
      short: depth.unused > 0 && depth.unused < SUPPLY_SHORT_BELOW,
      // The first-arrival shortfall is a statement about the pass the
      // customer arrived after, which only the arrival itself can know
      // (`supplyNotice`'s `arrivedAfter`). An ordinary read of this screen
      // is not that arrival.
      firstArrivalShortfall: false,
    },
    waiting,
  };
}
