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
import { AI_READER_AGENTS } from "@/lib/config/constants";
import type { AiAnswersCard } from "@/lib/market/questions/matrix";
import type { Question } from "@/lib/market/questions/phrase";
import type { MarketSet } from "@/lib/market/questions/market-set";
import type { RivalCandidate } from "@/lib/market/rivals/derive";
import { isOwnDomain, registrableDomain } from "@/lib/market/rivals/domains";
import type { RobotsPolicy } from "@/lib/egress/types";
import type { Measured } from "@/lib/measure/measured";
import { fromStored } from "@/lib/presentation/generated";
import type { AiAnswersSection, AnswerCell, StoredQuestion } from "./report";

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

/** The market category the profile inferred, shown beside the score. A
 *  market that was not measured, and a profile whose category came back
 *  empty, both read the same way — `null`, "the scan never reached one" —
 *  because neither is a category and neither may be guessed into one. */
export function categoryOf(market: Measured<MarketSet>): string | null {
  if (market.kind === "unmeasured") return null;
  const category = market.value.profile.category.trim();
  return category === "" ? null : category;
}

/** One question, as the *screen* stores it: numbered, its wording gated
 *  behind `GeneratedText` so no surface can reach it except through
 *  `renderQuestion`, and carrying no volume — the owner removed
 *  per-question `{vol}/mo` on 2026-09-03, and a field that does not exist
 *  cannot be rendered by mistake. */
function storedQuestionOf(question: Question, n: number, cell: AnswerCell): StoredQuestion {
  return {
    n,
    wording: fromStored("questions.wording", question.text),
    search: question.search.keyword,
    // The brands the AI answer named, in the order the answer named them.
    // A question with no answer named none — an empty list, never a claim.
    namedBrands: cell.kind === "answered" ? cell.citedDomains : [],
  };
}

/** One rival's row of the dot matrix: the same twelve cells, read for that
 *  rival instead of for the customer. A cell's `citedDomains` carries the
 *  rival's own domain where the answer named it and nothing where it did
 *  not, so the row's "cited on n of m" count is a filter over the row
 *  itself and never a second measurement. `namesCustomer` is the
 *  customer's fact and stays `false` on every rival row. */
function rivalCellsOf(cells: readonly AnswerCell[], rivalDomain: string): readonly AnswerCell[] {
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
    return { question: storedQuestionOf(question, index + 1, cell), cell };
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
  };
}
