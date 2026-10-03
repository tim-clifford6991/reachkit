// SPEC §7 · issue 475 — hard rules 8–12, the five that read the brief.
//
// Each checks the finished page against what the pipeline handed the model:
// the customer's own passages the brief selected, the outline's headings, and
// the searches the page targets. A draft can only state what those carry, so
// each rule fails a page that reaches past them:
//
//   no_invented_test         "we tested", "in our trials" — a test nobody ran;
//   no_invented_provenance   a case study — a history the page was never
//                            given. (A byline and the page's dates are the
//                            page's own since SPEC §7 of 2026-09-29: setup
//                            records the one, publishing the other.)
//   no_new_question_heading  a question-shaped heading the outline did not
//                            have (the answerability pass may add none);
//   traceable_numerals       a numeral no fact and no target search carries;
//   first_block_answers      an opening that does not answer: a short-answer
//                            box outside 40–60 words, or — on a page with no
//                            box — an opening block that is not a paragraph
//                            inside the older bound, or that asks.
//
// A sentence that is itself one of the handed passages is the customer's own
// words and is never failed by the two phrase rules. Deterministic, no I/O.
import { ANSWER_FIRST_BLOCK_CHARS, ANSWERABILITY_MAX_NEW_QUESTIONS, PAGE_BLOCKS } from "@/lib/config/constants";
import { answerBoxOf } from "./blocks";
import { numeralsOf, REGISTER_FLOOR } from "./figures";
import { blocksOf, headingKey, headingsOf, isQuestionShaped, sentencesOf } from "./text";
import type { RuleFailure } from "./types";

/** What the brief handed the model, as the rules read it. */
export interface BriefRuleInputs {
  /** The customer's own passages the brief selected, word for word. */
  facts: readonly string[];
  /** The outline's headings, in order. */
  headings: readonly string[];
  /** The target search and every search the row absorbed. */
  queries: readonly string[];
  /** The market facts the brief selected, each with the public page it was
   *  read from (SPEC §7, 2026-09-29; issue 1135). Absent on a page written
   *  before the research step, whose rules read as they did then. */
  marketFacts?: readonly { url: string; passage: string }[];
}

/** Every passage the page was handed, from either pool. */
export function poolPassages(brief: BriefRuleInputs): string[] {
  return [...brief.facts, ...(brief.marketFacts ?? []).map((fact) => fact.passage)];
}

/** A year is not a number for the figure rules (SPEC §7, 2026-09-29). */
export function isYear(normalised: string): boolean {
  return /^(?:19|20)\d{2}$/.test(normalised);
}

export const INVENTED_TEST_RES: readonly RegExp[] = [
  /\b(?:we|i|our team)\s+(?:have\s+)?(?:tested|trialled|trialed|benchmarked|measured|tried out|put\b.{0,40}\bto the test)\b/i,
  /\bin our (?:own\s+)?(?:tests?|testing|trials?|benchmarks?|experiments?)\b/i,
  /\b(?:hands-on|after testing|after (?:weeks|months) of (?:use|testing))\b/i,
];

export const INVENTED_PROVENANCE_RES: readonly RegExp[] = [/\bcase stud(?:y|ies)\b/i];

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** A sentence that occurs inside one of the handed passages. */
export function isHandedWords(sentence: string, facts: readonly string[]): boolean {
  const words = collapse(sentence);
  return words.length > 0 && facts.some((fact) => collapse(fact).includes(words));
}

function phraseRule(
  rule: "no_invented_test" | "no_invented_provenance",
  patterns: readonly RegExp[],
  a: { markdown: string; brief: BriefRuleInputs }
): RuleFailure | null {
  for (const sentence of sentencesOf(a.markdown)) {
    if (!patterns.some((pattern) => pattern.test(sentence.text))) continue;
    if (isHandedWords(sentence.text, poolPassages(a.brief))) continue;
    return { rule };
  }
  return null;
}

export function checkInventedTest(a: { markdown: string; brief: BriefRuleInputs }): RuleFailure | null {
  return phraseRule("no_invented_test", INVENTED_TEST_RES, a);
}

export function checkInventedProvenance(a: {
  markdown: string;
  brief: BriefRuleInputs;
}): RuleFailure | null {
  return phraseRule("no_invented_provenance", INVENTED_PROVENANCE_RES, a);
}

export function checkNewQuestionHeading(a: {
  markdown: string;
  brief: BriefRuleInputs;
}): RuleFailure | null {
  const outlined = new Set(a.brief.headings.map(headingKey));
  const added = headingsOf(a.markdown).filter(
    (heading) => isQuestionShaped(heading) && !outlined.has(headingKey(heading))
  );
  return added.length > ANSWERABILITY_MAX_NEW_QUESTIONS ? { rule: "no_new_question_heading" } : null;
}

/** Every numeral a fact of either pool or a target search states, normalised. */
export function traceableNumerals(brief: BriefRuleInputs): Set<string> {
  const out = new Set<string>();
  for (const text of [...poolPassages(brief), ...brief.queries]) {
    for (const numeral of numeralsOf(text)) out.add(numeral.normalised);
  }
  return out;
}

export function checkTraceableNumerals(a: {
  markdown: string;
  brief: BriefRuleInputs;
}): RuleFailure | null {
  const traceable = traceableNumerals(a.brief);
  for (const sentence of sentencesOf(a.markdown)) {
    // A figure beside the address it was read from is sourced where it
    // stands — the rival-sourcing rule's own allowance.
    if (sentence.hasLink) continue;
    for (const numeral of numeralsOf(sentence.text)) {
      // Below the floor a numeral is a count or an ordinal ("three steps",
      // "step 2"), the same line the private-figure register draws.
      if (Number(numeral.normalised) < REGISTER_FLOOR) continue;
      if (isYear(numeral.normalised) || traceable.has(numeral.normalised)) continue;
      return { rule: "traceable_numerals", detail: { rule: "traceable_numerals", figure: numeral.raw } };
    }
  }
  return null;
}

export function checkFirstBlockAnswers(a: { markdown: string }): RuleFailure | null {
  // SPEC §7 (2026-09-29): "a short-answer box of 40–60 words that answers
  // the target plainly". Counted here, in words, on the page as it stands —
  // so after the writer and after every pass that follows it.
  const box = answerBoxOf(a.markdown);
  if (box !== null) {
    const words = (box.match(/\S+/g) ?? []).length;
    const answers =
      !box.endsWith("?") && words >= PAGE_BLOCKS.answerWords.min && words <= PAGE_BLOCKS.answerWords.max;
    return answers ? null : { rule: "first_block_answers" };
  }
  const first = blocksOf(a.markdown).find((block) => !block.heading);
  if (first === undefined) return { rule: "first_block_answers" };
  const length = first.text.length;
  const answers =
    !first.quoted &&
    !first.listItem &&
    !first.text.endsWith("?") &&
    length >= ANSWER_FIRST_BLOCK_CHARS.min &&
    length <= ANSWER_FIRST_BLOCK_CHARS.max;
  return answers ? null : { rule: "first_block_answers" };
}
