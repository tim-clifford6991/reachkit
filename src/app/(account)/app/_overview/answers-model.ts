// SPEC §6 (2026-09-20, #908) — the AI answers tab's grid, in one shape: the
// latest pass's twelve and the published pages' own questions, each with one
// mark per engine. "'AI rank position' and sentiment are never shown": neither
// has a member here.
//
// **This file is pure.** Facts in, model out. Reading the facts is
// `answers-store.ts`'s (a real account) and `answers-fixture.ts`'s (the
// reserved fixture account). A mark is the score's own reading of the stored
// cell (`classifyReferences`), never recomputed here.
import type { GeneratedText } from "@/lib/presentation/generated";
import type { AnswerEngine } from "@/lib/opportunities/types";

/**
 * What one engine said about the site on one question.
 *
 * Six marks, closed, and two of them are not misses: an engine that served
 * no answer said something, and an engine nobody reached said nothing.
 *
 * The split the owner's 2026-09-20 ruling asks for is the first two:
 * **linked** is a cited domain that is the site's own, **named** is the
 * brand token appearing in a reference somewhere else. `names_others` is
 * wider than the approved board's "names a rival" on purpose — an answer
 * can cite a directory or a marketplace, and neither is a rival — and the
 * word beside the mark says so. An answer that cites no address and does
 * not name the site is `names_no_one`: an answer, and a miss, that names
 * nobody at all.
 *
 * It is the product's existing four-state reading of a cell
 * (`EngineStanding` in `@/lib/opportunities/types`) with its `names_you`
 * arm split in two and its `names_others` arm split from `names_no_one`.
 * A new mark is a requirement change, not a new member, and `Record<AnswerMark, …>` in `answers-words.ts` makes one a
 * compile error beside every word it would need.
 */
export const ANSWER_MARKS = [
  "links_to_you",
  "names_you",
  "names_others",
  "names_no_one",
  "no_answer",
  "not_measured",
] as const;
export type AnswerMark = (typeof ANSWER_MARKS)[number];




/**
 * §6.2's three answer columns, in the order the grid lays them out.
 *
 * Spelled as an order over `AnswerEngine` rather than imported from
 * `@/lib/market/questions/matrix`, for the reason `@/lib/opportunities/
 * types` already records for the handle type itself: a **runtime** edge
 * from a screen into the market leaf pulls `rivals/domains` → `scan/domain`
 * → `node:net` behind it. The map is total, so a fourth engine is a compile
 * error here rather than a column with no place to stand.
 */
const ENGINE_ORDER: Readonly<Record<AnswerEngine, number>> = Object.freeze({
  ai_overview: 0,
  ai_mode: 1,
  chatgpt: 2,
});

export const ANSWER_ENGINES: readonly AnswerEngine[] = Object.freeze(
  (Object.keys(ENGINE_ORDER) as AnswerEngine[]).sort((a, b) => ENGINE_ORDER[a] - ENGINE_ORDER[b])
);

/** The customer's own live page for a question's search, where one is
 *  published. Title and address only: this tab links to the page, it does
 *  not judge it. */
export interface AnswerPage {
  title: string;
  url: string;
}

/** One tracked question, as one row of the grid. */
export interface AnswerQuestion {
  /** 1-based, the number the pass gave it. */
  n: number;
  /** Model text. It reaches the screen only through `renderQuestion`,
   *  which will not yield the wording without the search it came from
   *  (REQ-093 c3) — which is why `search` is beside it and not optional. */
  wording: GeneratedText;
  search: string;
  /** One mark per engine, in `ANSWER_ENGINES` order and always that long,
   *  so a renderer indexes by position and never has to ask whether an
   *  engine is missing or absent. */
  marks: readonly AnswerMark[];
  /** `null` where ReachKit has published nothing for this question's
   *  search yet — which is a page that does not exist, not a page at
   *  position zero. */
  page: AnswerPage | null;
}




export interface AnswersModel {
  /** The latest measured pass's **twelve**, in the pass's own order. Empty
   *  where no pass has stored an AI-answers section yet. */
  questions: readonly AnswerQuestion[];
  /** SPEC §6 (2026-09-20, #919) — the published pages' own questions from
   *  that same pass, beside the twelve and never mixed into them. */
  pageQuestions: readonly AnswerQuestion[];
  engines: readonly AnswerEngine[];
  /** The date the latest pass measured; `null` where no pass has. */
  measuredAt: Date | null;
}

/** One weekly pass, as this screen reads it. */
export interface AnswerWeekFacts {
  weekStart: Date;
  questions: readonly AnswerQuestion[];
  /** The page questions that pass asked (#919). Optional: a pass that
   *  asked none, and every pass measured before they existed, has none —
   *  which is not the same as a pass that asked some and was named in
   *  none, and the absent member says the first. */
  pageQuestions?: readonly AnswerQuestion[];
}

/** Everything the AI answers tab reads, before it is a model: the passes
 *  that stored an AI-answers section, oldest first. */
export interface AnswersFacts {
  weeks: readonly AnswerWeekFacts[];
  measuredAt: Date | null;
}

export function assembleAnswers(facts: AnswersFacts): AnswersModel {
  const latest = facts.weeks.at(-1);
  return {
    questions: latest?.questions ?? [],
    pageQuestions: latest?.pageQuestions ?? [],
    engines: ANSWER_ENGINES,
    measuredAt: facts.measuredAt,
  };
}
