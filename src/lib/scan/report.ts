// BUILD §4.1, §6.3 — the stored report, declared, and the one read of it
//
// `ARCHITECTURE.md` gives `src/lib/scan/**` "the stored report" and names
// `readCurrentReport()` as its entry point. This file is both halves of
// that row: the blob `/scan/{domain}` renders, declared once so the screen
// has one type to read and the pipeline one type to write (issue #13), and
// the read itself (issue #25, which also supplies `runScan`,
// `assembleReport` and `storeCurrentReport` against this shape).
//
// **The blob is what the screen renders *and* what the pipeline recorded.**
// Issue #13 declared the seven members `/scan/{domain}` reads; issue #25
// adds the record beside them — which scan this was, when, at which tier,
// how it ended, and the market set, twelve questions, bought SERPs, rival
// derivation and coherence verdict it measured on the way. Nothing on the
// screen reads that second half, and it is not there for the screen: the
// correction reads its own category out of it (`readCorrectionFacts`), the
// paid deep pass reuses a fresh free scan's questions, market set and
// SERPs inside their cache windows (§6.4), and a report nobody can
// reproduce is not a measurement. A section that could not be produced is
// present and says so — `null` for the screen's sections (which the screen
// renders as a named absent section with one written line), the
// `unmeasured` arm for the record's — because an absent key and a
// `not_attempted` value read the same to a consumer and §5's trichotomy
// forbids that.
//
// **`rivalSizes` is here now, and this says why it took two versions.**
// It needs `RivalSize`, which the rival-sizing module (issue #37) declares
// — inventing a shape for a type another module owns is the second copy
// rule 2.4 exists to prevent — and nothing read it until §7's winnability
// did. `rankedCountsFromSizes` is that reader (issue #40), so the member
// joins the blob under the ruling that always owed it here (DECISIONS
// 2026-09-06, "RivalSize is declared in src/lib/market/rivals and joins
// StoredReport under #103"), and `REPORT_VERSION` goes to 2 for it: adding
// a member is a version bump, not a migration. `answers` is `aiAnswers`
// below — issue #13's section, which is the `AiAnswersCard` from issue #27
// plus the three things the screen needs and the engine's card does not
// carry.
//
// **The paid pass sizes rivals** (issue #140): `checking_your_presence`
// calls `sizeRivals` over the site's tracked rivals, and the free path
// calls it never (§6.4's never-pull list). A pass that could not read the
// site's rivals stores `unmeasured`, which winnability reads as "we do not
// know how big this rival is" — never as a zero that would satisfy every
// bar (`winnability/counts.ts`).
//
// **`ownRanked` joins beside it, and for the same reader.** §6.6 bands a
// rival against "the customer's own measured count from the same pass" and
// §7's two bars are multiples of that count, so the count has to survive
// the pass that measured it. `scans.drivers.searchPresence` is the 0–100
// sub-measure and not the count; storing the count is what lets a
// derivation run against the customer's own bars rather than the
// cold-start ones. Both members land together, so `REPORT_VERSION` goes to
// 3 once.
//
// **The market sections belong to the market leaves, and one of them is
// now theirs.** #27 landed `buildPresenceCard` while this branch was open,
// and its `PresenceCard` is member-for-member what this file had declared,
// so `PresenceSection` is that type and no longer a second copy of it.
//
// `AiAnswersSection` is still declared here, and deliberately: #27's
// `AiAnswersCard` is the *engine's* output and this is what the screen
// stores, and they differ in three ways that are decisions, not drift.
// Its `AnswerRow` carries the question as a plain `text: string`, which
// would reach the screen without passing `renderQuestion` — the gate
// REQ-093 c3 exists to hold — so this keeps a `GeneratedText`. It carries
// no `rivals`, and the dot matrix `BUILD.md` §4.1 draws is one row per
// rival. And it carries no `measuredAt`, which the card's source chip
// shows. Reconciling the two is `assembleReport`'s job (#25) and the
// first of the three is the owner's call; flagged there rather than
// settled quietly here by adopting a shape that drops a promise.
//
// **The three answer columns are here now, and `REPORT_VERSION` goes to
// 4 for them** (issue #128). §6.2 rules the paid weekly battery as
// "ChatGPT std + AI Mode std + AI-Overview piggyback … rendered as three
// answer columns", and nothing had ever bought the two engines because no
// stored shape carried their answers. Each row of `aiAnswers` now carries
// `engines`, `matrix.ts`'s `EngineCell` triple — the AI Overview it
// already had, plus the two the paid battery buys.
//
// **The migration is in this file, not a script**, because a stored blob
// has exactly one reader and it is `readStoredReport`. A version-3 report
// is upgraded on the way through: its rows gain the AI-Overview column
// they already measured and `not_attempted` for the two engines, which is
// precisely true of a report written before anything bought them. So no
// customer's report goes off its own address at deploy, which is what a
// bare version bump would have done to every report already on disk. The
// upgrade writes the literal triple rather than calling `engineColumns` —
// a migration describes a shape that is frozen in the past, and one that
// followed a moving helper would rewrite history the next time the helper
// changed.
//
// What the blob deliberately does **not** carry is the engines' own text.
// An AI answer's prose is generated text; `MarketAiAnswer`
// (`src/lib/market/views.ts`) has no member for it, so there is no field
// it can travel in and no surface that could render it unlabelled
// (`CLAUDE.md`). What is stored is what the product measures: whether the
// engine answered, and whom it named.
//
// ── #103 — one home per fact, and the one ruling that keeps two shapes ──
//
// Reconciling #13's screen shape with #25's pipeline record left two facts
// looking as though they had two homes each. Collapsing either is a
// decision rather than a tidy-up, so here is the decision.
//
// **The category has one home: `market`.** It was carried twice —
// `category: string | null` beside the verdict strip, and
// `market.profile.category` — with `sections.ts`'s `categoryOf` deriving
// the first from the second, so they could not disagree *at write time*.
// That is not the same as having one home: nothing stopped a later writer
// setting one and not the other, and a derived member on a stored blob is
// a value that outlives the derivation that made it. The member is gone
// (version 5); every reader calls `categoryOf(report.market)`, which is
// the one derivation and always was.
//
// **The twelve questions keep two shapes, and this is why.** The record's
// `questions: Measured<Question[]>` is the measurement: each selected
// search with its keyword, volume, intent, score and rank, read by the
// opportunity ranking and by the paid pass's frozen question set.
// `aiAnswers.rows[].question` is a *projection* of it for the screen —
// numbered, and with its wording behind `GeneratedText` so no surface can
// reach the raw string except through `renderQuestion` (REQ-093 c3,
// ADR-012).
//
// The gate is what makes the second shape necessary, and a gate is not a
// second home: it is the only representation a surface may hold. What
// keeps the two from drifting is that the projection has exactly one
// writer — `storedQuestionOf` in `sections.ts` — and is derived from the
// record at assembly, never supplied independently.
//
// The projection carried a fourth member until #103, and that one *was* a
// second home: `namedBrands`, the brands the AI answer named. It is a fact
// about the answer, not the question, and the row that holds the question
// already holds the cell it came from — so it was a third copy of
// `cell.citedDomains` sitting on the wrong object. Gone in version 5; the
// screen reads the cell.
//
// **ADR-095's "it" is the blob, not `MarketSet`.** The DECISIONS line
// reads "the report blob's market section takes the leaf's shape, and
// coherence is a member of it", and "it" is ambiguous between the two.
// The archived ADR-095 decision 3 settles it in as many words —
// "`StoredReport` gains `coherence: CoherenceVerdict`, unwrapped" — and
// the shipped `MarketSet` (#26) is `{ profile, suggestions, totalVolume }`
// with no coherence member. `coherence` therefore stays where #100 put it,
// on the blob, and the reason is recorded here rather than left to be
// re-derived. `DECISIONS.md` is the owner's file; the clarification is
// theirs to write.
//
// Nothing here is optional-by-accident: a section that could not be
// produced is `null`, which the screen renders as a named absent section
// with one written line (REQ-004 c10/c11), never as an empty card and
// never as a spinner.
import { measuredLocale, type Country, type Locale } from "@/lib/locale/locales";
import { AI_READER_AGENTS, TIMING } from "@/lib/config/constants";
import type { RobotsPolicy } from "@/lib/egress/types";
import type { SiteIssuesSection } from "@/lib/site-issues/types";
import type { CoherenceVerdict } from "@/lib/market/coherence/check";
import type { CorrectionState } from "@/lib/market/coherence/state";
import type { EngineCell } from "@/lib/market/questions/matrix";
import type { MarketSet } from "@/lib/market/questions/market-set";
import type { PromptKind } from "@/lib/market/prompts/generate";
import type { AnswerStatement } from "@/lib/market/prompts/misstated-types";
import type { Question } from "@/lib/market/questions/phrase";
import type { RivalCandidate } from "@/lib/market/rivals/derive";
import type { RivalSize } from "@/lib/market/rivals/size";
import type { PresenceCard } from "@/lib/market/rivals/presence";
import type { Measured } from "@/lib/measure/measured";
import type { OnPageFacts } from "@/lib/measure/parse";
import type { GeneratedText } from "@/lib/presentation/generated";
import type { Verdict } from "@/lib/measure/verdict";
import type { RankedRow, SerpResult } from "@/lib/vendors/dataforseo/types";
import { readPastProtection } from "./challenged";
import type { CanonicalDomain } from "./domain";

export type Tier = "free" | "deep" | "weekly";

/** The tiers a signed-in site's screens count as its pass; a free re-scan carrying the site's id is not one. */
export const SITE_PASS_TIERS = ["weekly", "deep"] as const satisfies readonly Tier[];

/** How a pass ended — the values `scans.stopped_reason` is constrained to
 *  (`20260904110000_scans_current.sql`, widened by
 *  `20260911090000_scans_stopped_reason.sql`). `site_unreadable` (issue
 *  #479) is a pass whose first stage could not read the customer's own
 *  home document: nothing after it is attempted, and the ending says so
 *  rather than calling an empty pass `complete`. */
export type StoppedReason = "complete" | "time_ceiling" | "spend_ceiling" | "site_unreadable" | "failed";

/** The one blob version this build writes. A reader that meets a version
 *  it does not know throws rather than returning a partially-populated
 *  value: `null` would be indistinguishable from "no report" at every call
 *  site. */
export const REPORT_VERSION = 13;

/** One cell of the AI-answers matrix — one question, one measured SERP.
 *  BP-025 `## Public interface` (issue #26's `matrix.ts` owns it). An
 *  `unmeasured` cell lowers the denominator and is never counted as a
 *  place the customer was ignored. */
export type AnswerCell =
  | {
      kind: "answered";
      citedDomains: readonly string[];
      namesCustomer: boolean;
      /** The site's own pages this answer cited (SPEC §4 2026-09-29, D16,
       *  issue 1147) — what a page's verdict reads before it credits that
       *  page. Absent where the answer's addresses were not read: every
       *  cell stored before this member, and the two battery engines. An
       *  absent list is not an empty one and decides nothing. */
      ownUrls?: readonly string[];
      /** The answer names the site (issue 1420): `classifyReferences`'
       *  mention, read from its text or a cited address on another site.
       *  Absent where it does not, and on every cell stored before. */
      named?: true;
    }
  | { kind: "no_answer" }
  | {
      kind: "unmeasured";
      reason: "undeterminable" | "not_attempted";
      /** What the engine last said, where the measurement heard it (issue
       *  869, carried from `Measured.because` — issue 865): a vendor
       *  failure's own kind, never a message. Optional and additive: a cell
       *  stored without it is still a cell, and it is the state issue 715's
       *  "Retry this part" and issue 867's engine column read to say why a
       *  column is blank rather than drawing it as a miss. */
      because?: string;
    };

/** `matrix.ts`'s own engine column, re-exported under the blob's roof so a
 *  screen or a fixture can name the type without a **runtime** edge into
 *  the market leaf. That edge is not hypothetical: `src/app/(public)/scan/
 *  [domain]/_fixture/states.ts` is reachable from `src/middleware.ts`, and
 *  importing `matrix.ts` for a value there pulls `rivals/domains` →
 *  `scan/domain` → `node:net` into the Edge bundle and fails the build. */
export type { EngineCell, BatteryEngine } from "@/lib/market/questions/matrix";

/** One of the twelve tracked questions, as the report stores it. `wording`
 *  is model text and therefore a `GeneratedText`: the screen reaches it
 *  only through `renderQuestion`, which refuses to yield the wording
 *  without the search it came from (REQ-093 c3).
 *
 *  No `volume` member. The owner removed per-question `{vol}/mo` on
 *  2026-09-03; a field that does not exist cannot be rendered by mistake. */
/**
 * One question, as the *screen* stores it.
 *
 * **Not a second home for the twelve** — see this file's header ruling.
 * `questions: Measured<Question[]>` below is the measurement; this is the
 * one representation a surface may hold, and it carries exactly what the
 * gate and the list need: the number the list shows, the wording behind
 * `GeneratedText`, and the search the question was phrased from.
 *
 * It carried a fourth member until #103: `namedBrands`, the brands the AI
 * answer named. That is not a fact about the question at all — it is the
 * *cell's*, and the row that holds this question already holds that cell,
 * so the member was a third copy of `cell.citedDomains` on the wrong
 * object. The screen reads it from the cell now.
 */
export interface StoredQuestion {
  /** 1-based, the number the list shows beside the question. */
  n: number;
  wording: GeneratedText;
  /** The search this question was derived from (REQ-006 c9). */
  search: string;
}

/** BUILD §4.1 module 2, left card. BP-025's `AiAnswersCard`, plus the
 *  measurement date the source chip shows. */
export interface AiAnswersSection {
  /** n — the denominator: searches whose AI answer could be read at all. */
  measuredSearches: number;
  /** m of n — searches an AI answer actually appeared on. */
  answeredSearches: number;
  /** Counted over m, never over n. */
  customerCitations: number;
  measuredAt: Date;
  /** The customer's own domain, so the matrix can label its own row. */
  ownDomain: string;
  /** Rival rows of the dot matrix, in the order the presence card orders
   *  them; one cell per row per question. */
  rivals: readonly { domain: string; cells: readonly AnswerCell[] }[];
  /** One row per question. `cell` is the AI-Overview column — the one the
   *  approved card renders — and `engines` is §6.2's three columns with
   *  that same cell first, so the screen's existing reading is untouched
   *  and the two engines the paid battery buys are beside it as data.
   *  `EngineCell` is `matrix.ts`'s own type rather than a second copy of
   *  it: the shape is the engine's, and this file has one duplicate of a
   *  market type already (`AnswerCell`) without wanting a second. */
  rows: readonly { question: StoredQuestion; cell: AnswerCell; engines: readonly EngineCell[] }[];
  /** Which AI answers this card could see — #27's own member, carried
   *  here because the ruling that created it requires a disclosure the
   *  screen can only render from a state it can read. The free report's
   *  twelve are bought with `load_async_ai_overview` and count Google's
   *  actual AI answers (`async_included`, ADR-094); a market correction
   *  buys none — the 12¢ cap stands and a correction spends no second
   *  allowance — so its card counts only what Google had already cached
   *  (`cached_only`), "and its disclosure says so" (DECISIONS
   *  2026-09-03). A state, never a sentence: the words are the registry's. */
  coverage: "async_included" | "cached_only";
  /**
   * **When the answers on this card were bought, where this pass did not
   * buy them** (SPEC §2, issue 715) — an ISO instant, or `null` where every
   * answer counted here was this pass's own purchase.
   *
   * A domain scanned again inside §6.4's SERP window is answered out of
   * `fetches` and spends nothing, which is the whole point of the window —
   * and until this member existed the report showed those answers with
   * today's date on the card's source chip and said nothing at all about
   * where they came from. This is that fact, carried from the ledger row
   * the cache served (`readCache`'s `storedAt`), through the SERP
   * (`MarketSerp.reusedFrom`) and the card (`AiAnswersCard.reusedFrom`),
   * to the one line the screen draws from it.
   *
   * It is the **oldest** such date on the card, so the one line a card can
   * show never claims an answer is fresher than it is. `null` on every
   * report written before version 12, which claims nothing.
   *
   * It is not `coverage` and does not replace it: `coverage` says which
   * answers a card could see at all, this says when the ones it saw were
   * read.
   */
  reusedFrom: string | null;
}

/**
 * SPEC §6 (2026-09-20, #908 · #919) — the page questions, **beside the
 * twelve and never inside them**.
 *
 * "Each published page's own question may join the tracked set: at most 24
 * tracked questions in all (the twelve plus twelve) … and a page's question
 * leaves the set after 8 weeks without a mention."
 *
 * It is a section of its own, and that is the issue's own requirement:
 * *"store them in the report beside, not inside, the twelve, so the score's
 * AI Presence is unchanged"*. `aiAnswers` is what the score counts over —
 * `measuredSearches`, `answeredSearches`, `customerCitations` and every
 * rival row — so a page question added to `aiAnswers.rows` would move a
 * published score by arriving, which is a measurement changing because the
 * product wrote a page rather than because the market did anything.
 * Since issue 1551 (owner, 2026-10-19) the score's AI Presence reads each
 * row's `cell` beside the twelve's SERPs, on purpose: a page cited on its
 * own question is progress. The cards and their counts still do not.
 *
 * `null` where the pass asked none: the free and onboarding passes (no
 * published page has a question yet), a site with no live page, and every
 * report written before version 11. Never an empty section with an empty
 * row list, which would say a pass looked and found no page to ask for.
 */
export interface PageQuestionsSection {
  measuredAt: Date;
  /** The site's own registrable domain, so a row can be read for a mention
   *  without the reader deciding what "the site" is a second time. */
  ownDomain: string;
  /** How many questions this pass tracked in all — the market's plus the
   *  rows below. Stored rather than derived so a screen states the number
   *  the pass actually obeyed, and a later change to the cap does not
   *  rewrite what an old week says about itself. */
  tracked: number;
  /** `TRACKED_QUESTIONS_MAX` as this pass read it, for the same reason. */
  cap: number;
  rows: readonly PageQuestionRow[];
  /** The pages whose question left the set this week (SPEC §6's eight
   *  weeks). Kept because a retirement is a fact about a page that the
   *  page's own verdict reads, and because the row is how *"a retired
   *  question's history stays readable"* — the weeks it was asked are in
   *  the reports behind this one, and this says which week it stopped. */
  retired: readonly RetiredPageQuestion[];
}

/** One published page's own question, as this pass asked it. The shape is
 *  the AI-answers row's — `cell` is the AI-Overview column and `engines`
 *  is §6.2's three with that cell first — so one reader draws both. */
export interface PageQuestionRow {
  /** The publication this question belongs to: its identity across weeks,
   *  and what a verdict for the page is keyed by. */
  publicationId: string;
  /** Where the page is, as it was live this week. */
  liveUrl: string;
  /** Numbered on from the twelve (13, 14, …), because the screen draws one
   *  list of tracked questions and the reader counts through it. */
  question: StoredQuestion;
  cell: AnswerCell;
  engines: readonly EngineCell[];
  /** Issue 1548: the organic rows of the Google result bought for this
   *  question, to the depth bought — what the page's own verdict reads its
   *  place from. `null` where that result could not be read this week;
   *  absent on a row stored before the rows were kept. */
  organic?: readonly { url: string; position: number }[] | null;
  /** How deep `organic` was bought; absent on a row bought ten deep. */
  depth?: number;
}

export interface RetiredPageQuestion {
  publicationId: string;
  liveUrl: string;
  /** The question as it was asked, in plain text: this row is the record of
   *  a question that is no longer asked, and it is read to say *which*
   *  question stopped rather than rendered as a question to a customer. */
  question: string;
  /** How many weekly passes asked it and heard nothing — the number that
   *  reached `PAGE_QUESTION_RETIRE_WEEKS`. */
  weeksWithoutMention: number;
}

/** BUILD §4.1 module 2, right card — #27's own `PresenceCard`, re-exported
 *  under the name the report blob uses for it rather than re-declared.
 *
 *  What it has no member for is the point of it: no rival ranked count,
 *  size, band, revenue, traffic value, funding, headcount or projected
 *  return, no severity, and no `totalMonthlyVolume` — the market-total
 *  footnote the owner removed on 2026-09-03, both halves. The card's
 *  honesty bound is the absence of anywhere to put a violation. */
export type PresenceSection = PresenceCard;

/** BUILD §4.1 module 3's two counts that are not on the verdict. The
 *  third, blocked readers, is `Verdict.blockedReaders` and is not
 *  duplicated here (one measurement, one home). */
export interface SupplySection {
  missingPages: Measured<number>;
  unquotablePages: Measured<number>;
}

/** BUILD §4.1 module 5 — page 1 of N, offered in exchange for an address.
 *  `title` is model text; the screen reaches it through `renderGenerated`
 *  with this page's own identity, never as a bare string. */
export interface FreePageSection {
  opportunityId: string;
  title: GeneratedText;
  slug: GeneratedText;
  /** The search the page targets, and its monthly volume. This volume is
   *  the *page's own target*, which §4.1 module 5 states as a row of the
   *  card; it is not the per-question volume the owner removed from the
   *  12-questions list on 2026-09-03. */
  target: { keyword: string; volume: number };
  /** The rival this page is written to overtake, where there is one. */
  beats: string | null;
  /** The opportunity type, rendered as written by the copy key for it. */
  format: string;
  /** How many pages the scan found in total — "page 1 of {N}". */
  totalPages: number;
}

/** What `GET /scan/{domain}` renders. One date governs the whole blob:
 *  `verdict.measuredAt` — every figure under it is that scan's. */
export interface StoredReport {
  /** The blob is versioned; readers branch on nothing else. */
  version: number;
  scanId: string;
  /** ADR-020's one canonical key. */
  domain: CanonicalDomain;
  tier: Tier;
  /** False where `stoppedReason` is a ceiling or a failure. */
  complete: boolean;
  stoppedReason: StoppedReason;
  /** REQ-001 c14's re-scan control reads this: an offer made once, which
   *  does not chain. */
  fromIncompleteRescan: boolean;

  verdict: Verdict;
  /** Which answer readers the home document's access rules block, in the
   *  pinned list's own order (SPEC §9, D14: training crawlers are not in
   *  it). Derived from `AI_READER_AGENTS` here for the
   *  same reason `_problems/unblock.ts` derives its own alias from it: the
   *  type follows the pin, so a seventh agent needs no edit in either
   *  place. `Verdict.blockedReaders` is the *count* of these and stays
   *  where it is — one measurement, two readings, no second count. */
  blockedAgents: readonly (typeof AI_READER_AGENTS)[number][];
  aiAnswers: AiAnswersSection | null;
  /** SPEC §6's page questions (#919), beside the twelve. `null` on a pass
   *  that asked none and on every report written before version 11 — never
   *  an empty section. The score reads `aiAnswers` and not this, which is
   *  the whole reason it is a second member. */
  pageQuestions: PageQuestionsSection | null;
  presence: PresenceSection | null;
  supply: SupplySection;
  freePage: FreePageSection | null;

  // ── The record (issue #25) — what the pass measured, not what the
  // screen renders. Read by the correction, by the paid pass's reuse of a
  // fresh free scan (§6.4) and by anyone asked to reproduce a report.

  /** §6.7 steps 1–2: the profile, the measured market and its size. The
   *  three fail together and never apart, which is why one `Measured`
   *  wraps the whole set (ADR-095). */
  market: Measured<MarketSet>;
  /** **The twelve, and their one home** (#103). Each carries the selected
   *  search it was phrased from, with that search's keyword, volume,
   *  intent, score and rank — the measurement, which the opportunity
   *  ranking and the paid pass's frozen question set read.
   *
   *  `aiAnswers.rows[].question` is not a second home for it: it is a
   *  projection of this, derived at assembly by exactly one function, and
   *  the header states the ruling that keeps it one. */
  questions: Measured<Question[]>;
  /** The bought top-tens, one per question, in question order. Every card
   *  above was counted over exactly these. */
  serps: readonly Measured<SerpResult>[];
  rivals: Measured<RivalCandidate[]>;
  /** §6.6's sizing, one entry per rival the pass sized, in the order it
   *  was handed them. Read by §7's winnability through
   *  `rankedCountsFromSizes`, which is the only consumer: no surface
   *  renders this and no band is re-derived from it. `unmeasured` until
   *  the sizing stage lands (issue #140) — never an empty array, which
   *  would read as "we sized this customer's rivals and there are none". */
  rivalSizes: Measured<RivalSize[]>;
  /** The customer's own ranked count from this pass — the rows, not the
   *  0–100 sub-measure `scans.drivers` carries. §6.6 bands every rival
   *  against it and §7's bars are `max(500, 5× it)` and `max(100, 2× it)`.
   *  Capped by the row limit the pass bought, which understates it and so
   *  tightens both bars (issue #117). */
  ownRanked: Measured<number>;
  /** The rows `ownRanked` counts — `DomainMeasurement.ownRankedRows` (#778),
   *  kept on the record: each search the customer ranks for, its position
   *  and the url that ranks, bought once. §7's Improve family reads its
   *  update candidates here (2026-09-16), the site's own ranked pages and
   *  not only the home document. Empty where the call was not made or did
   *  not answer, and on a report written before it was kept (version ≤ 8). */
  ownRankedRows: readonly RankedRow[];
  /** §6.6's platform partition — the "sources" half. Stored, not rendered
   *  in MVP. */
  sources: readonly string[];
  onPage: Measured<OnPageFacts>;
  robots: Measured<RobotsPolicy>;
  /** SPEC §9's nine technical-issue checks over the crawled pages. `null`
   *  only on a report written before the checks existed (version ≤ 6) —
   *  never for a pass that ran them, whose could-not-run checks carry their
   *  own reasons. */
  siteIssues: SiteIssuesSection | null;
  /** §6.7 step 5. A total union, unwrapped: it already carries its own
   *  failure arm, and a wrapper would give a consumer two `unknown`s to
   *  branch on (ADR-095 decision 3). */
  coherence: CoherenceVerdict;
  /** BP-028's value domain, stored on the scan row too. */
  correctionState: CorrectionState;
  /**
   * The category this pass measured under (issue 866) — the confirmed
   * category it was handed (`sites.category`, through `readSiteCategory`,
   * or the correction's own), or `null` where it was handed none and seeded
   * from the profile.
   *
   * It is **the category the measurement used**, which is why it is stored
   * rather than derived: `categoryOf(market)` is the category the model
   * *inferred* from the site, and a founder who confirmed a different one
   * is measured in theirs. REQ-071's pending-change comparison
   * (`measuredAnswers`) reads this member and nothing else, so a category
   * change clears the moment a pass has adopted it — and a report written
   * before version 10 carries `null`, which claims nothing.
   *
   * It is not the `category` member version 5 removed: that one was
   * `categoryOf(market)` written a second time, and this is a fact no other
   * member holds.
   */
  measuredCategory: string | null;
  /** The market's buyer prompts a deep pass asked AI Mode beside the
   *  twelve (#1195), each with the domains its answer cited and the start
   *  of its text — the evidence the pass's rivals are concluded from.
   *  Absent where a pass asked none, which every report before it is; the
   *  score and every card read the twelve and never this. */
  marketPrompts?: readonly MarketPromptAnswer[];
  /** The tracked buyer prompts a weekly pass asked and what each answer
   *  said (D19, #1162) — what the AI mention rate, share of voice and
   *  *your pages cited* are read from. Absent where a pass asked none. */
  prompts?: PromptsSection;
  /** The country and language this pass measured in (SPEC §6, owner D66,
   *  issue 1311), where they are not the United States and English, or
   *  where the site said something of itself that is not measured.
   *  `fellBack` is that something: the country or language the reading
   *  named that ReachKit does not measure yet, which the report says in one
   *  line. Absent on every report before D66 and on every one measured as
   *  those were: the United States, in English, with nothing fallen back
   *  from. */
  locale?: ReportLocale;
  /** The city a home page's structured data states for a business that
   *  marks itself a local one (SPEC §6, owner D67, issue 1318): what setup
   *  fills its question with. Absent where the page states none. */
  statedPlace?: { name: string; region?: string };
  /** SPEC §2 (owner, 2026-10-10, issue 1387): `search` where the market, and
   *  so the questions and the AI answers, were read from how the site
   *  appears in search because bot protection kept the reader off its own
   *  pages. The report says so in one line. Absent where the market was
   *  read from the site's pages, which every report before it was. */
  marketFrom?: "search";
  /** SPEC §2 (owner, 2026-10-15, issue 1440): a free pass stored this
   *  report with searches it chose and did not read, and the
   *  `scan/finish-reads` job is reading them in the background. How many,
   *  and since when. The job's own write sets it to `null`; absent on every
   *  report with nothing left to read. */
  finishingReads?: { searches: number; since: Date } | null;
  /** Where the re-score (`scan/rescore`) rewrote this report with the current code (owner,
   *  2026-10-14, issue 1426): when, at which commit, and the report and the
   *  `scans` columns (score, status, drivers) as they were first stored, so
   *  the rewrite can be undone. No surface reads them. */
  rescoredAt?: Date;
  rescoredBy?: string;
  previous?: unknown;
  previousColumns?: unknown;
}

export interface ReportLocale extends Locale {
  fellBack?: { country: string | null; language: string | null };
  /** The other markets the site's home page declares, as BCP-47 tags
   *  without the measured one (`marketsServed`). Absent where it declares
   *  none, and on every report read before it was counted. */
  alsoServes?: readonly string[];
  /** Which evidence named the town a free scan measured in (issue 1441):
   *  `PLACE_FROM`. Absent where it measured in none, or a paid pass settled
   *  the place. */
  placeFrom?: "address" | "area_served" | "address_text" | "page_text";
  /** `default` where the pass read neither the home page nor a country in
   *  the address, so it measured in D66's default, guessed. */
  basis?: "default";
  /** On a guessed pass, the other supported country the site's own Google
   *  listing reads as (`listingLocaleOf`). */
  listingReads?: Country;
}

/** The locale a stored report was measured in. */
/** How many searches the report says it is still reading at `now` (SPEC §2,
 *  issue 1440), or `null` where it says nothing: no marker, or one older than
 *  the line's window — a job that never ran is not a promise kept for ever. */
export function stillReading(report: Pick<StoredReport, "finishingReads">, now: Date): number | null {
  const marker = report.finishingReads;
  if (marker === undefined || marker === null) return null;
  const since = new Date(marker.since).getTime();
  if (!(now.getTime() - since < TIMING.finishReadsNoticeS * 1000)) return null;
  return marker.searches;
}

export const localeOfReport: (report: Pick<StoredReport, "locale">) => Locale = measuredLocale;

/** The two engines a tracked prompt is asked on (D19, #1162). */
export const PROMPT_ENGINES = ["ai_mode", "chatgpt"] as const;
export type PromptEngine = (typeof PROMPT_ENGINES)[number];

/** One answer to one tracked prompt, as it was read (D19, #1162): whether
 *  it named or linked the site, which of the site's pages it cited and
 *  which of the market's rivals it named. Never the engine's prose, never
 *  a position. */
export interface PromptAnswer {
  promptId: string;
  engine: PromptEngine;
  /** 1-based: which of the week's asks of this prompt on this engine. */
  run: number;
  named: boolean;
  linked: boolean;
  ownUrls: readonly string[];
  rivals: readonly string[];
  /** The addresses it cited that hold "alternative" (issue 1520): what
   *  says buyers asking it were shown a rival's alternatives. Absent where
   *  it cited none, and on every answer stored before. */
  alternatives?: readonly string[];
  /** The prices, counts and countries it gave the business (issue 1539),
   *  each with the few words around it. Absent where it gave none, and on
   *  every answer stored before. */
  states?: readonly AnswerStatement[];
}

/** One weekly pass's tracked prompts (SPEC §6, D19, #1162). */
export interface PromptsSection {
  /** The name the answers were read for. */
  siteName: string;
  /** The set as this pass asked it. */
  asked: readonly { id: string; kind: PromptKind; text: string }[];
  /** How many asks the set is: prompts × engines × runs. */
  asks: number;
  /** The asks that answered. One that did not is absent, so it leaves the
   *  rate's denominator and is never a miss. */
  answers: readonly PromptAnswer[];
  /** When the set asked was rebuilt whole (D54, issue 1281); absent on a
   *  set never rebuilt. A week that carries another mark asked another
   *  set, and the rolling rate leaves it out. */
  restartedAt?: string;
}

/** What one pass checked: the searches it read a result page for, and the
 *  AI questions it put. A pass with no prompts block measured no AI
 *  question, so its count is `null`, never 0. */
export function askedOf(report: Pick<StoredReport, "serps" | "prompts">): { searches: number; questions: number | null } {
  return {
    searches: report.serps.filter((serp) => serp.kind !== "unmeasured").length,
    questions: report.prompts === undefined ? null : report.prompts.asked.length,
  };
}

/** One buyer prompt as its AI answer read (#1195). */
export interface MarketPromptAnswer {
  prompt: string;
  citedDomains: readonly string[];
  namesSite: boolean;
  /** The start of the answer's text: it names products it does not link. */
  excerpt: string;
}

// ── Reading a stored blob (issue #25) ───────────────────────────────────

/** A strict ISO-8601 instant, exactly as `Date.prototype.toJSON` writes
 *  one. Narrow on purpose: a customer's own keyword or heading cannot
 *  match it by accident. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/** Rebuilds a parsed `jsonb` value with every ISO instant back as a
 *  `Date` — `measuredAt` and every `Measured.at` under it. Total: it never
 *  throws and never drops a key. */
function reviveDates(value: unknown): unknown {
  if (typeof value === "string") {
    return ISO_INSTANT.test(value) ? new Date(value) : value;
  }
  if (Array.isArray(value)) return value.map(reviveDates);
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, member] of Object.entries(value as Record<string, unknown>)) {
      out[key] = reviveDates(member);
    }
    return out;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The version this build's own migration knows how to lift, and the only
 *  one: a report written before issue #128 bought the paid battery. */
const MIGRATABLE_VERSIONS: readonly number[] = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** The two battery columns of a report written before anything bought
 *  them. `not_attempted` and not `no_answer`: nobody asked these engines,
 *  which is a different claim from asking and getting nothing. Frozen
 *  literals, deliberately not `engineColumns(...)` — see this file's
 *  header for why a migration does not follow a moving helper. */
function engineColumnsAtVersion3(overview: unknown): unknown[] {
  return [
    { engine: "ai_overview", cell: overview },
    { engine: "ai_mode", cell: { kind: "unmeasured", reason: "not_attempted" } },
    { engine: "chatgpt", cell: { kind: "unmeasured", reason: "not_attempted" } },
  ];
}

/**
 * Version 3 → 4: every AI-answers row gains its `engines` triple.
 *
 * Total and non-destructive — it adds one member per row and changes no
 * other byte of the blob, so a report measured before the battery existed
 * renders exactly as it did, with its two new columns saying honestly
 * that nobody asked them. A report whose `aiAnswers` is `null` needs no
 * row rewritten and only its version moved.
 */
function upgradeFromVersion3(blob: Record<string, unknown>): Record<string, unknown> {
  const answers = blob.aiAnswers;
  if (!isRecord(answers) || !Array.isArray(answers.rows)) {
    return { ...blob, version: 4 };
  }
  const rows = answers.rows.map((row) =>
    isRecord(row) ? { ...row, engines: engineColumnsAtVersion3(row.cell) } : row
  );
  return { ...blob, version: 4, aiAnswers: { ...answers, rows } };
}

/**
 * Version 4 → 5 (#103): the two facts that had two homes lose their second
 * one.
 *
 * `category` was `categoryOf(market)` written a second time, and
 * `aiAnswers.rows[].question.namedBrands` was the row's own
 * `cell.citedDomains` written a third time. Both are dropped here; both
 * readers derive them, from the home each fact actually has.
 *
 * **Dropping is safe precisely because nothing could disagree yet.** Both
 * were derived at assembly by one function, so no stored blob carries a
 * value the surviving home does not already imply — which is why this is a
 * migration and not a re-measurement, and why a v4 report renders exactly
 * as it did.
 *
 * Total: a blob whose `aiAnswers` is `null`, or whose rows are not rows,
 * needs only its version moved.
 */
function without(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const out = { ...record };
  delete out[key];
  return out;
}

function upgradeFromVersion4(blob: Record<string, unknown>): Record<string, unknown> {
  const rest = without(blob, "category");
  const answers = rest.aiAnswers;
  if (!isRecord(answers) || !Array.isArray(answers.rows)) {
    return { ...rest, version: 5 };
  }
  const rows = answers.rows.map((row) => {
    if (!isRecord(row) || !isRecord(row.question)) return row;
    return { ...row, question: without(row.question, "namedBrands") };
  });
  return { ...rest, version: 5, aiAnswers: { ...answers, rows } };
}

/**
 * Version 5 → 6 (#352): the verdict carries the three score factors.
 *
 * The owner's ruling 1b of 2026-09-08 keeps the report header's three
 * driver mini-bars **with their values**, amending REQ-004 c2 and BUILD
 * §4.1 for that one strip. `verdictOf` always computed the factors — the
 * score is `∛(f₁ × f₂ × f₃)` — and threw them away, so from this version
 * the verdict stores what it already knew.
 *
 * **A report written before this version does not carry them, and none is
 * invented here.** The three arrive `unmeasured/undeterminable`, which is
 * the honest reading of a value that cannot be determined *from this
 * report*: the scan did reach them (its score proves it), and the blob did
 * not keep them, so no figure can be recovered and no figure is guessed.
 * The header draws a dash in place of such a bar; every other line of an
 * old report renders exactly as it did, the score and the band included.
 *
 * Total: a blob with no `verdict` object, or one whose `verdict` is not a
 * record, needs only its version moved — `readStoredReport` casts, and a
 * blob that shape was already unreadable for other reasons.
 */
function upgradeFromVersion5(blob: Record<string, unknown>): Record<string, unknown> {
  const verdict = blob.verdict;
  if (!isRecord(verdict)) return { ...blob, version: 6 };
  const at = verdict.measuredAt;
  const unmeasured = { kind: "unmeasured", reason: "undeterminable", at };
  return {
    ...blob,
    version: 6,
    verdict: {
      ...verdict,
      factors: {
        foundations: unmeasured,
        answerability: unmeasured,
        presence: unmeasured,
      },
    },
  };
}

/**
 * Version 6 → 7 (#570): the report carries SPEC §9's technical-issue checks.
 *
 * A report written before this version never ran them, and none is invented
 * here: `siteIssues` arrives `null`, which is "these checks were not part of
 * this pass" — not nine could-not-run reasons the pass never gave, and never
 * nine zeros.
 */
function upgradeFromVersion6(blob: Record<string, unknown>): Record<string, unknown> {
  return { ...blob, version: 7, siteIssues: null };
}

/**
 * Version 7 → 8 (#690): each check that ran names the pages it counted.
 *
 * A version-7 report counted them and did not keep the addresses, so none is
 * recovered: every issue that ran arrives with `pages: null`, and no Fix
 * opportunity is derived from it. The counts render exactly as before.
 */
function upgradeFromVersion7(blob: Record<string, unknown>): Record<string, unknown> {
  const section = blob.siteIssues;
  if (!isRecord(section) || !Array.isArray(section.issues)) return { ...blob, version: 8 };
  const issues = section.issues.map((issue: unknown) =>
    isRecord(issue) && issue.ran === true ? { ...issue, pages: null } : issue
  );
  return { ...blob, version: 8, siteIssues: { ...section, checkedPages: null, issues } };
}

/**
 * Version 8 → 9 (#780): the report keeps the customer's own ranked rows.
 *
 * A version-8 report counted them and did not keep them, so none is
 * recovered: `ownRankedRows` arrives empty, the measurement's own arm for
 * rows it does not hold, and Improve reads only the top tens that report
 * bought.
 */
function upgradeFromVersion8(blob: Record<string, unknown>): Record<string, unknown> {
  // The literal `9`, not `REPORT_VERSION` (#919). Each upgrade lifts a blob
  // **one** version and the chain does the rest — an upgrade that jumped
  // straight to whatever this build writes would skip every upgrade after
  // it, and a version-8 report would land at the current number without the
  // members those upgrades add. Same rule as this file's header states for
  // helpers: a migration is a frozen statement about two versions.
  return { ...blob, version: 9, ownRankedRows: [] };
}

/**
 * Version 9 → 10 (issue 866): the report records the category the pass
 * measured under.
 *
 * REQ-071's pending-change comparison reads the market a measurement was
 * taken in (`measuredAnswers`), and until now no stored report carried one —
 * so a category a founder changed was never seen as changed, and the hold
 * REQ-071 c11 describes could not fire.
 *
 * **A report written before this version carries no category, and none is
 * invented here.** `measuredCategory` arrives `null`, which is what is true
 * of it: nobody recorded which category that pass was handed. The inferred
 * category on `market.profile` is *not* it — a founder who confirmed a
 * different category at setup would have that difference read as a change
 * the moment this shipped, holding pages on a site nothing changed on. Such
 * a report reads as it always did: no measured category, so nothing pending.
 */
function upgradeFromVersion9(blob: Record<string, unknown>): Record<string, unknown> {
  return { ...blob, version: 10, measuredCategory: null };
}

/**
 * Version 10 → 11 (#919): the report carries SPEC §6's page questions
 * beside the twelve.
 *
 * A pass that ran before this version asked none, so `pageQuestions`
 * arrives `null` — "this pass tracked no page question", which is true of
 * every one of them. Never an empty section, which would say a pass looked
 * for pages to ask for and found none, and never a row invented from the
 * twelve: the twelve are the market's questions and belong to no page.
 *
 * Every other member is untouched, so an old report renders exactly as it
 * did — its score, its AI-answers card and its rival rows included, which
 * is the point of the section being a second member rather than twelve more
 * rows in the first.
 */
function upgradeFromVersion10(blob: Record<string, unknown>): Record<string, unknown> {
  return { ...blob, version: 11, pageQuestions: null };
}

/**
 * Version 11 → 12 (issue 715): the AI-answers card says when a reused
 * answer was bought.
 *
 * A version-11 pass did not record it — the cache seam threw the ledger
 * row's date away on the way through — so `reusedFrom` arrives `null` on
 * every report written before this version. `null` is the arm that claims
 * nothing: not "these answers were fresh", which no version-11 report is
 * evidence of, but "this report does not say". The screen draws no mark
 * from it, which is exactly how those reports read before this member
 * existed.
 *
 * A report with no `aiAnswers` section at all keeps `null` there: there is
 * no card to carry the member, and inventing a section to hold it would
 * turn a pass that measured nothing into one that measured an empty card.
 */
function upgradeFromVersion11(blob: Record<string, unknown>): Record<string, unknown> {
  const section = blob.aiAnswers;
  return {
    ...blob,
    version: 12,
    aiAnswers: isRecord(section) ? { ...section, reusedFrom: null } : section,
  };
}

/**
 * Version 12 → 13 (issue 1145, SPEC §9 2026-09-29, D14): the blocked-readers
 * count is over the answer readers, not the training crawlers.
 *
 * A version-12 report counted GPTBot, ClaudeBot and Google-Extended as
 * blocked readers and never looked at Google's own crawler. Its access rules are still
 * in the blob, so the list and both counts are read again from them: a
 * founder who only opted out of training stops being told they are blocked
 * without waiting for the next scan. The list is the pin itself — no agent
 * is named outside `constants.ts` — and a reader the old parser did not pin
 * was keyed lowercased.
 * Snippet controls were not read, so the check counts readers alone, and the
 * score is left as it was measured.
 */
function upgradeFromVersion12(blob: Record<string, unknown>): Record<string, unknown> {
  const next = { ...blob, version: 13 };
  const robots = blob.robots;
  if (!isRecord(robots) || robots.kind === "unmeasured" || !isRecord(robots.value)) return next;
  const policy = robots.value;
  const named = isRecord(policy.disallowedAgents) ? policy.disallowedAgents : {};
  const blocked =
    policy.absent === true
      ? []
      : AI_READER_AGENTS.filter(
          (agent) => policy.disallowsAll === true || named[agent] === true || named[agent.toLowerCase()] === true
        );
  const count = blocked.length;

  const verdict = blob.verdict;
  const prior = isRecord(verdict) ? verdict.blockedReaders : undefined;
  const section = blob.siteIssues;
  return {
    ...next,
    blockedAgents: blocked,
    verdict:
      isRecord(verdict) && isRecord(prior) && prior.kind !== "unmeasured"
        ? { ...verdict, blockedReaders: { kind: count === 0 ? "zero" : "measured", value: count, at: prior.at } }
        : verdict,
    siteIssues:
      isRecord(section) && Array.isArray(section.issues)
        ? {
            ...section,
            issues: section.issues.map((issue: unknown) =>
              isRecord(issue) && issue.check === "ai_readers_blocked" && issue.ran === true
                ? {
                    ...issue,
                    count,
                    over: AI_READER_AGENTS.length,
                    severity: count === 0 ? "nothing_to_fix" : "critical",
                  }
                : issue
            ),
          }
        : section,
  };
}

/** Every upgrade this build can apply, oldest first, each lifting a blob
 *  one version. Chained rather than switched on, so a version-3 report is
 *  lifted twice and lands readable — a build that only knew `n → latest`
 *  would have to grow a new function per old version per release. */
const UPGRADES: readonly ((blob: Record<string, unknown>) => Record<string, unknown>)[] = [
  upgradeFromVersion3,
  upgradeFromVersion4,
  upgradeFromVersion5,
  upgradeFromVersion6,
  upgradeFromVersion7,
  upgradeFromVersion8,
  upgradeFromVersion9,
  upgradeFromVersion10,
  upgradeFromVersion11,
  upgradeFromVersion12,
];

/** The version guard, and the one upgrade beside it. Throws — loudly — on
 *  a blob this build can neither read nor lift, because `null` reads as
 *  "this domain has no report" at every call site and would quietly take a
 *  customer's report off its own address.
 *
 *  **Forward only, and that is the ruling** (issue 887, SPEC §2 2026-09-18).
 *  The chain lifts an old blob to `REPORT_VERSION`; nothing lifts a blob the
 *  other way, so a build older than the blob throws here rather than reading
 *  the members it happens to recognise. That is what makes production
 *  roll-forward-only: pointing production back at an earlier build turns
 *  every report written since into a failure, which is what the owner met on
 *  2026-09-17 ("stored report version 9 is not readable by this build
 *  (expected 6)"). The message names both numbers on purpose — the on-disk
 *  version and the one this build writes — because they are the whole
 *  diagnosis, and `tests/scan/report/read.test.ts` pins that it keeps
 *  naming them. A version bump is therefore a one-way door: ship the
 *  upgrade beside it, and fix a bad deploy with the next deploy. */
export function readStoredReport(blob: unknown): StoredReport {
  if (!isRecord(blob)) {
    throw new Error("readCurrentReport: the stored report is not an object");
  }
  let current = blob;
  while (typeof current.version === "number" && MIGRATABLE_VERSIONS.includes(current.version)) {
    const upgrade = UPGRADES[current.version - MIGRATABLE_VERSIONS[0]!];
    if (upgrade === undefined) break;
    current = upgrade(current);
  }
  if (current.version !== REPORT_VERSION) {
    throw new Error(
      `readCurrentReport: stored report version ${String(blob.version)} is not readable by this build (expected ${REPORT_VERSION})`
    );
  }
  return reviveDates(current) as StoredReport;
}

// `scans.is_current` is on disk (`20260904110000_scans_current.sql`) and
// not yet in the generated `Database` type, so this one query goes through
// a narrow, explicitly cast builder — the same worked-around gap
// `admission.ts` and `correction.ts` already carry. Nothing else in this
// file bypasses the generated type.

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  is(column: string, value: boolean): MinimalQueryBuilder<T>;
  limit(n: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

// The database is imported where a read asks for it (issue 1426), so
// `readStoredReport` loads without the database's bindings: the re-score
// reads an export on a box that has none.
function untyped(client: unknown): MinimalClient {
  return client as unknown as MinimalClient;
}

interface CurrentReportRow {
  report: unknown;
}

/**
 * The domain's one current report, or `null` where it has none.
 *
 * One indexed read off the partial unique index that makes two current
 * reports for one domain unrepresentable — never a "latest scan wins"
 * query, which would make a failed re-scan the report. Writes nothing,
 * opens no transaction, and takes no tier and no `forFree` parameter:
 * there is one report and everyone sees all of it.
 */
export async function readCurrentReport(domain: string): Promise<StoredReport | null> {
  const { dbAdmin } = await import("@/lib/db");
  const { data, error } = await untyped(dbAdmin())
    .from<CurrentReportRow>("scans")
    .select("report")
    .eq("domain", domain)
    .is("is_current", true)
    .limit(1);
  if (error) throw new Error(`readCurrentReport: ${error.message}`);

  const row = data?.[0];
  if (!row || row.report === null || row.report === undefined) return null;
  // Issue 1383: a report measured off a bot-protection page is read as
  // unmeasured there, by every reader of the current report.
  return readPastProtection(readStoredReport(row.report));
}

/** One scan's own stored report, or `null` where the row has none — read
 *  by id, for a step that runs after the pass which stored it (issue 798).
 *  Not the domain's current report: a later pass for the same domain
 *  would otherwise hand this one a report it did not measure. */
export async function readScanReport(scanId: string): Promise<StoredReport | null> {
  const { dbAdmin } = await import("@/lib/db");
  const { data, error } = await untyped(dbAdmin())
    .from<CurrentReportRow>("scans")
    .select("report")
    .eq("id", scanId)
    .limit(1);
  if (error) throw new Error(`readScanReport: ${error.message}`);

  const row = data?.[0];
  if (!row || row.report === null || row.report === undefined) return null;
  return readStoredReport(row.report);
}
