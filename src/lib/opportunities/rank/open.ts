// SPEC §7 — the one ranked list: integer points (`points.ts`), ties by
// volume, then age, then id, so two reads of the same rows give one order.
// The week keeps four rules and no others: no two days running on one topic,
// the pace, at most two offering pages a week, and D52's one comparison.
//
// `unblock` never appears here: the store's `openRankable` excludes the Fix
// family. A `not-yet` target never does either: readiness stores it
// `ready: false`, and this list ranks ready rows.
//
// **A ready `fix_page` is placed, not scored** (SPEC §9, owner ruling
// 2026-09-14): it goes immediately ahead of the first Write row in its
// cluster, and while clusters are not derived, ahead of the first Write row.
import { CONTENT_MIX, PACE, PLAN_DEPTH } from "@/lib/config/constants";
import type { Profile } from "@/lib/market/questions/profile";
import type { IntentPrompt } from "../intent";
import { opportunityStore } from "../store";
import { readOpportunity, type DraftedPage, type OpportunityRow } from "../store";
import { canonicalUrl } from "@/lib/measure/page-reading";
import { sameTopic } from "../cluster";
import { CONTENT_TYPES, contentTypeOf, type ContentType } from "../content-type";
import { pageTypeOf } from "../page-type";
import { isPausedType } from "../paused";
import { isOwnRefresh, type Opportunity, type OpportunityType, type PlaceRule, type PlanReason, type Ranked } from "../types";
import { POINTS, pointsOf, volumeOrder, type Seen } from "./points";

/** At most this many offering pages in any seven days (owner ruling of
 *  2026-10-19). Like the topic's rotation, it orders and never empties a day. */
export const OFFERING_MAX = 2;

/** A row with its points. */
export interface Scored {
  opportunity: Opportunity;
  points: number;
  parts: PlanReason["parts"];
}

function byPoints(a: Scored, b: Scored): number {
  if (b.points !== a.points) return b.points - a.points;
  const volume = volumeOrder(b.opportunity) - volumeOrder(a.opportunity);
  if (volume !== 0) return volume;
  const age = a.opportunity.createdAt.getTime() - b.opportunity.createdAt.getTime();
  if (age !== 0) return age;
  return a.opportunity.id < b.opportunity.id ? -1 : a.opportunity.id > b.opportunity.id ? 1 : 0;
}

/** An offering page has the business's own product or service as its subject. */
function isOffering(o: Parameters<typeof pageTypeOf>[0]): boolean {
  return pageTypeOf(o) === "product";
}

/** Each day, from `mix.from`, takes the row with the most points that keeps
 *  the week's rules. A day whose last seven days already hold
 *  `PACE.NEW_PAGES_PER_WEEK` new pages takes the best update instead, one of
 *  our own live pages first. D52: a listicle or comparison, whose template
 *  includes the business, is taken only where the seven days hold fewer than
 *  `SELF_PROMOTING_MAX`; where only such rows are left, the best is written
 *  as a Q&A of its buyer question before the offering count gives way. The
 *  topic's rotation and the offering count give way before a day goes empty. */
export function orderRanked(
  scored: readonly Scored[],
  rotation: {
    after?: Opportunity | null;
    topTens?: ReadonlyMap<string, readonly string[]>;
    mix?: Mix;
    /** How many days to plan, counted from the first. Absent plans until
     *  every row has a day. */
    days?: number;
    /** A day on which only rows over the D52 cap are left goes without,
     *  rather than answering one as a Q&A — what the writable-days count
     *  reads, since that Q&A needs buyer questions its pack may not hold. */
    holdCapped?: boolean;
  } = {}
): Ranked[] {
  const left = [...scored].sort(byPoints);
  const topTens = rotation.topTens ?? new Map<string, readonly string[]>();
  const placed = [...(rotation.mix?.recent ?? [])];
  const from = rotation.mix?.from ?? 0;
  const out: Ranked[] = [];
  let previous = rotation.after ?? null;
  const until = rotation.days === undefined ? Infinity : from + rotation.days;
  for (let day = from; left.length > 0 && day < until; day++) {
    const window = placed.filter((page) => page.day < day && page.day > day - CONTENT_MIX.WINDOW_DAYS);
    type Entry = (typeof left)[number];
    const kindOf = (entry: Entry) => contentTypeOf(entry.opportunity);
    const fresh = (entry: Entry) => previous === null || !sameTopic(entry.opportunity, previous, topTens);
    const isUpdate = (entry: Entry) => kindOf(entry) === "update";
    const own = (entry: Entry) => isOwnRefresh(entry.opportunity);
    const paced = window.filter((page) => page.kind !== "update").length >= PACE.NEW_PAGES_PER_WEEK;
    const offeringFull = window.filter((page) => page.offering).length >= OFFERING_MAX;
    const room = (entry: Entry) => !offeringFull || !isOffering(entry.opportunity);
    const capped = (entry: Entry) =>
      kindOf(entry) === "listicle" && window.filter((page) => page.kind === "listicle").length >= CONTENT_MIX.SELF_PROMOTING_MAX;
    type Tier = readonly [PlaceRule, (entry: Entry) => boolean];
    const qa: PlaceRule = "over the D52 cap, as a Q&A";
    const tiers: Tier[] = [
      ...(paced
        ? ([
            ["paced: own refresh", (entry: Entry) => fresh(entry) && own(entry)],
            ["paced: own refresh, same topic", own],
            ["paced: update", (entry: Entry) => fresh(entry) && isUpdate(entry)],
            ["paced: update, same topic", isUpdate],
          ] satisfies Tier[])
        : []),
      ["best", (entry) => fresh(entry) && room(entry)],
      ["best, same topic", room],
      // The offering cap holds until D52's Q&A has been tried; a Q&A tier reads only capped rows.
      ...(rotation.holdCapped === true ? [] : ([[qa, fresh], [qa, () => true]] satisfies Tier[])),
      ["best, offering full", fresh],
      ["best, offering full", () => true],
    ];
    let at = -1;
    let rule: PlaceRule = qa;
    for (const [name, tier] of tiers) {
      at = left.findIndex((entry) => (name === qa) === capped(entry) && tier(entry));
      if (at !== -1) {
        rule = name;
        break;
      }
    }
    if (at === -1) continue;
    const asQa = rule === qa;
    const [entry] = left.splice(at, 1);
    out.push({
      opportunityId: entry!.opportunity.id,
      reason: { points: entry!.points, parts: entry!.parts, rule: actionOf(entry!) ?? rule },
      ...(asQa ? { writeAs: "qa" as const } : {}),
    });
    previous = entry!.opportunity;
    const kind = asQa ? "qa" : kindOf(entry!);
    if (kind !== null) placed.push({ day, kind, offering: !asQa && isOffering(entry!.opportunity) });
  }
  return out;
}

/** What a page's own results planned, where they planned this row. */
function actionOf(entry: Scored): PlaceRule | null {
  const { evidence, family } = entry.opportunity;
  // Stored jsonb: a row missing a field reads as not having it.
  const shortfall = evidence?.family === "improve" ? evidence.shortfall : undefined;
  const cause = shortfall?.kind === "due" ? shortfall.cause : null;
  if (cause === "close") return "stalled near page one: gap refresh";
  if (cause === "unmet") return "not moving: refreshed once";
  return family === "write" && entry.parts.some((part) => part.part === "linked_by_ai") ? "linked by AI: one more in its cluster" : null;
}

/** The days the mix reads: the first day the list plans, and the kind of
 *  page each day before it holds. A day is a count of days, so two of them
 *  subtract. */
export interface Mix {
  from: number;
  recent: readonly { day: number; kind: ContentType; offering: boolean }[];
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

/** The days before as the site's own drafted pages state them. The first day planned
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
    const row = {
      type: page.row.type as OpportunityType,
      targetQuery: page.row.target_query,
      evidence: page.row.evidence as Opportunity["evidence"],
      source: (page.row.source ?? null) as Opportunity["source"],
      pageType: (page.row.page_type ?? null) as Opportunity["pageType"],
    };
    const kind = written ?? contentTypeOf(row);
    const offering = written === undefined && isOffering(row);
    return kind === null || !HOLDS_ITS_DAY.has(page.state) ? [] : [{ day: dayOf(page.date), kind, offering }];
  });
  return { from, recent };
}

function samePool(a: string | null, b: string | null): boolean {
  return a === null || b === null || a === b;
}

/** Oldest first, each ahead of the first Write row of its pool. Pure. */
export function placeFixPages(
  scored: readonly Scored[],
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
          out.push({ opportunityId: fix.id, reason: { points: 0, parts: [], rule: "fix ahead of its cluster" } });
          pending.splice(i, 1);
        } else {
          i += 1;
        }
      }
    }
    out.push(entry);
  }
  for (const fix of pending) out.push({ opportunityId: fix.id, reason: { points: 0, parts: [], rule: "fix, no page to precede" } });
  return out;
}

export { isPausedType };

/** The site's open, rankable opportunities in ranked order. A site with no
 *  readable profile ranks nothing. */
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
  scored: readonly Scored[],
  rotation: NonNullable<Parameters<typeof orderRanked>[1]>,
  days: number
): number {
  if (scored.length === 0) return 0;
  const topTens = rotation.topTens ?? new Map<string, readonly string[]>();
  const byId = new Map(scored.map((entry) => [entry.opportunity.id, entry]));
  const kept: Scored[] = [];
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
  /** The site's tracked prompts, which a search with no measured volume
   *  matches to count as asked. */
  prompts?: readonly IntentPrompt[];
  /** The clusters of the site's own pages a stored answer cited. */
  linkedClusters?: readonly string[];
}

/** Why a row the store holds open takes no place in the list. */
export type Rejection = "unready" | "paused" | "no_profile";

/**
 * Whether a row may take a place, or why not. Pure. One predicate, and it is
 * the stored one (issue 884, owner's ruling 2026-09-18): SPEC §6's "a day is
 * filled only by an opportunity that passes readiness" is the stored column
 * (`assessReadiness`), so the column, the screens and this order cannot
 * disagree. A fix needs no profile; any other row needs one, and a type
 * the mix has paused fills no day (SPEC §7, D46).
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
  const [rows, profile, fixRows, latest, drafted, cited, prompts] = await Promise.all([
    store.openRankable(siteId),
    store.profileForSite(siteId),
    store.openFixPages(siteId),
    store.latestPage(siteId),
    // The weekly mix reads the pages of the days before (issue 1209).
    store.draftedPages(siteId, 2 * CONTENT_MIX.WINDOW_DAYS),
    // A window that cannot be read lifts no update: the order is the one
    // before it.
    store.citedPages(siteId, at).catch(() => [] as readonly string[]),
    // Prompts that cannot be read add no demand.
    store.trackedPrompts === undefined ? [] : store.trackedPrompts(siteId).catch(() => [] as readonly IntentPrompt[]),
  ]);
  const scans = rows.filter((row) => named(row, only) && eligible(row, { profile }) === null).map((row) => row.scan_id);
  const topTens =
    scans.length === 0 ? new Map<string, readonly string[]>() : await store.topTens([...new Set([...scans, ...(latest === null ? [] : [latest.scan_id])])]);
  // A cluster that cannot be read earns no page.
  const linkedClusters =
    cited.length === 0 || store.clustersAt === undefined ? [] : await store.clustersAt(siteId, cited).catch(() => [] as readonly string[]);
  return { rows, fixRows, profile, latest, drafted, cited, topTens, prompts, linkedClusters };
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
  scored: Scored[];
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

  const seen: Seen = { cited: new Set(load.cited.map(canonicalUrl)), prompts: load.prompts ?? [] };
  const scored = mixed.map((opportunity) => ({ opportunity, ...pointsOf(opportunity, seen) }));
  // A cluster an AI answer linked earns one more page: its best new page.
  for (const cluster of new Set(load.linkedClusters ?? [])) {
    const next = scored.filter((entry) => entry.opportunity.family === "write" && entry.opportunity.clusterKey === cluster).sort(byPoints)[0];
    if (next === undefined) continue;
    next.parts = [...next.parts, { part: "linked_by_ai", n: POINTS.linkedByAi }];
    next.points += POINTS.linkedByAi;
  }
  const after = load.latest === null ? null : readOpportunity(load.latest);
  return { scored, fixes, rotation: { after, topTens: load.topTens, mix: mixOf(load.drafted, at) }, rejected };
}
