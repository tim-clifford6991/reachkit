// SPEC §4 (2026-09-20, #908) — the Rivals tab, in one shape.
//
// "Rivals tab: who is on the first page for the twelve searches, who the
// three answer engines name, how far ahead each rival's footprint is over
// twelve weeks, and the searches rivals win that the site does not, each
// with what ReachKit is doing about it. Market leaders stay on their own
// secondary line (§6, #858). Read from the stored weekly report."
//
// **This file is pure.** Facts in, model out — the same split `model.ts`,
// `search-model.ts` and `answers-model.ts` make, and for the same reason:
// every rule below is then decided by a test with no database and no
// browser. Reading the facts is `rivals-store.ts`'s (a real account) and
// `rivals-fixture.ts`'s (the reserved fixture account).
//
// **Two of the four cards are not assembled here at all.** *How far ahead
// they are* is `rivals.ts`'s `RivalGapModule`, which the Overview tab
// already reads and `RivalModule.tsx` already draws — one derivation of the
// gap, so the tile on the Overview and the card on this tab cannot come to
// disagree about which rival is nearest. Market leaders ride on that same
// module (§6, #858).
//
// **A count nobody could take is not a count of zero** (REQ-004). Both
// presence cards carry the denominator they were counted over — the twelve
// that were *measured*, the answers that were *asked* — and a card with no
// denominator at all is drawn as its written line instead of as a row of
// empty bars.
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";

/** One site on a presence card: a tracked rival, or the customer. */
export interface PresenceRow {
  domain: string;
  count: number;
}

/**
 * One of the two counting cards — who is on the first page, and who the
 * answer engines name.
 *
 * `of` is what every bar is drawn against, and it is what was measured
 * rather than what was asked for: a SERP the pass could not read is not a
 * search the rivals all lost, and an engine nobody reached named nobody.
 * `of === 0` is the card with nothing to draw, and the screen says so in
 * words rather than drawing four empty tracks.
 */
export interface PresenceCard {
  /** The tracked rivals, in the customer's own order. */
  rivals: readonly PresenceRow[];
  /** The customer, drawn last and in the accent (§4.1). */
  you: PresenceRow;
  of: number;
  /** The card was measured and every tracked rival counted zero (SPEC §4,
   *  2026-10-09, issue 1365). A row of empty bars would read as a finding
   *  about the rivals; it is a finding about who is tracked, and the card
   *  says so in a sentence instead. */
  noRival: boolean;
}

/**
 * What ReachKit is doing about a search a rival wins.
 *
 * Four words, closed, and none of them is "live": every row in this table
 * is a search the site does **not** win, so a page that already won it
 * would not be here. `needs_page` is the row with no opportunity on file at
 * all — the search is real and nothing in the plan covers it yet, which is
 * a different statement from "we have not got to it", and the only one of
 * the four that is about the customer's own site rather than about the
 * queue.
 */
export const RIVAL_SEARCH_STATUSES = ["in_review", "up_next", "needs_page", "too_big"] as const;
export type RivalSearchStatus = (typeof RIVAL_SEARCH_STATUSES)[number];

/** The chips over the table: `all` is a filter and never a rival, which is
 *  why it is spelled apart — the same shape, and the same reason, as the
 *  Search tab's `SEARCH_FILTERS`. */
export const ALL_RIVALS = "all" as const;

/** One row: a search one of the tracked rivals ranks for and the site does
 *  not. */
export interface RivalSearchRow {
  /** The search itself. The row's key — a pool row carries no id. */
  search: string;
  volume: Measured<number>;
  /** Which tracked rival the pass recorded as ranking for it. */
  rival: string;
  /** Where that rival stands on it. Measured only for the twelve the pass
   *  bought a top ten for; the pool is the rivals' whole ranked footprint
   *  and carries no position, so every other row states the honest dash
   *  rather than a place nobody read. */
  position: Measured<number>;
  status: RivalSearchStatus;
}

export interface RivalsModel {
  firstPage: PresenceCard;
  named: PresenceCard;
  /** Where the customer stood on the first-page card in the first week this
   *  window measured — the "when you started" line. `null` where there is
   *  no earlier week to compare with, and the line is then not drawn at all
   *  rather than drawn against zero. */
  firstPageAtStart: number | null;
  /** The other sites that hold the most first-page places, most first —
   *  named where no tracked rival holds one (issue 1365). */
  firstPageHolders: readonly string[];
  /** The tracked rivals neither card counted anywhere, where some rival
   *  was counted: stated in words under the cards. Empty where every rival
   *  is one, because both cards then say so themselves. */
  unseen: readonly string[];
  /** The rows, already in the screen's one order (below). */
  rows: readonly RivalSearchRow[];
  /** The tracked rivals, in the customer's own order — the chips, after
   *  `all`. */
  rivals: readonly string[];
  /** How many rows each chip stands for, `all` included. Counted over the
   *  whole set, once, so the chips and the table cannot disagree. */
  counts: Readonly<Record<string, number>>;
  /** The date the pass measured, for the line that says when. */
  measuredAt: Date | null;
}

/** Everything the Rivals tab reads, before it is a model. */
export interface RivalsFacts {
  /** The tracked rivals, in the customer's own order. */
  rivals: readonly string[];
  ownDomain: string;
  /** How many of the measured twelve put each domain on the first page,
   *  keyed by domain — the customer's own included. */
  firstPage: ReadonlyMap<string, number>;
  /** How many of the twelve the pass could read at all. */
  firstPageOf: number;
  /** How many of the asked answers named or linked each domain. */
  named: ReadonlyMap<string, number>;
  /** How many answers were asked and read — at most twelve × three. */
  namedOf: number;
  firstPageAtStart: number | null;
  /** Sites that are neither the customer's nor a tracked rival's nor a
   *  forum or network, by how many measured first pages they hold. */
  firstPageHolders: readonly string[];
  pool: readonly RivalPoolFacts[];
  measuredAt: Date | null;
}

export interface RivalPoolFacts {
  search: string;
  volume: Measured<number>;
  rival: string;
  position: Measured<number>;
  status: RivalSearchStatus;
}

/**
 * The screen's one order: **what the plan reaches first**.
 *
 * A search already has a page waiting for the customer, or is next in the
 * queue, or needs a page on their own site, or is outsized for today — in
 * that order, because that is the order the customer can act in. Within one
 * status the bigger search comes first: of two searches nobody has started,
 * the one more people ask is the nearer prize. The search itself breaks the
 * last tie, so the table's own paging cuts at the same row on every render.
 */
const STATUS_ORDER: Readonly<Record<RivalSearchStatus, number>> = Object.freeze({
  in_review: 0,
  up_next: 1,
  needs_page: 2,
  too_big: 3,
});

function demandOf(row: RivalSearchRow): number {
  return row.volume.kind === "unmeasured" ? 0 : row.volume.value;
}

/**
 * Facts in, model out.
 *
 * **No clock, unlike the three assemblers beside it.** Every `Measured` on
 * this screen is stamped by the read that took it — the store with the
 * pass's own `measuredAt`, the fixture with its Monday — so there is no
 * value here for a clock to date. An `at` parameter would be a clock a
 * reader would reasonably expect something to be dated by.
 */
export function assembleRivals(facts: RivalsFacts): RivalsModel {
  const rows: RivalSearchRow[] = facts.pool.map((row) => ({
    search: row.search,
    volume: row.volume,
    rival: row.rival,
    position: row.position,
    status: row.status,
  }));

  rows.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      demandOf(b) - demandOf(a) ||
      a.search.localeCompare(b.search)
  );

  const counts: Record<string, number> = { [ALL_RIVALS]: rows.length };
  for (const rival of facts.rivals) {
    counts[rival] = rows.filter((row) => row.rival === rival).length;
  }

  const firstPage = cardOf(facts.rivals, facts.ownDomain, facts.firstPage, facts.firstPageOf);
  const named = cardOf(facts.rivals, facts.ownDomain, facts.named, facts.namedOf);
  // A card that was not measured says nothing of a rival either way.
  const cards = [firstPage, named].filter((card) => card.of > 0);
  const nowhere = cards.length === 0 ? [] : facts.rivals.filter((domain) =>
    cards.every((card) => card.rivals.every((row) => row.domain !== domain || row.count === 0))
  );

  return {
    firstPage,
    named,
    firstPageAtStart: facts.firstPageAtStart,
    firstPageHolders: firstPage.noRival ? facts.firstPageHolders : [],
    unseen: nowhere.length === facts.rivals.length ? [] : nowhere,
    rows,
    rivals: facts.rivals,
    counts,
    measuredAt: facts.measuredAt,
  };
}

/** One card: the tracked rivals in the customer's own order, then the
 *  customer. A domain the map has no entry for counted zero over what was
 *  measured — which is a measurement, not a gap in one, because `of` is
 *  already what could be read. */
function cardOf(
  rivals: readonly string[],
  ownDomain: string,
  counts: ReadonlyMap<string, number>,
  of: number
): PresenceCard {
  const rows = rivals.map((domain) => ({ domain, count: counts.get(domain) ?? 0 }));
  return {
    rivals: rows,
    you: { domain: ownDomain, count: counts.get(ownDomain) ?? 0 },
    of,
    noRival: of > 0 && rows.length > 0 && rows.every((row) => row.count === 0),
  };
}

/** The rows one chip stands for. Applied here as well as by the table, so a
 *  test can decide the rule without a browser. */
export function rowsFor(rows: readonly RivalSearchRow[], rival: string): readonly RivalSearchRow[] {
  return rival === ALL_RIVALS ? rows : rows.filter((row) => row.rival === rival);
}

/** A count, as one of the three arms rather than a bare integer: a zero the
 *  screen counted is a measurement, and it is not the same fact as a count
 *  it could not take. */
export function counted(value: number, at: Date): Measured<number> {
  return value === 0 ? measuredZero(0, at) : measured(value, at);
}

/** A reading the pass never took, on this screen's own subject. */
export function notTaken(at: Date): Measured<number> {
  return unmeasured<number>("not_attempted", at);
}
