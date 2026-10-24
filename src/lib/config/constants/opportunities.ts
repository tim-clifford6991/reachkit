// src/lib/config/constants/opportunities.ts — choosing topics, the week's plan and when a page is improved or rested. Imports nothing.

/**
 * SPEC §7 (2026-09-20, #928) — "Known content". The pins the net-new rule
 * reads, and the one threshold that decides whether a topic is a repeat.
 *
 * `COVERED_MIN` — how alike a planned page's topic and a page the site
 * already has must be before the planned page is a repeat of it. The
 * measure is `known-content/similarity.ts`'s trigram-set Jaccard, the one
 * `pg_trgm` defines, and **0.6 is where two populations separate.** Scored
 * over realistic pairs (the table is
 * `tests/known-content/similarity.test.ts`, which fails if the gap closes):
 *
 *   the same page reworded                                       0.92
 *   the same topic in the customer's own words                   0.64
 *   the same words in another order                              0.76
 *   a singular against its plural                                0.84
 *   ── 0.6 ──────────────────────────────────────────────────────────
 *   a different topic sharing a phrase ("price a retainer"
 *     against "price a project")                                 0.50
 *   one word apart ("SEO for agencies" / "for accountants")      0.32
 *   a different topic sharing words                              0.22
 *
 * Above the line every pair is the same page written twice; below it, the
 * closest pair is two pages a reader would want both of. It is deliberately
 * the *lower* edge of the true-repeat band rather than the midpoint: the
 * cost of the two mistakes is not symmetric where the destination can
 * publish an update — a wrong match becomes an update of a page the site
 * already has, while a missed one becomes the second page on one topic,
 * which is the thing this rule exists to prevent.
 *
 * `HEADINGS_COMPARED` bounds how many of a page's own headings are scored
 * against a topic. A long page has dozens; the first few are what it is
 * about, and the rest are its detail.
 *
 * `WORDPRESS_POSTS_MAX` bounds one connection's read. The REST list is
 * paginated and this is how many posts are taken in all — enough for the
 * blogs this product meets, and a bound rather than an open crawl of a site
 * we do not own. `WORDPRESS_PER_PAGE` is one page of that read.
 *
 * `INVENTORY_MAX` caps the crawled main-site pages the index holds — the
 * hundred the rule was written against.
 */
export const KNOWN_CONTENT = Object.freeze({
  COVERED_MIN: 0.6,
  HEADINGS_COMPARED: 12,
  WORDPRESS_POSTS_MAX: 300,
  WORDPRESS_PER_PAGE: 100,
  INVENTORY_MAX: 100,
  /** How many rows the database's own narrowing hands back for one topic.
   *  It is a shortlist, not a page of results: past the first handful the
   *  rows share neither a word nor a spelling with the topic, and the
   *  closest of them is what the caller wants. */
  NEAR_ROWS: 25,
  /** How many of them are named to the writer as topics the site already
   *  covers. A list of everything the site has is not a list a model can
   *  use; the pages worth naming are the ones near this one's topic. */
  PROMPT_PAGES_MAX: 8,
  /** How many known pages a new page may link to. The same bound and the
   *  same reason as `CROSS_LINKS.CLUSTER_PAGES_MAX`: a page links to what
   *  helps the reader, and a list of every page the site has is an index,
   *  not a link. */
  LINKS_MAX: 5,
} as const);

/** SPEC §7 (owner, 2026-10-19, issue 1559): the one depth number. Each
 *  weekly pass commits the next `days` pages, one a day, and `spares` more
 *  the daily job takes when a day's page cannot be written. Supply is
 *  counted, and refilled at 0¢, up to their sum. */
export const WEEK_PLAN = Object.freeze({ days: 7, spares: 3 } as const);

// The week's ceiling is the plan's week, so the Terms' "up to 7 a week" holds by construction.
export const RATE_LIMITS = Object.freeze({
  publishesPerDay: 1, publishesPerWeek: WEEK_PLAN.days,
} as const);

// ── Added 2026-08-31 (decision 3). Every entry below is traced to the node
//    and the criterion that asked for it; none is minted here, and none is a
//    customer-visible string.
//
// The free report and the market chain
export const SELECTION = Object.freeze({                    // BP-025 · REQ-006 · BUILD §6.7 step 3
  volumeFloorPerMonth: 50,
  /** SPEC §6 thin markets (2026-09-16): the floor steps a pass short of
   *  twelve questions walks down, only as far as it needs. The first step
   *  is `volumeFloorPerMonth`; the last is never below `KEYWORD_PAGE_MIN_VOLUME`. */
  volumeSteps: Object.freeze([50, 20, 10] as const),
  /** SPEC §6 thin markets: at most this many extra `keyword_suggestions`
   *  purchases per pass, inside that pass's own cap — the free scan's too
   *  (owner ruling 2026-09-17, issue 835). */
  maxExtraSeeds: 3,
  /** SPEC §2 (2026-10-04, issue 1235): the free scan's ladder keeps buying
   *  seeds while it holds fewer questions than this and its purse still
   *  affords one. One question was enough before, and one SERP that timed
   *  out then left the whole report with no score. */
  freeLadderMinQuestions: 4,
  intentWeights: Object.freeze({ decision: 3, solution: 3, problem: 2, informational: 1 } as const),
  maxRivalBrand: 3, maxHowTo: 2,
  /** SPEC §6 right-sizing (owner walk 2026-09-17, issue 858): while the
   *  site's demand ceiling sits at its cold-start floor, a specific search
   *  of at least `longTailWords` content words scores `longTailWeight` ×
   *  its intent score, so long-tail searches carrying the profile's words
   *  lead the twelve. Owner-correctable defaults. */
  longTailWords: 3, longTailWeight: 2,
  /** SPEC §6 (owner D65 of 2026-10-07, issue 1303): the most of the twelve
   *  that are the market's own searched terms, most searched first; the
   *  other places go to the searches its seeds and pool yield, by score.
   *  A drafted default the owner may correct. */
  maxMarketTerms: 6,
  /** Issue 1549: the fewest of the twelve that are searches the site has
   *  not measured in the last `freshWeeks` weeks, where the market holds
   *  them, and the fewest that are how-to or informational searches — the
   *  answer pages D52's cap does not hold back. Drafted; the owner may
   *  correct them. */
  minFresh: 4, freshWeeks: 4, minAnswering: 4,
} as const);

/** SPEC §6 *Topics by business fit* (2026-09-29, 2026-10-03; issue 1134).
 *  `gate`: below it a target is `low_fit` and never supply. `writeAt`: the
 *  fit at which a search is a write target whatever its volume. `topShare`:
 *  the most of one pass's candidates that may hold the top fit — the owner's
 *  "under about 25%" — and `topMin` the floor of that count on a small set.
 *  `maxCandidates` bounds the one call. */
/** SPEC §6 *Write targets in the buyer's words* (2026-10-03, issue 1208):
 *  how many buyer searches a pass asks the small tier to write, how many of
 *  them must be problems or how-tos, the words one may run to, and how many
 *  proposals one "would a buyer search this?" check reads. */
export const BUYER_SEARCHES = Object.freeze({
  max: 16, minProblems: 6, minWords: 2, maxWords: 10, maxChecked: 60,
} as const);

export const TOPIC_FIT = Object.freeze({
  gate: 2, writeAt: 3, topShare: 0.25, topMin: 3, maxCandidates: 80,
} as const);

/** SPEC §6 *Topics from what buyers were seen asking* (issue 1519): the
 *  most "People also ask" questions and related searches one pass proposes
 *  (inside `TOPIC_FIT.maxCandidates`), the words one may run to, and how
 *  old a stored SERP may be. Drafted; the owner may correct them. */
export const ASKED_TOPICS = Object.freeze({
  max: 24, maxWords: 12, maxAgeDays: 30,
} as const);

// Opportunities, supply and verdicts
export const EFFORT_BY_TYPE = Object.freeze({                // BP-040 d3
  answerable_page: 0.2, expand_page: 0.3, refresh_page: 0.3,
  answer_page: 0.5, keyword_page: 0.5, comparison_page: 0.6, format_page: 0.7,
  // SPEC §0's Earn answer is "a first-party citable asset on the customer's
  // own domain" — the most work of any page the engine proposes.
  listed_page: 0.7,
} as const);                                                 // `unblock` is unranked

export const PLAN_DEPTH = WEEK_PLAN.days + WEEK_PLAN.spares;  // BP-041 d4 · REQ-095 c1
export const SUPPLY_SHORT_BELOW = WEEK_PLAN.days;            // BP-041 d4 · REQ-095 c5
/** A page's window: a gain counts inside it, and a page whose best place is
 *  this old with no AI link is not moving (owner, 2026-10-19, B1 · M-a). */
export const TOO_EARLY_WEEKS = 8 as const;                   // BP-051 d4 · REQ-063 c2
export const CLIMB_PLACES = 10 as const;                     // owner 2026-10-19 B1

// ── Opportunities (issue #40) — BUILD §7
/** §7's Write trigger, transcribed: "Rival top-20 for a query ≥10/mo;
 *  customer absent". The floor below which a search is not worth a page of
 *  its own. Distinct from `SELECTION.volumeFloorPerMonth` (50), which is
 *  §6.7's floor for admitting a search into the *twelve* — two floors,
 *  stated independently by the spec, and neither derived from the other. */
export const WRITE_VOLUME_FLOOR_PER_MONTH = 10 as const;      // §7

/** SPEC §6: "A Monday verdict of 'not working' on a cluster suppresses new
 *  Write opportunities in that cluster for four weeks; Improve of the live
 *  URL in it stays allowed." */
export const CLUSTER_SUPPRESS_WEEKS = 4 as const;             // §6

/** SPEC §7 (owner, D26, 2026-10-02): "A topic stopped twice, or skipped by
 *  the founder, rests for 28 days." */
export const TOPIC_REST_DAYS = 28 as const;                   // §7

/** SPEC §7 (R9, owner 2026-10-22): a hosted page its customer stops can be
 *  put back for 7 days; its topic is dropped for good (Q6). */
export const TAKE_DOWN = Object.freeze({
  PUT_BACK_DAYS: 7,
} as const);                                                   // §7

/** SPEC §7 (owner, D26): when the day's draft is stopped, the same run
 *  tries the next-ranked opportunity for the date "at most once more". */
export const DAY_TOPICS_MAX = 2 as const;                     // §7

/** Issue 1536: autopilot publishes one page every `cadenceDays`, and a site
 *  that has gone `stallFactor` times that with no page delivered is told to
 *  the owner, on that day and every such span after it until one is. */
export const AUTOPILOT_STALL = Object.freeze({ cadenceDays: 1, stallFactor: 2 } as const); // §7

/** SPEC §6 (2026-09-29, *Topics by business fit*): two searches whose
 *  stored top tens share this many page addresses are one topic. Drafted
 *  threshold; the owner may correct it (#1131). */
export const SAME_TOPIC_SHARED_ADDRESSES = 4 as const;        // §6

/** SPEC §6 (2026-10-02, #1181): a page younger than this is never the
 *  target of a refresh. Drafted default; the owner may correct it. */
export const REFRESH_MIN_AGE_DAYS = 30 as const;               // §6

/** A page of ours at 4–30 for its search is refreshed for the gap only
 *  once this many weekly readings in a row hold no gain (owner, 2026-10-19,
 *  B3 · M6). */
export const GAP_REFRESH = Object.freeze({ maxPlace: 30, stalledReadings: 3 } as const); // issue 1611

/** Issue 1538: a live page whose stored reading holds no Found step after
 *  this many days is due the `unseen` fix — a link in from its cluster's
 *  strongest live page, and D13's check run again on its text — and gains at
 *  most one such link in each `UNSEEN_LINK_EVERY_DAYS`. */
export const UNSEEN_AFTER_DAYS = 28 as const;                  // issue 1538
export const UNSEEN_LINK_EVERY_DAYS = 30 as const;             // issue 1538

/** SPEC §6 (owner, D60, issue 1288): a page that has reached neither of its
 *  goals after this many weekly verdicts gets a refresh or a retarget
 *  queued. */
export const INTENT_UNMET_WEEKS = 8 as const;                 // §6

/** SPEC §7 (2026-10-03, D36, issue 1209): the rolling weekly content mix.
 *  Over any `WINDOW_DAYS` days a site publishes at most `MAX_PER_KIND` pages
 *  of one kind, never the same kind two days running, and at least one
 *  update where one is ready. Drafted defaults; the owner may correct them. */
export const CONTENT_MIX = Object.freeze({
  WINDOW_DAYS: 7,
  MAX_PER_KIND: 2,
  /** SPEC §7 (owner, D52, 2026-10-05; issue 1267): how many of a window's
   *  pages may be a listicle or comparison that includes the business. A
   *  topic over it fills no day until the window has room. */
  SELF_PROMOTING_MAX: 1,
  /** SPEC §7 (issue 1506): the fewest of the site's last `NON_COMMERCIAL_OF`
   *  new pages (refreshes not counted) that answer rather than sell — a Q&A,
   *  a how-to or documentation — where a topic of one is ready. Drafted; the
   *  owner may correct it. */
  NON_COMMERCIAL_MIN: 3,
  NON_COMMERCIAL_OF: 7,
  NON_COMMERCIAL_TYPES: Object.freeze(["qa", "how_to", "documentation"] as const),
  /** How many of the site's own published and planned pages a brief is
   *  handed, newest first. */
  BRIEF_PAGES_MAX: 100,
});                                                            // §7

/** SPEC §7 (2026-09-29, *Pace*; issue 1139): in any seven days a site
 *  publishes at most `NEW_PAGES_PER_WEEK` new pages, and the other days
 *  refresh pages already live. One of ReachKit's own live pages is due a
 *  refresh once its current version is `REFRESH_AGE_DAYS` old. */
export const PACE = Object.freeze({
  NEW_PAGES_PER_WEEK: 4,
  REFRESH_AGE_DAYS: 90,
});                                                            // §7

/** Issue 477: "two `not_working` verdicts on Improve of one URL retire that
 *  URL" — counted in distinct Monday weeks. */
export const IMPROVE_RETIRE_AFTER_NOT_WORKING = 2 as const;   // §6

/** SPEC §6: "A residual keyword page fires only when every extra gate
 *  passes; volume >= 10/mo alone is never sufficient." The readiness floor a
 *  gate is checked against, never `WRITE_VOLUME_FLOOR_PER_MONTH`'s discovery
 *  one: two clauses of the spec, so two pins. */
export const KEYWORD_PAGE_MIN_VOLUME = 10 as const;           // §6

/** §7's Improve trigger, transcribed: "Customer ranks 4–30, page thin".
 *  The band is inclusive at both ends. The bought SERP is a top ten
 *  (`transport.ts` fixes depth 10), so today only 4–10 is observable; the
 *  band is stated as the spec states it, so widening what is bought needs
 *  no edit here. */
export const IMPROVE_POSITION_BAND = Object.freeze({ min: 4, max: 30 } as const); // §7

/** SPEC §6 (2026-09-29, D15, issue 1146): a live page is close to being
 *  quoted where it ranks inside this band for its target, inclusive, or an
 *  answer to a tracked prompt cited it inside `ANSWER_RATE_WEEKS`. Its
 *  update has first claim on a day. */
export const CLOSE_PAGE_POSITION_BAND = Object.freeze({ min: 4, max: 20 } as const); // §6

/** What "page thin" means, in the unit the parser measures
 *  (`OnPageFacts.visibleChars`). Chosen, not transcribed — §7 states the
 *  trigger and no number. 1800 visible characters is roughly 300 words at
 *  ~6 characters a word including spaces, the length below which a page
 *  answering a commercial search has said too little to rank for it.
 *  Reversal cost is this one number and its fixtures; nothing stored
 *  depends on it, since the shortfall row records the measured count
 *  itself and not the comparison. */
export const THIN_PAGE_VISIBLE_CHARS = 1800 as const;         // §7
