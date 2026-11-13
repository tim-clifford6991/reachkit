// SPEC §7 — the one ranked list: integer points (`points.ts`), ties by
// volume, then age, then id, so two reads of the same rows give one order.
// The week is the top of that list and keeps no rule of mix, pace or cluster:
// the highest-value topics are written first, even of one type or one topic.
//
// `unblock` never appears here: the store's `openRankable` excludes the Fix
// family. A `not-yet` target is ranked, with fewer points (`points.ts`).
//
// **A ready `fix_page` is placed, not scored** (SPEC §9, owner ruling
// 2026-09-14): it goes immediately ahead of the first Write row in its
// cluster, and while clusters are not derived, ahead of the first Write row.
import { PLAN_DEPTH } from "@/lib/config/constants";
import { unfielded, type ListicleHeld, type ListicleNeed } from "@/lib/generate/templates/listicle";
import type { Profile } from "@/lib/market/questions/profile";
import type { IntentPrompt } from "../intent";
import { opportunityStore } from "../store";
import { readOpportunity, type DraftedPage, type OpportunityRow } from "../store";
import { canonicalUrl } from "@/lib/measure/page-reading";
import { sameTopic } from "../cluster";
import { contentTypeOf } from "../content-type";
import { pageTypeOf } from "../page-type";
import type { Opportunity, PlaceRule, PlanReason, Ranked } from "../types";
import { POINTS, pointsOf, volumeOrder, type Seen } from "./points";

/** A site ranking fewer than `rankedBelow` searches is new, and its own offering or asked questions earn `points` (R31). */
export const NEW_SITE = Object.freeze({ rankedBelow: 30, points: 1 });

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

/** What the order reads besides the points. */
export interface Rotation {
  /** The stored top tens, by which two rows are one topic. */
  topTens?: ReadonlyMap<string, readonly string[]>;
  /** The first need a listicle cannot field from stored rows: each is written as a Q&A. */
  unfielded?: ListicleNeed;
}

/** Every row by points, highest first. Pure. */
export function orderRanked(scored: readonly Scored[], rotation: Rotation = {}): Ranked[] {
  return [...scored].sort(byPoints).map((entry) => {
    const need = contentTypeOf(entry.opportunity) === "listicle" ? rotation.unfielded : undefined;
    return {
      opportunityId: entry.opportunity.id,
      reason: { points: entry.points, parts: entry.parts, rule: need === undefined ? (actionOf(entry) ?? "best") : `${need} not on file, as a Q&A` },
      ...(need === undefined ? {} : { writeAs: "qa" as const }),
    };
  });
}

/** A Write or Earn row: a new page of the site's. */
function newPage(o: { family: string }): boolean {
  return o.family === "write" || o.family === "earn";
}

/** What a new site writes first (R31): a new page on its own offering, or
 *  on a question buyers were seen asking, that does not compare products. */
function newSiteLed(o: Opportunity): boolean {
  if (!newPage(o) || contentTypeOf(o) === "listicle") return false;
  const asked = o.evidence?.family === "write" && o.evidence.askedBeside !== undefined;
  return asked || pageTypeOf(o) === "product";
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

const DAY_MS = 86_400_000;

/** The first day, as a count of days, that the week plans: the day after the latest drafted date, never before `at`'s own. */
export function firstOpenDay(drafted: readonly DraftedPage[], at: Date): number {
  const days = drafted.map((page) => Math.floor(Date.parse(`${page.date}T00:00:00Z`) / DAY_MS) + 1);
  return Math.max(Math.floor(at.getTime() / DAY_MS), ...days);
}

function samePool(a: string | null, b: string | null): boolean {
  return a === null || b === null || a === b;
}

/** Oldest first, each ahead of the first Write row of its pool. Pure. */
export function placeFixPages(
  scored: readonly Scored[],
  fixes: readonly Opportunity[],
  rotation: Rotation = {}
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

/** The site's open, rankable opportunities in ranked order. */
export async function rankOpen(siteId: string, at: Date = new Date(), only?: ReadonlySet<string>): Promise<Ranked[]> {
  const { scored, fixes, rotation } = rankingOf(await loadRanking(siteId, at, only), only);
  return placeFixPages(scored, fixes, rotation);
}

/** How many of the next `days` days the week's commit fills ("pages left", the
 *  low-supply finding), read from the rows, profile and top tens alone: an
 *  unready row is not counted, a topic another row covers (`sameTopic`) counts
 *  once, and a Fix takes no day. */
export async function writableDays(siteId: string, days: number = PLAN_DEPTH): Promise<number> {
  const [rows, profile] = await Promise.all([opportunityStore().openRankable(siteId), opportunityStore().profileForSite(siteId)]);
  const { scored, rotation } = rankingOf({ rows, fixRows: [], profile, cited: [], topTens: await topTensFor(rows) });
  return countWritable(scored, rotation, days);
}

/** `writableDays` over rows already read. Pure. */
export function countWritable(scored: readonly Scored[], rotation: Rotation, days: number): number {
  const topTens = rotation.topTens ?? new Map<string, readonly string[]>();
  const kept: Scored[] = [];
  for (const entry of [...scored].sort(byPoints)) {
    if (!kept.some((held) => sameTopic(held.opportunity, entry.opportunity, topTens))) kept.push(entry);
  }
  return Math.min(kept.length, days);
}

/** What the one list is ordered from, as the store holds it. */
export interface RankLoad {
  rows: readonly OpportunityRow[];
  fixRows: readonly OpportunityRow[];
  profile: Profile | null;
  /** The site's own pages a stored answer cited (issue 1146). */
  cited: readonly string[];
  /** The top tens already stored for the eligible rows' searches (#1181). */
  topTens: ReadonlyMap<string, readonly string[]>;
  /** The site's tracked prompts, which a search with no measured volume
   *  matches to count as asked. */
  prompts?: readonly IntentPrompt[];
  /** The clusters of the site's own pages a stored answer cited. */
  linkedClusters?: readonly string[];
  /** The searches the site ranks for, as its current report counts them;
   *  `null` or absent where no report is read, ordered as an established site. */
  ownRanked?: number | null;
  /** What a listicle's needs are read from; `null` fields none, and absent holds no listicle back. */
  listicle?: ListicleHeld | null;
}

/** Why a row the store holds open takes no place in the list. */
export type Rejection = "unready";

/**
 * Whether a row may take a place, or why not. Pure. One predicate, and it is
 * the stored one (issue 884, owner's ruling 2026-09-18): SPEC §6's "a day is
 * filled only by an opportunity that passes readiness" is the stored column
 * (`assessReadiness`), so the column, the screens and this order cannot
 * disagree. A market the pass could not measure holds no row: readiness holds only for harm.
 */
export function eligible(row: OpportunityRow): Rejection | null {
  return row.ready ? null : "unready";
}

/** The site's rows and context the list reads — of the rows `only` names,
 *  where it is given (a week's spares, issue 1559). */
export async function loadRanking(siteId: string, at: Date, only?: ReadonlySet<string>): Promise<RankLoad> {
  const store = opportunityStore();
  const [rows, profile, fixRows, cited, prompts, report] = await Promise.all([
    store.openRankable(siteId),
    store.profileForSite(siteId),
    store.openFixPages(siteId),
    // A window that cannot be read lifts no update: the order is the one
    // before it.
    store.citedPages(siteId, at).catch(() => [] as readonly string[]),
    // Prompts that cannot be read add no demand.
    store.trackedPrompts(siteId).catch(() => [] as readonly IntentPrompt[]),
    // A report that cannot be read orders the site as an established one.
    Promise.resolve()
      .then(() => store.currentReport(siteId))
      .catch(() => null),
  ]);
  // An unmeasured count is the cold-start 0, as the pass reads it.
  const ownRanked = report === null ? null : report.ownRanked.kind === "measured" ? report.ownRanked.value : 0;
  const listicle = report === null ? null : await store.listicleHeld(siteId, report.scanId).catch(() => null);
  const topTens = await topTensFor(rows, only);
  // A cluster that cannot be read earns no page.
  const linkedClusters = cited.length === 0 ? [] : await store.clustersAt(siteId, cited).catch(() => [] as readonly string[]);
  return { rows, fixRows, profile, cited, topTens, prompts, linkedClusters, ownRanked, listicle };
}

function topTensFor(rows: readonly OpportunityRow[], only?: ReadonlySet<string>) {
  return opportunityStore().topTens([...new Set(rows.filter((row) => named(row, only) && eligible(row) === null).map((row) => row.scan_id))]);
}

function named(row: { id: string }, only: ReadonlySet<string> | undefined): boolean {
  return only === undefined || only.has(row.id);
}

/** The eligible rows scored, the ready fixes, what the order reads besides
 *  the points, and each row left out with its reason. Pure. */
export function rankingOf(
  load: RankLoad,
  only?: ReadonlySet<string>
): {
  scored: Scored[];
  fixes: Opportunity[];
  rotation: Rotation;
  rejected: { opportunityId: string; reason: Rejection }[];
} {
  const rejected: { opportunityId: string; reason: Rejection }[] = [];
  const keep = (row: OpportunityRow) => {
    const reason = eligible(row);
    if (reason !== null) rejected.push({ opportunityId: row.id, reason });
    return reason === null;
  };
  const fixes = load.fixRows.filter((row) => named(row, only) && keep(row)).map(readOpportunity);
  const mixed = load.rows.filter((row) => named(row, only) && keep(row)).map(readOpportunity);
  if (mixed.length === 0) return { scored: [], fixes, rotation: {}, rejected };

  const seen: Seen = { cited: new Set(load.cited.map(canonicalUrl)), prompts: load.prompts ?? [] };
  const scored = mixed.map((opportunity) => ({ opportunity, ...pointsOf(opportunity, seen) }));
  // A cluster an AI answer linked earns one more page: its best new page.
  for (const cluster of new Set(load.linkedClusters ?? [])) {
    const next = scored.filter((entry) => entry.opportunity.family === "write" && entry.opportunity.clusterKey === cluster).sort(byPoints)[0];
    if (next === undefined) continue;
    next.parts = [...next.parts, { part: "linked_by_ai", n: POINTS.linkedByAi }];
    next.points += POINTS.linkedByAi;
  }
  const isNew = load.ownRanked != null && load.ownRanked < NEW_SITE.rankedBelow;
  if (isNew) {
    for (const entry of scored.filter((each) => newSiteLed(each.opportunity))) {
      entry.parts = [...entry.parts, { part: "new_site", n: NEW_SITE.points }];
      entry.points += NEW_SITE.points;
    }
  }
  const unfit = load.listicle === undefined ? null : unfielded(load.listicle);
  const rotation = { topTens: load.topTens, ...(unfit === null ? {} : { unfielded: unfit }) };
  return { scored, fixes, rotation, rejected };
}
