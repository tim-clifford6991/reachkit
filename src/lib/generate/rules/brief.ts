// SPEC §7 · issue 475 — hard rules 8–12, the five that read the brief.
//
// Each checks the finished page against what the pipeline handed the model:
// the customer's own passages the brief selected, the outline's headings, and
// the searches the page targets. A draft can only state what those carry, so
// each rule fails a page that reaches past them:
//
//   no_invented_test         "we tested", "in our trials" — a test nobody ran;
//   no_invented_provenance   a byline, a publication or update date, a case
//                            study — a history the page was never given;
//   no_new_question_heading  a question-shaped heading the outline did not
//                            have (the answerability pass may add none);
//   traceable_numerals       a numeral no fact and no target search carries;
//   first_block_answers      an opening block that is not a paragraph inside
//                            the answer bound, or that asks instead of answers.
//
// A sentence that is itself one of the handed passages is the customer's own
// words and is never failed by the two phrase rules. Deterministic, no I/O.
import { ANSWER_FIRST_BLOCK_CHARS, ANSWERABILITY_MAX_NEW_QUESTIONS } from "@/lib/config/constants";
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
}

const INVENTED_TEST_RES: readonly RegExp[] = [
  /\b(?:we|i|our team)\s+(?:have\s+)?(?:tested|trialled|trialed|benchmarked|measured|tried out|put\b.{0,40}\bto the test)\b/i,
  /\bin our (?:own\s+)?(?:tests?|testing|trials?|benchmarks?|experiments?)\b/i,
  /\b(?:hands-on|after testing|after (?:weeks|months) of (?:use|testing))\b/i,
];

const INVENTED_PROVENANCE_RES: readonly RegExp[] = [
  /^(?:by|written by|author:?)\s+\p{Lu}/iu,
  /\b(?:written|reviewed|edited|fact-checked)\s+by\b/i,
  /\b(?:last updated|updated on|published on|posted on|first published)\b/i,
  /\bcase stud(?:y|ies)\b/i,
];

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** A sentence that occurs inside one of the handed passages. */
function isHandedWords(sentence: string, facts: readonly string[]): boolean {
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
    if (isHandedWords(sentence.text, a.brief.facts)) continue;
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

/** Every numeral a fact or a target search states, normalised. */
function traceableNumerals(brief: BriefRuleInputs): Set<string> {
  const out = new Set<string>();
  for (const text of [...brief.facts, ...brief.queries]) {
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
      if (traceable.has(numeral.normalised)) continue;
      return { rule: "traceable_numerals", detail: { rule: "traceable_numerals", figure: numeral.raw } };
    }
  }
  return null;
}

export function checkFirstBlockAnswers(a: { markdown: string }): RuleFailure | null {
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
