// src/lib/market/questions/matrix.ts — BUILD §6.7 — the AI-answers card,
// assembled from SERPs the twelve questions already bought (§6.2's ruling,
// §6.6's cold-start law).
//
// One cell per question, two counts that can only be read against what was
// measured, and no field an instruction, a technique or a severity could
// be written into. The card reports what was measured and nothing more.
//
// **Three cell kinds, never two.** A search whose SERP could not be
// measured lowers the denominator and is never a place the customer was
// ignored; a search Google served no AI answer on is excluded from both
// counts and is not an absence either — it carries no `namesCustomer`
// field at all, so no surface can read one as `false` and draw it as a
// miss. Only an `answered` cell can say anything about the customer.
//
// **Which answers this card could see** is `coverage`, decided by the
// caller and carried on the card as a state, never as a sentence
// (DECISIONS 2026-09-03 / ADR-094). The free report's initial twelve
// question-SERPs are bought with `loadAsyncAiOverview: true` and count
// Google's actual AI answers — `async_included`. A market correction's
// re-run does not buy them: the free scan's 12¢ cap stands and a
// correction spends no second allowance, so the corrected card counts only
// what Google had already cached — `cached_only`, and the report's
// disclosure line is rendered from that state.
//
// **Three engine columns, one cell shape** (§6.2, issue #128). §6.2 rules
// the paid weekly battery as "ChatGPT std + AI Mode std + AI-Overview
// piggyback … rendered as three answer columns", so every row carries
// `engines` — one cell per engine in `BATTERY_ENGINES` order, each of them
// the same three-armed `AnswerCell` the AI-Overview column already uses.
// The AI-Overview column *is* the row's own `cell`: one measurement, two
// readings, never a second copy of it.
//
// The free path buys no battery (§6.2: "The free path makes **zero** AI
// Optimization API calls"), and a free card's two battery columns are
// therefore `unmeasured / not_attempted` — "we did not get to it", which
// is exactly what is true of them, and which lowers no denominator and
// reads as no miss.
//
// **The three counts stay the AI-Overview counts.** `measuredSearches`,
// `answeredSearches` and `customerCitations` are the figures the card
// renders today, counted over Google's AI answers alone, and issue #128
// does not move them: re-counting them across three engines changes every
// rendered number on an approved screen, which is the design decision the
// three-column visual is gated behind. The engine cells are data beside
// them, not a new arithmetic under them.
//
// **This module buys nothing.** It reads the `Measured<MarketSerp>[]` and
// the `Measured<MarketAiAnswer>` pairs the scan already paid for, and
// resolves no import into `src/lib/vendors/`, `src/lib/costs/` or
// `src/lib/llm/` — which is why the battery answers arrive as
// `MarketAiAnswer`, `../views`' subset of the vendor's own shape, rather
// than as the vendor type. Domain normalisation and the own-domain test
// are `../rivals/domains`' — one implementation in the product, not two.
import type { Measured } from "@/lib/measure/measured";
import { isOwnDomain, registrableDomain } from "../rivals/domains";
import type { MarketAiAnswer, MarketSerp, QuestionView } from "../views";

export type AnswerCell =
  | { kind: "answered"; citedDomains: readonly string[]; namesCustomer: boolean }
  | { kind: "no_answer" }
  | { kind: "unmeasured"; reason: "undeterminable" | "not_attempted" };

/** §6.2's three answer columns, in the order the card lays them out: the
 *  AI Overview that rides free on a SERP already bought, then the two
 *  engines the paid battery buys. Perplexity is **not** here — §6.2
 *  defers it to v1.1 and §6.4's never-pull list forbids "a fourth
 *  engine", so a fourth name cannot be added without both being amended. */
export const BATTERY_ENGINES = ["ai_overview", "ai_mode", "chatgpt"] as const;

export type BatteryEngine = (typeof BATTERY_ENGINES)[number];

/** What the paid battery bought for one question: engine 1 (ChatGPT, LLM
 *  Scraper, standard only) and engine 2 (Google AI Mode). Both arrive
 *  already `Measured` — an engine that did not answer is the vendor's own
 *  `zero`, an engine the pass never reached is `not_attempted`, and an
 *  engine that raised is `undeterminable`. */
export interface BatteryAnswers {
  aiMode: Measured<MarketAiAnswer>;
  chatgpt: Measured<MarketAiAnswer>;
}

/** One column of one row: which engine answered, and what it said about
 *  the customer. */
export interface EngineCell {
  engine: BatteryEngine;
  cell: AnswerCell;
}

/** The row is a **view**, not the `Question` value. It carries the wording
 *  and the search text the provenance line requires and nothing else from
 *  the selected search: there is no field a monthly volume can travel in
 *  (the owner removed per-question `{vol}/mo` on 2026-09-03). The full
 *  selected search, volume included, stays in the report's questions
 *  section, where selection provenance and the opportunity ranking read
 *  it. */
export interface AnswerRow {
  questionId: string;
  text: string;
  phrasing: "template" | "model";
  keyword: string;
  /** The AI-Overview column — Google's own answer on the SERP this
   *  question's search bought. Also `engines[0].cell`: the same value,
   *  read the other way, never a second measurement. */
  cell: AnswerCell;
  /** §6.2's three answer columns, always three and always in
   *  `BATTERY_ENGINES` order, so a renderer indexes by position and a
   *  reader never has to ask whether an engine is missing or absent. */
  engines: readonly EngineCell[];
}

export interface AiAnswersCard {
  /** n — how many of the questions' SERPs were measured at all. */
  measuredSearches: number;
  /** m of n — on how many of those an AI answer appeared. */
  answeredSearches: number;
  /** Counted over m, never over n. */
  customerCitations: number;
  rows: readonly AnswerRow[];
  /** Which AI answers this card could see. A state, never a sentence. */
  coverage: "async_included" | "cached_only";
}

/** An AI Overview's reference hosts, reduced to registrable domains: nulls
 *  dropped, first-seen order preserved, exact duplicates collapsed once. */
function citedDomainsOf(hosts: readonly string[]): string[] {
  const domains: string[] = [];
  const seen = new Set<string>();
  for (const host of hosts) {
    const domain = registrableDomain(host);
    if (domain === null || seen.has(domain)) continue;
    seen.add(domain);
    domains.push(domain);
  }
  return domains;
}

/**
 * One cell per question, one arm each:
 *
 *  - the SERP was not measured → `unmeasured`, carrying the reason the
 *    measurement itself gave. It lowers n and counts nowhere else.
 *  - Google served no AI Overview → `no_answer`, excluded from both
 *    counts.
 *  - otherwise `answered`. An AI answer that cited no domain at all is
 *    `answered` with `citedDomains: []` — the answer named no brand, which
 *    is a different fact from no answer appearing, and it raises m.
 */
function cellFor(measured: Measured<MarketSerp> | undefined, ownDomain: string): AnswerCell {
  if (measured === undefined) return { kind: "unmeasured", reason: "not_attempted" };
  if (measured.kind === "unmeasured") return { kind: "unmeasured", reason: measured.reason };
  if (!measured.value.aiOverview.present) return { kind: "no_answer" };

  const citedDomains = citedDomainsOf(measured.value.aiOverview.referenceDomains);
  return {
    kind: "answered",
    citedDomains,
    namesCustomer: citedDomains.some((domain) => isOwnDomain(domain, ownDomain)),
  };
}

/**
 * One battery engine's cell, on exactly the arms `cellFor` uses for the
 * AI Overview — so the three columns are the same three kinds and a
 * renderer needs one cell component, not two.
 *
 *  - no answer was bought (the free path, or a ceiling) → `unmeasured`,
 *    carrying the reason the measurement itself gave.
 *  - the engine answered nothing → `no_answer`. §6.2's own denominator
 *    rule applied to an engine: an engine that gave no answer is not a
 *    place the customer was ignored.
 *  - otherwise `answered`, with the domains it cited and whether the
 *    customer is among them.
 */
function cellForAnswer(answer: Measured<MarketAiAnswer> | undefined, ownDomain: string): AnswerCell {
  if (answer === undefined) return { kind: "unmeasured", reason: "not_attempted" };
  if (answer.kind === "unmeasured") return { kind: "unmeasured", reason: answer.reason };
  if (!answer.value.answered) return { kind: "no_answer" };

  const citedDomains = citedDomainsOf(answer.value.citedDomains);
  return {
    kind: "answered",
    citedDomains,
    namesCustomer: citedDomains.some((domain) => isOwnDomain(domain, ownDomain)),
  };
}

/**
 * One row's three columns, in `BATTERY_ENGINES` order.
 *
 * The AI-Overview column is the row's own cell, passed in rather than
 * re-derived: §6.2 prices that column at "0¢ extra" precisely because it
 * rides on the SERP the question already bought, and deriving it twice
 * would be two readings of one measurement.
 *
 * `battery` absent is the free path and every pass a ceiling stopped
 * before the battery — both give `not_attempted` for the two engines,
 * which is the honest arm and not a zero.
 *
 * Exported because `src/lib/scan/sections.ts` builds the same three
 * columns for a question the card had no row for; one implementation, so
 * the two can never disagree about the order.
 */
export function engineColumns(a: {
  overview: AnswerCell;
  battery?: BatteryAnswers;
  ownDomain: string;
}): readonly EngineCell[] {
  return [
    { engine: "ai_overview", cell: a.overview },
    { engine: "ai_mode", cell: cellForAnswer(a.battery?.aiMode, a.ownDomain) },
    { engine: "chatgpt", cell: cellForAnswer(a.battery?.chatgpt, a.ownDomain) },
  ];
}

/**
 * Pairs each question with the SERP bought for its search, in question
 * order — `serps[i]` is the SERP for `questions[i]`, the scan's own
 * parallel record of one battery. `rows.length === questions.length`
 * always: a question whose SERP is missing entirely is an `unmeasured`
 * cell, never a dropped row.
 *
 * The five invariants this function holds, asserted in
 * `tests/market/questions/matrix.test.ts`:
 *   `measuredSearches === rows.filter(r => r.cell.kind !== 'unmeasured').length`
 *   `answeredSearches === rows.filter(r => r.cell.kind === 'answered').length`
 *   `customerCitations <= answeredSearches`
 *   `rows.length === questions.length`
 *   every `row.keyword` is its question's own search keyword, and no row
 *   carries any other field of one.
 *
 * And the sixth, issue #128's: every row carries exactly `BATTERY_ENGINES`
 * columns, in that order, with `engines[0].cell === row.cell` — so the
 * AI-Overview column is the row's own measurement rather than a copy of
 * it, and no engine can go missing from a row without failing the suite.
 */
export function buildAiAnswersCard(a: {
  questions: readonly QuestionView[];
  serps: readonly Measured<MarketSerp>[];
  /** §6.2's paid battery, one entry per question in question order, or
   *  absent where no battery was bought — the free path, which makes zero
   *  AI Optimization calls. Absent and a short array read the same way at
   *  every index they do not cover: `not_attempted`. */
  battery?: readonly BatteryAnswers[];
  ownDomain: string;
  coverage: AiAnswersCard["coverage"];
}): AiAnswersCard {
  const rows: AnswerRow[] = a.questions.map((question, i) => {
    const cell = cellFor(a.serps[i], a.ownDomain);
    const bought = a.battery?.[i];
    return {
      questionId: question.id,
      text: question.text,
      phrasing: question.phrasing,
      keyword: question.search.keyword,
      cell,
      engines: engineColumns({
        overview: cell,
        ...(bought === undefined ? {} : { battery: bought }),
        ownDomain: a.ownDomain,
      }),
    };
  });

  const answered = rows.filter((row) => row.cell.kind === "answered");
  const card: AiAnswersCard = {
    measuredSearches: rows.filter((row) => row.cell.kind !== "unmeasured").length,
    answeredSearches: answered.length,
    customerCitations: answered.filter((row) => row.cell.kind === "answered" && row.cell.namesCustomer).length,
    rows,
    coverage: a.coverage,
  };

  logCells(card);
  return card;
}

/** BP-025 `## NFR budget`: the per-cell outcome kind. Kinds only — no
 *  question, keyword or cited domain reaches a log line from here. */
function logCells(card: AiAnswersCard): void {
  console.log(
    JSON.stringify({
      event: "ai_answers_card",
      coverage: card.coverage,
      cells: card.rows.map((row) => row.cell.kind),
    })
  );
}
