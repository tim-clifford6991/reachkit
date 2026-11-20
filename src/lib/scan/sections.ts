// BUILD §4.1: the screen's sections, built from the engine's own values, kept out of `store.ts` (a plain copy) and `run.ts` (an ordering of calls).
// Nothing here measures: it re-shapes, filters and labels, and a missing input is `null` or an empty list, never a zero.
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
import { slotDepth, type PageQuestionCandidate } from "@/lib/market/questions/tracked";
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

/** The training crawlers the access rules turn away by name: a founder's choice, shown and never counted. A blanket `Disallow` names nobody. */
export function trainingOptOutOf(
  robots: Measured<RobotsPolicy>
): readonly (typeof AI_TRAINING_CRAWLERS)[number][] {
  if (robots.kind === "unmeasured" || robots.value.absent) return [];
  const policy = robots.value;
  return AI_TRAINING_CRAWLERS.filter((token) => policy.disallowedAgents[token] === true);
}

/** The category the profile inferred, shown beside the score. Unmeasured, empty or a placeholder (`<UNKNOWN>`) all read `null`: none may be guessed into one. */
export function categoryOf(market: Measured<MarketSet>): string | null {
  if (market.kind === "unmeasured") return null;
  const category = market.value.profile.category.trim();
  return isPlaceholder(category) ? null : category;
}

/** Whether the report's market stands, from the report alone: its searches, answers and rivals were measured in it, so none is drawn where it was withdrawn or never measured. */
export function marketStands(report: { market: Measured<unknown> }): boolean {
  return report.market.kind !== "unmeasured";
}

/** One question as the screen stores it: numbered, the wording behind `GeneratedText` (reached only through `renderQuestion`), and no volume.
 *  The one place the screen's projection of the twelve is built, so the two never disagree. */
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

/** `AiAnswersCard` as the screen stores it, plus the measurement date, the customer's own domain and one row per rival for the dot matrix.
 *  §6.2's three columns travel with each row from the card; a question without a card row gets `engineColumns` of its own cell, one implementation.
 *  Rival rows count Google's answers alone, as the approved card renders; counting across engines would change a rendered figure.
 *  `null` where the twelve were never phrased: the section is absent and named, never an empty card. */
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

/** The page questions as the report stores them, beside the twelve, rows shaped by `engineColumns` like the card's.
 *  It counts nothing: the score's AI Presence counts are `aiAnswers`', and a second set here would invite the wrong sum.
 *  Numbered on from the twelve, since the screen draws one list and the cap is on it. `null` where none were asked or retired, never an empty section. */
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
  /** The site's name, as `namesSite` reads it; `null` where none is known. */
  siteName?: string | null;
  measuredAt: Date;
}): PageQuestionsSection | null {
  if (a.asked.length === 0 && a.retired.length === 0) return null;

  const ownDomain = registrableDomain(a.ownDomain) ?? a.ownDomain;
  const rows = a.asked.map((candidate, index): PageQuestionRow => {
    const cell = overviewCellFor(a.serps[index], ownDomain, a.siteName ?? null);
    const serp = a.serps[index];
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
        siteName: a.siteName ?? null,
      }),
      // The result is bought for the page's own search, so its rows are kept for the page's place, not only its AI cell.
      organic:
        serp === undefined || serp.kind === "unmeasured"
          ? null
          : serp.value.organic.flatMap((row) =>
              typeof row.url === "string" && row.url !== "" ? [{ url: row.url, position: row.position }] : []
            ),
      depth: slotDepth(candidate, index),
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
