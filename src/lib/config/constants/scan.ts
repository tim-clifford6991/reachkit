// src/lib/config/constants/scan.ts — reading a site, the free and paid pass bounds, scoring and the report. Imports nothing.

/**
 * The knowledge base's bounds — SPEC §5. Drafted defaults the owner may
 * correct.
 *
 * `MAX_PAGES` is how many pages one read asks about, the most informative
 * first (`site-profile/knowledge/priority.ts`), so the read's cost does not
 * grow with the site. Twenty pages hold the home page, the pricing, product
 * or service, about, FAQ and location pages of a site of any size.
 *
 * `PAGE_INPUT_CHARS` is how much of one page's cleaned prose a call
 * carries: a pricing or features page is rarely longer, and at ~4
 * characters a token it is 2,000 tokens of input, 0.2¢. `BUDGET_C` is the
 * most one pass spends on the whole read, a tenth of `CAPS.DEEP_C`: a page
 * is asked about only while the budget still holds the most that page can
 * cost, so the read never ends above it. `STEP_MS` is the step's own
 * clock, inside the 300 s a job invocation has. A page whose text has not
 * changed since the last read is not asked about again.
 *
 * `PAGE_ITEMS` bounds what one page may answer with, per list,
 * `PAGE_QUESTIONS` how many buyer questions one page may hold once its own
 * FAQ is added, and `ITEMS` what the whole base keeps per list once the
 * pages are merged.
 */
export const KNOWLEDGE_BASE = Object.freeze({
  MAX_PAGES: 20,
  PAGE_INPUT_CHARS: 8_000,
  PAGE_MIN_CHARS: 200,
  CONCURRENCY: 6,
  BUDGET_C: 15,
  STEP_MS: 200_000,
  PAGE_ITEMS: 8,
  PAGE_QUESTIONS: 20,
  ITEMS: 40,
  OFFERINGS: 12,
  ITEM_CHARS: 300,
  ANSWER_CHARS: 600,
  DEMO_PHRASES: 500,
  /** A site that serves an empty JavaScript shell (SPEC §6): the most pages
   *  one pass has the vendor draw, and the longest it waits for them. Twelve
   *  pages are 1.8 cents at `PRICE_BOOK.RENDERED_PAGE_C`. */
  RENDERED_PAGES: 12,
  RENDER_MS: 60_000,
} as const);

/** SPEC §2: how long a pass waits for the vendor's rendered read of a home
 *  page whose plain read was a bot-protection page. One ask, inside
 *  `reading_your_site`'s own ten seconds on the free path. */
export const CHALLENGE_RENDER_MS = 5_000;

/** Drafted defaults the owner may correct: a free pass's plain read of the
 *  home page gives up after `FREE_READ_MS`, and a home page that did not
 *  answer by then is asked once of the vendor's browser, waited on for
 *  `RENDER_MS` beside the ranked rows — so a slow site's rendered read and
 *  its listing in search both fit inside `reading_your_site`'s ten seconds.
 *  A paid pass keeps the fetcher's own eight seconds. */
export const SLOW_HOME = Object.freeze({
  FREE_READ_MS: 5_000,
  RENDER_MS: 3_500,
} as const);

/** SPEC §2: the one second read of a home page that answered with an error
 *  or a rate limit. It waits what the server's `Retry-After` asks, or
 *  `WAIT_MS` where it asks nothing, and is not made where the server asks for
 *  more than `MAX_WAIT_MS`: the wait is spent inside `reading_your_site`'s
 *  own ten seconds on the free path. */
export const HOME_RETRY = Object.freeze({
  WAIT_MS: 1_000,
  MAX_WAIT_MS: 3_000,
} as const);

/** SPEC §2: what a site's listing in search must hold before its market is
 *  read from it, where bot protection kept the reader off its own pages.
 *  Fewer ranked searches than `minSearches`, or fewer than `minDescriptive`
 *  that say anything beyond the brand's own name, is too thin to name a
 *  market, and the pass does not guess. `maxPages` and `snippetChars` bound
 *  what one profile call is sent. Drafted defaults. */
export const SEARCH_FOOTPRINT = Object.freeze({
  minSearches: 10,
  minDescriptive: 5,
  maxPages: 25,
  maxSearches: 100,
  snippetChars: 320,
} as const);

/** The most of the customer's own page text one `profile` call may carry,
 *  in characters of the prompt it is serialised into — home first, the
 *  pricing page in what remains, cut at a word boundary
 *  (`src/lib/market/questions/profile.ts`). An own document may be up to
 *  `OWN_DOCUMENT_MAX_BYTES`, so without this a large marketing site's
 *  reservation alone could pass `CAPS.FREE_C` (or the model's context window)
 *  and leave the profile, the market, the twelve and the AI answers
 *  unmeasured. 20 000 is ~5.3k tokens with the fixed instruction, at ~4 chars
 *  a token; `tests/scan/free/cost-bound.test.ts` adds the free pass up from
 *  the pins with it and holds the sum under `CAPS.FREE_C`. Only the prompt is
 *  bounded — the measurement reads the whole document. */
export const PROFILE_INPUT_MAX_CHARS = 20_000 as const;

/** The site profile's bounds — SPEC §2: up to 100 pages read from the
 *  sitemap and internal links, one run per scan, inside the existing egress
 *  caps and the 12¢ ceiling.
 *
 *  `MAX_PAGES` is the only place that number is written. `CRAWL_MS` is the
 *  crawl's share of the pass: the free pass runs under
 *  `TIMING.reportCeilingS`, and a crawl that spent the whole of it would leave
 *  the market, the twelve and the score unmeasured — so the crawl stops at its
 *  budget and records what it has. `CONCURRENCY` is what makes 100 documents
 *  fit that budget at all (one at a time at the fetcher's own 8 s timeout
 *  could not); it is small enough that the crawl is never the reason a
 *  customer's own server is slow. `PAGE_SAMPLE_CHARS` bounds what each page
 *  contributes to the voice prompt, the way `PROFILE_INPUT_MAX_CHARS` bounds
 *  the profile's: the prompt is bounded, the inventory reads every page it
 *  fetched.
 *
 *  `VOICE_INPUT_MAX_CHARS` is 4 000 and not the profile call's 20 000 because
 *  of the 12¢ ceiling: `llm()` reserves twice the estimated input plus the
 *  output pin, so a 20 000-character prompt alone would put the free pass
 *  over it. Four thousand characters is several pages of the customer's own
 *  prose, which is what reading a voice takes. */
export const SITE_PROFILE = Object.freeze({
  MAX_PAGES: 100,
  CRAWL_MS: 12_000,
  /** SPEC §5: the crawl holds at most 8 MB in total, and a site's
   *  `Crawl-delay` is honoured up to 1 s between reads — a longer one is
   *  applied as 1 s, and the time budget above then decides how much of the
   *  site that pace reaches. */
  CRAWL_MAX_BYTES: 8_000_000,
  CRAWL_DELAY_MAX_MS: 1_000,
  CONCURRENCY: 6,
  PAGE_SAMPLE_CHARS: 600,
  VOICE_INPUT_MAX_CHARS: 4_000,
  /** How much of an about or team page's visible text is kept, and how many
   *  such pages, to tell whether one names a page's author. */
  ABOUT_TEXT_CHARS: 6_000,
  ABOUT_PAGES: 3,
} as const);

/** SPEC §2: the one logo the free scan keeps per site, for the gallery at
 *  `/scans` and the landing's strip. It is read off the home document the
 *  crawl already holds, so choosing it costs nothing; fetching it is at most
 *  `MAX_TRIES` image reads inside one `BUDGET_MS`, and 0¢ — a read of the
 *  site's own server, like every other own-document read. `MAX_BYTES` keeps a
 *  stored logo small enough to serve from our own origin sixteen to a page;
 *  `MIN_ICON_PX` is what makes a declared `icon` "large" rather than a 16px
 *  favicon. */
export const SITE_LOGO = Object.freeze({
  MAX_TRIES: 2,
  BUDGET_MS: 3_000,
  MAX_BYTES: 65_536,
  MIN_ICON_PX: 96,
} as const);

/** SPEC §9's technical-issue checks over the crawled pages.
 *
 *  `SLOW_PAGE_MS`: a page is slow when the crawl's own fetch of its document
 *  took at least this long, and a second read of it did too (one slow read is
 *  a cold start as often as a slow page). It is the one speed signal that
 *  costs nothing beyond the crawl itself; a page served from the cache has no
 *  timing and is left out of the set the count is measured over.
 *
 *  `CRITICAL_PAGE_SHARE`: a per-page check is "Worth fixing" from one page
 *  and "Critical" once at least this share of the set it was measured over
 *  is affected. A site-wide fault (a `noindex` home page, no sitemap, an AI
 *  reader blocked) is "Critical" whenever it is present. */
export const SITE_ISSUES = Object.freeze({
  SLOW_PAGE_MS: 3_000,
  CRITICAL_PAGE_SHARE: 0.25,
} as const);

/** How many `llm()` calls one free pass issues: `profile` and
 *  `question-phrasing`, both `nano` (`src/lib/market/questions/profile.ts`
 *  and `…/phrase.ts`), one after the other inside the `reading_your_market`
 *  stage. Pinned so the budget arithmetic has a count to multiply the
 *  per-call budget by.
 *
 *  The free pass crawls and stores the site profile's inventory, but the
 *  profile's inference (voice, products, claims) is a third call that does
 *  not fit: two calls already hold 30 s of the 60 the platform allows the
 *  invocation (`INFERENCE_TIMEOUT_MS`), and `tests/llm/budget.test.ts` holds
 *  the pass to leaving half of it for the fetches, the SERPs and the battery.
 *  So the inference derives on the first paid pass and refreshes weekly. */
export const FREE_PASS_INFERENCE_CALLS = 2 as const;

export const BATTERY = Object.freeze({
  QUESTIONS: 12, TARGET_SERPS_MAX: 13, MEASURED_PAGES_MAX: 25, COMPETITORS_MAX: 5,
  /** The market's buyer prompts a deep pass asks AI Mode beside the twelve,
   *  so the rivals are concluded from answers in the market it measures
   *  (drafted default, the owner may correct it; 3.2¢ live). */
  MARKET_PROMPTS: 8,
} as const);

/** BUILD §11's free-path bounds, plus two that stop a script walking past
 *  them.
 *
 *  `scansPerIpPerHour`, `inFlightPerIp` and `scansPerDay` alone would let one
 *  network run 5 scans an hour for 24 hours — 120 scans, 1440¢ — and let one
 *  domain be claimed over and over from different networks, because the
 *  stored report that makes a repeat free is read at the report address and
 *  not by the admission order the API route calls.
 *
 *  The other two are drafted defaults the owner corrects:
 *   - **`scansPerIpPerDay: 20`.** Four hours at the hourly bound: 240¢,
 *     about a quarter of `DAILY_PRODUCT_CEILING.baseC` with no paying site.
 *     A visitor scanning their own site and a few rivals is in single digits.
 *   - **`scansPerDomainPerDay: 3`.** One domain's first scan, one
 *     "measure what's missing" and one "measure again" is every route the
 *     product itself offers into a fresh measurement of one address in a
 *     day; at 12¢ a scan the domain costs at most 36¢ however many
 *     networks ask for it. A correction re-measures inside the report and
 *     never through admission, so it does not spend one of the three. */
export const FREE_BOUNDS = Object.freeze({
  scansPerIpPerHour: 5, inFlightPerIp: 1, scansPerDay: 200,
  scansPerIpPerDay: 20, scansPerDomainPerDay: 3,
} as const);

export const TIMING = Object.freeze({
  // The design ceiling fires before the platform's, with margin to write the
  // partial report. The free pass runs inside the `POST /api/scan`
  // invocation, which the platform freezes at `platformCeilingS`; a design
  // ceiling above it could never fire, and the reader would see a failed scan
  // instead of the partial report. `tests/scan/ceilings-pins.test.ts` holds
  // the two in that order.
  //
  // 50 leaves ten seconds under the platform bound for the ending to be
  // decided and the partial report stored, and still clears the free pass's
  // two nano calls with room. `reportTargetS` is the p95 the pass aims at:
  // ten seconds under the ceiling, the same margin the ceiling keeps under
  // the platform's.
  reportTargetS: 40, reportCeilingS: 50, deepReleaseMin: 10, progressHeartbeatS: 30,
  /** How long after setup completes a site with no ended deep pass is
   *  re-sent one by `account/maintenance` — past the release deadline, so a
   *  pass that is merely slow has had its window — and how far back that look
   *  goes: the queue's own idempotency window, inside which a re-send is
   *  dropped for a pass already queued. */
  deepPassBackstopMin: 15, deepPassBackstopH: 24,
  /** The platform's own ceiling on the `POST /api/scan` invocation, in
   *  seconds — `export const maxDuration` on that route, which must stay a
   *  literal there because Next reads route segment config out of the
   *  source at build time. This is the same number, pinned where the engine
   *  can read it; `tests/scan/ceilings-pins.test.ts` reads the route source
   *  and fails if the two ever disagree. 60 is the plan this product
   *  deploys to (Hobby). */
  platformCeilingS: 60,
  /** The ceiling on one invocation of a job step on `/api/jobs`, in
   *  seconds — `export const maxDuration` on that route, a literal there
   *  for the same reason as above. Not `platformCeilingS`: the project runs
   *  fluid compute, whose default and plan ceiling is 300, and the onboarding
   *  pass's measurement step (every question's SERPs, ChatGPT and AI Mode
   *  reads, rival sizing, the extra seeds) runs in one invocation and does
   *  not fit in the free request path's 60. */
  jobsCeilingS: 300,
  /** The time ceiling on a paid pass's measurement (deep and weekly), in
   *  seconds — its own, never the free report's `reportCeilingS`, which is
   *  too short for twelve SERPs. The measurement step runs in one
   *  `/api/jobs` invocation, so the ceiling sits inside `jobsCeilingS` with
   *  room to compose and store the report before the platform freezes the
   *  invocation. */
  paidPassCeilingS: 240,
  /** How long before that ceiling a paid pass stops waiting on its asks
   *  (drafted default, the owner may correct it). A standard-queue ChatGPT
   *  task can wait minutes, so without a reserve the pass never scores,
   *  sizes its rivals or ends `complete`. An ask still queued here is that
   *  engine's unmeasured cell; the pass goes on to score inside its ceiling. */
  paidPassAskReserveS: 25,
  /** How many further job steps read the tracked-prompt answers a weekly
   *  pass paid for and stopped waiting on (drafted default, the owner may
   *  correct it). Each waits up to `paidPassCeilingS` inside its own
   *  invocation and buys nothing; three rounds give a task about a quarter
   *  of an hour from its post. */
  weeklyCollectRounds: 3,
  /** How long before `reportCeilingS` a free scan stops waiting for a
   *  queued Google read (SPEC §6): the time it keeps to score, compose and
   *  store the report inside its ceiling. A read still queued then is that
   *  search's unmeasured cell. */
  freePassAskReserveS: 5,
  /** How long a free report says it is still reading the searches its pass
   *  left unread (SPEC §2; drafted default, the owner may correct it). The
   *  `scan/finish-reads` job is delivered in seconds and reads inside
   *  `paidPassCeilingS`; a line past this window would be a promise nothing
   *  is keeping, so it goes and the report stands. */
  finishReadsNoticeS: 600,
  /** How long before `platformCeilingS` a free pass still running in its
   *  request marks its own row `failed`. Past the design ceiling a pass is
   *  only storing its partial report; one still going here is about to be
   *  frozen, and its `running` row would refuse the visitor's network until
   *  the sweep came round. The margin is the time that one guarded write
   *  needs; a report stored after it overwrites the failure with the truth. */
  requestBudgetMarginS: 3,
  /** How long past the platform's ceiling a free row still `running` has to
   *  be before the sweep (`src/lib/scan/stuck.ts`) calls it a ghost. The
   *  sweep keys on the platform bound, not the design one: a row at 50 s
   *  may be writing its partial report, while a row past the platform bound
   *  is frozen and nothing is coming back for it.
   *
   *  The margin covers what sits between the row's own clock and that
   *  freeze — `created_at` is written at admission, before the response and
   *  before `after()` hands the pass over — plus a partial-report write in
   *  flight at the moment of freezing. 30 s covers all of it, and costs
   *  nothing: the sweep runs on the maintenance tick
   *  (`MAINTENANCE_TICK_MINUTES`), so a wider margin never delays a row by
   *  more than the tick it would have waited for anyway. */
  sweepMarginS: 30,
  // A rival suggestion call is bounded so setup is never held on suggestions:
  // on timeout `SuggestionState` stays `none_found`. Seconds, like its neighbours.
  suggestCeilingS: 3,
} as const);

/** BUILD §5's four score bands, as lower bounds on a 0–100 score:
 *  "0–24 Invisible · 25–49 Hard to find · 50–74 Findable · 75–100 Dominant".
 *  Boundaries only — the four words are `SCORE_BANDS` in the copy registry,
 *  which is why this is named `SCORE_BAND_BOUNDS`. */
export const SCORE_BAND_BOUNDS = Object.freeze({
  invisible: 0, "hard-to-find": 25, findable: 50, dominant: 75,
} as const);

/** The score's numeric coefficients: "Answerability = shape of the home +
 *  measured pages, 0–100, floored at 1" and "`directAnswers` = question
 *  headings whose first block is 40–320 visible chars ÷ all headings × 100".
 *  The window is closed at both ends. `PRESENCE_FLOOR`
 *  (`src/lib/measure/score.ts`) is deliberately not a fourth member: equal to
 *  `answerabilityFloor` by coincidence of value, not by derivation. */
export const SCORING = Object.freeze({                    // BUILD §5
  directAnswerCharsMin: 40,   // inclusive
  directAnswerCharsMax: 320,  // inclusive
  answerabilityFloor: 1,
} as const);

/** The guard an automatic re-score's dry run must hold before the tick asks
 *  for the apply (SPEC §2; drafted default, the owner may correct it). A
 *  score that moves further than this, or a scored scan that loses its
 *  number, is a move nobody expected; the dry run is held for the master
 *  session to read, and nothing is written. */
export const RESCORE_GUARD = Object.freeze({
  maxScoreMove: 15,
} as const);

/** SPEC §0 and §2: how a score says how sure it is, and how Presence weighs
 *  its two halves. `z` is the Wilson interval's (95%) over the AI answers
 *  each rate is read from; a score whose range is wider than `roughWidth`
 *  points, or read from fewer than `closeMinReads` Google results, is a
 *  "rough estimate", else a "close estimate". "AI answered none" is only said
 *  over at least `noneMinReads` results read; fewer is AI not read.
 *  `searchWeight` and `aiWeight` are Presence's weighted mean, so one zero
 *  does not collapse it. Drafted defaults the owner may correct. Not in
 *  `SCORING`, which holds the score's three coefficients. */
export const SCORE_ESTIMATE = Object.freeze({
  z: 1.96,
  roughWidth: 8,
  closeMinReads: 6,
  noneMinReads: 4,
  searchWeight: 0.5,
  aiWeight: 0.5,
} as const);

export const SEVERITY_THRESHOLDS = Object.freeze({
  blocked_readers: Object.freeze({ mid: 1, high: 3 } as const),   // 0 = low; 1–2 mid; >= 3 high
  missing_pages: Object.freeze({ mid: 1, high: 10 } as const),
  unquotable_pages: Object.freeze({ mid: 1, high: 2 } as const),
} as const);

/** The answer readers (SPEC §9, D14): the crawlers an AI answer is drawn
 *  from. Googlebot is one of them — Google's AI answers need only a page that
 *  is indexed and may show a snippet. The blocked-readers count, the score's
 *  access gates and the robots fix lines read this list; the training
 *  crawlers are `AI_TRAINING_CRAWLERS`, and a site that turns those away has
 *  made a choice, not a fault. The hosted robots policy allows both lists by
 *  name. An empty list fails `tests/config/constants.test.ts`'s non-empty row. */
export const AI_READER_AGENTS = Object.freeze([              // SPEC §9 D14
  "Googlebot", "OAI-SearchBot", "Claude-SearchBot", "PerplexityBot",
] as const);

// The free path's own bounds — BUILD §6.4 and §11
export const FREE_RESCAN_WINDOW_D = 7 as const;              // BUILD §6.4
export const FAILURE_COOLDOWN_H = 24 as const;               // BUILD §6.4
export const MARKET_REMEASURE_H = 24 as const;               // an unread market on a ranked site, measured again at most this often
export const HOURLY_WINDOW_H = 1 as const;                   // BUILD §11 bounds
export const DAILY_WINDOW_H = 24 as const;                   // BUILD §11 bounds

/** How often a founder may have their market measured again now (SPEC §6),
 *  so it cannot be spammed. `perDay` counts every paid deep pass the site
 *  started in the last 24 hours, the onboarding pass included — each is a
 *  `DEEP` cap of spend, so three a day is a founder trying two broader
 *  categories after a thin first read, and never a loop. `runningHoldMin` is
 *  how long a started pass that has not ended is treated as still under way:
 *  one pass at a time, and a pass the platform lost stops blocking the next
 *  after it. */
export const REMEASURE = Object.freeze({                      // SPEC §6
  perDay: 3,
  runningHoldMin: 30,
  /** How long the side panel states a finished pass's end — done, failed or
   *  stopped — before it says nothing. Long enough to be read by a founder
   *  who stepped away while it ran. */
  endShownMin: 30,
  /** At most this many broader categories are offered. */
  suggestions: 3,
});

// ── Egress — BUILD §6.4
/** Bound on one DNS resolution inside `resolvesInDns()` (`src/lib/egress/dns.ts`).
 *  The fetch bound (8 s default, 15 s hard max) does not cover the bare
 *  "does this name resolve" question, which is asked where a human is
 *  waiting on a setup or settings form. A healthy resolver answers in well
 *  under a second; 5 s is long enough for a slow authoritative server and
 *  short enough that a hanging resolver never holds the form longer than
 *  a fetch would. */
export const DNS_TIMEOUT_MS = 5000 as const;                  // BUILD §6.4
/** The size cap on one read of the customer's own documents — the home page,
 *  its pricing page and the tier's extra pages (`src/lib/measure/own-fetch.ts`
 *  passes it as `safeFetch`'s `maxBytes`). Modern marketing home pages carry
 *  more than 2 MB of HTML in inline scripts and styles, which the fetcher's
 *  own 2 MB default refuses; vendor and rival reads keep that default. Above
 *  this cap the read is still refused, never truncated: a truncated document
 *  would mis-measure answerability. */
export const OWN_DOCUMENT_MAX_BYTES = 6_000_000 as const;     // BUILD §6.4

// Report removal on written request
/** The status a removed domain's report address serves. Gone, not Not Found:
 *  the address existed and its report was taken down at the domain owner's
 *  request, and the one written line served with it names the address that
 *  brings it back. */
export const REPORT_REMOVED_STATUS = 410 as const;
