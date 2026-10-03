// SPEC §6 (2026-09-22, #1004) — what one site's LLM Mentions week is, stored.
//
// The shapes `store.ts` writes and reads, and the two cards on the AI
// answers tab read through. Product types, not vendor payload shapes, the
// same split `src/lib/vendors/dataforseo/types.ts` makes: what is here is
// what a screen can show.
//
// **Two shapes, because a week has two facts in it** — the read (it was
// bought, skipped or it failed) and the mentions (what came back). SPEC §6
// of this date turns that distinction into two different screens: "a week
// with no rows is a measured zero (a written line), not a blank card; a
// site never queried draws no card."
//
// **What has no member here, and never will.** A rank position and
// anything readable as sentiment: SPEC §4 (2026-09-20) closes the AI
// answers tab on both — "'AI rank position' and sentiment are never shown"
// — and #1004 repeats it. A field that does not exist is the only way a
// later surface cannot render one.

/**
 * What happened on one site's Monday, closed.
 *
 *   `measured`    the vendor answered with rows.
 *   `zero`        the vendor answered with none. A **measurement**, not an
 *                 absence (§6.6's cold-start law): the engines answered
 *                 nobody with this site that week, and the card says so in
 *                 a written line.
 *   `skipped_cap` the weekly cap had no room for the reservation. Nothing
 *                 was asked and nothing was spent.
 *   `skipped_footprint` the site ranks for fewer than
 *                 `LLM_MENTIONS_MIN_FOOTPRINT` keywords, so the read is not
 *                 bought (SPEC §6, owner D32 of 2026-10-03, #1162).
 *   `skipped_monthly` it was bought inside the last
 *                 `LLM_MENTIONS_EVERY_WEEKS` weeks (D32).
 *   `failed`      the vendor was reached and could not be read.
 */
export type MentionReadStatus =
  | "measured"
  | "zero"
  | "skipped_cap"
  | "skipped_footprint"
  | "skipped_monthly"
  | "failed";

/** One row: a buyer's question an engine answered, citing one of the
 *  site's own pages. Everything but the question may be absent — the
 *  question is the row's subject, and a mention whose volume the vendor
 *  could not give is still a question the engines answered. */
export interface StoredMention {
  /** The site-local Monday this row was bought on, `YYYY-MM-DD` — the same
   *  spelling `scans.week_start` carries. */
  weekStart: string;
  question: string;
  engine: string | null;
  model: string | null;
  /** One of the site's own pages the answer cites, or `null` where the
   *  mention could not be attributed to a URL on this domain. */
  citedUrl: string | null;
  /** `null` where the vendor gave none — never 0, which would sort a
   *  question it could not size to the bottom of a list ordered by it. */
  aiSearchVolume: number | null;
  monthlySearches: number | null;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
}

/** One week of one site, as the two cards read it. */
export interface MentionWeek {
  weekStart: string;
  status: MentionReadStatus;
  /** The vendor's own count of every mention it holds for this domain,
   *  independent of the 100 rows this read bought. `null` where it
   *  reported none. */
  totalCount: number | null;
  /** Empty on every status but `measured` — and on `zero` that emptiness
   *  is the measurement. */
  mentions: readonly StoredMention[];
}
