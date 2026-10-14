// BUILD §4.1 — the screen's sections, built from the engine's own values.
//
// Issue #13 declared what `/scan/{domain}` renders; issues #21, #26 and
// #27 built what the engine measures. Three of the screen's members are
// not any single engine value as it stands, and this file is where the two
// meet — the reconciliation `src/lib/scan/report.ts` names as `#25`'s job,
// kept out of `store.ts` so that `assembleReport` stays a copy with no
// transformation in it, and out of `run.ts` so the pipeline stays an
// ordering of calls.
//
// Nothing here measures anything. Every figure it returns was already
// measured by the call that produced its input; this file re-shapes,
// filters and labels, and where an input is missing it returns `null` or
// an empty list rather than a zero.
import { AI_READER_AGENTS, AI_TRAINING_CRAWLERS, TRACKED_QUESTIONS_MAX } from "@/lib/config/constants";
import {
  engineColumns,
  overviewCellFor,
  type AiAnswersCard,
  type BatteryAnswers,
} from "@/lib/market/questions/matrix";
import type { Question } from "@/lib/market/questions/phrase";
import type { MarketSet } from "@/lib/market/questions/market-set";
import type { RivalCandidate } from "@/lib/market/rivals/derive";
import { isOwnDomain, registrableDomain } from "@/lib/market/rivals/domains";
import type { RobotsPolicy } from "@/lib/egress/types";
import type { Measured } from "@/lib/measure/measured";
import { isPlaceholder } from "@/lib/measure/placeholder";
import { fromStored } from "@/lib/presentation/generated";
import type { MarketSerp } from "@/lib/market/views";
import type { PageQuestionCandidate } from "@/lib/market/questions/tracked";
import type {
  AiAnswersSection,
  AnswerCell,
  PageQuestionRow,
  PageQuestionsSection,
  RetiredPageQuestion,
  StoredQuestion,
} from "./report";

/** Which AI readers the home document's access rules block, in the pinned
 *  list's own order. `Verdict.blockedReaders` is the *count* of exactly
 *  this list — one measurement, two readings, and the count is not
 *  recomputed here. A policy that could not be read blocks nobody we can
 *  name: the empty list, beside a `blockedReaders` that is `unmeasured`,
 *  which is the pair that says "we could not tell". */
export function blockedAgentsOf(
  robots: Measured<RobotsPolicy>
): readonly (typeof AI_READER_AGENTS)[number][] {
  if (robots.kind === "unmeasured") return [];
  const policy = robots.value;
  if (policy.absent) return [];
  if (policy.disallowsAll) return [...AI_READER_AGENTS];
  return AI_READER_AGENTS.filter((token) => policy.disallowedAgents[token] === true);
}

/** The training crawlers the access rules turn away by name (SPEC §9,
 *  2026-09-29, D14). A choice the founder made, shown as one and never
 *  counted: a blanket `Disallow` names nobody and is not read as one. */
export function trainingOptOutOf(
  robots: Measured<RobotsPolicy>
): readonly (typeof AI_TRAINING_CRAWLERS)[number][] {
  if (robots.kind === "unmeasured" || robots.value.absent) return [];
  const policy = robots.value;
  return AI_TRAINING_CRAWLERS.filter((token) => policy.disallowedAgents[token] === true);
}

/** The market category the profile inferred, shown beside the score. A
 *  market that was not measured, and a profile whose category came back
 *  empty or as a placeholder (`<UNKNOWN>`, issue 1377), all read the same
 *  way — `null`, "the scan never reached one" — because none is a category
 *  and none may be guessed into one. */
export function categoryOf(market: Measured<MarketSet>): string | null {
  if (market.kind === "unmeasured") return null;
  const category = market.value.profile.category.trim();
  return isPlaceholder(category) ? null : category;
}

/**
 * One question, as the *screen* stores it: numbered, its wording gated
 * behind `GeneratedText` so no surface can reach it except through
 * `renderQuestion`, and carrying no volume — the owner removed
 * per-question `{vol}/mo` on 2026-09-03, and a field that does not exist
 * cannot be rendered by mistake.
 *
 * **This is the one place the screen's shape is built** (#103's ruling in
 * `report.ts`'s header): a projection of the record's twelve, derived
 * here and written nowhere else, so the two can never come to disagree.
 *
 * It no longer takes the answer cell. `namedBrands` used to be built from
 * it, and that was a fact about the *answer* riding on the question — a
 * third copy of `cell.citedDomains`, on an object the row already holds
 * the cell beside.
 */
function storedQuestionOf(question: Question, n: number): StoredQuestion {
  return {
    n,
    wording: fromStored("questions.wording", question.text),
    search: question.search.keyword,
  };
}

/** One rival's row of the dot matrix: the same twelve cells, read for that
 *  rival instead of for the customer. A cell's `citedDomains` carries the
 *  rival's own domain where the answer named it and nothing where it did
 *  not, so the row's "cited on n of m" count is a filter over the row
 *  itself and never a second measurement. `namesCustomer` is the
 *  customer's fact and stays `false` on every rival row. */
export function rivalCellsOf(cells: readonly AnswerCell[], rivalDomain: string): readonly AnswerCell[] {
  const rival = registrableDomain(rivalDomain);
  return cells.map((cell): AnswerCell => {
    if (cell.kind !== "answered") return cell;
    const cited = rival !== null && cell.citedDomains.some((domain) => isOwnDomain(domain, rival));
    return { kind: "answered", citedDomains: cited ? [rival as string] : [], namesCustomer: false };
  });
}

/**
 * #27's `AiAnswersCard` as the screen stores it. Three things the card
 * does not carry, and each is a decision `src/lib/scan/report.ts` records:
 * the measurement date its source chip shows, the customer's own domain so
 * the matrix can label its own row, and one row per rival — the dot matrix
 * §4.1 draws is rival rows against the customer's.
 *
 * §6.2's three answer columns travel with each row (issue #128), taken
 * from the card rather than re-derived. A question the card had no row for
 * gets the columns `engineColumns` builds from its own cell and no
 * battery — one implementation of the order, so the two paths can never
 * disagree about which column is which.
 *
 * **The rival rows keep the AI-Overview reading, and that is deliberate.**
 * `rivalCellsOf` counts a rival over Google's answers alone, which is
 * exactly what the approved card renders and what "cited on n of m" means
 * on it today. Counting a rival across three engines changes a rendered
 * figure, and that is the design decision the three-column visual is
 * gated behind — not something to slip in under a data change.
 *
 * `null` where the twelve were never phrased: the section is then absent
 * and named, never an empty card.
 */
export function answersSectionOf(a: {
  card: AiAnswersCard;
  questions: Measured<Question[]>;
  rivals: readonly RivalCandidate[];
  ownDomain: string;
  measuredAt: Date;
}): AiAnswersSection | null {
  if (a.questions.kind === "unmeasured") return null;

  const cells = a.card.rows.map((row) => row.cell);
  const rows = a.questions.value.map((question, index) => {
    const cell = cells[index] ?? ({ kind: "unmeasured", reason: "not_attempted" } as const);
    const engines = a.card.rows[index]?.engines ?? engineColumns({ overview: cell, ownDomain: a.ownDomain });
    return { question: storedQuestionOf(question, index + 1), cell, engines };
  });

  return {
    measuredSearches: a.card.measuredSearches,
    answeredSearches: a.card.answeredSearches,
    customerCitations: a.card.customerCitations,
    measuredAt: a.measuredAt,
    ownDomain: registrableDomain(a.ownDomain) ?? a.ownDomain,
    rivals: a.rivals.map((rival) => ({ domain: rival.domain, cells: rivalCellsOf(cells, rival.domain) })),
    rows,
    coverage: a.card.coverage,
    reusedFrom: a.card.reusedFrom,
  };
}

/**
 * SPEC §6 (2026-09-20, #908 · #919) — the page questions as the report
 * stores them, **beside the twelve**.
 *
 * The rows have the AI-answers row's shape — the AI-Overview cell that
 * rode free on the question's own SERP, and §6.2's three columns with that
 * cell first — built by `engineColumns`, the same function the card uses,
 * so the two lists can never disagree about which column is which.
 *
 * **It counts nothing.** There is no `measuredSearches`, no
 * `answeredSearches` and no `customerCitations` here, and there will not
 * be: those three are what the score's AI Presence reads, they are
 * `aiAnswers`', and a second set of them under a section that must not move
 * the score would be a denominator waiting to be added to the wrong sum.
 *
 * **The numbering continues the twelve** (13, 14, …) because the screen
 * draws one list of tracked questions and a reader counts through it, and
 * the cap is a cap on that one list.
 *
 * `null` where this pass asked no page question and retired none — the free
 * and onboarding passes, and a site with no live page. An empty section
 * would say a pass went looking and found nothing to ask, which is a
 * different fact and one no reader wants told twice.
 */
export function pageQuestionsSectionOf(a: {
  asked: readonly PageQuestionCandidate[];
  /** One per asked question, in the order they were asked — the same
   *  positional pairing `serps` and `battery` keep for the twelve. */
  serps: readonly Measured<MarketSerp>[];
  battery: readonly BatteryAnswers[];
  retired: readonly RetiredPageQuestion[];
  /** How many questions the market itself contributed this week, so
   *  `tracked` is the whole set and not this half of it. */
  selected: number;
  ownDomain: string;
  measuredAt: Date;
}): PageQuestionsSection | null {
  if (a.asked.length === 0 && a.retired.length === 0) return null;

  const ownDomain = registrableDomain(a.ownDomain) ?? a.ownDomain;
  const rows = a.asked.map((candidate, index): PageQuestionRow => {
    const cell = overviewCellFor(a.serps[index], ownDomain);
    return {
      publicationId: candidate.publicationId,
      liveUrl: candidate.liveUrl,
      question: {
        n: a.selected + index + 1,
        wording: fromStored("questions.wording", candidate.question),
        search: candidate.search,
      },
      cell,
      engines: engineColumns({
        overview: cell,
        ...(a.battery[index] === undefined ? {} : { battery: a.battery[index] as BatteryAnswers }),
        ownDomain,
      }),
    };
  });

  return {
    measuredAt: a.measuredAt,
    ownDomain,
    tracked: a.selected + rows.length,
    cap: TRACKED_QUESTIONS_MAX,
    rows,
    retired: a.retired,
  };
}
