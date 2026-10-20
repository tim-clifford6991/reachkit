// BUILD §7 — the one ranked list.
//
// "Ranking: `demand × intent × (1−effort) × fit`, one list." One list, and
// one order: business fit first (SPEC §6, 2026-09-29), then the source, then
// the score descending, then family and type, then `created_at`
// ascending, then the id — an update of a page close to being quoted ahead
// of the rest of its fit (issue 1146) — and no two consecutive days on one topic
// (#1181), inside the weekly content mix (issue 1209). The last two keys are what make it a *total* order — without them
// two opportunities with identical scores would come back in whatever
// order Postgres happened to return them, and the day a calendar fills
// from would move between two reads that measured nothing new.
//
// Nothing is stored. `rankOpen` computes from the evidence already on the
// row, so retuning a coefficient changes tomorrow's order and rewrites no
// history.
//
// `unblock` never appears here: the store's `openRankable` excludes the
// Fix family, once, and no caller downstream restates that predicate.
//
// **A `not-yet` target never appears here either** (issue 881, SPEC §6's
// right-sizing law) — but not because this file says so (issue 884):
// `readiness.ts` stores such a row `ready: false` with the reason
// `outsized`, and this list ranks ready rows. The score's `fit` term still
// weighs the two bands that remain against each other, and a row that
// reaches here banded `not-yet` is a row the stored answer called ready —
// a contradiction the suites assert against rather than one this file
// silently repairs.
//
// **A ready `fix_page` is placed, not scored** (SPEC §9, owner ruling
// 2026-09-14): it outranks new writing for its cluster. It carries no search
// to score, so it goes immediately ahead of the first Write row in the same
// cluster — and while clusters are not derived, a null key on either side is
// one pool, so it goes ahead of the first Write row at all. Improve and Earn
// keep their scored places. A fix with no Write row to precede goes last. A
// fix that is not ready is not in the list.
import { CONTENT_MIX, PACE, PLAN_DEPTH } from "@/lib/config/constants";
import type { Profile } from "@/lib/market/questions/profile";
import { opportunityStore } from "../store";
import { readOpportunity, type DraftedPage, type OpportunityRow } from "../store";
import { canonicalUrl } from "@/lib/measure/page-reading";
import { comparePrecedence, sameTopic } from "../cluster";
import { isCloseUpdate } from "../close";
import { CONTENT_TYPES, contentTypeOf, type ContentType } from "../content-type";
import { isPausedType } from "../paused";
import { isOwnRefresh, type Opportunity, type OpportunityType, type PlaceRule, type Ranked } from "../types";
import { rankScore } from "./score";

/** A row no pass has judged ranks with the rows that plainly help: it was
 *  ready under the gates it was derived by, and is neither lifted above a
 *  judged 3 nor dropped below a judged 2. */
const UNJUDGED_FIT = 2;

/** SPEC §6 (2026-09-29): a category's "best X" ranks last within its fit.
 *  The other sources are ordered by the score, where a measured AI-answer
 *  gap carries demand and a proposal nothing measured carries none. */
function sourcePlace(o: Opportunity): number {
  return o.source === "best_x" ? 1 : 0;
}

/** Business fit first (SPEC §6, 2026-09-29, issue 1134): volume orders
 *  targets of equal fit and never lifts a lower one. Then an update of a
 *  page that is close to being quoted, ahead of every other row of its fit
 *  (D15, issue 1146). Then the source, then
 *  the score; ties broken by family and type (§6's order, owner 2026-09-15 —
 *  a tie-break only since #1181), then by age, then by id. */
function byScore(
  a: { opportunity: Opportunity; score: number },
  b: { opportunity: Opportunity; score: number },
  close: (o: Opportunity) => boolean
): number {
  const fit = (b.opportunity.businessFit ?? UNJUDGED_FIT) - (a.opportunity.businessFit ?? UNJUDGED_FIT);
  if (fit !== 0) return fit;
  if (close(a.opportunity) !== close(b.opportunity)) return close(a.opportunity) ? -1 : 1;
  const source = sourcePlace(a.opportunity) - sourcePlace(b.opportunity);
  if (source !== 0) return source;
  if (b.score !== a.score) return b.score - a.score;
  const precedence = comparePrecedence(a.opportunity, b.opportunity);
  if (precedence !== 0) return precedence;
  const age = a.opportunity.createdAt.getTime() - b.opportunity.createdAt.getTime();
  if (age !== 0) return age;
  return a.opportunity.id < b.opportunity.id ? -1 : a.opportunity.id > b.opportunity.id ? 1 : 0;
}

/** SPEC §7's daily decision (2026-09-16): an update of an existing page
 *  (Improve) against a new page (Earn, Write), whichever ranks higher for
 *  this site — one list in score order, an update taking a tie (#1181: the
 *  type no longer outranks the score).
 *
 *  **Rotation** (SPEC §6, 2026-10-02, #1181): no two consecutive days on
 *  one topic. Each place takes the best-scoring row that is not the same
 *  topic (`sameTopic`) as the day before it — `after`, the page drafted or
 *  published last, for the first place. Where every row left is, the best
 *  one takes the place: rotation orders and never empties a day.
 *
 *  **The weekly mix** (SPEC §7, 2026-10-03, D36, issue 1209): each place is
 *  a day, the first one `mix.from`, and the days before it are `mix.recent`.
 *  A day takes the best-scoring row whose kind is not the kind of the day
 *  before and has fewer than `MAX_PER_KIND` pages in the days of its window;
 *  once the site has had pages for a whole window and none of them is an
 *  update, the day takes the best update. Where
 *  no row fits, the count is given up first, then the kind, then the topic —
 *  the mix orders and never empties a day either.
 *
 *  **Pace** (SPEC §7, 2026-09-29, issue 1139): a day whose window already
 *  holds `PACE.NEW_PAGES_PER_WEEK` new pages takes the best update instead —
 *  a refresh of one of ReachKit's own live pages first, then an Improve of
 *  the site's own — the mix's count and its turn of kinds give way to it,
 *  as they do wherever no row fits. Where no update is left the day takes a
 *  new page: a site with nothing to refresh yet fills its week with new
 *  pages.
 *
 *  **The self-promotion cap** (SPEC §7, owner, D52, issue 1267): a day whose
 *  window already holds `SELF_PROMOTING_MAX` listicles or comparisons — the
 *  type whose page includes the business — takes no other one. The topic
 *  falls through to the next, and unlike the mix this is never given up.
 *  Where every row left is over the cap, the day does not go empty (issue
 *  1455: reachkit.app published nothing for days because every topic it
 *  held was a comparison): the best of them is written as a Q&A of its
 *  buyer question, which answers it without ranking the business, and the
 *  day counts as a Q&A.
 *
 *  **Pages that answer** (SPEC §7, issue 1506): of the site's last
 *  `NON_COMMERCIAL_OF` new pages, refreshes not counted, at least
 *  `NON_COMMERCIAL_MIN` are Q&As, how-tos or documentation where one is
 *  ready. A day whose six new pages before it already hold the rest in
 *  other pages takes one of them, after the update and the pace and before
 *  the count and the turn of kinds. */
export function orderRanked(
  scored: readonly { opportunity: Opportunity; score: number }[],
  rotation: {
    after?: Opportunity | null;
    topTens?: ReadonlyMap<string, readonly string[]>;
    mix?: Mix;
    /** The site's own pages a tracked AI answer cited in the last four
     *  weeks, as canonical addresses (issue 1146). */
    cited?: ReadonlySet<string>;
    /** Issue 1549: how many days to plan, counted from the first. Absent
     *  plans until every row has a day. */
    days?: number;
    /** Issue 1549: a day on which only rows over the D52 cap are left goes
     *  without, rather than answering one of them as a Q&A — what the
     *  writable-days count reads, since that Q&A needs buyer questions its
     *  pack may not hold. */
    holdCapped?: boolean;
  } = {}
): Ranked[] {
  const close = (o: Opportunity) => isCloseUpdate(o, rotation.cited);
  const left = [...scored].sort((a, b) => byScore(a, b, close));
  const topTens = rotation.topTens ?? new Map<string, readonly string[]>();
  const placed = [...(rotation.mix?.recent ?? [])];
  const from = rotation.mix?.from ?? 0;
  const out: Ranked[] = [];
  let previous = rotation.after ?? null;
  const until = rotation.days === undefined ? Infinity : from + rotation.days;
  for (let day = from; left.length > 0 && day < until; day++) {
    const window = placed.filter((page) => page.day < day && page.day > day - CONTENT_MIX.WINDOW_DAYS);
    const yesterday = placed.find((page) => page.day === day - 1)?.kind ?? null;
    const held = (kind: ContentType | null) => window.filter((page) => page.kind === kind).length;
    type Entry = (typeof left)[number];
    const kindOf = (entry: Entry) => contentTypeOf(entry.opportunity);
    const fresh = (entry: Entry) => previous === null || !sameTopic(entry.opportunity, previous, topTens);
    const turns = (entry: Entry) => kindOf(entry) !== yesterday;
    const room = (entry: Entry) => held(kindOf(entry)) < CONTENT_MIX.MAX_PER_KIND;
    // Due on the last day that can still keep the window's one update: the
    // site has had pages for a whole window and none of them is one.
    const updateDue =
      held("update") === 0 && placed.some((page) => page.day <= day - (CONTENT_MIX.WINDOW_DAYS - 1));
    const isUpdate = (entry: Entry) => kindOf(entry) === "update";
    const own = (entry: Entry) => isOwnRefresh(entry.opportunity);
    // The week's new pages are in: the day takes an update, one of our own
    // live pages first, and the topic gives way before the pace does.
    const paced = window.filter((page) => page.kind !== "update").length >= PACE.NEW_PAGES_PER_WEEK;
    // D52: a listicle or comparison includes the business, by its template.
    const capped = (entry: Entry) => kindOf(entry) === "listicle" && held("listicle") >= CONTENT_MIX.SELF_PROMOTING_MAX;
    // Issue 1506 (as the SEO master review of 2026-10-18 reads it): of the
    // site's last seven new pages, refreshes not counted, at least three
    // answer. Once the six before today leave no room, the day takes a page
    // that answers where one is ready — after the update and the pace,
    // ahead of the turn of kinds, never ahead of the topic's rotation, and
    // it never empties a day. Owed only then, so the best page still goes
    // first.
    const answers = (kind: ContentType | null) => (CONTENT_MIX.NON_COMMERCIAL_TYPES as readonly string[]).includes(kind ?? "");
    const lastNew = placed
      .filter((page) => page.day < day && page.kind !== "update")
      .sort((x, y) => x.day - y.day)
      .slice(-(CONTENT_MIX.NON_COMMERCIAL_OF - 1));
    const owed =
      lastNew.filter((page) => !answers(page.kind)).length >= CONTENT_MIX.NON_COMMERCIAL_OF - CONTENT_MIX.NON_COMMERCIAL_MIN;
    const answering = (entry: Entry) => answers(kindOf(entry));
    type Tier = readonly [PlaceRule, (entry: Entry) => boolean];
    const tiers: Tier[] = [
      ...(updateDue ? [["update due", (entry: Entry) => fresh(entry) && isUpdate(entry)] satisfies Tier] : []),
      ...(paced
        ? ([
            ["paced: own refresh", (entry: Entry) => fresh(entry) && own(entry)],
            ["paced: own refresh, same topic", own],
            ["paced: update", (entry: Entry) => fresh(entry) && isUpdate(entry)],
            ["paced: update, same topic", isUpdate],
          ] satisfies Tier[])
        : []),
      ...(owed
        ? ([
            ["answer owed", (entry: Entry) => fresh(entry) && answering(entry) && turns(entry) && room(entry)],
            ["answer owed, same kind", (entry: Entry) => fresh(entry) && answering(entry) && room(entry)],
            ["answer owed, kind full", (entry: Entry) => fresh(entry) && answering(entry)],
          ] satisfies Tier[])
        : []),
      ["best", (entry) => fresh(entry) && turns(entry) && room(entry)],
      ["best, kind full", (entry) => fresh(entry) && turns(entry)],
      ["best, same kind", fresh],
      ["best, same topic", () => true],
    ];
    let at = -1;
    let rule: PlaceRule = "over the D52 cap, as a Q&A";
    for (const [name, tier] of tiers) {
      at = left.findIndex((entry) => !capped(entry) && tier(entry));
      if (at !== -1) {
        rule = name;
        break;
      }
    }
    // Only rows over the cap are left: the freshest of them is answered as
    // a Q&A rather than leave the day empty (issue 1455).
    const asQa = at === -1;
    if (asQa && rotation.holdCapped === true) continue;
    if (asQa) at = Math.max(0, left.findIndex(fresh));
    const [entry] = left.splice(at, 1);
    out.push({ opportunityId: entry!.opportunity.id, score: entry!.score, rule, ...(asQa ? { writeAs: "qa" as const } : {}) });
    previous = entry!.opportunity;
    const kind = asQa ? "qa" : kindOf(entry!);
    if (kind !== null) placed.push({ day, kind });
  }
  return out;
}

/** The days the mix reads: the first day the list plans, and the kind of
 *  page each day before it holds. A day is a count of days, so two of them
 *  subtract. */
export interface Mix {
  from: number;
  recent: readonly { day: number; kind: ContentType }[];
}

const DAY_MS = 86_400_000;

/** The draft states whose page holds its date in the mix: a page that was
 *  stopped, skipped or taken down did not publish that day. */
const HOLDS_ITS_DAY: ReadonlySet<string> = new Set([
  "planned",
  "generating",
  "in_review",
  "approved",
  "publishing",
  "published",
]);

/** The mix as the site's own drafted pages state it. The first day planned
 *  is the day after the latest date that has a draft, and never before
 *  `at`'s own day. A page counts as the type it was written as, where the
 *  draft records one (issue 1455: a comparison answered as a Q&A is a Q&A),
 *  else as its row's. */
export function mixOf(drafted: readonly DraftedPage[], at: Date): Mix {
  const dayOf = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
  const today = Math.floor(at.getTime() / DAY_MS);
  const days = drafted.map((page) => dayOf(page.date));
  const from = Math.max(today, ...days.map((day) => day + 1));
  const recent = drafted.flatMap((page) => {
    const written = CONTENT_TYPES.find((type) => type === page.writtenAs);
    const kind = written ?? contentTypeOf({
      type: page.row.type as OpportunityType,
      targetQuery: page.row.target_query,
      evidence: page.row.evidence as Opportunity["evidence"],
    });
    return kind === null || !HOLDS_ITS_DAY.has(page.state) ? [] : [{ day: dayOf(page.date), kind }];
  });
  return { from, recent };
}

function samePool(a: string | null, b: string | null): boolean {
  return a === null || b === null || a === b;
}

/** Oldest first, each ahead of the first Write row of its pool. Pure. */
export function placeFixPages(
  scored: readonly { opportunity: Opportunity; score: number }[],
  fixes: readonly Opportunity[],
  rotation: Parameters<typeof orderRanked>[1] = {}
): Ranked[] {
  const ordered = orderRanked(scored, rotation);
  const byId = new Map(scored.map((entry) => [entry.opportunity.id, entry.opportunity]));
  const pending = [...fixes].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const out: Ranked[] = [];
  for (const entry of ordered) {
    const opportunity = byId.get(entry.opportunityId);
    if (opportunity?.family === "write") {
      for (let i = 0; i < pending.length; ) {
        const fix = pending[i]!;
        if (samePool(fix.clusterKey, opportunity.clusterKey)) {
          out.push({ opportunityId: fix.id, score: entry.score, rule: "fix ahead of its cluster" });
          pending.splice(i, 1);
        } else {
          i += 1;
        }
      }
    }
    out.push(entry);
  }
  for (const fix of pending) out.push({ opportunityId: fix.id, score: 0, rule: "fix, no page to precede" });
  return out;
}

/**
 * The site's open, rankable opportunities in ranked order.
 *
 * The profile is loaded once per call and passed to every row — the intent
 * term is §6.7's classifier and its second parameter is not optional. A
 * site with no readable profile ranks nothing: an empty list, which the
 * caller reads as "no supply to order", never as an order derived from a
 * classification we could not make.
 */
export { isPausedType };

export async function rankOpen(siteId: string, at: Date = new Date(), only?: ReadonlySet<string>): Promise<Ranked[]> {
  const { scored, fixes, rotation } = rankingOf(await loadRanking(siteId, at, only), at, only);
  return placeFixPages(scored, fixes, rotation);
}

/**
 * Issue 1549: how many of the next `days` days the week's commit fills with
 * a page of the topic's own type — the number "pages left" and the
 * low-supply finding state, and what the weekly refill tops up to. Read from the same rows, order and rules as `rankOpen`: a
 * listicle or comparison over D52's cap waits for the cap's window to pass
 * instead of counting as a Q&A whose buyer questions the pack may not hold,
 * a resting or unready row is not counted, and a topic another row on the
 * same topic (`sameTopic`) would be written as is counted once — drafting
 * the first folds the other (`nearRepeatsOf`). A Fix takes no day of supply.
 */
export async function writableDays(siteId: string, at: Date = new Date(), days: number = PLAN_DEPTH): Promise<number> {
  const { scored, rotation } = rankingOf(await loadRanking(siteId, at), at);
  return countWritable(scored, rotation, days);
}

/** `writableDays` over rows already read. Pure. */
export function countWritable(
  scored: readonly { opportunity: Opportunity; score: number }[],
  rotation: NonNullable<Parameters<typeof orderRanked>[1]>,
  days: number
): number {
  if (scored.length === 0) return 0;
  const topTens = rotation.topTens ?? new Map<string, readonly string[]>();
  const byId = new Map(scored.map((entry) => [entry.opportunity.id, entry]));
  const kept: { opportunity: Opportunity; score: number }[] = [];
  for (const { opportunityId } of orderRanked(scored, rotation)) {
    const entry = byId.get(opportunityId)!;
    if (kept.some((held) => sameTopic(held.opportunity, entry.opportunity, topTens))) continue;
    kept.push(entry);
  }
  return orderRanked(kept, { ...rotation, days, holdCapped: true }).length;
}

/** What the one list is ordered from, as the store holds it. */
export interface RankLoad {
  rows: readonly OpportunityRow[];
  fixRows: readonly OpportunityRow[];
  profile: Profile | null;
  /** The page drafted or published last (#1181). */
  latest: OpportunityRow | null;
  /** The pages of the days before, newest first (issue 1209). */
  drafted: readonly DraftedPage[];
  /** The site's own pages a stored answer cited (issue 1146). */
  cited: readonly string[];
  /** The top tens already stored for the eligible rows' searches (#1181). */
  topTens: ReadonlyMap<string, readonly string[]>;
}

/** Why a row the store holds open takes no place in the list. */
export type Rejection = "unready" | "paused" | "no_profile";

/**
 * Whether a row may take a place, or why not. Pure. One predicate, and it is
 * the stored one (issue 884, owner's ruling 2026-09-18): SPEC §6's "a day is
 * filled only by an opportunity that passes readiness" is the stored column
 * (`assessReadiness`), so the column, the screens and this order cannot
 * disagree. A fix needs no profile; any other row needs one to be scored,
 * and a type the mix has paused fills no day (SPEC §7, D46).
 */
export function eligible(row: OpportunityRow, ctx: { profile: Profile | null }): Rejection | null {
  if (!row.ready) return "unready";
  if (row.type === "fix_page") return null;
  if (ctx.profile === null) return "no_profile";
  return isPausedType(readOpportunity(row)) ? "paused" : null;
}

/** The site's rows and context the list reads — of the rows `only` names,
 *  where it is given (a week's spares, issue 1559). */
export async function loadRanking(siteId: string, at: Date, only?: ReadonlySet<string>): Promise<RankLoad> {
  const store = opportunityStore();
  const [rows, profile, fixRows, latest, drafted, cited] = await Promise.all([
    store.openRankable(siteId),
    store.profileForSite(siteId),
    store.openFixPages(siteId),
    store.latestPage(siteId),
    // The weekly mix reads the pages of the days before (issue 1209).
    store.draftedPages(siteId, 2 * CONTENT_MIX.WINDOW_DAYS),
    // A window that cannot be read lifts no update: the order is the one
    // before it.
    store.citedPages(siteId, at).catch(() => [] as readonly string[]),
  ]);
  const scans = rows.filter((row) => named(row, only) && eligible(row, { profile }) === null).map((row) => row.scan_id);
  const topTens =
    scans.length === 0 ? new Map<string, readonly string[]>() : await store.topTens([...new Set([...scans, ...(latest === null ? [] : [latest.scan_id])])]);
  return { rows, fixRows, profile, latest, drafted, cited, topTens };
}

function named(row: { id: string }, only: ReadonlySet<string> | undefined): boolean {
  return only === undefined || only.has(row.id);
}

/** The eligible rows scored, the ready fixes, the rotation and mix the order
 *  keeps, and each row left out with its reason. Pure. */
export function rankingOf(
  load: RankLoad,
  at: Date,
  only?: ReadonlySet<string>
): {
  scored: { opportunity: Opportunity; score: number }[];
  fixes: Opportunity[];
  rotation: NonNullable<Parameters<typeof orderRanked>[1]>;
  rejected: { opportunityId: string; reason: Rejection }[];
} {
  const { profile } = load;
  const rejected: { opportunityId: string; reason: Rejection }[] = [];
  const keep = (row: OpportunityRow) => {
    const reason = eligible(row, { profile });
    if (reason !== null) rejected.push({ opportunityId: row.id, reason });
    return reason === null;
  };
  const fixes = load.fixRows.filter((row) => named(row, only) && keep(row)).map(readOpportunity);
  const mixed = load.rows.filter((row) => named(row, only) && keep(row)).map(readOpportunity);
  if (profile === null || mixed.length === 0) return { scored: [], fixes, rotation: {}, rejected };

  const scored = mixed.map((opportunity) => ({
    opportunity,
    score: rankScore({
      volume: opportunity.volume,
      // Every rankable opportunity has a target query: `targetQuery` is
      // null only for `unblock`, which `openRankable` already excluded.
      query: opportunity.targetQuery ?? "",
      type: opportunity.type,
      fit: opportunity.fitBand ?? "not-yet",
      profile,
    }),
  }));
  const after = load.latest === null ? null : readOpportunity(load.latest);
  const cited = new Set(load.cited.map(canonicalUrl));
  return { scored, fixes, rotation: { after, topTens: load.topTens, mix: mixOf(load.drafted, at), cited }, rejected };
}
