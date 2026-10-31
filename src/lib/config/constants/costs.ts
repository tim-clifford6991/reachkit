// src/lib/config/constants/costs.ts — vendor and model prices, spend ceilings, the plan's price, the job runner and account lifetimes. Imports nothing.

// ── Price book, caps, battery, location — BUILD §6.1
export const PRICE_BOOK = Object.freeze({
  RANKED_FREE_ROWS: 50, RANKED_FREE_COST_C: 1.8,
  RANKED_PAID_ROWS: 300, RANKED_PAID_COST_C: 4.8,
  RANKED_RIVAL_ROWS: 100, RANKED_RIVAL_COST_C: 2.4,
  COMPETITORS_DOMAIN_COST_C: 1.5, SUGGESTIONS_COST_C: 1.8,
  SERP_LIVE_C: 0.2, SERP_STD_C: 0.06,
  /** The queue at the vendor's high priority (SPEC §6): twice the normal
   *  queue's price, charged on each task posted. A free scan's and a first
   *  pass's Google reads. */
  SERP_STD_HIGH_C: 0.12,
  /** Google News, live, ten results (SPEC §7, D48): the vendor's own charge,
   *  0.2 cents a call. */
  NEWS_LIVE_C: 0.2,
  /** Labs keyword overview (SPEC §6, D49): the vendor's list price, one cent
   *  a request and a hundredth of a cent a keyword. */
  KEYWORD_OVERVIEW_REQUEST_C: 1, KEYWORD_OVERVIEW_KEYWORD_C: 0.01,
  /** Google AI Mode, live: the vendor's list price, 0.4 cents a page, twice a
   *  live organic read. The deep pass buys it: its twelve and its market
   *  prompts (`BATTERY.QUESTIONS + BATTERY.MARKET_PROMPTS`) are 20 asks, 8
   *  cents of `CAPS.DEEP_C`'s 150. */
  AI_MODE_LIVE_C: 0.4,
  CHATGPT_SCRAPE_STD_C: 0.12, AI_MODE_STD_C: 0.12,
  /** One page as a browser draws it (SPEC §6): On-Page instant pages with
   *  JavaScript on, 0.15 cents a page; the read of the HTML it kept is free. */
  RENDERED_PAGE_C: 0.15,
  /** The account's balance, `GET /v3/appendix/user_data`: "Your account will
   *  not be charged for using this API" (https://docs.dataforseo.com/v3/appendix/user_data/). */
  USER_DATA_C: 0,
} as const);

/** The four per-scan/per-draft ceilings BUILD §6.1 pins, plus the per-site
 *  daily one. The product-wide daily ceiling is `DAILY_PRODUCT_CEILING`
 *  below, because it is not one figure.
 *
 *  `DAILY_SITE_C` bounds one site for the same UTC day, so a single site in a
 *  retry loop cannot consume the product's shared ceiling and refuse every
 *  other customer's pass, draft and publish until midnight. It is read over
 *  the same ledger, for every paid call made against a scan row that carries
 *  a `site_id`; a free scan has no site and is bounded by `FREE_BOUNDS`.
 *  A drafted default the owner may correct, sized from two readings:
 *   - one deep pass (`DEEP_C` 150¢) plus a week of drafts (7 x `DRAFT_C` =
 *     315¢) is 465¢;
 *   - the largest day SPEC §6 allows a site, 3 deep passes in 24 hours (450¢)
 *     and the day's one draft (45¢), is 495¢.
 *  500¢ covers both, and is half the product's smallest day (1000¢), so one
 *  runaway site never takes the whole of it.
 *
 *  The UTC day and not the site's, because the two figures are read off one
 *  ledger in one call, and a site-local day would make "today" mean two
 *  different windows inside a single refusal. */
export const CAPS = Object.freeze({
  FREE_C: 12, DEEP_C: 150, WEEKLY_C: 40, DRAFT_C: 45,
  DAILY_SITE_C: 500,
} as const);

/** The product-wide ceiling for one UTC day, in cents: `baseC` plus
 *  `perPayingSiteC` for each site with active access at the day's start, so
 *  the guard against a runaway grows with the customers it serves instead of
 *  being reached on an ordinary Monday. An unreadable count is `baseC`,
 *  never unlimited. */
export const DAILY_PRODUCT_CEILING = Object.freeze({ baseC: 1000, perPayingSiteC: 100 } as const);

/** The two crossings of the day's product ceiling the owner is told about, as
 *  fractions of it: four fifths, and the ceiling itself. Fractions rather
 *  than cent figures, so the warning cannot drift away from the ceiling it
 *  warns about. */
export const SPEND_ALERT_AT = Object.freeze({ warn: 0.8, ceiling: 1 } as const);

/** When the owner is told DataForSEO credit is running out: fewer days left
 *  than `runwayDays` at the trailing week's spend, or under `floorC` cents,
 *  since at zero every draft fails. Two weeks, so a failed auto-recharge
 *  still leaves time for a top-up by hand. */
export const VENDOR_LOW = Object.freeze({ runwayDays: 14, floorC: 1000 } as const);

/**
 * US dollars for one euro.
 *
 * Every figure the product records is a US cent, the currency both vendors
 * bill in. The one euro figure is the testing budget's two euros a day
 * (`docs/PROCESS.md`, *Testing budget*), and `npm run costs` converts it
 * with this rate to judge the day.
 *
 * `rate` is the European Central Bank's euro foreign exchange reference
 * rate for `asOf`: https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml.
 * It is a pin, not a feed. Set it again when the dollar has moved by more
 * than a few per cent, with the new date.
 */
export const USD_PER_EUR = Object.freeze({
  rate: 1.1206,
  asOf: "2026-10-09",
  source: "ECB euro foreign exchange reference rate",
} as const);

/** The testing budget (`docs/PROCESS.md`, *Testing budget*), in euros: two a
 *  day across all live testing, judged on what the vendors billed where it
 *  is known, with a warning at one and a half. Read by `npm run costs` and the
 *  owner's cost page. */
export const TEST_DAY_EUR = Object.freeze({ cap: 2, warn: 1.5 } as const);

/** What one site's month brings in, in euro cents, net of sales tax:
 *  `PRICE_EUR_CENTS` with 21% tax taken out. The owner's cost page sets each
 *  site's monthly cost against it. */
export const PLAN_NET_EUR_CENTS = 4050 as const;

/** Per-token model prices, cents per million tokens. `costCents` for one call
 *  is `tokensIn/1e6 * inCentsPerM + tokensOut/1e6 * outCentsPerM`, computed at
 *  the call site (`src/lib/llm/tiers.ts`): this file holds the price, never
 *  the formula.
 *
 *  `nano` and `haiku` both call `claude-haiku-4-5`, so they share one frozen
 *  row rather than a retyped copy and cannot drift apart. A genuinely cheaper
 *  nano model is a new row. */
const HAIKU_INFERENCE_PRICE = Object.freeze({ inCentsPerM: 100, outCentsPerM: 500 } as const);

export const INFERENCE_PRICE_BOOK = Object.freeze({
  nano: HAIKU_INFERENCE_PRICE,
  haiku: HAIKU_INFERENCE_PRICE,
  /** `claude-sonnet-4-6`'s list price per million tokens, in cents. Its one
   *  call is the pass's business-fit judgement (SPEC §6): about 5¢ a site,
   *  once a pass. */
  sonnet: Object.freeze({ inCentsPerM: 300, outCentsPerM: 1500 } as const),
  /** `claude-sonnet-5`'s list price per million tokens, in cents: the tier a
   *  customer's page and its critic are written on (SPEC §7, *Length and the
   *  writer*). 2 US dollars in and 10 out per million tokens, the standard
   *  price on https://platform.claude.com/docs/en/about-claude/pricing. */
  writer: Object.freeze({ inCentsPerM: 200, outCentsPerM: 1000 } as const),
} as const);

/** The wall clock one `llm()` call may hold, per tier, in milliseconds: the
 *  whole call, every attempt inside it included.
 *
 *  `nano` is 15 000 because a structured call to `claude-haiku-4-5` from a
 *  cold serverless function does not answer inside 3 s.
 *
 *  The budget is the call and not the attempt because how many attempts
 *  `llm()` spends is its own retry policy, which no caller can see, so one
 *  budget per call is the only figure the pass's arithmetic can be written
 *  from: `FREE_PASS_INFERENCE_CALLS` × `nano` = 30 s of the 60 the platform
 *  allows the free pass's invocation (`maxDuration`,
 *  `src/app/api/scan/route.ts`), leaving the other 30 to everything else that
 *  pass buys. `tests/llm/budget.test.ts` asserts that arithmetic against
 *  these pins and the route's own literal. */
export const INFERENCE_TIMEOUT_MS = Object.freeze({
  nano: 15_000, haiku: 20_000,
  /** One judgement over every candidate of a pass: a longer answer on a
   *  slower model, made once, in the paid pass's derivation step and never on
   *  the free path. */
  sonnet: 60_000,
  /** One call that writes a whole page, or fixes one (SPEC §7, D41): up to
   *  8 192 output tokens on Sonnet 5. The draft job's invocation is bounded
   *  by `TIMING.jobsCeilingS`; `PIPELINE.fixBeforeMs` keeps the fix call
   *  inside it. */
  writer: 120_000,
} as const);

/** The vendor SDK's own retry layer, off. `@anthropic-ai/sdk` defaults
 *  `maxRetries` to 2, which would make every `llm()` attempt three requests
 *  and three times the wall clock `INFERENCE_TIMEOUT_MS` reads as. `llm()`
 *  (`src/lib/llm/index.ts`) owns the one retry policy; this is passed to the
 *  vendor client explicitly so the total attempt budget is a number a reader
 *  can add up rather than a default they must know. */
export const INFERENCE_MAX_RETRIES = 0 as const;

/** The most output one `llm()` call may generate, per call site, in tokens:
 *  carried to the vendor as the request's own `max_tokens` and used for the
 *  up-front cost reservation (`src/lib/llm/index.ts`). Keyed by call site
 *  because the site, not the tier, decides how long an answer can honestly
 *  be. The key set is the closed call-site list: `llm()`'s `site` is typed as
 *  these keys, so a call site with no budget does not compile.
 *
 *  Each figure is the smallest the site's schema can need with headroom, at
 *  ~4 chars per token, so a long answer cannot spend the call's time budget
 *  and leave none for the retry:
 *  - `profile` — seven fields, three short strings and four lists capped
 *    by `PROFILE_LIST_BOUNDS` (27 short strings at most): ~300 needed; the
 *    offerings, kind and reach: ~120 more.
 *  - `question-phrasing` — at most `BATTERY.QUESTIONS` `{ id, text }`
 *    pairs of one question each: ~30 a pair, ~360 needed.
 *  - `opportunity-typing` — `{ type, slug, title }`: ~60 needed.
 *  - `generate.write`, `generate.fix` — a whole page in parts (SPEC §7, D41).
 *  - `generate.fit_check` — `{ unsupported: { index, claims }[] }`, a few
 *    words a sentence, and few sentences on a page that fails: ~20 each. */
export const INFERENCE_MAX_OUTPUT_TOKENS = Object.freeze({
  /** Up to four offerings (a name, a category, a weight), a kind and a reach
   *  beside the seven fields: ~120 more. */
  profile: 900,
  "question-phrasing": 800,
  "opportunity-typing": 256,
  /** `{ pairs: { search, sameAs }[] }` over at most the pass's candidates:
   *  ~25 a pair. */
  "topic-same-question": 512,
  /** `{ scores: { i, fit, title }[], strongest: number[] }` over at most
   *  `TOPIC_FIT.maxCandidates` searches: ~12 a score, ~25 a title on the
   *  ones scored 2 or 3. */
  "topic-fit": 3072,
  /** `{ problems: string[], solutions: string[] }`, at most
   *  `BUYER_SEARCHES.max` searches of under ten words: ~15 each. */
  "topic-buyer-searches": 700,
  /** `{ typed: number[] }` over at most `BUYER_SEARCHES.maxChecked`
   *  indexes: ~4 each. */
  "topic-typed": 400,
  /** SPEC §7 (D41, stage 3): the whole page in one call — its title, short
   *  answer, takeaways, every section, closing line and buyer questions. A
   *  2,500-word comparison is about 3,600 tokens of prose; 8 192 leaves the
   *  parts' framing room. `generate.fix` is the one fix call of stage 4 and
   *  returns the page whole again. */
  "generate.write": 8192,
  "generate.fix": 8192,
  /** The lead's free first page (SPEC §2): the same write call, sized so the
   *  seam's reservation — two attempts — fits `CAPS.FREE_C`. 3 072 tokens is
   *  a page of about 1,800 words in parts; a lead's page is a Q&A or a
   *  documentation page, at most 1,500. */
  "generate.write_free": 3072,
  /** The claims read off at most `RESEARCH.pagesPerCall` public pages — up to
   *  `RESEARCH.claimsPerPage` quotations of a sentence or two each, ~60
   *  tokens a claim. */
  "generate.research": 2560,
  /** `{ results: { result, about }[] }` over at most
   *  `RESEARCH.recentJudged` news results: ~12 a result. */
  "generate.news_fit": 400,
  "generate.fit_check": 512,
  /** The site profile's one call (SPEC §2): the site name, its products and
   *  claims, and the five-member brand-voice summary with the paragraph the
   *  customer reads. Prose the customer edits, not a set of tokens: an answer
   *  with every list the schema allows filled is ~800 tokens, and a smaller
   *  pin truncates the forced tool's input and stores `voice: null` on a site
   *  that read fine. Paid only, never on the free pass
   *  (`FREE_PASS_INFERENCE_CALLS`); two attempts at 1 200 reserve 1.2¢.
   *  `tests/site-profile/your-voice.test.tsx` holds a full answer to this pin. */
  "site-profile": 1200,
  /** SPEC §9: a page's own title and meta description, rewritten —
   *  `{ title, description }`, two short strings: ~80 needed. */
  "generate.page_fix": 256,
  /** The market ReachKit concludes for a site — seven fields, the longest a
   *  sentence: ~450 needed. */
  "market-inference": 900,
  /** Its rivals — up to ten candidates of nine fields with a reason each. A
   *  German reason takes more tokens than an English one, and a cut-off answer
   *  is cut at the same place on the temperature-0 retry, so the pass would
   *  pay to conclude no rival at all. English sites answer in about 1,300. */
  "rival-inference": 2400,
  /** SPEC §6 (D49): a market's candidate search terms — up to ten short
   *  phrases with a flag each: ~250 needed. */
  "market-terms": 500,
  /** SPEC §6 (D65): one verdict for each search a pass is about to measure —
   *  up to 24 short objects: ~450 needed. */
  "market-searches": 900,
  /** SPEC §5: one page's share of the knowledge base — eight short lists
   *  bounded by `KNOWLEDGE_BASE.PAGE_ITEMS`, each item a phrase or one
   *  sentence: ~900 needed on a full pricing page. */
  "site-knowledge": 1400,
} as const);

/** A call site's sampling temperature, where it has one pinned. Absent, the
 *  vendor's default (1.0) stands. The market a site is measured in must not
 *  change because one call drew a different sample: a market is replaced
 *  only on a conclusion seen twice, which a sampled answer would rarely give. */
export const INFERENCE_TEMPERATURE: Readonly<Partial<Record<keyof typeof INFERENCE_MAX_OUTPUT_TOKENS, number>>> =
  Object.freeze({
    "market-inference": 0,
    "rival-inference": 0,
    "market-terms": 0,
    "market-searches": 0,
    "topic-fit": 0,
    "topic-buyer-searches": 0,
    "topic-typed": 0,
    // The same page read twice says the same thing about the business.
    "site-knowledge": 0,
  });

/** A call site asked fewer times than the seam's two, where a retry buys
 *  nothing: a temperature-0 answer asked again is the same answer; what it
 *  missed is asked again next pass. */
export const INFERENCE_ATTEMPTS: Readonly<Partial<Record<keyof typeof INFERENCE_MAX_OUTPUT_TOKENS, 1>>> = Object.freeze({
  "topic-fit": 1,
  "rival-inference": 1,
});

export const CACHE_WINDOWS_D = Object.freeze({
  own: 7, rival: 30, serp: 30, suggestions: 30,
  /** The news search of *current insights* (SPEC §7, D48): what a market
   *  published is asked once a day at most. */
  news: 1,
  /** The weekly target re-check's SERP window, the exception to `serp`, so a
   *  re-check run to detect movement is never served from a month-old cache
   *  wearing this week's date. */
  serpWeeklyRecheck: 7,
  /** The paid AI battery — AI Mode and the ChatGPT scraper — deliberately
   *  not 7. Weekly runs fire hourly on each site's own local Monday, so two
   *  runs are 168 hours apart or slightly less (a DST shift moves the local
   *  hour); at 7 days a run landing an hour early is served last week's
   *  answer. Six days leaves 24 hours of slack and still buys nothing twice
   *  inside one weekly cycle. `serpWeeklyRecheck` carries the same hazard at 7. */
  aiBattery: 6,
} as const);
export const EMAIL_CHANGE_TTL_H = 24 as const;
export const SIGNIN_LINK_TTL_H = 24 as const;
/** A sign-in link asked for again inside this many minutes is the same link (REQ-024 c4). */
export const SIGNIN_LINK_REUSE_MIN = 15 as const;
export const ERASURE_DAYS = 30 as const;
export const DANGER_TICKET_TTL_MINUTES = 30 as const;
export const EXPORT_DEADLINE_MS = 120_000 as const;
export const HOSTED_RETENTION_DAYS = 30 as const;
export const HOSTING_END_REMINDER_DAYS = 7 as const;
export const MAINTENANCE_TICK_MINUTES = 15 as const;

// ── Vendor client
/** The one endpoint whose vendor charge is data-dependent: `serpOrganic`
 *  with `loadAsyncAiOverview: true` reserves the base price times this
 *  multiplier — the vendor's own rule, "Add one base price" — and the ledger
 *  settles the documented charge read off the response
 *  (`src/lib/vendors/dataforseo/serp.ts`). Prices the reservation, never the
 *  customer-visible number. */
export const ASYNC_AIO_SURCHARGE_MULTIPLIER = 2 as const;

/** Vendor-side request shape the price book prices but does not name as a
 *  row of its own. `competitorsDomainRows` is the row count the 1.5¢ pin is
 *  derived from (task 1.2¢ + 25 × 0.012¢). The standard-queue figures are the
 *  vendor's published turnaround ("5 minutes on average · The target
 *  turnaround time is 45 minutes"): a `mode: "std"` call polls `task_get`
 *  every `stdQueuePollIntervalS` seconds and gives up — `unmeasured`, never a
 *  throw — at `stdQueueDeadlineMin`. */
export const VENDOR = Object.freeze({
  suggestionsRows: 50,          // BUILD §6.1: "SUGGESTIONS_COST | 1.8¢ / call @ 50 rows"
  competitorsDomainRows: 25,
  /** How deep an organic or news SERP is bought. A page past it is read
   *  from the site's ranked rows. */
  serpDepth: 10,
  stdQueuePollIntervalS: 10,
  stdQueueDeadlineMin: 45,
  /** How often a pass somebody is waiting for asks whether its queued Google
   *  read is ready (SPEC §6). High-priority tasks are ready 3–25 s after they
   *  are posted, so ten seconds between asks would spend most of a free scan's
   *  wait not looking. A `task_get` is free. */
  waitedQueuePollIntervalS: 2,
  /** The wall clock one vendor request may hold, in milliseconds. Every call
   *  takes this unless its call site names another. */
  requestAbortMs: 10_000,
  /** SPEC §6 (D63): what a paid pass's SERP request may hold. Live reads
   *  answer in 6–10 s and a share of them pass the 10 s bound, each billed.
   *  A free scan keeps `requestAbortMs`. */
  paidSerpAbortMs: 30_000,
  // No shorter free-path bound: these calls take longer than five seconds, and an aborted call is still billed.
  /** The shape of the payload `ranked_keywords` caches, as a number that is
   *  part of that call's cache key. Version 2 carries the vendor's own
   *  `total_count` beside its rows; reading an older bare array back as
   *  `{ rows, total }` would report every cached rival as having no rows.
   *  Bumping it retires old entries by never asking for them again — nothing
   *  is deleted, which is this seam's rule everywhere. */
  rankedPayloadVersion: 2,
} as const);

// ── The job runner — BUILD §11
/** The fixed fan-out bound: no job fans out across customers inside one
 *  invocation past a fixed concurrency, so a slow site never starves the rest
 *  of Monday. Ten is wide enough that a Monday's fan-out is not serialised
 *  behind one slow site and narrow enough that one tick cannot open more
 *  vendor work than the cost seam's caps were sized for. */
export const JOB_FAN_OUT_CONCURRENCY = 10 as const;
/** How many per-site runs of one job go at once, across every site; one
 *  site runs one at a time whatever the job. */
export const JOB_SUBJECT_CONCURRENCY = 5 as const;
/** Per-site runs that call a model start at most this often, so a zone's
 *  due hour does not arrive at the model vendor as one burst. */
export const LLM_RUN_THROTTLE = Object.freeze({ limit: 10, periodSeconds: 60 } as const);

// ── Payments — BUILD §13
/** The price, in minor units of its currency: the three pins the Stripe
 *  Price object is built from and checked against. Minor units because that
 *  is what the payment vendor's own Price object carries, so no caller ever
 *  multiplies by a hundred.
 *
 *  No sentence about the price lives here. What a founder reads is
 *  `PRICE_COPY_KEYS`' three keys in the copy registry, and this file holds
 *  no key and no currency sign — `tests/config/constants.test.ts` asserts
 *  both. */
export const PRICE_EUR_CENTS = 4900 as const;
export const PRICE_CURRENCY = "eur" as const;
export const PRICE_INTERVAL = "month" as const;

/** How long after a completed payment nobody has signed in before the
 *  address is written to again. Deliberately not `MAINTENANCE_TICK_MINUTES`,
 *  which holds the same number and bounds how often the tick that notices
 *  runs: a five-minute tick would not change when a founder is chased. */
export const PAYMENT_CHASE_MINUTES = 15 as const;
/** How long after a completed payment with no account opened before the
 *  backstop opens one from the payment alone. Deliberately not
 *  `PUBLISH_VERIFY_DELAY_H`, which also holds 24 and bounds a publication
 *  check. */
export const PAYMENT_BACKSTOP_H = 24 as const;
