// src/lib/config/constants.ts — grouped, frozen, exhaustively asserted
//
// WO-006, cut from BP-005's `## Public interface`. One named group per
// source section; every group is `Object.freeze`d (and `as const` for its
// literal types) so nothing mutates a pin at runtime (BP-005 error
// behaviour). Imports nothing — every other module imports this one
// (`structure.md` rule 5, BP-005 module boundary).
//
// Two values BP-005 names in this file are deliberately absent, not
// guessed (rule 1.2):
//   - the removal address REQ-002 criterion 1 requires the free report to
//     name (BP-005 decision 3, `rests-on` — a customer-visible string, the
//     owner's under the decision-rights table, still outstanding).
//   - `WORDPRESS_STAMP_SLUG`, `PRICE_EUR_CENTS`, `PRICE_CURRENCY` and
//     `PRICE_INTERVAL` are declared in BP-005's current `## Public
//     interface` but are not part of WO-006's own enumerated file-plan
//     list or WO-007's consuming test plan; flagged to the planner rather
//     than added on this implementer's own authority (rule 4.2 — see the
//     WO-006 return for the full note).
//
// The nine band/severity words BP-005 decision 2 and decision 3's
// discharge route to BP-019 (`BAND_LABELS`, `SCORE_BANDS`, `SEVERITY`) are
// not here and never will be: this file holds counts and boundaries, never
// the customer-visible word.

// ── Price book, caps, battery, location — BUILD.md §6.1
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-05: `DRAFT_DUE_HOUR_LOCAL = 18` (site-local, ADR-060) and
//   `JOB_FAN_OUT_CONCURRENCY = 10` are pinned; revisit with the first weekly cost report. —
//   #86
//
// DECISIONS 2026-09-05: `RIVAL_SCORE` is pinned as its two weights (1 per top-10 appearance, 2
//   per AI citation), never as the formula; `constants.ts` holds prices and boundaries, not
//   formula shape. — #87/#88
//
// DECISIONS 2026-09-07: Vendor cache: the weekly target-SERP re-check has its own window
//   (CACHE_WINDOWS_D.serpWeeklyRecheck = 7d, the archive ruling transcribed); the SERP/AI
//   cache key carries the site id so a purchase is per customer as DATA-COSTS §5 states
//   (BP-008 d5), old shared entries are simply never asked for again; the paid battery has its
//   own window aiBattery = 6d, one day under the weekly cadence because the Monday trigger
//   lands hourly and two runs can be slightly under 168h apart. Owner may unify the two at 6d
//   — one pin. — #207
//
// DECISIONS 2026-09-10: The free pass's design ceiling is below the platform's by rule:
//   `TIMING.reportCeilingS` 50 s under `platformCeilingS` 60 (pinned to the route's
//   `maxDuration`), `reportTargetS` 40 s; the sweep keys on `platformCeilingS + sweepMarginS`
//   (30), never on the design ceiling. REQ-003 c5's 90 s is superseded on the pin; no plan
//   upgrade. — master, #456 (PR 461; BUILD §11)
//
// DECISIONS 2026-09-11: `INFERENCE_PRICE_BOOK.nano` is priced at Haiku's rate — both tiers
//   call `claude-haiku-4-5` — from one source; supersedes the 2026-09-10 "Pending, owner" nano
//   line. — owner, 2026-09-11 (master session, selector; #517)

export const PRICE_BOOK = Object.freeze({
  RANKED_FREE_ROWS: 50, RANKED_FREE_COST_C: 1.8,
  RANKED_PAID_ROWS: 300, RANKED_PAID_COST_C: 4.8,
  RANKED_RIVAL_ROWS: 100, RANKED_RIVAL_COST_C: 2.4,
  COMPETITORS_DOMAIN_COST_C: 1.5, SUGGESTIONS_COST_C: 1.8,
  SERP_LIVE_C: 0.2, SERP_STD_C: 0.06,
  CHATGPT_SCRAPE_STD_C: 0.12, AI_MODE_LIVE_C: 0.2, AI_MODE_STD_C: 0.06,
} as const);

/** The four per-scan/per-draft ceilings BUILD §6.1 pins, plus the
 *  product-wide one BUILD §6.5 does not yet name (issue #329).
 *
 *  **`DAILY_PRODUCT_C` — the ceiling on everything, for one UTC day.** The
 *  other four bound *one* pass; nothing bounded the sum, so the product's
 *  whole exposure was the per-scan cap multiplied by however many passes
 *  the day happened to bring. This is that missing number, in cents,
 *  measured over the ledger (`fetches.cost_cents`) for the UTC day.
 *
 *  Its size is read off the two figures the corpus already states, and is
 *  the master's under ship-then-steer — the owner's to rule:
 *   - the free path's own worst case at BUILD §11's bounds is
 *     `FREE_BOUNDS.scansPerDay * FREE_C` = 2400¢ (DATA-COSTS's own
 *     "worst-case daily exposure at the existing bounds" line is smaller
 *     again, being those same 200 scans at the ~6.3¢ a report actually
 *     costs rather than at its 12¢ cap);
 *   - 5000¢ leaves the free path the whole of that worst case and the same
 *     again for the paid loop — a deep pass is 150¢, a weekly refresh 40¢,
 *     a day of content 45¢ — so the ceiling is a guard against a runaway,
 *     never a bound the ordinary day approaches.
 *
 *  A UTC day, not a site-local one: this is one figure for the whole
 *  product, so there is no site whose clock it could keep (contrast
 *  `WEEK_START` / `WEEKLY_DUE_HOUR_LOCAL`, which are each a customer's). */
export const CAPS = Object.freeze({
  FREE_C: 12, DEEP_C: 150, WEEKLY_C: 40, DRAFT_C: 45,
  DAILY_PRODUCT_C: 5000,
} as const);

/** The two crossings of `CAPS.DAILY_PRODUCT_C` the owner is told about
 *  (issue #329), as fractions of it: four fifths of the day's ceiling, and
 *  the ceiling itself. Fractions rather than two more cent figures, so the
 *  warning cannot drift away from the ceiling it warns about. */
export const SPEND_ALERT_AT = Object.freeze({ warn: 0.8, ceiling: 1 } as const);

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
 *    by `PROFILE_LIST_BOUNDS` (27 short strings at most): ~300 needed.
 *  - `question-phrasing` — at most `BATTERY.QUESTIONS` `{ id, text }`
 *    pairs of one question each: ~30 a pair, ~360 needed.
 *  - `opportunity-typing` — `{ type, slug, title }`: ~60 needed.
 *  - `generate.brief` — two sentences and a list of points: ~400 needed.
 *  - `generate.outline` — one `{ heading, covers }` per point: ~600 needed.
 *  - `generate.draft`, `generate.answerability` — a whole page of
 *    Markdown; the seam's old ceiling, unchanged.
 *  - `generate.claim_check` — `{ matches, matchedIndex }`: ~20 needed. */
export const INFERENCE_MAX_OUTPUT_TOKENS = Object.freeze({
  profile: 700,
  "question-phrasing": 800,
  "opportunity-typing": 256,
  "generate.brief": 1024,
  "generate.outline": 1536,
  "generate.draft": 4096,
  "generate.answerability": 4096,
  "generate.claim_check": 128,
} as const);

/** How many entries each of the business profile's lists may carry (BUILD
 *  §6.7 step 1). The schema the model's answer is parsed against and the
 *  prompt that asks for it both read these, so the two cannot disagree
 *  (`src/lib/market/questions/profile.ts`). `audienceTerms` is §6.7's own
 *  "2–4 audience/use-case terms"; the other three are bounds issue #462
 *  set so a profile cannot spend its budget on an unbounded list. */
export const PROFILE_LIST_BOUNDS = Object.freeze({
  audienceTerms: Object.freeze({ min: 2, max: 4 } as const),
  namedRivals: Object.freeze({ min: 0, max: 5 } as const),
  vocabulary: Object.freeze({ min: 0, max: 12 } as const),
  brandTokens: Object.freeze({ min: 0, max: 6 } as const),
} as const);

/** The most of the customer's own page text one `profile` call may carry,
 *  in characters of the prompt it is serialised into — home first, the
 *  pricing page in what remains, cut at a word boundary
 *  (`src/lib/market/questions/profile.ts`). Issue #523: since #479 an own
 *  document may be up to `OWN_DOCUMENT_MAX_BYTES`, and its visible text went
 *  into the prompt whole, so a large marketing site's reservation alone
 *  could pass `CAPS.FREE_C` (or the model's context window) and leave the
 *  profile, the market, the twelve and the AI answers unmeasured. 20 000 is
 *  the figure #517's worst-case arithmetic assumed (~5.3k tokens with the
 *  fixed instruction, at ~4 chars a token); `tests/scan/free/cost-bound.
 *  test.ts` adds the free pass up from the pins with it and holds the sum
 *  under `CAPS.FREE_C`. Only the prompt is bounded — the measurement reads
 *  the whole document. */
export const PROFILE_INPUT_MAX_CHARS = 20_000 as const;

/** How many `llm()` calls one free pass issues — BP-009 `## NFR budget`,
 *  quoted: "the free scan's **two** nano calls — `profile` and
 *  `question-phrasing` (BP-025 decision 2) — sit inside the 60-second
 *  promise". Both are `nano`; they are
 *  `src/lib/market/questions/profile.ts` and `…/phrase.ts`, issued one
 *  after the other inside the `reading_your_market` stage. Pinned so the
 *  budget arithmetic has a count to multiply the per-call budget by
 *  instead of a literal 2 typed into a test (issue #452). */
export const FREE_PASS_INFERENCE_CALLS = 2 as const;

export const BATTERY = Object.freeze({
  QUESTIONS: 12, TARGET_SERPS_MAX: 13, MEASURED_PAGES_MAX: 25, COMPETITORS_MAX: 5,
} as const);

export const SERP_LOCATION = Object.freeze({
  location: "United States", language: "en",
} as const);

/** `BUILD.md` §6.1's price-book row: "`PLATFORM_DOMAINS` | reddit, quora,
 *  youtube, wikipedia, g2, capterra, medium, linkedin, producthunt,
 *  stackoverflow, … (closed list)". The row ends in an ellipsis, so the ten
 *  names below are what §6.1 states, not a complete list on its face — the
 *  incompleteness is raised in the WO-006 return, per its own `rests-on`
 *  row, rather than an eleventh name being invented here (rule 1.2). */
export const PLATFORM_DOMAINS = Object.freeze([
  "reddit", "quora", "youtube", "wikipedia", "g2",
  "capterra", "medium", "linkedin", "producthunt", "stackoverflow",
] as const);

export const CACHE_WINDOWS_D = Object.freeze({
  own: 7, rival: 30, serp: 30, suggestions: 30,
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

export const FREE_BOUNDS = Object.freeze({
  scansPerIpPerHour: 5, inFlightPerIp: 1, scansPerDay: 200,
} as const);

export const TIMING = Object.freeze({
  // **The design ceiling fires before the platform's, with margin to write
  // the partial report** (master ruling 2026-09-10, issue #456). The free
  // pass runs inside the `POST /api/scan` invocation, and that invocation
  // is frozen by the platform at `platformCeilingS` below. A design ceiling
  // above it can never fire: the pass would be killed mid-flight, its row
  // swept to `failed`, and the reader shown a failed scan instead of the
  // partial report ADR-021 promises. So the two are ordered here, in one
  // place, and `tests/scan/ceilings-pins.test.ts` holds them in that order.
  //
  // 50 leaves ten seconds under the platform bound for the ending to be
  // decided and the partial report stored, and still clears the free
  // pass's own inference arithmetic (two nano calls, #452/#455) with room.
  // REQ-003 c5's 90 s is superseded on the pin: the platform, not the
  // product, sets the outer bound, and the owner has ruled no plan upgrade.
  //
  // `reportTargetS` is the p95 the pass aims at, and a target above the
  // ceiling that stops it is not a target. BUILD §11 fixes no figure for it
  // — "Free ≈60s live" is the outer bound the reader waits inside, which is
  // now the platform's — so 40 is chosen here (rule 1.1): ten seconds of
  // headroom under the ceiling, the same margin the ceiling keeps under the
  // platform's. Reversal cost: one pin.
  reportTargetS: 40, reportCeilingS: 50, deepReleaseMin: 10, progressHeartbeatS: 30,
  /** The platform's own ceiling on the `POST /api/scan` invocation, in
   *  seconds — `export const maxDuration` on that route, which must stay a
   *  literal there because Next reads route segment config out of the
   *  source at build time. This is the same number, pinned where the engine
   *  can read it; `tests/scan/ceilings-pins.test.ts` reads the route source
   *  and fails if the two ever disagree. 60 is the plan this product
   *  deploys to (Hobby). Issue #456. */
  platformCeilingS: 60,
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
   *  more than the tick it would have waited for anyway. Issue #456. */
  sweepMarginS: 30,
  // BP-034 `## NFR budget` (archived corpus), verbatim: "a rival suggestion
  // call is bounded at 3 s and, on timeout, leaves `SuggestionState` at
  // `none_found` rather than holding the screen — **setup is never held on
  // suggestions**". Seconds, like its three neighbours. Issue #37.
  suggestCeilingS: 3,
} as const);

export const WINNABILITY = Object.freeze({
  qualifyFloor: 500, qualifyMultiple: 5, nearFloor: 100, nearMultiple: 2,
} as const);

export const RIVAL_SIZE_BANDS = Object.freeze({
  nearFloor: 100, nearMultiple: 2, middleFloor: 500, middleMultiple: 5,
} as const);

/** `BUILD.md` §5's four score bands, as lower bounds on a 0–100 score:
 *  "Bands: 0–24 Invisible · 25–49 Hard to find · 50–74 Findable · 75–100
 *  Dominant". BP-024's `bandOf(score)` says "thresholds are BP-005 pins" and
 *  had none to read; this is that pin. Boundaries only — the four *words* are
 *  BP-019's `SCORE_BANDS` (decision 2). Named `SCORE_BAND_BOUNDS` and not
 *  `SCORE_BANDS`, which is already BP-019's `CopyKey` map. */
export const SCORE_BAND_BOUNDS = Object.freeze({ // BP-024 · REQ-004 c1 · BUILD §5
  invisible: 0, "hard-to-find": 25, findable: 50, dominant: 75,
} as const);

/** The other two numbers BP-010 decision 2 assigns to this file — "the
 *  coefficients that are numbers (band thresholds, the answerability floor,
 *  the direct-answer character window) are pins in BP-005" — transcribed
 *  verbatim from BP-005's `## Public interface` (2026-09-04, `2fe462e`),
 *  which is itself `BUILD.md` §5, transcribed (rule 1.2 — nothing chosen):
 *  "Answerability = shape of the home + measured pages, 0–100, floored at
 *  1" and "`directAnswers` = question headings whose first block is
 *  40–320 visible chars ÷ all headings × 100". The window is closed at
 *  both ends. `PRESENCE_FLOOR` (`src/lib/measure/score.ts`) is
 *  deliberately not a fourth member here — equal to `answerabilityFloor`
 *  today by coincidence of value, not by derivation; `BUILD.md` §5 states
 *  the two floors independently. */
export const SCORING = Object.freeze({                    // BP-010 d2 · BUILD §5
  directAnswerCharsMin: 40,   // inclusive
  directAnswerCharsMax: 320,  // inclusive
  answerabilityFloor: 1,
} as const);

export const GENERATION = Object.freeze({
  brandGapChars: 300, duplicateThreshold: 0.85, regenerations: 1,
} as const);

export const SUPPLY = Object.freeze({
  deepTarget: 30, shortThreshold: 7,
} as const);

export const VETO = Object.freeze({
  defaultHours: 24, minDays: 0, maxDays: 7,
} as const);

export const RATE_LIMITS = Object.freeze({
  publishesPerDay: 1, publishesPerWeek: 8,
} as const);

export const RETENTION_D = Object.freeze({
  erasure: 30, hostedAfterAccess: 30, removalSlaWorkingDays: 5,
} as const);

export const NURTURE_H = Object.freeze([24, 72, 168] as const);

// ── Added 2026-08-31 (decision 3). Every entry below is traced to the node
//    and the criterion that asked for it; none is minted here, and none is a
//    customer-visible string.
//
// The free report and the market chain
export const SELECTION = Object.freeze({                    // BP-025 · REQ-006 · BUILD §6.7 step 3
  volumeFloorPerMonth: 50,
  intentWeights: Object.freeze({ decision: 3, solution: 3, problem: 2, informational: 1 } as const),
  minDecision: 4, minSolution: 3, maxRivalBrand: 3, maxHowTo: 2,
} as const);

export const COHERENCE = Object.freeze({                    // BP-028 · REQ-094 c2 · BUILD §6.7 step 5
  minMeasuredSearches: 3, shareDivisor: 4, minAppearances: 2,
} as const);

export const CORRECTION = Object.freeze({                   // BP-028 · REQ-094 c5–c7
  perScan: 1, retries: 1, offerMaxAgeDays: 7,
} as const);

export const SEVERITY_THRESHOLDS = Object.freeze({          // BP-027 · REQ-009 c8
  blocked_readers: Object.freeze({ mid: 1, high: 3 } as const),   // 0 = low; 1–2 mid; >= 3 high
  missing_pages: Object.freeze({ mid: 1, high: 10 } as const),
  unquotable_pages: Object.freeze({ mid: 1, high: 2 } as const),
} as const);

/** ADR-022's single closed list of AI reader user-agent tokens. One set, one
 *  name: the blocked-readers count (BP-024), the paste block (BP-027) and the
 *  hosted robots policy (BP-004/BP-047) all read this and nothing else.
 *  ADR-090 folds BP-047's `AI_CRAWLERS` into this name and records that
 *  REQ-059 criterion 4 states the membership verbatim: "it blocks no general
 *  search engine crawler and permits by name GPTBot, ClaudeBot,
 *  OAI-SearchBot, Claude-SearchBot, PerplexityBot and Google-Extended."
 *  Nothing is populated here from memory (rule 1.2); `tests/pins.test.ts`
 *  asserts the value against that clause, quoted. An empty list fails the
 *  pins test. */
export const AI_READER_AGENTS = Object.freeze([              // ADR-022, ADR-090
  "GPTBot", "ClaudeBot", "OAI-SearchBot",
  "Claude-SearchBot", "PerplexityBot", "Google-Extended",
] as const);

// The free path's own bounds
export const FREE_RESCAN_WINDOW_D = 7 as const;              // BP-023 · BUILD §6.4
export const FAILURE_COOLDOWN_H = 24 as const;               // BP-023 · BUILD §6.4
export const HOURLY_WINDOW_H = 1 as const;                   // BP-023 · BUILD §11 bounds
export const DAILY_WINDOW_H = 24 as const;                   // BP-023 · BUILD §11 bounds
export const DEEP_HEARTBEAT_S = 15 as const;                 // BP-036 d5 · REQ-029 c1 (half of 30)

// Opportunities, supply and verdicts
export const EFFORT_BY_TYPE = Object.freeze({                // BP-040 d3
  answerable_page: 0.2, expand_page: 0.3, refresh_page: 0.3,
  answer_page: 0.5, keyword_page: 0.5, comparison_page: 0.6, format_page: 0.7,
} as const);                                                 // `unblock` is unranked

export const FIT_WEIGHT = Object.freeze({ winnable: 1.0, reach: 0.5, "not-yet": 0 } as const); // BP-040 d3
export const SUPPLY_TARGET_DEPTH = 30 as const;              // BP-041 d4 · REQ-095 c1
export const SUPPLY_SHORT_BELOW = 7 as const;                // BP-041 d4 · REQ-095 c5
export const TOO_EARLY_WEEKS = 3 as const;                   // BP-051 d4 · REQ-063 c2

// Generation
export const SHINGLE_SIZE = 5 as const;                      // BP-042 · REQ-050 c9
export const NEAR_DUPLICATE_MAX = 0.85 as const;             // BP-042 · REQ-050 c9 · BUILD §8

/** BP-042 decision 5: "`no_machine_address` is a pinned pattern battery" —
 *  "a pinned list matching the named forms (an instruction or assertion
 *  directed at an assistant, a crawler or a ranking system about how to
 *  treat, cite, rank or recommend the page), applied to the rendered text."
 *  Chosen here as a parameter (constitution rule 1.1 — "internal names,
 *  type members" and enforcement fidelity, never a customer-visible
 *  string); WO-006 gave no derivation steps for this group the way it did
 *  for `PLATFORM_DOMAINS` and `AI_READER_AGENTS`, so it is flagged in the
 *  WO-006 return rather than silently authored. "The battery decides the
 *  forms it lists and no others" is BP-042's own `undischargeable`
 *  `rests-on` — no pass over the corpus can ever prove this list complete —
 *  and a form found later is added here, in one file (BP-042 decision 5,
 *  WO-194 out of scope). An empty list is never shipped: WO-194's
 *  `machine.test.ts` fails its guard assertion on one. */
export const MACHINE_ADDRESS_PATTERNS = Object.freeze([       // BP-042 · REQ-050 c8
  /\b(dear|attention|note to)\s+(the\s+)?(ai|assistant|chatbot|llm|language model)\b/i,
  /\bif you(?:'re| are) an? (ai|language model|assistant|chatbot)\b/i,
  /\bignore (?:all |any )?(?:previous|prior|the above) instructions\b/i,
  /\b(dear|attention|note to)\s+(the\s+)?(crawler|bot|spider|search engine)\b/i,
  /\b(please\s+)?(cite|rank|recommend|index)\s+this\s+(page|article|post|content)\b/i,
]);

export const CLAIM_RECHECK_SWEEP_MAX = 25 as const;          // BP-043 · REQ-053

// Publishing, destinations and verification
export const PUBLISH_RETRY_BACKOFF_MIN = Object.freeze([5, 30, 180] as const);   // BP-045 · REQ-056 c4
export const DESTINATION_HEALTH_MAX_AGE_H = 24 as const;     // BP-058 · REQ-074 c1
/** How long one destination's health check stands before the read path
 *  will run another. Chosen, not transcribed (BP-058 NFR budget): the
 *  smallest window that collapses an ordinary navigation burst — a
 *  customer moving between Overview, the calendar and Settings — into one
 *  check. Deliberately not `DESTINATION_HEALTH_MAX_AGE_H`, which bounds a
 *  different thing: the age of the date the customer reads. Reversal cost
 *  is this one number. */
export const DESTINATION_HEALTH_DEBOUNCE_S = 60 as const;    // BP-058 NFR budget
/** How long a destination must have needed reconnecting before the one
 *  breakage mail is due (§9, REQ-074 c6: "has needed reconnecting for 24
 *  hours"). Deliberately not `DESTINATION_HEALTH_MAX_AGE_H`, which also
 *  holds 24 and bounds the age of the date the customer reads: one is how
 *  stale a check may be, the other is how long a breakage stands before
 *  the customer is written to, and they move independently. */
export const DESTINATION_BREAKAGE_MAIL_DELAY_H = 24 as const; // BP-058 · REQ-074 c6

/** BP-049 NFR budget: "`VERIFY.coverageFloor = 0.95` and `VERIFY.userAgent`
 *  belong in BP-005 (config over constants, rule 7)." `userAgent` is our own
 *  token, chosen here as a parameter (rule 1.1) — "our own token … it is not
 *  one of the six named AI agents, and impersonating one of them would be a
 *  false statement to a server we are measuring" — never customer copy. */
export const VERIFY = Object.freeze({                         // BP-049 · REQ-062
  coverageFloor: 0.95,
  userAgent: "ReachKitVerify/1.0 (+https://reachkit.app)",     // userAgent is a machine token, not customer copy
  /** How many sitemap documents one page's check may read before it stops
   *  and reports that it could not read the site's sitemap (issue #50).
   *  A sitemap index names further documents, and following them without a
   *  bound turns one page's check into an unbounded crawl of a site
   *  ReachKit does not serve. Chosen here as a parameter: five covers the
   *  robots-declared documents plus the two conventional addresses on every
   *  shape of site this check has to read, and a site that needs more is
   *  reported as unread for that one page rather than crawled further.
   *  Reversing it is one number and no customer-visible consequence. */
  sitemapMaxDocuments: 5,
} as const);

// The weekly clock
export const WEEK_START = "monday" as const;                 // REQ-065 c1; not a tunable, pinned so it is stated once
export const WEEKLY_DUE_HOUR_LOCAL = 6 as const;              // ADR-060 · site-local, never UTC

// Account lifecycle
export const SETUP_REMINDER_OFFSETS_H = Object.freeze([24, 72, 168] as const);   // BP-033 · REQ-025 c6
export const EMAIL_CHANGE_TTL_H = 24 as const;                // BP-061 d2 · REQ-077 c4
export const SIGNIN_LINK_TTL_H = 24 as const;                 // BP-061 d2 (chosen)
export const ERASURE_DAYS = 30 as const;                      // BP-063 · REQ-079 c7
export const DANGER_TICKET_TTL_MINUTES = 30 as const;         // BP-063
export const EXPORT_DEADLINE_MS = 120_000 as const;           // BP-062 (chosen) · REQ-078 c5
export const HOSTED_RETENTION_DAYS = 30 as const;             // BP-060 · REQ-076 c10
export const HOSTING_END_REMINDER_DAYS = 7 as const;          // BP-060 · REQ-076 c11
export const MAINTENANCE_TICK_MINUTES = 15 as const;          // BP-003 d1 · REQ-024 c5
export const NURTURE_MAX_TOUCHES = 3 as const;                // BP-029 · REQ-010 c9
export const SEQUENCE_START_DEADLINE_DAYS = 7 as const;       // BP-029 · REQ-010 c12
export const FIRST_PAGE_RETRY_WINDOW_H = 24 as const;         // BP-029 · REQ-010 c8
export const FIRST_PAGE_RETRY_MINUTES = Object.freeze([5, 30, 120, 360, 720, 1440] as const);  // BP-029 d4

/** Overview's headline goal **values** (BP-038). Numbers only: BP-038's `GOALS`
 *  pairs each with its copy key and is the one home of the pairing, so this file
 *  stays free of `CopyKey` and keeps importing nothing.
 *  BP-038 decision 2's derivation, verbatim:
 *  - `searches_appeared_in = 400` — `BUILD.md` §4.5's footnote pair, "start
 *    value · At 400 the big category terms unlock."
 *  - `ai_answers = 6` — `BUILD.md` §4.5's AI-answers tile, "dashed goal dots
 *    + goal: 6", out of the twelve tracked questions.
 *  - `score = 50` — `BUILD.md` §5's band boundaries; 50 is the first score at
 *    which the product's own verdict changes from not-findable to findable.
 *  - `pages_published = 30` — **not derivable; ruled by the owner on
 *    2026-08-31**: a month of daily pages, the product's own promise of one
 *    page a day (REQ-056 c8), sustained for a month. It is no longer
 *    optional, and BP-038 renders that tile's goal like the other three. */
export const GOAL_VALUES = Object.freeze({
  searches_appeared_in: 400, ai_answers: 6, score: 50,
  pages_published: 30,          // owner ruling, 2026-08-31 — a month of daily pages
} as const);

// ── Egress — BUILD §6.4
/** Bound on one DNS resolution inside `resolvesInDns()` (`src/lib/egress/dns.ts`).
 *  Chosen here as a parameter (rule 1.1): BUILD §6.4 / BP-006 bound the
 *  *fetch* (8 s default, 15 s hard max) but name no bound for the bare
 *  "does this name resolve" question, which is asked where a human is
 *  waiting on a setup or settings form. A healthy resolver answers in well
 *  under a second; 5 s is long enough for a slow authoritative server and
 *  short enough that a hanging resolver never holds the form longer than
 *  a fetch would. Reversal cost: one number, no customer-visible string. */
export const DNS_TIMEOUT_MS = 5000 as const;                  // BP-006 · BUILD §6.4 (chosen)
/** The size cap on one read of the customer's **own** documents — the home
 *  page, its pricing page and the tier's extra pages (`src/lib/measure/
 *  own-fetch.ts` passes it as `safeFetch`'s `maxBytes`). Master ruling
 *  2026-09-10 (issue #479): modern marketing home pages routinely carry
 *  more than 2 MB of HTML (inline scripts and styles — cal.com's was
 *  2 157 610 bytes), and the fetcher's own 2 MB default refused it, so a
 *  scan measured nothing. Vendor and rival reads keep that default. Above
 *  this cap the read is still refused, never truncated: a truncated
 *  document would mis-measure answerability. */
export const OWN_DOCUMENT_MAX_BYTES = 6_000_000 as const;     // master ruling 2026-09-10 · #479 · BUILD §6.4

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
  stdQueuePollIntervalS: 10,
  stdQueueDeadlineMin: 45,
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

// Report removal on written request (REQ-002 · ADR-002)
/** The status a removed domain's report address serves (REQ-002 c3). Gone,
 *  not Not Found: the address existed and its report was taken down at the
 *  domain owner's request, and the one written line served with it names
 *  the address that brings it back. Owner ruling 2026-09-05 (#28) —
 *  supersedes the archived plan's `200`. */
export const REPORT_REMOVED_STATUS = 410 as const;

// ── The job runner — BUILD §11
/** The fixed fan-out bound BP-003 names: "No job fans out across customers
 *  inside one invocation past a fixed concurrency; a slow site never
 *  starves the rest of Monday." Chosen here as a parameter (rule 1.1 — an
 *  internal scheduling bound with no customer-visible consequence): ten is
 *  wide enough that a Monday's fan-out is not serialised behind one slow
 *  site and narrow enough that one tick cannot open more vendor work than
 *  the cost seam's caps were sized for. Reversal cost: one number. */
export const JOB_FAN_OUT_CONCURRENCY = 10 as const;           // BP-003 · BUILD §11
/** The site-local hour `draft/generate` is due. BUILD §11 says "daily,
 *  evening" and BP-003 adds "in the site's time zone … must finish before
 *  the veto window would start"; neither states an hour, so 18:00 local is
 *  chosen here as a parameter (rule 1.1) — the first hour that is evening
 *  everywhere, leaving `VETO.defaultHours` clear of the next publish date.
 *  Site-local, never UTC, on the same grounds ADR-060 states for the
 *  weekly tick. Reversal cost: one number. */
export const DRAFT_DUE_HOUR_LOCAL = 18 as const;              // BP-003 · BUILD §11 (chosen)
/** BUILD §11: `publish/verify` runs "+24h" after a publish. Distinct from
 *  `DAILY_WINDOW_H`, which is BP-023's free-scan rate-limit window and
 *  happens to share the number; the two move independently. */
export const PUBLISH_VERIFY_DELAY_H = 24 as const;            // BP-049 · BUILD §11

// ── Rival derivation and the presence card (issue #27) — BUILD §6.6
/** `BUILD.md` §6.1's own price-book row, transcribed (rule 1.2 — nothing
 *  chosen): "`RIVAL_SCORE` | top10Appearances + 2×aiCitations (§6.6)". The
 *  two weights, never the formula, which is
 *  `src/lib/market/rivals/derive.ts`'s (rule 2.5). §6.6 states the reason
 *  the AI weight is the larger of the two: "cited-by-AI weighs double". */
export const RIVAL_SCORE = Object.freeze({                    // BUILD §6.1 · §6.6
  top10Weight: 1, aiCitationWeight: 2,
} as const);

/** REQ-008 criterion 4: of the searches the customer is absent from, "up
 *  to five of the biggest are listed". Deliberately not
 *  `BATTERY.COMPETITORS_MAX`, which happens to hold the same number today
 *  and bounds a different thing — how many rivals a customer may track. */
export const ABSENT_FROM_MAX = 5 as const;                    // BP-026 · REQ-008 c4

// ── Overview (issue #15) — BUILD §4.5
/** The point below which a rival-to-customer ratio misleads more than it
 *  informs. §6.6, verbatim: "The ratio module unlocks at ranked ≥ 10 with
 *  copy 'now comparable'" — and, above it, the reason there is a threshold
 *  at all: "when the customer's count is 0, render the rivals' absolute
 *  numbers with `you: 0` — **never a ratio** (division by zero renders as
 *  ∞× and reads as broken)". Transcribed, not chosen. */
export const RATIO_UNLOCK = 10 as const;                      // §6.6

/** The fixed trailing window Overview reads its two week-counted readings
 *  over: the weekly points the growth chart draws, and — since the owner's
 *  ruling of 2026-09-03 (DECISIONS) — the AI-answers tile's one reading,
 *  "in how many of a fixed trailing window of weeks the customer was named
 *  in at least one tracked question's AI answer". Twelve weeks is a
 *  quarter of weekly measurement, and it is what makes
 *  `GOAL_VALUES.ai_answers = 6` read as half the window; one number, so the
 *  chart and the tile can never disagree about which weeks they mean. */
export const OVERVIEW_TRAILING_WEEKS = 12 as const;           // BUILD §4.5 · DECISIONS 2026-09-03

/** BUILD §4.5, verbatim: "up to two alerts". The remainder is stated as a
 *  count with where to see it, never as a third alert. */
export const OVERVIEW_ALERT_CAP = 2 as const;                 // BUILD §4.5

// ── Setup's destination card (issue #14) — BUILD §4.3 (§9's hosted CMS)
/** §9, transcribed (rule 1.2 — nothing chosen): "**Hosted CMS:**
 *  `content.{customer-domain}` by CNAME → our edge route serves
 *  static-rendered pages by Host header." The label, never the record,
 *  which is `src/lib/publish/setup/cards.ts`'s (rule 2.5). The target the
 *  record points at is `HOSTED_EDGE_CNAME_TARGET`, an env binding, because
 *  it differs per deployment; this label does not. */
export const HOSTED_SUBDOMAIN_LABEL = "content" as const;     // BUILD §4.3

// ── The draft editor's two intervals (issue #17) — BUILD §4.6
/** BUILD §4.6's autosave, in milliseconds. The archived BP-044 `## NFR
 *  budget` derives it: "criterion 6 triggers on 'pauses or leaves the
 *  view'; 1200 ms is above ordinary inter-keystroke pauses and below the
 *  interval at which a customer starts to feel their work is at risk."
 *  A pause of this length issues one save; blur and leaving the view flush
 *  immediately, so the number bounds the pause and never the departure. */
export const AUTOSAVE_DEBOUNCE_MS = 1200 as const;             // BP-044 · BUILD §4.6

/** BUILD §4.6's live preview pane, in milliseconds. Same source: "preview
 *  re-renders at most every 100 ms and runs entirely client-side, so 'as
 *  they type' costs no round trip." It is a ceiling on re-render, never on
 *  the edit itself — the textarea is never debounced. */
export const PREVIEW_DEBOUNCE_MS = 100 as const;               // BP-044 · BUILD §4.6

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

// ── Opportunities (issue #40) — BUILD §7
/** The ranking formula's demand scale (§7: `demand × intent × (1−effort) ×
 *  fit`). `demand = min(1, log10(volume + 1) / 5)`: log-scaled for the
 *  reason §6.7 gives for the selection score, with the divisor chosen so
 *  100,000/mo saturates the term at 1.0 — above any volume a market set
 *  carries, so demand saturates rather than clips. Chosen, not
 *  transcribed: §7 fixes the formula's shape and no term's scale. Reversal
 *  cost is this one number and its assertion. */
export const DEMAND_LOG_DIVISOR = 5 as const;                 // §7 ranking

/** §7's Write trigger, transcribed: "Rival top-20 for a query ≥10/mo;
 *  customer absent". The floor below which a search is not worth a page of
 *  its own. Distinct from `SELECTION.volumeFloorPerMonth` (50), which is
 *  §6.7's floor for admitting a search into the *twelve* — two floors,
 *  stated independently by the spec, and neither derived from the other. */
export const WRITE_VOLUME_FLOOR_PER_MONTH = 10 as const;      // §7

/** §7's Improve trigger, transcribed: "Customer ranks 4–30, page thin".
 *  The band is inclusive at both ends. The bought SERP is a top ten
 *  (`transport.ts` fixes depth 10), so today only 4–10 is observable; the
 *  band is stated as the spec states it, so widening what is bought needs
 *  no edit here. */
export const IMPROVE_POSITION_BAND = Object.freeze({ min: 4, max: 30 } as const); // §7

/** What "page thin" means, in the unit the parser measures
 *  (`OnPageFacts.visibleChars`). Chosen, not transcribed — §7 states the
 *  trigger and no number. 1800 visible characters is roughly 300 words at
 *  ~6 characters a word including spaces, the length below which a page
 *  answering a commercial search has said too little to rank for it.
 *  Reversal cost is this one number and its fixtures; nothing stored
 *  depends on it, since the shortfall row records the measured count
 *  itself and not the comparison. */
export const THIN_PAGE_VISIBLE_CHARS = 1800 as const;         // §7

// ── Identity (issue #35) — BUILD §13, §4.7
/** The size of a sign-in token, in bytes of `randomBytes`. BP-061 decision
 *  3: "SHA-256 of a 256-bit random token" — the entropy is what makes the
 *  stored hash unsalted-safe, so the number and the reason travel together.
 *  A smaller token is not a tuning knob; it is the credential. */
export const LINK_TOKEN_BYTES = 32 as const;                  // BP-061 d3 (256 bits)
/** How long a session cookie stays valid before its holder needs a fresh
 *  link. **Chosen** (constitution rule 1.1): no requirement states a
 *  session lifetime — REQ-077 c5 fixes only that signing out ends one.
 *  Derivation: the product has no password, so every expiry costs the
 *  customer a round trip through their inbox; 30 days is the same window
 *  `ERASURE_DAYS` and `HOSTED_RETENTION_DAYS` already use for "long enough
 *  that a person on holiday is not punished", and a weekly product whose
 *  own mail arrives every Monday re-anchors it four times over. Reversal
 *  cost: one line here. */
export const SESSION_TTL_DAYS = 30 as const;                  // BP-061 (chosen)

// ── Publishing, the veto leaf (issue #46) — BUILD §9
/** The whole of one delivery attempt, bounded. Distinct from the egress
 *  seam's per-request bound (BUILD §6.4: 8 s default, 15 s hard maximum),
 *  which bounds one byte-stream toward one customer URL: an adapter makes
 *  several requests — create, set meta, read back the address — and this is
 *  the bound on all of them together, so a destination that answers every
 *  request slowly cannot hold a publish attempt open indefinitely.
 *  Chosen (rule 1.1): 20 s is above the §6.4 hard maximum, so a single
 *  slow request still fails on its own bound and is reported as itself,
 *  and low enough that a held attempt is retried within the first backoff
 *  step (`PUBLISH_RETRY_BACKOFF_MIN[0]`, 5 minutes). Reversal cost: one
 *  number. Raised as a possible pin by #45's PR and taken here. */
export const PUBLISH_DELIVER_TIMEOUT_MS = 20_000 as const;   // BP-045 · BUILD §9 (chosen)

/** The veto token's entropy, in bytes from a CSPRNG (REQ-057 c1's "single
 *  action to stop it"). 32 bytes is the width every other single-use
 *  secret in the product is minted at; only its SHA-256 hash is stored. */
export const VETO_TOKEN_BYTES = 32 as const;                 // BP-046 · REQ-057 c1

// ── The WordPress destination (issue #54) — BUILD §9 · REQ-060
/**
 * The pins the WordPress adapter runs on. One group, because every member
 * is a fact about the same destination and a reader chasing one wants the
 * others in front of them.
 *
 * `stampSlug` and `stampName` are **ADR-083 Decision 5's pin**, and their
 * *values* are the owner's, not this file's: the term is visible on the
 * customer's own public site from the moment a page is delivered
 * (ADR-084 Decision 5), and a customer-visible string is owner-owed. They
 * are pinned here so that the reversal is one line and so that no second
 * spelling of the term can exist; the values below are placeholders the
 * owner rules on, and the PR that added them says so.
 *
 * `markerPrefix` is **ADR-080 decision 5's marker**, and it is not a
 * tuning knob: it is the only at-most-once mechanism available at a
 * destination whose database we cannot index. Changing it is a migration
 * of somebody else's site and requires a fallback that finds the old shape
 * first.
 *
 * `markerSearchLimit` bounds the candidate page the marker search reads
 * back before confirming each candidate exactly. **Chosen** (rule 1.1):
 * no requirement states one. Derivation: the search is by a token that
 * appears in no human-written post, so a correct site returns at most one
 * row; 20 is small enough that a site answering with a page of unrelated
 * posts costs one bounded read, and large enough that a site whose search
 * ranks loosely still carries our post in the first page. Reversal cost:
 * one number.
 */
export const WORDPRESS = Object.freeze({
  /** The REST root, appended to the customer's site root. Derived from
   *  `baseUrl` at every call and stored nowhere a second time. */
  restBase: "/wp-json",
  /** The idempotency marker's token. `{prefix}:{draftId}` is what the
   *  search looks for and what a candidate is confirmed against. */
  markerPrefix: "reachkit-draft",
  /** How many candidates the marker search reads back before confirming. */
  markerSearchLimit: 20,
  /** ADR-083's findability stamp, as a `post_tag` term. Owner-owed values. */
  stampSlug: "reachkit",
  stampName: "ReachKit",
} as const);

// ── The hosted edge (issue #49) — BUILD §9
/** §9, transcribed (rule 1.2 — nothing chosen): "Preview at
 *  `{slug}.reachkit.app` is `noindex` **forever** (site-reputation-abuse
 *  guardrail — customer content never ranks on our domain)."
 *
 *  The parent of every preview host, and the one place the spelling lives.
 *  It is **not** `NEXT_PUBLIC_APP_URL`'s host and never derived from it:
 *  the app's own address is a per-deployment binding (`dev.reachkit.app`
 *  today, the apex at M4), while this suffix is the product's own name and
 *  the same in every deployment. `resolveHost()` reads both — the app's own
 *  host is subtracted from this suffix's children, so the deployment's own
 *  address is never mistaken for a customer's preview. */
export const PREVIEW_HOST_SUFFIX = "reachkit.app" as const;   // BUILD §9

/** REQ-076 c10, quoted through `DECISIONS.md` and BP-060: 30 days after a
 *  departed customer's paid-through date "ReachKit stops serving their
 *  hosted pages and every address that served one returns 410 Gone rather
 *  than a page, a redirect or a not-found" — and a deleted account's pages
 *  stop at the moment of deletion (REQ-079 c6).
 *
 *  Deliberately **not** `REPORT_REMOVED_STATUS`, which happens to hold the
 *  same number and bounds a different thing: that one is the report
 *  address's answer after a written removal request (#28), and the two move
 *  independently — the same reason `PUBLISH_VERIFY_DELAY_H` is its own
 *  constant beside `DAILY_WINDOW_H`. */
export const HOSTED_GONE_STATUS = 410 as const;               // BUILD §9 · REQ-076 c10

// ── The Markdown renderer (issue #158) — BUILD §9 · §4.6
/**
 * The schemes a draft's link may address, and the whole of the renderer's
 * address policy (`src/lib/publish/render/markdown.ts`).
 *
 * **An allowlist, never a blocklist.** A blocklist of dangerous schemes is
 * always one scheme behind — `javascript:` is the one everybody names and
 * `data:`, `vbscript:` and the next one nobody has written down are the
 * reason the list is closed the other way round. A link whose scheme is not
 * one of these renders as its own label, in plain text: the words the
 * customer wrote survive and the address does not become clickable.
 *
 * It is pinned here rather than left inside the renderer because it decides
 * what publishes onto a customer's own domain, and because it is read in
 * two directions — the renderer vets an address against it, and a test
 * asserts a scheme outside it never reaches an `href`.
 *
 * `/` is on it because a draft may link within the site it is published to;
 * every other member names a scheme a reader's browser will open as a
 * document or a mail, and nothing that executes.
 */
export const MARKDOWN_LINK_SCHEMES = Object.freeze([
  "http://",
  "https://",
  "mailto:",
  "/",
] as const);

// ── The Monday digest (issue #181) — BUILD §12
/** How many of the ranked-open opportunities §12's weekly mail names:
 *  "score delta, AI answers delta, pages verdicts, **next 3**".
 *
 *  Transcribed, not chosen (rule 1.2) — §12 states the number. It is a
 *  pin rather than a literal in the sender because it is the size of a
 *  list a customer reads, and because §12 is where it changes. */
export const WEEKLY_NEXT_COUNT = 3 as const;                  // BUILD §12

// ── The Core Web Vitals budget (issue #332)
/**
 * The three ceilings the two surfaces a stranger meets are held to: the
 * landing page (`/`) and the free report (`/scan/{domain}`).
 *
 * **Chosen, not transcribed (rule 1.2).** No clause in `BUILD.md`,
 * `DECISIONS.md` or `DATA-COSTS.md` rules a page-speed number — BP-018's
 * `## NFR budget` is the nearest thing the corpus has and it budgets *what
 * ships* ("no chart library, so no runtime dependency ships to the browser
 * for a five-chart inventory"), never how fast it arrives. Two of the three
 * are the published "good" thresholds of the Core Web Vitals as issue #332
 * states them; the third is the script weight that issue chose. They are
 * pinned here rather than left in the suite that measures them because a
 * budget nobody can find is a budget nobody raises on purpose.
 *
 * The unit of each is written into its name, because a budget read in the
 * wrong unit is a budget that never fires:
 *   - `LCP_MS` — Largest Contentful Paint, milliseconds from navigation.
 *   - `CLS` — Cumulative Layout Shift, the unitless session-window score.
 *   - `LANDING_SCRIPT_KB` — the script bytes `/` transfers over the wire,
 *     in kilobytes of 1000. Only `/` carries it: the issue names one route
 *     ("JS ≤ 200 kB on `/`"), the landing page is the one surface a
 *     stranger loads cold, and the report's own weight is its data.
 *
 * `tests/ui/layout/vitals.test.ts` is what measures them, in the same real
 * Chromium the layout sweep uses and against the same built-and-served app.
 */
export const WEB_VITALS_BUDGET = Object.freeze({              // #332 (chosen)
  LCP_MS: 2500,
  CLS: 0.1,
  LANDING_SCRIPT_KB: 200,
} as const);
