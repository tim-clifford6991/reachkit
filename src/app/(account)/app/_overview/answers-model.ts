// SPEC §4 · §6 (2026-09-20, #908) — the AI answers tab, in one shape.
//
// §6 of that date: "a rolling four-week rate — answers that name or link
// the site over all answers asked — beside this week's n of 12; named and
// linked are counted apart." §4 of the same date closes the screen: "'AI
// rank position' and sentiment are never shown." Neither has a member here
// to be rendered from, which is the only way that stays true.
//
// **This file is pure.** Facts in, model out — the same split `model.ts`
// and `search-model.ts` make, and for the same reason: every rule below is
// then decided by a test with no database and no browser. Reading the facts
// is `answers-store.ts`'s (a real account) and `answers-fixture.ts`'s (the
// reserved fixture account).
//
// **Nothing here is recomputed that was measured.** A cell arrives as one
// of the five marks `answers-store.ts` derived from the stored answer with
// `classifyReferences` — the score's own reading of "linked" and "named",
// reused rather than restated — and this file only counts them.
//
// **The window's denominator is what was measured, never 12 × 3 × 4.** An
// unmeasured cell leaves the denominator and is never a miss (§6.2's rule,
// applied to a window instead of to one week); the full grid is stated
// beside the rate as the shape of the window, not as its divisor.
import { ANSWER_RATE_WEEKS, BATTERY } from "@/lib/config/constants";
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
import type { GeneratedText } from "@/lib/presentation/generated";
import type { AnswerEngine } from "@/lib/opportunities/types";
import { GOALS } from "./goals";

/**
 * What one engine said about the site on one question.
 *
 * Five marks, closed, and two of them are not misses: an engine that served
 * no answer said something, and an engine nobody reached said nothing.
 *
 * The split the owner's 2026-09-20 ruling asks for is the first two:
 * **linked** is a cited domain that is the site's own, **named** is the
 * brand token appearing in a reference somewhere else. `names_others` is
 * wider than the approved board's "names a rival" on purpose — an answer
 * can cite a directory, a marketplace, or no domain at all, and none of
 * those is a rival — and the word beside the mark says so.
 *
 * It is the product's existing four-state reading of a cell
 * (`EngineStanding` in `@/lib/opportunities/types`) with its `names_you`
 * arm split in two. A sixth mark would be a requirement change, not a new
 * member, and `Record<AnswerMark, …>` in `answers-words.ts` makes one a
 * compile error beside every word it would need.
 */
export const ANSWER_MARKS = [
  "links_to_you",
  "names_you",
  "names_others",
  "no_answer",
  "not_measured",
] as const;
export type AnswerMark = (typeof ANSWER_MARKS)[number];

/** The two marks that are the tab's subject: the answer reached the site's
 *  own name, one way or the other. Named once, because the rate tile, the
 *  split beneath it and this week's count all ask the same question. */
export function reachesYou(mark: AnswerMark): boolean {
  return mark === "links_to_you" || mark === "names_you";
}

/** A cell the pass actually read. The denominator of every rate on this
 *  screen is exactly these — "an unmeasured cell leaves the denominator". */
export function wasAsked(mark: AnswerMark): boolean {
  return mark !== "not_measured";
}

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

/** The one engine this screen's *n of 12* is counted from — the Overview
 *  tile's own rule (`model.ts`'s `COUNTED_FROM`, §6.2: "the three counts
 *  stay the AI-Overview counts"), so the two screens name the same engine
 *  and the tile's line says which. */
export const COUNTED_FROM: AnswerEngine = "ai_overview";

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

/** The rolling rate, and the two readings it is made of. */
export interface AnswerRate {
  /** Answers that named or linked the site, over the window. */
  value: Measured<number>;
  /** All answers asked that could be read — the denominator. */
  of: Measured<number>;
  /** The same numerator, counted apart (§6, 2026-09-20). */
  linked: number;
  named: number;
}

/** This week's n of 12, with its denominator and its goal — §4's data rule,
 *  and no change at all (REQ-041 c12: no reading of AI-answer movement). */
export interface AnswerWeek {
  value: Measured<number>;
  of: number;
  goal: number;
  engine: AnswerEngine;
}

export interface AnswersModel {
  rate: AnswerRate;
  week: AnswerWeek;
  /** The latest measured pass's questions, in the pass's own order. Empty
   *  where no pass has stored an AI-answers section yet, and the screen
   *  then says so in words rather than drawing an empty grid. */
  questions: readonly AnswerQuestion[];
  engines: readonly AnswerEngine[];
  /** The date the latest pass measured, for the line that says when.
   *  `null` where no pass has. */
  measuredAt: Date | null;
}

/** One weekly pass, as this screen reads it. */
export interface AnswerWeekFacts {
  weekStart: Date;
  questions: readonly AnswerQuestion[];
}

/** Everything the AI answers tab reads, before it is a model. */
export interface AnswersFacts {
  /** The passes inside the four-week window that stored an AI-answers
   *  section, oldest first. A week with no row is absent rather than
   *  present-and-empty: those are two different facts, and an empty week
   *  would lower the rate as though twelve questions had been asked and
   *  nobody named. */
  weeks: readonly AnswerWeekFacts[];
  measuredAt: Date | null;
}

export function assembleAnswers(facts: AnswersFacts, at: Date): AnswersModel {
  const latest = facts.weeks.at(-1);

  let asked = 0;
  let linked = 0;
  let named = 0;
  for (const week of facts.weeks) {
    for (const question of week.questions) {
      for (const mark of question.marks) {
        if (!wasAsked(mark)) continue;
        asked += 1;
        if (mark === "links_to_you") linked += 1;
        else if (mark === "names_you") named += 1;
      }
    }
  }

  // A window in which nothing could be read is not a window in which the
  // engines named nobody (REQ-004): both halves of the rate are unmeasured,
  // and the tile draws the dash with its own written line.
  const reached = linked + named;
  const rate: AnswerRate = {
    value: asked === 0 ? unmeasured<number>("not_attempted", at) : counted(reached, at),
    of: asked === 0 ? unmeasured<number>("not_attempted", at) : measured(asked, at),
    linked,
    named,
  };

  // This week's n of 12, counted from Google's AI Overview alone — the same
  // engine the Overview's tile counts from, said on the tile's own line. A
  // week whose pass never reached that column is unmeasured, never a zero.
  const column = ANSWER_ENGINES.indexOf(COUNTED_FROM);
  const thisWeek = latest?.questions ?? [];
  const readable = thisWeek.filter((q) => wasAsked(q.marks[column] ?? "not_measured"));
  const week: AnswerWeek = {
    value:
      readable.length === 0
        ? unmeasured<number>("not_attempted", at)
        : counted(readable.filter((q) => reachesYou(q.marks[column] as AnswerMark)).length, at),
    of: BATTERY.QUESTIONS,
    goal: GOALS.ai_answers.value,
    engine: COUNTED_FROM,
  };

  return {
    rate,
    week,
    questions: thisWeek,
    engines: ANSWER_ENGINES,
    measuredAt: facts.measuredAt,
  };
}

/** The shape of the window, for the line that says why four weeks: twelve
 *  questions × three engines × four passes.
 *
 *  A statement about **the window**, never about the rate's divisor. The
 *  divisor is what was actually measured, which is smaller wherever a pass
 *  was missed or an engine went unread — so a site with one pass behind it
 *  reads the same sentence and a much smaller denominator, rather than a
 *  sentence that quietly shrinks to "over the last 1 weeks". */
export const FULL_WINDOW = Object.freeze({
  questions: BATTERY.QUESTIONS,
  engines: ANSWER_ENGINES.length,
  weeks: ANSWER_RATE_WEEKS,
});

/** A count, as one of the three arms rather than a bare integer: a zero the
 *  screen counted is a measurement, and it is not the same fact as a count
 *  it could not take. */
function counted(value: number, at: Date): Measured<number> {
  return value === 0 ? measuredZero(0, at) : measured(value, at);
}
