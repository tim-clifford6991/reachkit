// SPEC §4 (2026-09-20, #908) — the Search tab's facts, for a real account.
//
// The other half of `search-provider.ts`. It measures nothing, buys nothing
// and creates nothing: every value below is a projection of rows another
// block already wrote, which is that date's own rule — "read from stored
// opportunities, the site's own ranked keywords and the weekly verdicts;
// nothing is bought for the screen."
//
// **What is read, and whose rows it is:**
//
//   the rows        `opportunities` — the open, rankable ones through the
//                   engine's own door (`openRankable`), and the queued and
//                   done ones beside them, because a search whose page is
//                   live is still a search ReachKit is going after and
//                   SPEC §4 gives it a status word of its own
//   the projection  `_shell/page-target.ts` — the one-page projection the
//                   calendar and the draft screen already read
//   your position   the current stored report's `ownRankedRows` (§6)
//   the week's move `page_verdicts.movement` (§9), as `judgeWeek` wrote it
//   live pages      §9's live `publications`
//
// **Four reads, and not one of them per row.** The verdicts, the
// publications and the report come back whole and are joined in memory;
// a per-row read would be one query per search on a screen that draws
// thirty-eight of them.
//
// **A read that fails is never a zero.** Every count that could not be
// taken is `unmeasured`, which renders as the dash and its own line
// (REQ-004); a `0` would be a claim this customer has nothing.
import { dbAdmin } from "@/lib/db";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import { readingOf } from "@/lib/measure/page-reading";
import type { PositionChange, SearchFacts, SearchStatus, SearchTargetFacts } from "./search-model";

export interface SearchSite {
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
  neq(column: string, value: unknown): MinimalQuery<T>;
  in(column: string, values: readonly unknown[]): MinimalQuery<T>;
  is(column: string, value: null): MinimalQuery<T>;
  not(column: string, operator: string, value: unknown): MinimalQuery<T>;
  order(column: string, opts: { ascending: boolean }): MinimalQuery<T>;
  limit(count: number): MinimalQuery<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

function client(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

/** A live publication, joined to the opportunity its page was written for.
 *  The three foreign keys the baseline declares, read in one go. */
export interface LivePageRow {
  live_url: string | null;
  unpublished_at: string | null;
  search_reading: unknown;
  drafts: { opportunity_id: string } | null;
}

/** Each live page's place by its opportunity, from the page's own reading:
 *  the one the ladder, the verdict and the mail read. A page never read is
 *  absent, and keeps the ranked rows' place. */
export function livePlaces(rows: readonly LivePageRow[]): ReadonlyMap<string, Measured<number>> {
  const places = new Map<string, Measured<number>>();
  for (const row of rows) {
    const reading = readingOf(row.search_reading);
    const id = row.drafts?.opportunity_id;
    if (reading === null || id === undefined) continue;
    const readAt = new Date(reading.at);
    places.set(id, reading.place === null ? unmeasured<number>("not_attempted", readAt) : measured(reading.place.value, readAt));
  }
  return places;
}

/** `page_verdicts` through `publications → drafts`, newest week first. The
 *  `movement` blob is read back as `judgeWeek` wrote it — REQ-063 c3's
 *  decline is never re-derived on a render path, where it could be rounded
 *  away. */
interface VerdictRow {
  week_start: string;
  movement: { from?: unknown; to?: unknown; declined?: boolean } | null;
  publications: { drafts: { opportunity_id: string } | null } | null;
}

/** The statuses a row with a page can be in. `dismissed` is not among them:
 *  the customer stopped that page, so ReachKit is no longer going after
 *  that search and the table does not claim it is. */
const WITH_A_PAGE = ["queued", "done"] as const;

export async function readSearchFacts(site: SearchSite, at: Date): Promise<SearchFacts> {
  // Lazily, the way `_overview/store.ts` already reaches the engine: a
  // static import of a `@/lib/db`-reaching module from a file the shell can
  // pull hangs the job suites, and the Edge bundle refuses one outright.
  const { opportunityStore, readOpportunity } = await import("@/lib/opportunities/store");
  const store = opportunityStore();

  // **Which reads may fail quietly, and which may not.** The two
  // opportunity reads are the screen's subject — a table of searches cannot
  // be drawn without them, and an empty one would say "no searches are on
  // file", which is a different and false statement — so they propagate.
  // Everything else degrades to its own unmeasured arm: a missing report
  // means no position and no ceiling, a missing verdict means no change
  // stated, an unreadable count of live pages means the dash.
  const [open, withPages, livePages, verdicts, report] = await Promise.all([
    store.openRankable(site.siteId),
    pagedRows(site.siteId),
    readLivePages(site.siteId),
    readMovements(site.siteId),
    store.currentReport(site.siteId).catch(() => null),
  ]);

  const liveByOpportunity = new Set(livePages.rows.map((row) => row.drafts?.opportunity_id ?? ""));
  const placeByOpportunity = livePlaces(livePages.rows);
  const { askedAs, doneWhen } = await import("../calendar/store");
  const { pageTargetOf } = await import("../_shell/page-target");

  const targets: SearchTargetFacts[] = [];
  for (const row of [...open, ...withPages]) {
    // An open row unready for a reason that is about ReachKit's own
    // plumbing rather than about the market is on file and is not being
    // gone after — it is not drawn at all (see `drawn`).
    if (!drawn(row.status, row.ready, row.unready_reason)) continue;
    const opportunity = readOpportunity(row);
    // A Fix row has no market target at all — no search, no volume, no band
    // — so `pageTargetOf` answers `null` for it and this table, which is a
    // table of searches, has no row to draw.
    const evidence = opportunity.evidence;
    if (evidence.family === "fix") continue;
    const choice = {
      opportunityId: opportunity.id,
      type: opportunity.type,
      family: opportunity.family,
      fitBand: opportunity.fitBand,
      acceptance: opportunity.acceptance,
      evidence,
    };
    const target = pageTargetOf({
      choice,
      askedAs: askedAs(choice, evidence.query),
      doneWhen: doneWhen(choice),
      // The measurement's own date, never today's: an unmeasured value on
      // this row was unmeasured when the row was made.
      at: opportunity.createdAt,
    });
    if (target === null) continue;
    targets.push({
      id: opportunity.id,
      target: {
        search: target.search,
        volume: target.volume,
        difficulty: target.difficulty,
        ceiling: target.ceiling,
        winnability: target.winnability,
      },
      status: statusOf(row.status, row.ready, row.unready_reason, liveByOpportunity.has(opportunity.id)),
      // §4.6's own rule, read the same way: a Write or Earn target records
      // the rival whose page holds the answer today; an Improve target is
      // the customer's own page, so no rival holds it.
      rival:
        evidence.family === "write" || evidence.family === "earn"
          ? {
              domain: evidence.rival.domain,
              position:
                evidence.family === "write"
                  ? evidence.rival.position
                  : unmeasured<number>("not_attempted", opportunity.createdAt),
            }
          : null,
      change: verdicts.get(opportunity.id) ?? { kind: "none" },
      ...(placeByOpportunity.has(opportunity.id) ? { position: placeByOpportunity.get(opportunity.id) } : {}),
    });
  }

  const ownRankedRows = report?.ownRankedRows ?? [];
  const positions = new Map<string, Measured<number>>();
  // One date governs the whole blob (`src/lib/scan/report.ts`): the
  // verdict's own `measuredAt`. Read from there rather than stamped with
  // today, so a position states when it was taken.
  const measuredAt = report?.verdict.measuredAt ?? null;
  for (const row of ownRankedRows) {
    // The report's own rows carry no arm: they are what the vendor returned
    // for searches the site holds a place for, so each is a measurement,
    // stamped with the pass's own date. A search absent from them is a
    // search the site holds no place for, and it stays out of the map
    // rather than entering it as a zero.
    positions.set(row.keyword, measured(row.position, measuredAt ?? at));
  }

  return {
    targets,
    positions,
    // Issue 1551: your market is the stored presence card's own count over
    // the twelve, so this tab and the Competitors tab say one number.
    market:
      report?.presence == null
        ? null
        : { top10: report.presence.you.top10Count, measured: report.presence.measuredSearches },
    measuredAt,
  };
}

/**
 * SPEC §4's four, decided from the stored row and nothing else.
 *
 * `live` is read off the publication rather than off `status = 'done'`:
 * done means the acceptance test passed, which is a later and rarer event
 * than the page going live, and a customer whose page is up would otherwise
 * read "up next" for weeks. A row with a page that is not live yet is the
 * customer's to read — *your review* — which is the state §9's machine puts
 * every draft through before it publishes.
 *
 * `too_big` is exactly `unready_reason = 'outsized'` (SPEC §6's
 * right-sizing law, issue 884): the one unready reason that is about the
 * market rather than about ReachKit's own plumbing, and the only one the
 * product has a customer-facing word for. A row unready for any other
 * reason is on file and is not being gone after this week, so it is not
 * drawn — never as "up next", which would be a promise.
 */
export function statusOf(
  status: string,
  ready: boolean,
  unreadyReason: string | null,
  hasLivePage: boolean
): SearchStatus {
  if (status !== "open") return hasLivePage ? "live" : "your_review";
  if (ready) return "up_next";
  return unreadyReason === "outsized" ? "too_big" : "up_next";
}

/** The open rows this table does not draw: unready for a reason that is
 *  about ReachKit's own plumbing rather than about the market. Applied
 *  after `statusOf` so the two rules stay one sentence apart. */
export function drawn(status: string, ready: boolean, unreadyReason: string | null): boolean {
  return status !== "open" || ready || unreadyReason === "outsized";
}

/** The site's queued and done non-Fix rows — the searches whose page has
 *  been written. `openRankable` is the engine's door for the open ones and
 *  is used as such; there is no door for these, and adding one to
 *  `OpportunityStore` would put a screen's read inside the engine's own
 *  interface, which every job double would then have to answer. */
async function pagedRows(siteId: string): Promise<readonly OpportunityRowLike[]> {
  const { data, error } = await client()
    .from<OpportunityRowLike>("opportunities")
    .select(OPPORTUNITY_COLUMNS)
    .eq("site_id", siteId)
    .in("status", WITH_A_PAGE)
    .neq("family", "fix")
    .order("created_at", { ascending: true });
  if (error !== null || data === null) {
    throw new Error(`search: opportunities with a page — ${error?.message ?? "no rows returned"}`);
  }
  return data;
}

/** §9's live pages: delivered, not taken down — the same predicate the
 *  Overview's count and the hosted sitemap read. */
async function readLivePages(
  siteId: string
): Promise<{ ok: boolean; rows: readonly LivePageRow[] }> {
  const { data, error } = await client()
    .from<LivePageRow>("publications")
    .select("live_url, unpublished_at, search_reading, drafts(opportunity_id)")
    .eq("site_id", siteId)
    .not("published_at", "is", null);
  if (error !== null || data === null) return { ok: false, rows: [] };
  return {
    ok: true,
    rows: data.filter((row) => row.unpublished_at === null && row.live_url !== null),
  };
}

/** The newest verdict per page, as a change per opportunity. Newest first,
 *  and the first entry for an opportunity wins: a page judged for six weeks
 *  has six rows, and the week this screen is about is the last one. */
async function readMovements(siteId: string): Promise<ReadonlyMap<string, PositionChange>> {
  const out = new Map<string, PositionChange>();
  const { data, error } = await client()
    .from<VerdictRow>("page_verdicts")
    .select("week_start, movement, publications(drafts(opportunity_id))")
    .eq("site_id", siteId)
    .order("week_start", { ascending: false });
  if (error !== null || data === null) return out;
  for (const row of data) {
    const id = row.publications?.drafts?.opportunity_id;
    if (id === undefined || out.has(id)) continue;
    out.set(id, changeOf(row.movement));
  }
  return out;
}

/**
 * The stored `Movement` blob, as the "You" column states it.
 *
 * A place is better the **smaller** it is, so a move from 17 to 11 is six
 * places better. The blob carries both raw figures rather than a delta
 * exactly so this is a subtraction of two recorded numbers and never a
 * re-measurement; where either figure was not measured there is no change
 * to state, and the column shows the place alone.
 */
export function changeOf(movement: VerdictRow["movement"]): PositionChange {
  if (movement === null) return { kind: "first" };
  const from = rawValue(movement.from);
  const to = rawValue(movement.to);
  if (from === null || to === null) return { kind: "first" };
  const places = Math.abs(from - to);
  if (places === 0) return { kind: "none" };
  return { kind: "moved", places, better: to < from };
}

/** The number inside a stored `Measured<number>`, or `null` on its
 *  unmeasured arm. The blob is `jsonb` and arrives as `unknown`; this is
 *  the one place it is narrowed. */
function rawValue(m: unknown): number | null {
  if (typeof m !== "object" || m === null) return null;
  const arm = m as { kind?: unknown; value?: unknown };
  if (arm.kind !== "measured" && arm.kind !== "zero") return null;
  return typeof arm.value === "number" ? arm.value : null;
}

/** The columns `openRankable` selects, so the queued and done rows arrive
 *  in the same shape and `readOpportunity` revives both the same way. */
const OPPORTUNITY_COLUMNS =
  "id, site_id, scan_id, type, family, target_query, target_ref, proposed_slug, " +
  "title, volume, evidence, acceptance, fit_band, effort, status, cluster_key, " +
  "absorbed_queries, ready, unready_reason, created_at";

/** The row shape both reads return. Structural rather than imported from
 *  the engine: this module already reaches the engine lazily, and a static
 *  type import would put `@/lib/opportunities/store` into the static graph
 *  of every file that can reach this one. */
interface OpportunityRowLike {
  id: string;
  site_id: string;
  scan_id: string;
  type: string;
  family: string;
  target_query: string | null;
  target_ref: string;
  proposed_slug: string | null;
  title: string | null;
  volume: number | null;
  evidence: unknown;
  acceptance: unknown;
  fit_band: string | null;
  effort: string | number;
  status: string;
  cluster_key: string | null;
  absorbed_queries: string[];
  ready: boolean;
  unready_reason: string | null;
  created_at: string;
}
