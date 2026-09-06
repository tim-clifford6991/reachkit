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
export const PRICE_BOOK = Object.freeze({
  RANKED_FREE_ROWS: 50, RANKED_FREE_COST_C: 1.8,
  RANKED_PAID_ROWS: 300, RANKED_PAID_COST_C: 4.8,
  RANKED_RIVAL_ROWS: 100, RANKED_RIVAL_COST_C: 2.4,
  COMPETITORS_DOMAIN_COST_C: 1.5, SUGGESTIONS_COST_C: 1.8,
  SERP_LIVE_C: 0.2, SERP_STD_C: 0.06,
  CHATGPT_SCRAPE_STD_C: 0.12, AI_MODE_LIVE_C: 0.2, AI_MODE_STD_C: 0.06,
} as const);

export const CAPS = Object.freeze({
  FREE_C: 12, DEEP_C: 150, WEEKLY_C: 40, DRAFT_C: 45,
} as const);

/** Per-token model prices, cents per million tokens — BP-005 `## Public
 *  interface`, transcribed verbatim (rule 1.2 — data, not a chosen
 *  parameter): `nano: { inCentsPerM: 20; outCentsPerM: 125 }`,
 *  `haiku: { inCentsPerM: 100; outCentsPerM: 500 }`. `costCents` for one
 *  call is `tokensIn/1e6 * inCentsPerM + tokensOut/1e6 * outCentsPerM`,
 *  computed at BP-009's own call site (`src/lib/llm/tiers.ts`), never
 *  here — this file holds the price, never the formula (rule 2.5). */
export const INFERENCE_PRICE_BOOK = Object.freeze({
  nano: Object.freeze({ inCentsPerM: 20, outCentsPerM: 125 } as const),
  haiku: Object.freeze({ inCentsPerM: 100, outCentsPerM: 500 } as const),
} as const);

/** BP-009 `## NFR budget`, verbatim: "p95 latency: nano ≤ 3 s, haiku ≤
 *  20 s." Not among the pins BP-005's own `## Public interface` lists —
 *  added here under the same "pins live in `constants.ts` and nowhere
 *  else" rule (rule 2.4, WO-026), transcribing the other approved
 *  artifact that states a number `tiers.ts` and its test must agree on. */
export const INFERENCE_TIMEOUT_MS = Object.freeze({
  nano: 3000, haiku: 20000,
} as const);

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
} as const);

export const FREE_BOUNDS = Object.freeze({
  scansPerIpPerHour: 5, inFlightPerIp: 1, scansPerDay: 200,
} as const);

export const TIMING = Object.freeze({
  reportTargetS: 60, reportCeilingS: 90, deepReleaseMin: 10, progressHeartbeatS: 30,
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

/** BP-049 NFR budget: "`VERIFY.coverageFloor = 0.95` and `VERIFY.userAgent`
 *  belong in BP-005 (config over constants, rule 7)." `userAgent` is our own
 *  token, chosen here as a parameter (rule 1.1) — "our own token … it is not
 *  one of the six named AI agents, and impersonating one of them would be a
 *  false statement to a server we are measuring" — never customer copy. */
export const VERIFY = Object.freeze({                         // BP-049 · REQ-062
  coverageFloor: 0.95,
  userAgent: "ReachKitVerify/1.0 (+https://reachkit.app)",     // userAgent is a machine token, not customer copy
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
