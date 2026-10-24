// src/lib/config/constants/costs.ts — vendor and model prices, spend ceilings, the plan's price, the job runner and account lifetimes. Imports nothing.

// ── Price book, caps, battery, location — BUILD.md §6.1
export const PRICE_BOOK = Object.freeze({
  RANKED_FREE_ROWS: 50, RANKED_FREE_COST_C: 1.8,
  RANKED_PAID_ROWS: 300, RANKED_PAID_COST_C: 4.8,
  RANKED_RIVAL_ROWS: 100, RANKED_RIVAL_COST_C: 2.4,
  COMPETITORS_DOMAIN_COST_C: 1.5, SUGGESTIONS_COST_C: 1.8,
  SERP_LIVE_C: 0.2, SERP_STD_C: 0.06,
  /** The queue at the vendor's high priority (SPEC §6, 2026-10-08, issue
   *  1352): twice the normal queue's price, charged on each of the 30
   *  tasks posted that day. A free scan's and a first pass's Google reads. */
  SERP_STD_HIGH_C: 0.12,
  /** Google News, live, ten results (SPEC §7, D48; issue 1259): the vendor's
   *  own charge on the cost check of 2026-10-04, 0.2 cents a call. */
  NEWS_LIVE_C: 0.2,
  /** Labs keyword overview (SPEC §6, D49; issue 1270): the vendor's list
   *  price, one cent a request and a hundredth of a cent a keyword. */
  KEYWORD_OVERVIEW_REQUEST_C: 1, KEYWORD_OVERVIEW_KEYWORD_C: 0.01,
  /** Google AI Mode, live (issue 1231): the vendor's list price, 0.4 cents a
   *  page, twice a live organic read. The deep pass buys it: its twelve and
   *  its market prompts (`BATTERY.QUESTIONS + BATTERY.MARKET_PROMPTS`) are
   *  20 asks, 8 cents of `CAPS.DEEP_C`'s 150. */
  AI_MODE_LIVE_C: 0.4,
  CHATGPT_SCRAPE_STD_C: 0.12, AI_MODE_STD_C: 0.12,
  /** One page as a browser draws it (SPEC §6, issue 1374): On-Page instant
   *  pages with JavaScript on. The vendor charged 0.15 cents a page on the
   *  cost check of 2026-10-10, and nothing for the read of the HTML it kept. */
  RENDERED_PAGE_C: 0.15,
  /** The account's balance, `GET /v3/appendix/user_data`: "Your account will
   *  not be charged for using this API" (https://docs.dataforseo.com/v3/appendix/user_data/). */
  USER_DATA_C: 0,
} as const);

/** The four per-scan/per-draft ceilings BUILD §6.1 pins, plus the
 *  per-site daily one. The product-wide daily ceiling is
 *  `DAILY_PRODUCT_CEILING` below, because it is not one figure.
 *
 *  **`DAILY_SITE_C` — the ceiling on one site, for the same UTC day**
 *  (issue 885). The product's ceiling is shared by everyone, so it does
 *  not care *whose* spend reached it: a single site in a retry loop, or
 *  one whose market keeps failing and re-measuring, could consume the day
 *  and every other customer's pass, draft and publish was refused until
 *  midnight UTC. At one customer that is invisible; at fifty it is an
 *  outage nobody is told about. This is the missing per-site figure, read
 *  over the same ledger, for every paid call made against a scan row that
 *  carries a `site_id`. A free scan has no site and is bounded by
 *  `FREE_BOUNDS` instead.
 *
 *  Its size is the owner's to rule; this is the drafted default and the
 *  two readings it was sized from:
 *   - the shape issue 885 names — one deep pass (`DEEP_C` 150¢) plus a
 *     week of drafts (7 x `DRAFT_C` = 315¢) — is 465¢;
 *   - the largest day the product's own rules allow a site: SPEC §6's
 *     re-measure bound is at most 3 deep passes in 24 hours (450¢) and
 *     the day's page is one draft (45¢), which is 495¢.
 *   - 500¢ covers both, and is half the product's smallest day (1000¢),
 *     so one runaway site never takes the whole of it.
 *
 *  The same UTC day as the product's, and for the same reason the product
 *  ceiling keeps no customer's clock: the two figures are read off one
 *  ledger in one call, and a site-local day would make "today" mean two
 *  different windows inside a single refusal. */
export const CAPS = Object.freeze({
  FREE_C: 12, DEEP_C: 150, WEEKLY_C: 40, DRAFT_C: 45,
  DAILY_SITE_C: 500,
} as const);

/** The product-wide ceiling for one UTC day, in cents: `baseC` plus
 *  `perPayingSiteC` for each site with active access at the day's start
 *  (owner ruling D7, 2026-10-19), so the guard against a runaway grows with
 *  the customers it serves instead of being reached on an ordinary Monday.
 *  An unreadable count is `baseC`, never unlimited. */
export const DAILY_PRODUCT_CEILING = Object.freeze({ baseC: 1000, perPayingSiteC: 100 } as const);

/** The two crossings of the day's product ceiling the owner is told about
 *  (issue #329), as fractions of it: four fifths of the day's ceiling, and
 *  the ceiling itself. Fractions rather than two more cent figures, so the
 *  warning cannot drift away from the ceiling it warns about. */
export const SPEND_ALERT_AT = Object.freeze({ warn: 0.8, ceiling: 1 } as const);

/** When the owner is told DataForSEO credit is running out: fewer days left
 *  than `runwayDays` at the trailing week's spend, or under `floorC` cents,
 *  since at zero every draft fails. Two weeks, so a failed auto-recharge
 *  still leaves time for a top-up by hand. */
export const VENDOR_LOW = Object.freeze({ runwayDays: 14, floorC: 1000 } as const);

/**
 * US dollars for one euro (issue 1408, owner 2026-10-11).
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

/** D34's testing budget (`docs/PROCESS.md`, *Testing budget*), in euros: two a
 *  day across all live testing, judged on what the vendors billed where it
 *  is known, with a warning at one and a half. Read by `npm run costs` and the
 *  owner's cost page (issue 1478). */
export const TEST_DAY_EUR = Object.freeze({ cap: 2, warn: 1.5 } as const);

/** What one site's month brings in, in euro cents, net of sales tax:
 *  `PRICE_EUR_CENTS` with 21% tax taken out (issue 1478). The owner's cost
 *  page sets each site's monthly cost against it. */
export const PLAN_NET_EUR_CENTS = 4050 as const;

/** Per-token model prices, cents per million tokens. `haiku` is BP-005
 *  `## Public interface`, transcribed verbatim (rule 1.2 — data, not a
 *  chosen parameter): `haiku: { inCentsPerM: 100; outCentsPerM: 500 }`.
 *  `costCents` for one call is `tokensIn/1e6 * inCentsPerM + tokensOut/1e6
 *  * outCentsPerM`, computed at BP-009's own call site
 *  (`src/lib/llm/tiers.ts`), never here — this file holds the price, never
 *  the formula (rule 2.5).
 *
 *  **`nano` is Haiku's row, owner ruling 2026-09-11 (issue #517).** BP-005
 *  and BP-009 priced `nano` at 20 / 125 ¢ per MTok, a nano-class model the
 *  product never bought: both tiers call `claude-haiku-4-5`
 *  (`src/lib/llm/tiers.ts`), so every nano call was ledgered at a fifth of
 *  its cost and `CAPS.FREE_C` was checked against a price that does not
 *  exist. The owner ruled the row priced at Haiku's rate. It is the same
 *  frozen object as `haiku`'s, not a retyped copy, so the two tiers cannot
 *  drift apart; a genuinely cheaper nano model is a new ruling and a new
 *  row. */
const HAIKU_INFERENCE_PRICE = Object.freeze({ inCentsPerM: 100, outCentsPerM: 500 } as const);

export const INFERENCE_PRICE_BOOK = Object.freeze({
  nano: HAIKU_INFERENCE_PRICE,
  haiku: HAIKU_INFERENCE_PRICE,
  /** `claude-sonnet-4-6`'s list price per million tokens, in cents. The one
   *  call on it is the pass's business-fit judgement (SPEC §6, 2026-10-03,
   *  issue 1134): about 5¢ a site, once a pass. */
  sonnet: Object.freeze({ inCentsPerM: 300, outCentsPerM: 1500 } as const),
  /** `claude-sonnet-5`'s list price per million tokens, in cents — the tier
   *  a customer's page and its critic are written on (SPEC §7, 2026-09-29,
   *  *Length and the writer*; issue 1138). Checked on 2026-10-11 (issue
   *  1408) against https://platform.claude.com/docs/en/about-claude/pricing:
   *  2 US dollars in and 10 out per million tokens, which that page says is now the
   *  standard price and not an introductory one. */
  writer: Object.freeze({ inCentsPerM: 200, outCentsPerM: 1000 } as const),
} as const);

/** The wall clock one `llm()` call may hold, per tier, in milliseconds —
 *  the whole call, every attempt inside it included, never one attempt
 *  each. Not among the pins BP-005's own `## Public interface` lists —
 *  held here under the same "pins live in `constants.ts` and nowhere
 *  else" rule (rule 2.4, WO-026).
 *
 *  **`nano` raised from 3 000, issue #452.** BP-009's `## NFR budget`
 *  reads "p95 latency: nano ≤ 3 s, haiku ≤ 20 s", and 3 000 was
 *  transcribed from it. That figure is a budget the product wanted, not a
 *  latency the vendor offers: both tiers call `claude-haiku-4-5`
 *  (`src/lib/llm/tiers.ts`, 2026-09-04 correction) and a structured call
 *  to it from a cold serverless function does not answer inside 3 s. The
 *  M3 live run of 2026-09-10 (production at 57b3c29) is the measurement
 *  this pin moves on: every `profile` call it made was cut off — three
 *  attempts, 10.3 s, `parseOutcome: "unavailable"` every time — so no
 *  free scan on production has ever produced a market profile, and
 *  without one the report has no rivals, no AI-answer cells and no score.
 *  No p95 of a *completed* call exists to read yet, from that run or from
 *  the vendor's own published figures; 15 000 is the working assumption
 *  issue #452 states, and the next live run against production is what
 *  confirms or moves it (#317).
 *
 *  **Why the budget is the call and not the attempt.** BP-009 states its
 *  own budget over the pass rather than the attempt — "the free scan's
 *  **two** nano calls — `profile` and `question-phrasing` (BP-025
 *  decision 2) — sit inside the 60-second promise" — and how many
 *  attempts `llm()` spends inside one call is its own retry policy, which
 *  no caller can see. One budget per call is therefore the only figure
 *  the pass's arithmetic can be written from: `FREE_PASS_INFERENCE_CALLS`
 *  × `nano` = 30 s of the 60 the platform allows the invocation the
 *  pass runs in (`maxDuration`, `src/app/api/scan/route.ts`), leaving the
 *  other 30 to everything else that pass buys. `tests/llm/budget.test.ts`
 *  is that arithmetic, asserted against these pins and against the
 *  route's own literal. */
export const INFERENCE_TIMEOUT_MS = Object.freeze({
  nano: 15_000, haiku: 20_000,
  /** One judgement over every candidate of a pass (issue 1134): a longer
   *  answer on a slower model, made once, in the paid pass's derivation
   *  step and never on the free path. */
  sonnet: 60_000,
  /** One call that writes a whole page, or fixes one (SPEC §7, D41): up to
   *  8 192 output tokens on Sonnet 5. The draft job's invocation is bounded
   *  by `TIMING.jobsCeilingS`; `PIPELINE.fixBeforeMs` keeps the fix call
   *  inside it. */
  writer: 120_000,
} as const);

/** The vendor SDK's own retry layer, off — stated here rather than
 *  inherited (issue #452). `@anthropic-ai/sdk` defaults `maxRetries` to 2,
 *  so every `llm()` attempt was silently three requests and three times
 *  the wall clock `INFERENCE_TIMEOUT_MS` reads as: at `nano`'s old 3 000
 *  that is the 10.3 s the M3 live run spent reaching no profile at all.
 *  `llm()` (`src/lib/llm/index.ts`) already owns one retry policy —
 *  BP-009's "retried at most once" — and two stacked policies, one of
 *  them invisible, is the whole of the defect. This pin is what says the
 *  seam's is the only one, and it is passed to the vendor client
 *  explicitly so the total attempt budget is a number a reader can add
 *  up rather than a default they must know. */
export const INFERENCE_MAX_RETRIES = 0 as const;

/** The most output one `llm()` call may generate, per call site, in tokens —
 *  carried to the vendor as the request's own `max_tokens` and used for the
 *  up-front cost reservation in its place (`src/lib/llm/index.ts`). Keyed by
 *  call site because the site, not the tier, decides how long an answer can
 *  honestly be: a two-field verdict and a whole page are both `nano`/`haiku`
 *  calls. The key set *is* the closed call-site list — `llm()`'s `site` is
 *  typed as these keys, so a call site with no budget does not compile.
 *
 *  **Issue #462.** The seam used one 4 096 for every site, and the M3 live
 *  run 4b (2026-09-10) spent the whole 15 s `nano` budget generating one
 *  888-token profile that then missed its schema — leaving no time for the
 *  retry BP-009's policy promises. Each figure below is the smallest the
 *  site's schema can need with headroom, at ~4 chars per token:
 *  - `profile` — seven fields, three short strings and four lists capped
 *    by `PROFILE_LIST_BOUNDS` (27 short strings at most): ~300 needed; the
 *    offerings, kind and reach of issue 1454: ~120 more.
 *  - `question-phrasing` — at most `BATTERY.QUESTIONS` `{ id, text }`
 *    pairs of one question each: ~30 a pair, ~360 needed.
 *  - `opportunity-typing` — `{ type, slug, title }`: ~60 needed.
 *  - `generate.write`, `generate.fix` — a whole page in parts (SPEC §7, D41).
 *  - `generate.fit_check` — `{ unsupported: { index, claims }[] }`, a few
 *    words a sentence, and few sentences on a page that fails: ~20 each
 *    (issue 1136). */
export const INFERENCE_MAX_OUTPUT_TOKENS = Object.freeze({
  /** Issue 1454: up to four offerings (a name, a category, a weight), a
   *  kind and a reach beside the seven fields: ~120 more. */
  profile: 900,
  "question-phrasing": 800,
  "opportunity-typing": 256,
  /** `{ pairs: { search, sameAs }[] }` over at most the pass's candidates:
   *  ~25 a pair (issue #1131). */
  "topic-same-question": 512,
  /** `{ scores: { i, fit, title }[], strongest: number[] }` over at most
   *  `TOPIC_FIT.maxCandidates` searches: ~12 a score, ~25 a title on the
   *  ones scored 2 or 3 (issue 1134). */
  "topic-fit": 3072,
  /** `{ problems: string[], solutions: string[] }`, at most
   *  `BUYER_SEARCHES.max` searches of under ten words: ~15 each (issue
   *  1208). */
  "topic-buyer-searches": 700,
  /** `{ typed: number[] }` over at most `BUYER_SEARCHES.maxChecked`
   *  indexes: ~4 each (issue 1208). */
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
  /** Issue 1135: the claims read off at most `RESEARCH.pagesPerCall` public
   *  pages — up to `RESEARCH.claimsPerPage` quotations of a sentence or two
   *  each, ~60 tokens a claim. */
  "generate.research": 2560,
  /** Issue 1262: `{ results: { result, about }[] }` over at most
   *  `RESEARCH.recentJudged` news results: ~12 a result. */
  "generate.news_fit": 400,
  "generate.fit_check": 512,
  /** The site profile's one call (issue #577, SPEC.md §2 "The scan builds
   *  the site profile"): the site name, its products and claims, and the
   *  five-member brand-voice summary with the paragraph the customer
   *  reads. Larger than `profile`'s 700 because it answers with prose the
   *  customer edits, not a set of tokens. */
  /** **1 200, because 400 cut the answer off (issue 839).** The pin was
   *  400 while the free pass was to buy this call under its 12¢ ceiling;
   *  it never does (`FREE_PASS_INFERENCE_CALLS` below) — the call is paid
   *  only, under `CAPS.DEEP_C` and `CAPS.WEEKLY_C`. An answer with every
   *  list the schema allows filled is ~800 tokens, so at 400 the forced
   *  tool's input came back truncated, failed the schema twice, and the
   *  profile stored `voice: null` on a site that read fine. Two attempts
   *  at 1 200 output tokens reserve 1.2¢ — nothing either paid cap
   *  notices. `tests/site-profile/your-voice.test.tsx` holds a full answer to
   *  this pin. */
  "site-profile": 1200,
  /** SPEC §9 (#690): a page's own title and meta description, rewritten —
   *  `{ title, description }`, two short strings: ~80 needed. */
  "generate.page_fix": 256,
  /** #1185: the market ReachKit concludes for a site — seven fields, the
   *  longest a sentence: ~450 needed. */
  "market-inference": 900,
  /** #1185: its rivals — up to ten candidates with a reason each.
   *
   *  2400 since issue 1318. A candidate has grown from five fields to nine
   *  (D50's two, the closeness of issue 1314, and D67's `national`), and a
   *  German reason takes more tokens than an English one. At 1400 the
   *  Düsseldorf bakery's ten candidates were cut off at exactly the ceiling
   *  on both attempts — the retry is at temperature 0, so it is the same
   *  answer cut at the same place — and the pass paid 6.3¢ to conclude no
   *  rival at all. The three English panel sites of the same run answered
   *  in about 1,300. */
  "rival-inference": 2400,
  /** SPEC §6 (D49, issue 1270): a market's candidate search terms — up to
   *  ten short phrases with a flag each: ~250 needed. */
  "market-terms": 500,
  /** SPEC §6 (D65, issue 1303): one verdict for each search a pass is
   *  about to measure — up to 24 short objects: ~450 needed. */
  "market-searches": 900,
  /** SPEC §5 (2026-09-29, #1133): one page's share of the knowledge base —
   *  eight short lists bounded by `KNOWLEDGE_BASE.PAGE_ITEMS`, each item a
   *  phrase or one sentence: ~900 needed on a full pricing page. */
  "site-knowledge": 1400,
} as const);

/** A call site's sampling temperature, where it has one pinned (#1185).
 *  Absent, the vendor's default (1.0) stands, as it always has. The market
 *  a site is measured in must not change because one call drew a different
 *  sample: nine profile calls on reachkit.app's same two pages gave nine
 *  categories (#1159), and the stability rule of #1185 replaces a market
 *  only on a conclusion seen twice — which a sampled answer would rarely
 *  give. */
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
  /** `BUILD.md` §6.4's stated exception — "SERPs 30d (**except the weekly
   *  target re-check**)" — which had a clause and no pin (#75). The weekly
   *  target-SERP battery passes this instead of `serp`, so a re-check run
   *  to detect movement can never be served from a month-old cache wearing
   *  this week's date, and REQ-065's "measured once a week" cannot be met
   *  by a monthly measurement. Transcribed from the frozen corpus
   *  (`design`/BP-005 decision 3 addendum, BP-008 decision 4), which is
   *  where the 7 was ruled. */
  serpWeeklyRecheck: 7,
  /** §6.2's paid AI battery — AI Mode and the ChatGPT scraper. §6.4 names
   *  **no** window for it, so this is chosen here (rule 1.1) rather than
   *  transcribed, and it is deliberately not 7.
   *
   *  The battery is re-measured weekly, and ADR-060 triggers that hourly
   *  on each site's own local Monday — so two consecutive runs are 168
   *  hours apart *or slightly less* (a DST shift moves the local hour). At
   *  a 7-day window a run landing an hour early is served the previous
   *  week's answer and the week's measurement is last week's. Six days
   *  leaves 24 hours of slack, which is more than any shift or trigger
   *  drift, and still buys nothing twice inside one weekly cycle.
   *
   *  Reversal cost: one pin. Note the same hazard exists at 7 for
   *  `serpWeeklyRecheck` above, which is the archive's own ruling
   *  transcribed rather than this issue's to change. */
  aiBattery: 6,
} as const);
export const EMAIL_CHANGE_TTL_H = 24 as const;                // BP-061 d2 · REQ-077 c4
export const SIGNIN_LINK_TTL_H = 24 as const;                 // BP-061 d2 (chosen)
export const ERASURE_DAYS = 30 as const;                      // BP-063 · REQ-079 c7
export const DANGER_TICKET_TTL_MINUTES = 30 as const;         // BP-063
export const EXPORT_DEADLINE_MS = 120_000 as const;           // BP-062 (chosen) · REQ-078 c5
export const HOSTED_RETENTION_DAYS = 30 as const;             // BP-060 · REQ-076 c10
export const HOSTING_END_REMINDER_DAYS = 7 as const;          // BP-060 · REQ-076 c11
export const MAINTENANCE_TICK_MINUTES = 15 as const;          // BP-003 d1 · REQ-024 c5

// ── Vendor client (issue #23) — BUILD §6.1–§6.4, ADR-094
/** The one endpoint whose vendor charge is data-dependent (ADR-094 d3, d3a;
 *  DECISIONS 2026-09-03): `serpOrganic` with `loadAsyncAiOverview: true`
 *  **reserves** the base price times this multiplier — the vendor's own
 *  rule, "Add one base price" — and the ledger settles the documented
 *  charge read off the response (`src/lib/vendors/dataforseo/serp.ts`).
 *  Prices the reservation, never the customer-visible number. */
export const ASYNC_AIO_SURCHARGE_MULTIPLIER = 2 as const;      // ADR-094 d3 · d3a

/** Vendor-side request shape the price book prices but BUILD §6.1 does not
 *  name as a row of its own. `suggestionsRows` is §6.1's own "@ 50 rows";
 *  `competitorsDomainRows` is DATA-COSTS §1's
 *  "`competitors_domain` … 1.5¢ @ 25 rows" — the row count the 1.5¢ pin is
 *  derived from (task 1.2¢ + 25 × 0.012¢). The standard-queue figures are
 *  the vendor's own published turnaround ("5 minutes on average · The
 *  target turnaround time is 45 minutes", pricing page quoted in the
 *  archived RESEARCH-dataforseo-endpoints.md §2.1): a `mode: "std"` call
 *  polls `task_get` every `stdQueuePollIntervalS` seconds and gives up —
 *  `unmeasured`, never a throw — at `stdQueueDeadlineMin`. */
export const VENDOR = Object.freeze({                         // #23 · BUILD §6.1 · DATA-COSTS §1
  suggestionsRows: 50,          // BUILD §6.1: "SUGGESTIONS_COST | 1.8¢ / call @ 50 rows"
  competitorsDomainRows: 25,
  /** How deep an organic or news SERP is bought. A page past it is read
   *  from the site's ranked rows (issues 1518, 1537). */
  serpDepth: 10,
  stdQueuePollIntervalS: 10,
  stdQueueDeadlineMin: 45,
  /** How often a pass somebody is waiting for asks whether its queued
   *  Google read is ready (SPEC §6, 2026-10-08, issue 1352). High-priority
   *  tasks were ready 3–25 s after they were posted, so ten seconds between
   *  asks would spend most of a free scan's wait not looking. A `task_get`
   *  is free. */
  waitedQueuePollIntervalS: 2,
  /** The wall clock one vendor request may hold, in milliseconds (issue
   *  #539's bound, pinned here by issue 875 so a tier can carry its own).
   *  Every call takes this unless its call site names another. */
  requestAbortMs: 10_000,
  /** SPEC §6 (owner, D63, 2026-10-07, issue 1298): what a paid pass's
   *  SERP request may hold. Live reads answered in 6–10 s that week and
   *  20–40% met the 10 s bound, each billed. A free scan keeps
   *  `requestAbortMs`. */
  paidSerpAbortMs: 30_000,
  // Issue 877: **there is no free-path abort pin any more.** Issue 875 put
  // one here at 5 s on the owner's ruling, and the first free scan after it
  // shipped — `linear.app`, 2026-09-18 — aborted 5 of its 7 SERP calls and
  // was billed for every one of them, against 13% aborted before the
  // change. These calls take longer than five seconds, so the shorter bound
  // bought aborted-and-billed calls and a thinner report. Every tier asks
  // under `requestAbortMs` again, and the next value for it comes from the
  // durations now recorded on the ledger rows, not from a guess.
  /** The shape of the payload `ranked_keywords` caches, as a number that
   *  is part of that call's cache key (#117). It went to 2 when the call
   *  began carrying the vendor's own `total_count` beside its rows: an
   *  entry written under the old shape is a bare array, and reading one
   *  back as `{ rows, total }` would report every cached rival as having
   *  no rows at all. Bumping this retires those entries by never asking
   *  for them again — nothing is deleted, which is this seam's rule
   *  everywhere. */
  rankedPayloadVersion: 2,
} as const);

// ── The job runner — BUILD §11
/** The fixed fan-out bound BP-003 names: "No job fans out across customers
 *  inside one invocation past a fixed concurrency; a slow site never
 *  starves the rest of Monday." Chosen here as a parameter (rule 1.1 — an
 *  internal scheduling bound with no customer-visible consequence): ten is
 *  wide enough that a Monday's fan-out is not serialised behind one slow
 *  site and narrow enough that one tick cannot open more vendor work than
 *  the cost seam's caps were sized for. Reversal cost: one number. */
export const JOB_FAN_OUT_CONCURRENCY = 10 as const;           // BP-003 · BUILD §11
/** How many per-site runs of one job go at once, across every site; one
 *  site runs one at a time whatever the job. Reversal cost: one number. */
export const JOB_SUBJECT_CONCURRENCY = 5 as const;
/** Per-site runs that call a model start at most this often, so a zone's
 *  due hour does not arrive at the model vendor as one burst. */
export const LLM_RUN_THROTTLE = Object.freeze({ limit: 10, periodSeconds: 60 } as const);

// ── Payments (issues #33, #91) — BUILD §13
/** The price, in minor units of its currency. `BUILD.md` §13 states the
 *  amount ("49/mo flat", written there with its currency sign) and
 *  `DECISIONS.md`'s ADR-052 line names these three as the pins the Stripe
 *  Price object is built from and checked against. Minor units because
 *  that is what the payment vendor's own Price object carries, so no
 *  caller ever multiplies by a hundred.
 *
 *  No sentence about the price lives here. What a founder reads is
 *  `PRICE_COPY_KEYS`' three keys in the copy registry, and this file holds
 *  no key and no currency sign — `tests/config/constants.test.ts` asserts
 *  both. */
export const PRICE_EUR_CENTS = 4900 as const;                 // ADR-052 · REQ-022 c1, c4
export const PRICE_CURRENCY = "eur" as const;                 // ADR-052 · REQ-022 c4
export const PRICE_INTERVAL = "month" as const;               // ADR-052 · REQ-022 c1, c2

/** How long after a completed payment nobody has signed in before the
 *  address is written to again (REQ-024 c5). Deliberately not
 *  `MAINTENANCE_TICK_MINUTES`, which happens to hold the same number today
 *  and bounds a different thing — how often the tick that notices runs.
 *  The two move independently: a five-minute tick would not change when a
 *  founder is chased. */
export const PAYMENT_CHASE_MINUTES = 15 as const;             // REQ-024 c5
/** How long after a completed payment with no account opened before the
 *  backstop opens one from the payment alone (REQ-024 c6). Deliberately
 *  not `PUBLISH_VERIFY_DELAY_H`, which also holds 24 and bounds a
 *  publication check. */
export const PAYMENT_BACKSTOP_H = 24 as const;                // REQ-024 c6
