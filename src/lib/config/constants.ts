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
//     than added outside the listed file plan (rule 4.2 — see the
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
  LLM_MENTIONS_ROWS: 100, LLM_MENTIONS_REQUEST_C: 10, LLM_MENTIONS_ROW_C: 0.1,
} as const);

/** LLM Mentions' worst case for one site's week, in cents: the flat request
 *  charge plus the row cap (SPEC §6, 2026-09-22 — owner ruling after the
 *  #920 pilot). It is the **reservation** `recordFetch` checks the weekly
 *  cap against; the settlement is the rows that actually came back, which
 *  the pilot measured at 16.6c a domain on average.
 *
 *  Written here rather than at the call site because the arithmetic is the
 *  price book's: two pins multiplied is still the price, and a second copy
 *  in `mentions.ts` is a figure that can drift from the rows it prices. */
export const LLM_MENTIONS_WORST_CASE_C =
  PRICE_BOOK.LLM_MENTIONS_REQUEST_C + PRICE_BOOK.LLM_MENTIONS_ROWS * PRICE_BOOK.LLM_MENTIONS_ROW_C;

/** The four per-scan/per-draft ceilings BUILD §6.1 pins, plus the
 *  product-wide one BUILD §6.5 does not yet name (issue #329).
 *
 *  **`DAILY_PRODUCT_C` — the ceiling on everything, for one UTC day.** The
 *  other four bound *one* pass; nothing bounded the sum, so the product's
 *  whole exposure was the per-scan cap multiplied by however many passes
 *  the day happened to bring. This is that missing number, in cents,
 *  measured over the ledger (`fetches.cost_cents`) for the UTC day.
 *
 *  Its size is read off the two figures already stated, and is the owner's
 *  to rule:
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
 *  `WEEK_START` / `WEEKLY_DUE_HOUR_LOCAL`, which are each a customer's).
 *
 *  **`DAILY_SITE_C` — the ceiling on one site, for the same UTC day**
 *  (issue 885). `DAILY_PRODUCT_C` is one figure for everyone, so it does
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
 *   - 500¢ covers both, and is a tenth of `DAILY_PRODUCT_C`: ten sites
 *     each at their own cap cannot take the day between them, and one
 *     runaway takes a tenth of it rather than all of it.
 *
 *  The same UTC day as the product's, and for the same reason the product
 *  ceiling keeps no customer's clock: the two figures are read off one
 *  ledger in one call, and a site-local day would make "today" mean two
 *  different windows inside a single refusal. */
export const CAPS = Object.freeze({
  FREE_C: 12, DEEP_C: 150, WEEKLY_C: 40, DRAFT_C: 45,
  DAILY_PRODUCT_C: 5000, DAILY_SITE_C: 500,
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
  /** `claude-sonnet-4-6`'s list price per million tokens, in cents. The one
   *  call on it is the pass's business-fit judgement (SPEC §6, 2026-10-03,
   *  issue 1134): about 5¢ a site, once a pass. */
  sonnet: Object.freeze({ inCentsPerM: 300, outCentsPerM: 1500 } as const),
  /** `claude-sonnet-5`'s list price per million tokens, in cents — the tier
   *  a customer's page and its critic are written on (SPEC §7, 2026-09-29,
   *  *Length and the writer*; issue 1138). */
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
 *    by `PROFILE_LIST_BOUNDS` (27 short strings at most): ~300 needed.
 *  - `question-phrasing` — at most `BATTERY.QUESTIONS` `{ id, text }`
 *    pairs of one question each: ~30 a pair, ~360 needed.
 *  - `opportunity-typing` — `{ type, slug, title }`: ~60 needed.
 *  - `generate.write`, `generate.fix` — a whole page in parts (SPEC §7, D41).
 *  - `generate.fit_check` — `{ unsupported: { index, claims }[] }`, a few
 *    words a sentence, and few sentences on a page that fails: ~20 each
 *    (issue 1136). */
export const INFERENCE_MAX_OUTPUT_TOKENS = Object.freeze({
  profile: 700,
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
  /** SPEC §5 (2026-09-20, #923): setup's voice sample — one short paragraph
   *  in the customer's own voice, grounded in one passage the scan read off
   *  their pages, with that sentence quoted back and the passage named.
   *
   *  600, because the answer is a paragraph plus the sentence inside it
   *  quoted a second time: roughly 150 tokens of prose, doubled, with room
   *  for the schema's own framing. It is a paid call under `CAPS.DEEP_C`,
   *  bounded to `VOICE_SAMPLES_MAX` asks per founder, so the ceiling it can
   *  reach is three of these and nothing notices. */
  "setup.voice-sample": 600,
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

/** SPEC §7 (D41) — the five-stage pipeline's own bounds.
 *
 *  `fixBeforeMs`: the one fix call is started only while the page has been
 *  in the making for less than this, so research, the write call and the fix
 *  call stay inside the draft job's invocation (`TIMING.jobsCeilingS`).
 *  `nextTopicBeforeMs`: D26's next topic is tried in the same run only this
 *  early, for the same reason. */
export const PIPELINE = Object.freeze({
  fixBeforeMs: 165_000,
  nextTopicBeforeMs: 120_000,
} as const);

/** What a context pack carries at most (SPEC §7, D41 stage 2): the business
 *  passages handed to the writer, the site's published and planned pages
 *  (D36: at most 100), and a Q&A page's questions (D42: 5–8). */
export const PACK = Object.freeze({ facts: 40, pages: 100, questions: 8 } as const);

/** SPEC §7 (owner, D61; issue 1295): two headings are too alike where they
 *  share this fraction of the longer one's words, or open with this many of
 *  the same words. */
export const DISTINCT_HEADINGS = Object.freeze({ overlap: 0.6, opening: 6 } as const);

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

/**
 * How much of the **confirmed business profile** a generation prompt may
 * carry (issue #927 · SPEC §7, 2026-09-20: "The confirmed business profile
 * … joins the writer's inputs").
 *
 * **A bounded block, because a prompt's budget is the draft's cost.** The
 * profile is the customer's own curated lists, and a customer may add to
 * them: nothing else bounds what arrives, so the prompt does. `CAPS.DRAFT_C`
 * is the ceiling this protects — a page written from an unbounded list is a
 * page that spends the day's budget on vocabulary.
 *
 * **Four of the five item caps are numbers this product already pinned**,
 * restated here rather than imported because their homes reach the language
 * model (`src/lib/site-profile/summary.ts`'s `VOICE_LIST_MAX`) or are about
 * what a model may *answer* with rather than what a prompt may *carry*:
 *
 *   · `products` 8 and `promises` 8 — `VOICE_LIST_MAX.products` / `.claims`;
 *   · `audience` 4 — `PROFILE_LIST_BOUNDS.audienceTerms.max`, §6.7's own
 *     "2–4 audience/use-case terms";
 *   · `vocabulary` 12 — `PROFILE_LIST_BOUNDS.vocabulary.max`.
 *
 * `itemChars` and `jobChars` are this issue's own: an item is a product name
 * or a promise, not a paragraph, and *what you do* is one sentence.
 *
 * `blockChars` is the ceiling over all of it together, applied last, so the
 * worst case is one number rather than the product of six. It was 1,200
 * while the profile was five short lists; the knowledge base (SPEC §5,
 * 2026-09-29, #1133) is offerings with their features and prices, proof,
 * buyers' questions and the founder's answers, and 6,000 characters —
 * about 1,500 tokens, under half a cent a call on the small tier — is the
 * drafted cap the issue names. What is trimmed first is named in
 * `src/lib/generate/voice/profile-block.ts`.
 *
 * `knowledgeItems` is how many entries each knowledge list may carry, and
 * `knowledgeItemChars` how long one may be: a differentiator or a customer
 * result is a sentence, not a product name.
 */
export const PROFILE_PROMPT_CAPS = Object.freeze({
  products: 8,
  audience: 4,
  promises: 8,
  vocabulary: 12,
  itemChars: 80,
  jobChars: 200,
  knowledgeItems: 12,
  knowledgeItemChars: 240,
  blockChars: 6000,
} as const);

/**
 * The knowledge base's bounds — SPEC §5 (2026-09-29, #1133; bounded
 * 2026-10-07, issue 1314). The numbers are drafted defaults the owner may
 * correct.
 *
 * `MAX_PAGES` is how many pages one read asks about, the most informative
 * first (`site-profile/knowledge/priority.ts`). It was the crawl's hundred,
 * and the read's cost then grew with the site: 74 pages of one panel site
 * cost 44¢, a third of a deep pass. Twenty pages hold the home page, the
 * pricing, product or service, about, FAQ and location pages of a site of
 * any size.
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
  /** A site that serves an empty JavaScript shell (SPEC §6, issue 1374): the
   *  most pages one pass has the vendor draw, and the longest it waits for
   *  them. Twelve pages are 1.8 cents at `PRICE_BOOK.RENDERED_PAGE_C`. */
  RENDERED_PAGES: 12,
  RENDER_MS: 60_000,
} as const);

/** SPEC §2 (issue 1379): how long a pass waits for the vendor's rendered
 *  read of a home page whose plain read was a bot-protection page. One ask,
 *  inside `reading_your_site`'s own ten seconds on the free path. */
export const CHALLENGE_RENDER_MS = 5_000;

/** SPEC §2 (issue 1387): what a site's listing in search must hold before
 *  its market is read from it, where bot protection kept the reader off its
 *  own pages. Fewer ranked searches than `minSearches`, or fewer than
 *  `minDescriptive` that say anything beyond the brand's own name, is too
 *  thin to name a market, and the pass does not guess. `maxPages` and
 *  `snippetChars` bound what one profile call is sent. Drafted defaults. */
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

/** The site profile's bounds — `SPEC.md` §2, verbatim: "Bounded: 100
 *  pages, one run per scan, inside the existing egress caps and the 12¢
 *  ceiling", and §12 ruling 8's "up to 100 pages read from the sitemap and
 *  internal links" (2026-09-12, issue #577).
 *
 *  `MAX_PAGES` is the ruling's own number and the only place it is
 *  written. `CRAWL_MS` is the crawl's share of the pass: the free pass
 *  runs under `TIMING.reportCeilingS`, and a crawl that spent the whole of
 *  it would leave the market, the twelve and the score unmeasured — so the
 *  crawl stops at its budget and records what it has, which is what §2's
 *  "a site of fewer than 100 pages records what it has" already asks of
 *  it. `CONCURRENCY` is what makes 100 documents fit that budget at all
 *  (one at a time at the fetcher's own 8 s timeout could not); it is small
 *  enough that the crawl is never the reason a customer's own server is
 *  slow. `PAGE_SAMPLE_CHARS` bounds what each page contributes to the
 *  voice prompt, the way `PROFILE_INPUT_MAX_CHARS` bounds the profile's:
 *  the prompt is bounded, the inventory reads every page it fetched.
 *
 *  `VOICE_INPUT_MAX_CHARS` is 4 000 and not the profile call's 20 000 for
 *  one reason only — §2's 12¢ ceiling. The pass reserves ~11.08¢ before
 *  this call, and `llm()` reserves twice the estimated input plus the
 *  output pin, so a 20 000-character prompt alone would put the free pass
 *  at ~13.06¢ and break the promise the lead magnet is built on. Four
 *  thousand characters is several pages of the customer's own prose,
 *  which is what reading a voice takes; the crawl still reads every page
 *  it fetched into the inventory. */
export const SITE_PROFILE = Object.freeze({
  MAX_PAGES: 100,
  CRAWL_MS: 12_000,
  /** Master ruling under SPEC §5 (2026-09-12, issue 610): the crawl holds
   *  at most 8 MB in total, and a site's `Crawl-delay` is honoured up to 1 s
   *  between reads — a longer one is applied as 1 s, and the time budget
   *  above then decides how much of the site that pace reaches. */
  CRAWL_MAX_BYTES: 8_000_000,
  CRAWL_DELAY_MAX_MS: 1_000,
  CONCURRENCY: 6,
  PAGE_SAMPLE_CHARS: 600,
  VOICE_INPUT_MAX_CHARS: 4_000,
} as const);

/** SPEC §2 (2026-09-24, #1058/#1069): the one logo the free scan keeps per
 *  site, for the gallery at `/scans` and the landing's strip. It is read
 *  off the home document the crawl already holds, so choosing it costs
 *  nothing; fetching it is at most `MAX_TRIES` image reads inside one
 *  `BUDGET_MS`, and 0¢ — a read of the site's own server, like every
 *  other own-document read. `MAX_BYTES` keeps a stored logo small enough
 *  to serve from our own origin sixteen to a page; `MIN_ICON_PX` is what
 *  makes a declared `icon` "large" rather than a 16px favicon. */
export const SITE_LOGO = Object.freeze({
  MAX_TRIES: 2,
  BUDGET_MS: 3_000,
  MAX_BYTES: 65_536,
  MIN_ICON_PX: 96,
} as const);

/** SPEC §7 Rules (2026-09-12): "Every asset links to real inventory pages
 *  (pricing, about, features, product) and to earlier assets in its
 *  cluster." (`src/lib/generate/links/`)
 *
 *  `PRODUCT_PAGES_MAX` bounds the one purpose a site can hold dozens of:
 *  pricing, about and features are one page each, and a site with forty
 *  integration pages would otherwise hand the page forty links. The
 *  product pages linked are the ones whose own headings share words with
 *  the page's query, most-shared first.
 *
 *  `CLUSTER_PAGES_MAX` bounds the same list for the cluster's earlier
 *  pages, newest first. At one page a day a cluster rarely reaches it; the
 *  bound is there so a long-lived cluster does not turn every new page
 *  into an index of the old ones. */
export const CROSS_LINKS = Object.freeze({
  PRODUCT_PAGES_MAX: 2,
  CLUSTER_PAGES_MAX: 5,
} as const);

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

/** SPEC §9's technical-issue checks over the crawled pages — the two numbers
 *  the owner ruled on 2026-09-14.
 *
 *  `SLOW_PAGE_MS`: a page is slow when the crawl's own fetch of its document
 *  took at least this long. It is the one speed signal that costs nothing
 *  beyond the crawl itself; a page served from the cache has no timing and
 *  is left out of the set the count is measured over.
 *
 *  `CRITICAL_PAGE_SHARE`: a per-page check is "Worth fixing" from one page
 *  and "Critical" once at least this share of the set it was measured over
 *  is affected. A site-wide fault (a `noindex` home page, no sitemap, an AI
 *  reader blocked) is "Critical" whenever it is present. */
export const SITE_ISSUES = Object.freeze({
  SLOW_PAGE_MS: 3_000,
  CRITICAL_PAGE_SHARE: 0.25,
} as const);

/** How many `llm()` calls one free pass issues — BP-009 `## NFR budget`,
 *  quoted: "the free scan's **two** nano calls — `profile` and
 *  `question-phrasing` (BP-025 decision 2) — sit inside the 60-second
 *  promise". Both are `nano`; they are
 *  `src/lib/market/questions/profile.ts` and `…/phrase.ts`, issued one
 *  after the other inside the `reading_your_market` stage. Pinned so the
 *  budget arithmetic has a count to multiply the per-call budget by
 *  instead of a literal 2 typed into a test (issue #452).
 *
 *  **Still two after the site profile landed** (2026-09-12, issue #577).
 *  `SPEC.md` §12 ruling 8 puts the profile in the free scan, and it is
 *  there: the free pass crawls up to `SITE_PROFILE.MAX_PAGES` pages, gives
 *  each one a purpose, reads the site's name off its own home document and
 *  stores the inventory. What it does not do there is *infer* — the voice
 *  summary, the products and the claims need one `site-profile` model
 *  call, and a third nano call does not fit the time this pin is part of:
 *  two calls already hold 30 s of the 60 the platform allows the
 *  invocation (`INFERENCE_TIMEOUT_MS` above), and `tests/llm/budget.test.
 *  ts` holds the pass to leaving half the invocation for the fetches, the
 *  SERPs and the battery that are not this seam's. So the inference half
 *  of the profile derives on the first *paid* pass — the deep pass, which
 *  runs in the background once setup is submitted (issue 839) — and
 *  refreshes weekly, which is the cadence §5 and ruling 8 ask for. Nothing
 *  about the free scan's own promise changes: the crawl, the purposes and
 *  the inventory that cross-linking needs are all stored by it. */
export const FREE_PASS_INFERENCE_CALLS = 2 as const;

export const BATTERY = Object.freeze({
  QUESTIONS: 12, TARGET_SERPS_MAX: 13, MEASURED_PAGES_MAX: 25, COMPETITORS_MAX: 5,
  /** #1195: the market's buyer prompts a deep pass asks AI Mode beside the
   *  twelve, so the rivals are concluded from answers in the market it
   *  measures (drafted default, the owner may correct it; 3.2¢ live). */
  MARKET_PROMPTS: 8,
} as const);

/**
 * A market's search terms (SPEC §6, owner D49 of 2026-10-05, issue 1270).
 * `MAX` is how many candidates one keyword-overview call reads. Volumes
 * move slowly, so the terms of a market that still stands are read again
 * only after `REFRESH_DAYS`.
 */
export const MARKET_TERMS = Object.freeze({ MAX: 10, REFRESH_DAYS: 30 } as const);

/**
 * Rivals and comparison targets need search demand (SPEC §6, owner D50 of
 * 2026-10-05, issue 1271). A brand is searched at `MIN_VOLUME` searches a
 * month or more: reachkit.app's AEO Engine has 70 and the owner counts it
 * as searched by no one, while the least-searched rival he names has 320
 * (`docs/walk/titles-and-vocabulary.md`). A brand's volume is read again
 * after `REFRESH_DAYS`. `PAIRS` is how many of the most-searched rivals are
 * set against each other where the business's own brand is not searched.
 * Drafted defaults; the owner may correct them.
 */
export const RIVAL_DEMAND = Object.freeze({ MIN_VOLUME: 100, REFRESH_DAYS: 30, PAIRS: 3 } as const);

/**
 * SPEC §6 (2026-10-09, issue 1365) — rivals are chosen from who the pass
 * saw. `FIRST_PAGE_PLACES` of the five go first to the on-market products
 * that hold the most first-page places on the measured searches, whatever
 * their brand volume; the rest follow D50's order, one the pass saw before
 * one it did not. `HOLDERS` is how many other sites the Rivals tab names
 * where no tracked rival holds a first-page place. Drafted defaults; the
 * owner may correct them.
 */
export const RIVAL_PRESENCE = Object.freeze({ FIRST_PAGE_PLACES: 2, HOLDERS: 3 } as const);

/**
 * SPEC §6 (owner, D19 final, D32 and D33 of 2026-10-03, #1162) — the tracked
 * buyer prompts, which are the weekly AI measure.
 *
 * `SPLIT` is the set's shape, 25 in all. `ENGINES × RUNS` is how often each
 * prompt is asked in one weekly pass: at the measured 0.12¢ an ask that is
 * 0.48¢ a prompt and 12¢ a full set (`docs/walk/d19-cost.md`). At most
 * `ROTATION_SHARE` of the set is replaced in any `ROTATION_WEEKS`, and only
 * a prompt added that way is pre-checked (D33).
 */
export const TRACKED_PROMPTS = Object.freeze({
  SPLIT: Object.freeze({ category: 5, "use-case": 7, persona: 4, comparison: 4, problem: 3, branded: 2 }),
  ENGINES: 2,
  RUNS: 2,
  ROTATION_SHARE: 0.2,
  ROTATION_WEEKS: 13,
} as const);

/** SPEC §6 (owner, D32 of 2026-10-03, #1162): LLM Mentions is bought only
 *  for a site whose own ranked footprint is at least this many keywords,
 *  and then once in this many weeks. */
export const LLM_MENTIONS_MIN_FOOTPRINT = 30 as const;
export const LLM_MENTIONS_EVERY_WEEKS = 4 as const;

/**
 * SPEC §6 (2026-09-20, #908) — how many AI questions this product tracks
 * for one site, in all. Both numbers were drafted there and **confirmed as
 * written** by the owner on 2026-09-21 (§12, #985), so they are transcribed
 * here and not chosen (rule 1.2).
 *
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
export const TRACKED_QUESTIONS_MAX = 24 as const;             // SPEC §6 2026-09-20
export const PAGE_QUESTION_RETIRE_WEEKS = 8 as const;         // SPEC §6 2026-09-20


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
  /** SPEC §6 (2026-09-22, #1004) — DataForSEO's LLM Mentions, bought once a
   *  week per site inside the Monday pass. Six days, for exactly the reason
   *  `aiBattery` above is six: the Monday trigger is hourly and a DST shift
   *  can land a run an hour early, and at seven the early run would be
   *  served last week's rows wearing this week's date. Six leaves 24 hours
   *  of slack and still refuses to buy the same site twice in one week —
   *  which is what makes a re-run of a Monday pass free rather than a
   *  second 10c request charge. */
  llmMentions: 6,
} as const);

/** BUILD §11's free-path bounds, plus the two that issue 885 adds so a
 *  script cannot walk past them.
 *
 *  `scansPerIpPerHour`, `inFlightPerIp` and `scansPerDay` are the original
 *  three. Between them one network could still run 5 scans an hour for 24
 *  hours — 120 scans, `120 x CAPS.FREE_C` = 1440¢, more than half the free
 *  path's own 2400¢ worst case — and one domain could be claimed over and
 *  over from different networks, because the stored report that makes a
 *  repeat free is read at the report address and not by the admission
 *  order the API route calls.
 *
 *  Both new figures are drafted defaults the owner corrects:
 *   - **`scansPerIpPerDay: 20`.** Four hours at the hourly bound, and
 *     `20 x CAPS.FREE_C` = 240¢ — a twentieth of the day's ceiling, where
 *     the hourly bound alone left one network six tenths of it. A visitor
 *     scanning their own site and a few rivals is in single digits.
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
  // **The design ceiling fires before the platform's, with margin to write
  // the partial report** (ruling 2026-09-10, issue #456). The free
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
  /** Issue #782: how long after setup completes a site with no ended deep
   *  pass is re-sent one by `account/maintenance` — past the release
   *  deadline, so a pass that is merely slow has had its window — and how
   *  far back that look goes: the queue's own idempotency window, inside
   *  which a re-send is dropped for a pass already queued. */
  deepPassBackstopMin: 15, deepPassBackstopH: 24,
  /** The platform's own ceiling on the `POST /api/scan` invocation, in
   *  seconds — `export const maxDuration` on that route, which must stay a
   *  literal there because Next reads route segment config out of the
   *  source at build time. This is the same number, pinned where the engine
   *  can read it; `tests/scan/ceilings-pins.test.ts` reads the route source
   *  and fails if the two ever disagree. 60 is the plan this product
   *  deploys to (Hobby). Issue #456. */
  platformCeilingS: 60,
  /** The ceiling on one invocation of a job step on `/api/jobs`, in
   *  seconds — `export const maxDuration` on that route, a literal there
   *  for the same reason as above. Not `platformCeilingS`: the project runs
   *  fluid compute, whose default and plan ceiling is 300, and the onboarding
   *  pass's measurement step (every question's SERPs, ChatGPT and AI Mode
   *  reads, rival sizing, the extra seeds) runs in one invocation and does
   *  not fit in the free request path's 60. Issue 798. */
  jobsCeilingS: 300,
  /** The time ceiling on a paid pass's measurement (deep and weekly), in
   *  seconds — its own, never the free report's `reportCeilingS` (issue
   *  855). The measurement step runs in one `/api/jobs` invocation, so the
   *  ceiling sits inside `jobsCeilingS` with room to compose and store the
   *  report before the platform freezes the invocation. A deep pass read
   *  against the free 50 s stopped after three of its twelve SERPs. */
  paidPassCeilingS: 240,
  /** How long before that ceiling a paid pass stops waiting on its asks
   *  (#1195; drafted default, the owner may correct it). A ChatGPT task on
   *  the standard queue waited 207 s on 2026-10-02 and ran the re-measure of
   *  reachkit.app into its ceiling after one question, so the pass never
   *  scored, sized its rivals or ended `complete`. An ask still queued here
   *  is that engine's unmeasured cell; the pass goes on to score inside its
   *  ceiling. No ceiling moves. */
  paidPassAskReserveS: 25,
  /** How many further job steps read the tracked-prompt answers a weekly
   *  pass paid for and stopped waiting on (#1160; drafted default, the
   *  owner may correct it). Each waits up to `paidPassCeilingS` inside its
   *  own invocation and buys nothing. On 2026-10-05 the pass waited 185 s
   *  and 73 of its 100 asks were still queued; three rounds give a task
   *  about a quarter of an hour from its post. */
  weeklyCollectRounds: 3,
  /** How long before `reportCeilingS` a free scan stops waiting for a
   *  queued Google read (SPEC §6, 2026-10-08, issue 1352): the time it
   *  keeps to score, compose and store the report inside its ceiling. A
   *  read still queued then is that search's unmeasured cell. */
  freePassAskReserveS: 5,
  /** How long before `platformCeilingS` a free pass still running in its
   *  request marks its own row `failed` (issue 798). Past the design
   *  ceiling a pass is only storing its partial report; one still going
   *  here is about to be frozen, and its `running` row would refuse the
   *  visitor's network until the sweep came round. The margin is the time
   *  that one guarded write needs; a report stored after it overwrites the
   *  failure with the truth. */
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
   *  more than the tick it would have waited for anyway. Issue #456. */
  sweepMarginS: 30,
  // BP-034 `## NFR budget` (archived corpus), verbatim: "a rival suggestion
  // call is bounded at 3 s and, on timeout, leaves `SuggestionState` at
  // `none_found` rather than holding the screen — **setup is never held on
  // suggestions**". Seconds, like its three neighbours. Issue #37.
  suggestCeilingS: 3,
} as const);

/** SPEC §6, right-sizing law (owner, 2026-09-16, #777 · #779): a target is
 *  offered only if it is winnable *for this site's presence*. Two proportions,
 *  both scaled by the site's own ranked count (its footprint, §0):
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
 *  `keyword_page` (§6, 2026-09-15, #769); demand gates every new target.
 *  Improve reads competition only — the site already ranks for that search.
 *
 *  - **Difficulty** — `difficulty*` (SPEC §6, owner walk 2026-09-17, issue
 *    858): the vendor's own keyword difficulty (0–100, "difficulty of
 *    ranking in the first top-10 organic results", log scale) may be no
 *    higher than `30 + 10 × log10(1 + own)` (Reach), `15 + 10 × log10(1 +
 *    own)` (Winnable), never above 100. A search harder than the first is
 *    outsized exactly as a search too big is. Where the vendor gives no
 *    difficulty the search is read on volume and competition alone.
 *
 *  The cold-start demand floors were 1000 and 200 until issue 858: a floor
 *  of 1000 admitted "best seo software" for a site ranking for three
 *  keywords. The numbers are owner-correctable defaults. */
export const WINNABILITY = Object.freeze({
  qualifyFloor: 500, qualifyMultiple: 5, nearFloor: 100, nearMultiple: 2,
  demandFloor: 300, demandMultiple: 10, demandNearFloor: 100, demandNearMultiple: 2,
  difficultyFloor: 30, difficultyNearFloor: 15, difficultyPerDecade: 10, difficultyMax: 100,
} as const);

export const RIVAL_SIZE_BANDS = Object.freeze({
  nearFloor: 100, nearMultiple: 2, middleFloor: 500, middleMultiple: 5,
} as const);

/** How far a paid pass goes in sizing the rivals **its own twelve top
 *  tens** hold (issue 901). Drafted defaults, chosen here under rule 1.1;
 *  the owner may correct either number.
 *
 *  `candidatesMax` — one candidate per question the pass may ask
 *  (`BATTERY.QUESTIONS` is the same number today and bounds a different
 *  thing, so it is not reused): enough that every question's top ten can
 *  contribute a domain to band against, and no more. At
 *  `PRICE_BOOK.RANKED_RIVAL_COST_C` a first pass therefore spends at most
 *  28.8¢ on this, well inside `CAPS.DEEP_C`; every later pass re-reads the
 *  same domains inside §6.4's 30-day rival window, where a cache hit is
 *  free.
 *
 *  `reserveCents` — what this sizing may not take. A pass types its
 *  opportunities out of the same cap after its report is stored (issue
 *  798), and four Haiku calls at `INFERENCE_PRICE_BOOK.haiku` come to
 *  about a cent; four cents is several times that and is the only spend
 *  the pass still owes this cap. Issue 1134 adds the pass's one fit
 *  judgement to what it owes: its up-front reservation is about six cents
 *  (`INFERENCE_MAX_OUTPUT_TOKENS["topic-fit"]` at the Sonnet price, plus
 *  its input), so the reserve was twelve. Issue 1208 adds two small-tier
 *  calls before that judgement — the buyer searches and their check, about
 *  1.2¢ reserved together — so it is fourteen. A candidate the reserve leaves no
 *  room for is recorded `unsized` with `budget_reached`, never guessed at. */
export const SERP_RIVAL_SIZING = Object.freeze({
  candidatesMax: 12, reserveCents: 14,
} as const);

/** SPEC §6 (owner D64, issue 1301; a drafted default the owner may correct):
 *  how many of a site's rivals one weekly pass sizes again. A sizing is kept
 *  30 days, and a site's five rivals are usually first sized on one day, so
 *  they fall due together: 12¢ in one week, which with the rest of a weekly
 *  pass is over `CAPS.WEEKLY_C`. One a week keeps every weekly pass under
 *  its cap; the others keep the size they had, dated, until their week. A
 *  deep pass and a re-measure size every rival that is due. */
export const WEEKLY_RIVAL_RESIZES = 1 as const;

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
  duplicateThreshold: 0.85, regenerations: 1,
} as const);

/** SPEC §7 *honesty by page type* (issue 1136): the most sentences naming
 *  the business one fit check reads. A page of 2,500 words that names it in
 *  every paragraph stays inside the check's one small call. */
export const FIT_CHECK_MAX_SENTENCES = 40;

export const SUPPLY = Object.freeze({
  deepTarget: 30, shortThreshold: 7,
} as const);

/** SPEC §0 and §7: "Default 24 h; range 1-7 days; there is no zero window."
 *  `minDays` read 0 until 2026-09-12, which is a draft with no veto path at
 *  all — the one window the ruling forbids. */
export const VETO = Object.freeze({
  defaultHours: 24, minDays: 1, maxDays: 7,
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

/** The answer readers (SPEC §9, 2026-09-29, D14, issue 1145): the crawlers
 *  an AI answer is drawn from. Googlebot is one of them — Google's AI
 *  answers need only a page that is indexed and may show a snippet. The
 *  blocked-readers count, the score's access gates and the robots fix lines
 *  read this list; the training crawlers are `AI_TRAINING_CRAWLERS`, and a
 *  site that turns those away has made a choice, not a fault. The hosted
 *  robots policy allows both lists by name. An empty list fails
 *  `tests/config/constants.test.ts`'s non-empty row. */
export const AI_READER_AGENTS = Object.freeze([              // SPEC §9 D14
  "Googlebot", "OAI-SearchBot", "Claude-SearchBot", "PerplexityBot",
] as const);

/** SPEC §6 (2026-09-20, #908) measure (d) and §7 of the same date, issue
 *  #921 — the three closed lists behind "pages fetched by an answer engine
 *  for a user's question, and visitors arriving from one, counted by day,
 *  page and engine".
 *
 *  **Beside `AI_READER_AGENTS`, never inside it.** That list is read by
 *  the blocked-readers count, the paste block and the score; adding a
 *  name to it would change a score and a site-issue count. These are a
 *  different question — not "may an engine read this site" but "did one
 *  read this page, and why" — so they are their own pins and the one
 *  overlap (the three search indexers) is spelled here again rather than
 *  sliced out of a list that means something else.
 *
 *  **Three kinds, and only two of them are progress.** A *user fetcher* is
 *  an engine going to the page because a person asked it something; a
 *  *search indexer* is an engine building the index it answers from. §6(d)
 *  is explicit that "training crawlers are not progress and are not shown",
 *  so `AI_TRAINING_CRAWLERS` exists to be *excluded* by name rather than by
 *  omission — a token that matches it is never counted, whatever else the
 *  agent string also says.
 *
 *  Each token maps to the engine a customer knows it by; the engine names
 *  are internal handles (constitution rule 1.1), and every word drawn on
 *  the card is a registry key. */
export const AI_BLOG_ENGINES = Object.freeze([               // SPEC §6 2026-09-20 (d) · issue 921
  "chatgpt", "perplexity", "claude", "gemini", "copilot",
] as const);

/** The user-triggered fetchers: an engine fetching the page because a
 *  person asked it a question. Named by SPEC §6's own issue #921. */
export const AI_ANSWER_FETCHERS = Object.freeze({            // issue 921
  "ChatGPT-User": "chatgpt",
  "Perplexity-User": "perplexity",
  "Claude-User": "claude",
} as const);

/** The search indexers: an engine building the index its answers are drawn
 *  from. All three are also in `AI_READER_AGENTS`, which asks a different
 *  question of them. */
export const AI_SEARCH_INDEXERS = Object.freeze({            // issue 921
  "OAI-SearchBot": "chatgpt",
  "PerplexityBot": "perplexity",
  "Claude-SearchBot": "claude",
} as const);

/** Excluded by name, never by omission: a hit whose agent carries one of
 *  these is not counted at all. §6(d): "training crawlers are not progress
 *  and are not shown." SPEC §9 (D14) reads the same list: a site that
 *  blocks one has opted out of training, which is never an issue.
 *  Google-Extended is a robots token only and never appears in a request's
 *  agent string. */
export const AI_TRAINING_CRAWLERS = Object.freeze([          // issue 921 · SPEC §9 D14
  "GPTBot", "ClaudeBot", "Google-Extended",
] as const);

/** Where a visitor came from, when the referrer or `utm_source` says an AI
 *  app. Hosts are matched as the host itself or a subdomain of it, so
 *  `www.perplexity.ai` is Perplexity and `perplexity.ai.example.com` is
 *  not. This is the "at least" half of the card: most AI apps send no
 *  referrer at all, and the sentence beside the figure says so. */
export const AI_REFERRER_HOSTS = Object.freeze({             // issue 921
  "chatgpt.com": "chatgpt",
  "perplexity.ai": "perplexity",
  "gemini.google.com": "gemini",
  "copilot.microsoft.com": "copilot",
  "claude.ai": "claude",
} as const);

/** The same five, as the `utm_source` values an AI app appends when it
 *  sends no referrer. Lower-cased at the comparison, never here. */
export const AI_REFERRER_SOURCES = Object.freeze({           // issue 921
  chatgpt: "chatgpt",
  perplexity: "perplexity",
  gemini: "gemini",
  copilot: "copilot",
  claude: "claude",
} as const);

/** The card's own window (drafted, issue #921: "Last 7 days") and how long
 *  a day's counts are kept. Four weeks is the rolling window every other
 *  AI-answer measure on this screen is read over (`ANSWER_RATE_WEEKS`), so
 *  the roll-up outlives the card's week by enough to answer a month and no
 *  longer. Retention is enforced by the writer, in the same statement that
 *  counts a hit — see `record_publication_read`. */
export const BLOG_READS_WINDOW_D = 7 as const;               // issue 921
export const BLOG_READS_RETENTION_W = 4 as const;            // issue 921

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
  // SPEC §0's Earn answer is "a first-party citable asset on the customer's
  // own domain" — the most work of any page the engine proposes.
  listed_page: 0.7,
} as const);                                                 // `unblock` is unranked

export const FIT_WEIGHT = Object.freeze({ winnable: 1.0, reach: 0.5, "not-yet": 0 } as const); // BP-040 d3
export const SUPPLY_TARGET_DEPTH = 30 as const;              // BP-041 d4 · REQ-095 c1
export const SUPPLY_SHORT_BELOW = 7 as const;                // BP-041 d4 · REQ-095 c5
export const TOO_EARLY_WEEKS = 3 as const;                   // BP-051 d4 · REQ-063 c2

// Generation
export const SHINGLE_SIZE = 5 as const;                      // BP-042 · REQ-050 c9
export const NEAR_DUPLICATE_MAX = 0.85 as const;             // BP-042 · REQ-050 c9 · BUILD §8

/** SPEC §7 (owner, D13, issue 1144): a draft is compared with what ReachKit
 *  wrote for **other** sites, at `NEAR_DUPLICATE_MAX` — the same bar as the
 *  same-site check, so there is no second threshold here. `months` is the
 *  ruling's; `pagesMax` bounds one read, newest first (a drafted default:
 *  a run that reaches it logs that it did); `noteSentences` is how many of
 *  the draft's own shared sentences the one rewrite is told to avoid. */
export const ELSEWHERE = Object.freeze({ months: 12, pagesMax: 1000, noteSentences: 12 } as const);

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
/** How long the project's domain list stands before one hostname is asked
 *  about again (SPEC §5, 2026-09-12 — the hostname is added "on save … and
 *  the certificate is automatic once the CNAME resolves"). Chosen, not
 *  transcribed: the health pass reaches every hosted destination, so
 *  without a window each pass is one vendor call per destination. An hour
 *  is the coarsest window that still heals a save made while the vendor was
 *  unreachable on the same day the founder made it. Reversal cost is this
 *  one number. */
export const DESTINATION_HOSTNAME_RECHECK_H = 1 as const;     // SPEC §5 (2026-09-12)
/** The shortest gap between two vendor calls a founder's own "check
 *  connection" press may make for one site (issue #757). Chosen, not
 *  transcribed: a press asks the vendor now rather than waiting out
 *  `DESTINATION_HOSTNAME_RECHECK_H`, so it needs its own floor or the button
 *  becomes a way to call the Domains API in a loop. Half a minute is longer
 *  than a double-click or a second tab and shorter than the time it takes to
 *  edit a DNS record and come back. A press inside it is told when it may ask
 *  again — never handed an old answer as a new one. Reversal cost is this one
 *  number. */
export const DESTINATION_HOSTNAME_CHECK_FLOOR_S = 30 as const; // SPEC §5 (2026-09-16, #757)

/** How often a founder may have their market measured again now (issue 837).
 *  Chosen, not transcribed: the owner asked for a bound "so it cannot be
 *  spammed". `perDay` counts every paid deep pass the site started in the
 *  last 24 hours, the onboarding pass included — each is a `DEEP` cap of
 *  spend, so three a day is a founder trying two broader categories after a
 *  thin first read, and never a loop. `runningHoldMin` is how long a started
 *  pass that has not ended is treated as still under way: one pass at a time,
 *  and a pass the platform lost stops blocking the next after it. Reversal
 *  cost is these two numbers. */
export const REMEASURE = Object.freeze({                      // SPEC §6 (2026-09-17, issue 837)
  perDay: 3,
  runningHoldMin: 30,
  /** How long the side panel states a finished pass's end — done, failed or
   *  stopped — before it says nothing (issue 1196). Long enough to be read
   *  by a founder who stepped away while it ran. */
  endShownMin: 30,
  /** At most this many broader categories are offered. */
  suggestions: 3,
});

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
// SPEC §8 Retention (#569): idle 7 days · veto < 6 h · win-back once at +30 d after access ends.
// Stated in the SPEC table, pinned here so each is written once.
export const RETENTION_MAIL = Object.freeze({
  inactivityIdleDays: 7, vetoReminderHours: 6, winbackAfterAccessDays: 30,
  /** How stale a stored "last seen" may be before an /app visit rewrites it. */
  seenRefreshMinutes: 60,
} as const);
export const NURTURE_MAX_TOUCHES = 3 as const;                // BP-029 · REQ-010 c9
export const SEQUENCE_START_DEADLINE_DAYS = 7 as const;       // BP-029 · REQ-010 c12
export const FIRST_PAGE_RETRY_WINDOW_H = 24 as const;         // BP-029 · REQ-010 c8
export const FIRST_PAGE_RETRY_MINUTES = Object.freeze([5, 30, 120, 360, 720, 1440] as const);  // BP-029 d4
/** A writer's claim on a report's free page older than this never finished (its
 *  invocation died): the next lead may take the scan and write it. Longer than
 *  any one job invocation can live. SPEC §2 (issue 826, chosen). */
export const FIRST_PAGE_CLAIM_STALE_MINUTES = 30 as const;

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
export const OWN_DOCUMENT_MAX_BYTES = 6_000_000 as const;     // ruling 2026-09-10 · #479 · BUILD §6.4

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

/** SPEC §6 (owner, 2026-09-20, #908): the AI-answers tab states "a rolling
 *  four-week rate — answers that name or link the site over all answers
 *  asked". Four weekly passes, and not the twelve above: the window exists
 *  because one week of twelve questions is too small a sample to read a
 *  direction from, and the tab's own sentence says so. A separate pin
 *  because it is a separate reading — the tile over it counts *answers*,
 *  where `OVERVIEW_TRAILING_WEEKS` counts *weeks*. */
export const ANSWER_RATE_WEEKS = 4 as const;                  // SPEC §6 2026-09-20

/** SPEC §6 (owner, D58 of 2026-10-06, issue 1287): no mention rate is shown
 *  until this many weeks of the current prompt set exist. Before then the
 *  count and its sample stand in its place ("0 of 46 answers"). */
export const MENTION_RATE_MIN_WEEKS = 2 as const;             // SPEC §6 2026-10-06 D58

/** SPEC §7 (owner, D59 of 2026-10-06, issue 1287): a context pack drops a
 *  rival pricing fact read more than this many days ago. */
export const RIVAL_PRICE_MAX_AGE_D = 30 as const;             // SPEC §7 2026-10-06 D59

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

/** SPEC §6: "A Monday verdict of 'not working' on a cluster suppresses new
 *  Write opportunities in that cluster for four weeks; Improve of the live
 *  URL in it stays allowed." */
export const CLUSTER_SUPPRESS_WEEKS = 4 as const;             // §6

/** SPEC §7 (owner, D26, 2026-10-02): "A topic stopped twice, or skipped by
 *  the founder, rests for 28 days." */
export const TOPIC_REST_DAYS = 28 as const;                   // §7

/** SPEC §7 (owner, D26): when the day's draft is stopped, the same run
 *  tries the next-ranked opportunity for the date "at most once more". */
export const DAY_TOPICS_MAX = 2 as const;                     // §7

/** SPEC §6 (2026-09-29, *Topics by business fit*): two searches whose
 *  stored top tens share this many page addresses are one topic. Drafted
 *  threshold; the owner may correct it (#1131). */
export const SAME_TOPIC_SHARED_ADDRESSES = 4 as const;        // §6

/** SPEC §6 (2026-10-02, #1181): a page younger than this is never the
 *  target of a refresh. Drafted default; the owner may correct it. */
export const REFRESH_MIN_AGE_DAYS = 30 as const;               // §6

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
  /** How many of the site's own published and planned pages a brief is
   *  handed, newest first. */
  BRIEF_PAGES_MAX: 100,
  /** SPEC §7 (owner, D46, 2026-10-04): the content types the mix leaves out
   *  for now. A topic of one of them fills no day. The one list, and it is
   *  empty: D48 took `insights` out (issue 1259, it reads a news search) and
   *  D47 took `listicle` out (issue 1258, its table is built in code). */
  PAUSED_TYPES: Object.freeze([] as readonly string[]),
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

/** SPEC §6: "A format page fires only for a missing comparison, alternative,
 *  integration or template; glossary, changelog, blog and resources hub
 *  never qualify." The list is the gate: a format outside it never fires. */
export const FORMAT_PAGE_ALLOWED = Object.freeze([
  "comparison", "alternative", "integration", "template",
] as const);                                                  // §6


/** SPEC §7: the answerability pass may "shorten a first block to 40–320
 *  characters where a question heading already exists". The same bound is
 *  what a draft's opening block must fall inside to count as an answer. */
export const ANSWER_FIRST_BLOCK_CHARS = Object.freeze({ min: 40, max: 320 } as const); // §7

/** SPEC §7 (2026-09-29, *What every page carries*): the counts a generated
 *  page is held to, in code. The answer box is counted in words; a section
 *  is an H2. `taglineRepeats` is the round-1 review's cap (2026-10-02,
 *  issue 1137): a promise of the business's own is said at most twice. */
export const PAGE_BLOCKS = Object.freeze({
  answerWords: { min: 40, max: 60 },
  takeaways: { min: 3, max: 5 },
  faq: { min: 3, max: 6 },
  taglineRepeats: 2,
} as const);                                                   // §7 · issue 1137

/** SPEC §7 (owner, D51; issue 1266) — what the stage-4 `title` check holds a
 *  page's `<title>` and its meta description to. The numbers, the year's
 *  types and the banned patterns are the ruling's; the engine names and the
 *  first three words of a search term are how code reads "an engine" and
 *  "the search term" (drafted). */
export const TITLE = Object.freeze({
  chars: { min: 30, max: 65 },
  /** The search term starts within this many words of the title. */
  headWords: 5,
  /** How many of a search term's leading words the title must carry. */
  termWords: 3,
  /** Token overlap with a title the site has published or planned. */
  overlapMax: 0.8,
  description: { min: 120, max: 155 },
  /** The types whose title may carry the current year. A comparison and an
   *  alternatives page are listicles (D42). */
  yearTypes: ["listicle", "research", "insights"],
  banned: [
    "questions, answered",
    "buyer questions",
    "ultimate guide",
    "everything you need to know",
    "unlock",
    "comprehensive",
  ],
  engines: ["chatgpt", "perplexity", "claude", "gemini", "copilot", "google", "ai overviews", "ai mode"],
} as const);                                                   // §7 · D51 · issue 1266



/** How many of a site's own passages a caller that needs only a few reads
 *  (`readFacts`): setup's voice sample and the lead's free page. A paid
 *  page's context pack carries `PACK.facts`. */
export const BRIEF_MAX_FACTS = 8 as const;                     // §7 · issue 475

/** SPEC §7 (2026-09-29, *Two pools of facts*; issue 1135) — the research
 *  step's bounds. Chosen, not transcribed, except where the ruling names
 *  the figure: "at most two primary studies found by one search", and "a
 *  market statistic older than three years is not used". The rest are sized
 *  so the step stays a fraction of `CAPS.DRAFT_C`: thirteen pages of
 *  `readWords` words are four small-tier calls, about 7¢. */
export const RESEARCH = Object.freeze({
  /** The target's top results that are read, from the stored top ten. */
  topResults: 3,
  /** The named rivals whose own pricing and feature pages are read. */
  rivals: 4,
  /** D56 (issue 1282): a rival's pages are found in its own sitemap — at
   *  most this many addresses of it, from this many sitemaps of an index. */
  sitemaps: 3,
  sitemapUrls: 2000,
  /** Ruled: at most two, found by one search. */
  studies: 2,
  /** Ruled: a statistic older than this many years is not used. */
  statisticMaxAgeYears: 3,
  /** A page is read for claims up to this many words. */
  readWords: 1500,
  /** A page with fewer readable words than this states nothing to cite. */
  minWords: 80,
  /** SPEC §7 (D41): a page's research is at most two model calls, so the
   *  pages read are split over two; seven to a call is the most one reads. */
  calls: 2,
  pagesPerCall: 7,
  claimsPerPage: 5,
  /** The market facts a context pack carries. */
  briefFacts: 24,
  /** *Current insights* (D48): the news searches it buys — the market's
   *  category, then its synonyms in their stored order — and, of the results
   *  they date inside `recentDays`, how many are read and how many kept. */
  newsSearches: 3,
  recentRead: 8,
  recentPages: 5,
  /** Issue 1262: the read results one judgement holds against the market,
   *  and how many words of each it is shown. */
  recentJudged: 8,
  judgedWords: 120,
  /** D41 (drafted default): a *current insights* page reads web results
   *  published inside this many days. */
  recentDays: 30,
  /** A Q&A's questions (owner, D61; issue 1295): the related searches of the
   *  target's SERP whose volume one keyword-overview call measures. */
  relatedSearches: 10,
  /** A market comparison stands on at least this many cited market facts
   *  (issue 1135's done-when). */
  comparisonMinFacts: 3,
  readTimeoutMs: 10_000,
  /** A public page read today is not read again inside this window. */
  freshnessDays: 7,
} as const);

/** SPEC §7 (2026-09-29, D12; issue 1143) — *a new page adds what the web
 *  does not say*.
 *
 *  `min` and `businessMin` are the ruling's: at least three claims found
 *  neither in the target's top results nor on the customer's pages, at least
 *  one of them a business fact. The rest are drafted bounds: how much of the
 *  customer's own pages the listing is shown, how many claims it may return,
 *  and how close an existing page has to be before a page short of the bar
 *  becomes an update of it rather than waiting — half of
 *  `KNOWN_CONTENT.COVERED_MIN`, at and above which the topic was already an
 *  update before it was ever written. */
export const ADDS = Object.freeze({
  min: 3,
  businessMin: 1,
  maxClaims: 12,
  /** Words of one of the customer's pages shown to the listing, and of all
   *  of them together. The code check reads every page whole. */
  sitePageWords: 600,
  siteWords: 3000,
  updateMin: 0.3,
} as const);

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

/** SPEC §8 (2026-09-20, #933) — how much of a page the page-ready mail
 *  carries: its first paragraphs, and no more. The mail is where a reader
 *  decides to open the page; the page itself is one button away, and a
 *  whole draft in an inbox is a page nobody then reads. Three, because the
 *  answer-first opening the writing rules require is the first block and
 *  the two after it are what says whether the page keeps its promise. */
export const MAIL_PAGE_LINES = 3 as const;                    // SPEC §8 2026-09-20

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
