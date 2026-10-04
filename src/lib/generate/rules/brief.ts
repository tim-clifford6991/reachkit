// SPEC §7 · issue 475 — the four rules that read what the page was handed.
//
// Each checks the finished page against what its context pack holds (D41):
// the customer's own passages, the market claims, and the searches the page
// targets. (`no_new_question_heading` retired with the outline, D41.) A draft can only state what those carry, so
// each rule fails a page that reaches past them:
//
//   no_invented_test         "we tested", "in our trials" — a test nobody ran;
//   no_invented_provenance   a case study — a history the page was never
//                            given. (A byline and the page's dates are the
//                            page's own since SPEC §7 of 2026-09-29: setup
//                            records the one, publishing the other.)
//   traceable_numerals       a numeral no fact and no target search carries;
//   first_block_answers      an opening that does not answer: a short-answer
//                            box outside 40–60 words, or — on a page with no
//                            box — an opening block that is not a paragraph
//                            inside the older bound, or that asks.
//
// A sentence that is itself one of the handed passages is the customer's own
// words and is never failed by the two phrase rules. Deterministic, no I/O.
import { ANSWER_FIRST_BLOCK_CHARS, PAGE_BLOCKS } from "@/lib/config/constants";
import { answerBoxOf } from "./blocks";
import { numeralsOf, REGISTER_FLOOR } from "./figures";
import { blocksOf, ownWordsOf, sentencesOf } from "./text";
import type { RuleFailure } from "./types";

/** What the brief handed the model, as the rules read it. */
export interface BriefRuleInputs {
  /** The customer's own passages the brief selected, word for word. */
  facts: readonly string[];
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
  // "hands-on" alone is an adjective; beside a test it is a claim of one.
  /\b(?:hands-on (?:tests?|testing|trials?|reviews?)|after testing|after (?:weeks|months) of (?:use|testing))\b/i,
];

/** A history claimed, never a word (issue 1187): a case study the page says
 *  exists, or one it offers as its evidence. "Look for case studies on the
 *  vendor's site" claims none. A byline and the page's dates are the page's
 *  own (issue 1137). */
export const INVENTED_PROVENANCE_RES: readonly RegExp[] = [
  /\b(?:our|in (?:a|one|another|this)|according to (?:a|our|one|this))\s+(?:recent\s+|own\s+)?case stud(?:y|ies)\b/i,
  /\bcase stud(?:y|ies)\s+(?:shows?|showed|proves?|proved|finds?|found|demonstrates?|demonstrated|reveals?|revealed|confirms?|confirmed)\b/i,
];

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** A sentence that occurs inside one of the handed passages. */
export function isHandedWords(sentence: string, facts: readonly string[]): boolean {
  const words = collapse(sentence);
  return words.length > 0 && facts.some((fact) => collapse(fact).includes(words));
}

/**
 * Does this sentence make the claim — in the page's own words?
 *
 * A link's label is the cited page's title or its words: "[We tested 15
 * tools](…)" reports somebody else's test, with its address beside it. So the
 * patterns read the sentence without its labels. A sentence that is itself
 * one of the handed passages is the customer's own and never a breach.
 */
export function isPhraseBreach(
  sentence: { raw: string; text: string },
  patterns: readonly RegExp[],
  brief: BriefRuleInputs
): boolean {
  const own = ownWordsOf(sentence.raw);
  return patterns.some((pattern) => pattern.test(own)) && !isHandedWords(sentence.text, poolPassages(brief));
}

function phraseRule(
  rule: "no_invented_test" | "no_invented_provenance",
  patterns: readonly RegExp[],
  a: { markdown: string; brief: BriefRuleInputs }
): RuleFailure | null {
  return sentencesOf(a.markdown).some((sentence) => isPhraseBreach(sentence, patterns, a.brief)) ? { rule } : null;
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

/** Every numeral a fact of either pool or a target search states, normalised. */
export function traceableNumerals(brief: BriefRuleInputs): Set<string> {
  const out = new Set<string>();
  for (const text of [...poolPassages(brief), ...brief.queries]) {
    for (const numeral of numeralsOf(text)) out.add(numeral.normalised);
  }
  return out;
}

/**
 * Every numeral this page can state: what the brief carries, and every
 * figure the page itself states beside a link.
 *
 * A page cites a figure where it first uses it and repeats it in its
 * takeaways or its buyer questions. The repeat is the same sourced figure,
 * and the reader finds its source on the page — measured, holding each repeat
 * to a link of its own stopped the hand-written reference page and every
 * prototype page for figures none of which was invented (issue 1187).
 */
export function pageTraceableNumerals(markdown: string, brief: BriefRuleInputs): Set<string> {
  const out = traceableNumerals(brief);
  for (const sentence of sentencesOf(markdown)) {
    if (!sentence.hasLink) continue;
    for (const numeral of numeralsOf(sentence.text)) out.add(numeral.normalised);
  }
  return out;
}

/** The numerals a sentence states that nothing carries: at or above the
 *  floor — below it a numeral is a count or an ordinal ("three steps",
 *  "step 2") — not a year, and not among the traceable ones. */
export function untraceableIn(
  words: string,
  traceable: ReadonlySet<string>
): { raw: string; normalised: string }[] {
  return numeralsOf(words).filter(
    (numeral) => Number(numeral.normalised) >= REGISTER_FLOOR && !isYear(numeral.normalised) && !traceable.has(numeral.normalised)
  );
}

export function checkTraceableNumerals(a: {
  markdown: string;
  brief: BriefRuleInputs;
}): RuleFailure | null {
  const traceable = pageTraceableNumerals(a.markdown, a.brief);
  for (const sentence of sentencesOf(a.markdown)) {
    // A figure beside the address it was read from is sourced where it
    // stands — the rival-sourcing rule's own allowance.
    if (sentence.hasLink) continue;
    const figure = untraceableIn(sentence.text, traceable)[0];
    if (figure !== undefined) {
      return { rule: "traceable_numerals", detail: { rule: "traceable_numerals", figure: figure.raw } };
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
  // Sixty words run to about 380 characters, past the older 320-character
  // bound, so an opening inside either answers: a 55-word, one-sentence
  // answer of 335 characters was stopped for fifteen of them, with no
  // sentence to split it at (issue 1187).
  const short =
    length <= ANSWER_FIRST_BLOCK_CHARS.max || first.text.split(/\s+/).length <= PAGE_BLOCKS.answerWords.max;
  const answers =
    !first.quoted &&
    !first.listItem &&
    !first.text.endsWith("?") &&
    length >= ANSWER_FIRST_BLOCK_CHARS.min &&
    short;
  return answers ? null : { rule: "first_block_answers" };
}
