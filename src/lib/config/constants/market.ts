// src/lib/config/constants/market.ts — the business profile's lists, market searches, tracked prompts and rivals. Imports nothing.

/** How many entries each of the business profile's lists may carry (BUILD
 *  §6.7 step 1). The schema the model's answer is parsed against and the
 *  prompt that asks for it both read these, so the two cannot disagree
 *  (`src/lib/market/questions/profile.ts`). `audienceTerms` is "2–4
 *  audience/use-case terms"; the others bound the lists so a profile cannot
 *  spend its budget on an unbounded one. */
export const PROFILE_LIST_BOUNDS = Object.freeze({
  audienceTerms: Object.freeze({ min: 2, max: 4 } as const),
  namedRivals: Object.freeze({ min: 0, max: 5 } as const),
  vocabulary: Object.freeze({ min: 0, max: 12 } as const),
  brandTokens: Object.freeze({ min: 0, max: 6 } as const),
  /** What the business sells, one entry per line it sells, each with its own
   *  category; four is the most a site's searches can usefully be spread
   *  across. An answer with none is kept: its `category` is then its one
   *  offering. */
  offerings: Object.freeze({ min: 0, max: 4 } as const),
} as const);

/** Drafted defaults the owner may correct: how a profile's offerings share
 *  the searches. An offering with less than `seedShare` of the site's weight
 *  gets no seed of its own bought up front; it is still a seed while the pass
 *  is short, still a relevance term, and still held to its share of the
 *  searches its category yields.
 *
 *  `genericWords` say what kind of thing a line is, not what it is about:
 *  two lines that share only one of them ("plumbing services", "audit
 *  services") are two lines, and two that share any other word
 *  ("residential plumbing repair" after "plumbing services") are one line
 *  worded twice, bought one seed. */
export const OFFERINGS = Object.freeze({
  seedShare: 0.2,
  genericWords: ["service", "services", "product", "products", "solution", "solutions"],
} as const);

/**
 * A market's search terms (SPEC §6, D49). `MAX` is how many candidates one
 * keyword-overview call reads. Volumes move slowly, so the terms of a market
 * that still stands are read again only after `REFRESH_DAYS`.
 */
export const MARKET_TERMS = Object.freeze({ MAX: 10, REFRESH_DAYS: 30 } as const);

/**
 * Rivals and comparison targets need search demand (SPEC §6, D50). A brand
 * is searched at `MIN_VOLUME` searches a month or more; below it, it counts
 * as searched by no one. A brand's volume is read again after
 * `REFRESH_DAYS`. `PAIRS` is how many of the most-searched rivals are set
 * against each other where the business's own brand is not searched.
 * Drafted defaults; the owner may correct them.
 */
export const RIVAL_DEMAND = Object.freeze({ MIN_VOLUME: 100, REFRESH_DAYS: 30, PAIRS: 3 } as const);

/**
 * SPEC §6 — rivals are chosen from who the pass saw. `FIRST_PAGE_PLACES` of
 * the five go first to the on-market products that hold the most first-page
 * places on the measured searches, whatever their brand volume; the rest
 * follow D50's order, one the pass saw before one it did not. `HOLDERS` is
 * how many other sites the Rivals tab names where no tracked rival holds a
 * first-page place. Drafted defaults; the owner may correct them.
 */
export const RIVAL_PRESENCE = Object.freeze({ FIRST_PAGE_PLACES: 2, HOLDERS: 3 } as const);

/**
 * SPEC §6 (D19, D32, D33) — the tracked buyer prompts, which are the weekly
 * AI measure.
 *
 * `SPLIT` is the set's shape, 25 in all. Each engine asks an unbranded
 * prompt `RUNS` times and a branded one `BRANDED_RUNS` times in one weekly
 * pass: 23 + 4 asks an engine, 54 at the measured 0.12¢ each, 6.48¢ a set.
 * At most `ROTATION_SHARE` of the set is replaced in any `ROTATION_WEEKS`,
 * and only a prompt added that way is pre-checked (D33).
 */
export const TRACKED_PROMPTS = Object.freeze({
  SPLIT: Object.freeze({ category: 5, "use-case": 7, persona: 4, comparison: 4, problem: 3, branded: 2 }),
  ENGINES: 2,
  RUNS: 1,
  BRANDED_RUNS: 2,
  ROTATION_SHARE: 0.2,
  ROTATION_WEEKS: 13,
} as const);

/**
 * SPEC §6 — how many AI questions this product tracks for one site, in all:
 * "Each published page's own question may join the tracked set: **at most
 * 24 tracked questions in all** (the twelve plus twelve), the twelve page
 * questions being those whose pages rank nearest the first page, and a
 * page's question leaves the set after **8 weeks** without a mention. The
 * set never grows past the cap, so its cost is flat."
 *
 * The cap is the point of the feature and not a tuning knob. A published
 * page's own question joins the twelve so that tracking grows with what
 * ReachKit writes — but a site with thirty live pages must cost no more
 * each Monday than a site with two. Twenty-four is the ceiling on the
 * *set*, so the page half is whatever is left of it once the market's
 * questions are counted, and the weekly spend is flat whatever the
 * customer publishes.
 *
 * The retirement is the other half of the same promise. A page question
 * asked for eight weekly passes with the site named in none of them has
 * told us what it is going to tell us, and its slot goes to the next page.
 * A pass that did not ask it is not one of the eight: a week nobody
 * measured is not a week the answer was no.
 *
 * `src/lib/market/questions/tracked.ts` is the one reader of both.
 */
export const TRACKED_QUESTIONS_MAX = 24 as const;             // SPEC §6
export const PAGE_QUESTION_RETIRE_WEEKS = 8 as const;         // SPEC §6

/**
 * How a page question's Google result is read (SPEC §6). A page is due on its
 * first Monday and in its `DUE_WEEKS`; its result is read `DEPTH_MAX` deep
 * until it is first seen, then `DEPTH_PAST` places past where it was last
 * seen, never under `DEPTH_MIN`. `CLIMBING` is the band of places a slot is
 * given to after the due pages.
 */
export const PAGE_QUESTION_READ = Object.freeze({
  DUE_WEEKS: Object.freeze([0, 2, 4, 8] as const),
  DEPTH_MAX: 100,
  DEPTH_MIN: 20,
  DEPTH_PAST: 10,
  CLIMBING: Object.freeze({ from: 11, to: 30 }),
} as const);


/** The price book's `PLATFORM_DOMAINS` row (BUILD §6.1): "reddit, quora,
 *  youtube, wikipedia, g2, capterra, medium, linkedin, producthunt,
 *  stackoverflow, … (closed list)". The row ends in an ellipsis, so these ten
 *  are the names it states, and no eleventh is invented here. */
export const PLATFORM_DOMAINS = Object.freeze([
  "reddit", "quora", "youtube", "wikipedia", "g2",
  "capterra", "medium", "linkedin", "producthunt", "stackoverflow",
] as const);

/** SPEC §6, right-sizing law: a target is offered only if it is winnable *for
 *  this site's presence*. Two proportions, both scaled by the site's own
 *  ranked count (its footprint, §0):
 *
 *  - **Competition** — `qualify*` / `near*`: at least one top-ten domain ranks
 *    for no more than `max(500, 5 × own)` keywords (Reach), `max(100, 2 × own)`
 *    (Winnable). Rivals' sizes against the site's own.
 *  - **Demand** — `demand*`: the search itself is no bigger than
 *    `max(300, 10 × own)` searches a month (Reach), `max(100, 2 × own)`
 *    (Winnable). Above the first it is outsized for the site and refused for
 *    every Write and Earn type — a site that ranks for three keywords is
 *    offered a 20/mo long-tail answer, never a 50,000/mo head term; a site
 *    that ranks for 30,000 is. The floors keep a site ranking for nothing
 *    supplied with small targets (the thin-market steps read down to 10/mo).
 *
 *  A target's band is the lower of the two. Competition still gates only
 *  `keyword_page`; demand gates every new target. Improve reads competition
 *  only — the site already ranks for that search.
 *
 *  - **Difficulty** — `difficulty*`: the vendor's own keyword difficulty
 *    (0–100, "difficulty of ranking in the first top-10 organic results", log
 *    scale) may be no higher than `30 + 10 × log10(1 + own)` (Reach),
 *    `15 + 10 × log10(1 + own)` (Winnable), never above 100. A search harder
 *    than the first is outsized exactly as a search too big is. Where the
 *    vendor gives no difficulty the search is read on volume and competition
 *    alone.
 *
 *  The cold-start demand floors are low enough that a broad head term is never
 *  offered to a site ranking for three keywords. The numbers are
 *  owner-correctable defaults. */
export const WINNABILITY = Object.freeze({
  qualifyFloor: 500, qualifyMultiple: 5, nearFloor: 100, nearMultiple: 2,
  demandFloor: 300, demandMultiple: 10, demandNearFloor: 100, demandNearMultiple: 2,
  difficultyFloor: 30, difficultyNearFloor: 15, difficultyPerDecade: 10, difficultyMax: 100,
} as const);

export const RIVAL_SIZE_BANDS = Object.freeze({
  nearFloor: 100, nearMultiple: 2, middleFloor: 500, middleMultiple: 5,
} as const);

/** How far a paid pass goes in sizing the rivals **its own twelve top
 *  tens** hold. A drafted default the owner may correct.
 *
 *  `candidatesMax` — one candidate per question the pass may ask
 *  (`BATTERY.QUESTIONS` is the same number and bounds a different thing, so
 *  it is not reused): enough that every question's top ten can contribute a
 *  domain to band against, and no more. At `PRICE_BOOK.RANKED_RIVAL_COST_C` a
 *  first pass therefore spends at most 28.8¢ on this, well inside
 *  `CAPS.DEEP_C`; every later pass re-reads the same domains inside the
 *  30-day rival window, where a cache hit is free. A candidate
 *  `TYPING_RESERVE_C` leaves no room for is recorded `unsized` with
 *  `budget_reached`, never guessed at. */
export const SERP_RIVAL_SIZING = Object.freeze({
  candidatesMax: 12,
} as const);

/** What a paid pass's measurement may not spend of its cap (SPEC §0): the
 *  stages stop at the cap less this, and the derivation after the stored
 *  report spends from it. Sized to reservations, since the cap checks
 *  reservations. A pass types its opportunities out of the same cap after its
 *  report is stored, and four Haiku calls at `INFERENCE_PRICE_BOOK.haiku`
 *  come to about a cent. The peak is the fit judgement's one-attempt
 *  reservation (`INFERENCE_ATTEMPTS`): its input plus
 *  `INFERENCE_MAX_OUTPUT_TOKENS["topic-fit"]` at the Sonnet price, about 5.9¢
 *  at a 4–5k-token input, after the buyer searches and their check have
 *  settled about 0.4¢. Eight covers a fit input of up to about 9.9k tokens. */
export const TYPING_RESERVE_C = 8;

/** SPEC §6 (D64; a drafted default the owner may correct): how many of a
 *  site's rivals one weekly pass sizes again. A sizing is kept 30 days, and a
 *  site's five rivals are usually first sized on one day, so they fall due
 *  together: 12¢ in one week, which with the rest of a weekly pass is over
 *  `CAPS.WEEKLY_C`. One a week keeps every weekly pass under its cap; the
 *  others keep the size they had, dated, until their week. A deep pass and a
 *  re-measure size every rival that is due. */
export const WEEKLY_RIVAL_RESIZES = 1 as const;

export const COHERENCE = Object.freeze({                    // BUILD §6.7 step 5
  minMeasuredSearches: 3, shareDivisor: 4, minAppearances: 2,
} as const);

export const CORRECTION = Object.freeze({
  perScan: 1, retries: 1, offerMaxAgeDays: 7,
} as const);

// ── Rival derivation and the presence card — BUILD §6.6
/** The price book's `RIVAL_SCORE` row: "top10Appearances + 2×aiCitations".
 *  The two weights, never the formula, which is
 *  `src/lib/market/rivals/derive.ts`'s. The AI weight is the larger because
 *  "cited-by-AI weighs double". */
export const RIVAL_SCORE = Object.freeze({                    // BUILD §6.1 · §6.6
  top10Weight: 1, aiCitationWeight: 2,
  /** A drafted default the owner may correct: how many of a pass's searches
   *  must find a domain — in the top ten, the local pack or an AI answer —
   *  before it is a rival. A place in a local pack stands on one. */
  minSearches: 2,
} as const);

/** Of the searches the customer is absent from, "up to five of the biggest
 *  are listed". Deliberately not `BATTERY.COMPETITORS_MAX`, which holds the
 *  same number and bounds a different thing — how many rivals a customer may
 *  track. */
export const ABSENT_FROM_MAX = 5 as const;
