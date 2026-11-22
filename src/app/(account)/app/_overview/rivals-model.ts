// SPEC §4 *Competitors tab* (plate O5) — the twelve main searches, the site's
// place beside each tracked competitor's, and who is on the first page, from
// the stored weekly report. Pure: facts in, model out; `rivals-store.ts` and
// `rivals-fixture.ts` read the facts.
import type { PromptsModel } from "./prompts-model";

/** One site on the first-page count: a tracked competitor, or the customer. */
export interface PresenceRow {
  domain: string;
  count: number;
}

/** Who is on the first page over the searches the pass could read (`of`); `of === 0` is nothing read, never a zero. */
export interface PresenceCard {
  /** The tracked competitors, in the customer's own order. */
  rivals: readonly PresenceRow[];
  you: PresenceRow;
  of: number;
  /** Measured, and every tracked competitor counted zero (SPEC §4, 2026-10-09). */
  noRival: boolean;
}

/** What ReachKit is doing about a search; `live` is the site already on its first page with nothing planned. */
export type RivalSearchStatus = "in_review" | "up_next" | "needs_page" | "too_big" | "live";

/** One of the twelve the pass read. */
export interface RivalSearchRow {
  search: string;
  volume: number;
  /** The site's place, 1–100; `null` where it is not in the top 100. */
  you: number | null;
  /** Each tracked competitor's place, 1–10, by domain; absent is not on page 1. */
  places: Readonly<Record<string, number>>;
  status: RivalSearchStatus;
}

export interface RivalsModel {
  firstPage: PresenceCard;
  /** The customer's first-page count in the first week the window measured; `null` with no earlier week. */
  firstPageAtStart: number | null;
  /** The other sites holding the most first-page places, named where no tracked competitor holds one. */
  firstPageHolders: readonly string[];
  rows: readonly RivalSearchRow[];
  /** The tracked competitors, in the customer's own order. */
  rivals: readonly string[];
  measuredAt: Date | null;
}

export interface RivalsFacts {
  rivals: readonly string[];
  ownDomain: string;
  /** First-page counts over the measured twelve, by domain, the customer's own included. */
  firstPage: ReadonlyMap<string, number>;
  firstPageOf: number;
  firstPageAtStart: number | null;
  firstPageHolders: readonly string[];
  rows: readonly RivalSearchRow[];
  measuredAt: Date | null;
}

/** The order the plan reaches them in, then the bigger search. */
const STATUS_ORDER: Readonly<Record<RivalSearchStatus, number>> = Object.freeze({
  in_review: 0,
  up_next: 1,
  needs_page: 2,
  too_big: 3,
  live: 4,
});

export function assembleRivals(facts: RivalsFacts): RivalsModel {
  const rows = [...facts.rows].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.volume - a.volume || a.search.localeCompare(b.search)
  );
  const firstPage = cardOf(facts.rivals, facts.ownDomain, facts.firstPage, facts.firstPageOf);
  return {
    firstPage,
    firstPageAtStart: facts.firstPageAtStart,
    firstPageHolders: firstPage.noRival ? facts.firstPageHolders : [],
    rows,
    rivals: facts.rivals,
    measuredAt: facts.measuredAt,
  };
}

function cardOf(rivals: readonly string[], ownDomain: string, counts: ReadonlyMap<string, number>, of: number): PresenceCard {
  const rows = rivals.map((domain) => ({ domain, count: counts.get(domain) ?? 0 }));
  return {
    rivals: rows,
    you: { domain: ownDomain, count: counts.get(ownDomain) ?? 0 },
    of,
    noRival: of > 0 && rows.length > 0 && rows.every((row) => row.count === 0),
  };
}

/** Who the window's AI answers mention: the customer, and each site they named.
 *  Read by the Competitors tab and by Settings › Market, so both state one figure. */
export function namedOf(reputation: PromptsModel): PresenceCard {
  if (reputation.kind !== "measured") return { rivals: [], you: { domain: "", count: 0 }, of: 0, noRival: false };
  const rivals = reputation.rivals.map((rival) => ({ domain: rival.domain, count: rival.answers }));
  return {
    rivals,
    you: { domain: "", count: reputation.rate.linked + reputation.rate.named },
    of: reputation.rate.samples,
    noRival: rivals.every((row) => row.count === 0),
  };
}
