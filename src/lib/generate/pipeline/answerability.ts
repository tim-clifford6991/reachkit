// SPEC §7 · issue 475, issue 1137 — the answerability pass, bounded in code.
//
// The model does not rewrite the page. It returns operations, and this pure
// function applies the ones inside the bound and drops the rest:
//
//   · `order`        a permutation of the page's H2 sections. Anything that
//                    is not exactly a permutation is ignored.
//   · `openings`     a section's opening answer (SPEC §7, 2026-09-29: "each
//                    section opening with its own two- or three-sentence
//                    answer"). Since issue 1137 the pass may **add** one, not
//                    only shorten: where a section opens with a list, a
//                    table or a sub-heading the paragraph is put before it,
//                    and where it opens with a paragraph the new one replaces
//                    it only if it is shorter. One to three sentences, one
//                    paragraph, never a question, never a heading.
//   · `insertFacts`  a selected passage, word for word, appended to a
//                    section. An index outside the brief's facts, or a
//                    passage the page already carries, is ignored.
//   · `title`, `description`  the SEO half of the pass: the page's metadata,
//                    never its body.
//
// No operation can write a heading, and none reaches what stands above the
// first section — the short-answer box and the takeaways are the writer's
// and are counted where they were written. An opening is the one text the
// pass can add that is not the customer's own passage, and the hard rules
// read it like every other sentence on the page.
import { SENTENCE_END_RE } from "../rules/text";
import type { DraftBody } from "./steps";

export interface AnswerabilityOps {
  title: string;
  description: string;
  order: readonly number[];
  /** A section's opening answer, by the section's index as written. */
  openings: readonly { section: number; text: string }[];
  insertFacts: readonly { section: number; fact: number }[];
}

interface Section {
  /** The heading line as written, or `null` for text before the first. */
  heading: string | null;
  /** Paragraph blocks, as written, blank-line separated in the page. */
  blocks: string[];
}

/** A section is an H2: an H3 under it moves with it. */
const HEADING_RE = /^[ \t]*##[ \t]+(.*)$/;
/** A block that is not a paragraph of prose. */
const NOT_PROSE_RE = /^[ \t]*(?:#{1,6}[ \t]|[-*+][ \t]|\d+[.)][ \t]|>|\||:::)/;
const OPENING = Object.freeze({ minChars: 40, maxChars: 600, maxSentences: 3 } as const);

/** An opening answer the pass may place: one paragraph of prose, one to
 *  three sentences, that states rather than asks. */
function isOpening(text: string): boolean {
  return (
    !text.includes("\n") &&
    !NOT_PROSE_RE.test(text) &&
    !text.endsWith("?") &&
    text.length >= OPENING.minChars &&
    text.length <= OPENING.maxChars &&
    text.split(SENTENCE_END_RE).length <= OPENING.maxSentences
  );
}

function sectionsOf(markdown: string): Section[] {
  const sections: Section[] = [{ heading: null, blocks: [] }];
  let paragraph: string[] = [];
  const current = (): Section => sections[sections.length - 1]!;
  const flush = (): void => {
    if (paragraph.length > 0) current().blocks.push(paragraph.join("\n"));
    paragraph = [];
  };
  for (const line of markdown.split("\n")) {
    if (HEADING_RE.test(line)) {
      flush();
      sections.push({ heading: line, blocks: [] });
    } else if (line.trim() === "") {
      flush();
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return sections;
}

function markdownOf(sections: readonly Section[]): string {
  return sections
    .flatMap((section) => [...(section.heading === null ? [] : [section.heading]), ...section.blocks])
    .join("\n\n");
}

function isPermutation(order: readonly number[], length: number): boolean {
  return (
    order.length === length &&
    new Set(order).size === length &&
    order.every((index) => Number.isInteger(index) && index >= 0 && index < length)
  );
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Pure. The page after the operations inside the bound, and nothing else. */
export function applyAnswerability(
  body: DraftBody,
  ops: AnswerabilityOps,
  facts: readonly string[]
): DraftBody {
  const [preamble, ...headed] = sectionsOf(body.bodyMarkdown);

  // Insert first, against the sections as the draft wrote them.
  const inserted = new Set<number>();
  for (const { section, fact } of ops.insertFacts) {
    const target = headed[section];
    const passage = facts[fact];
    if (target === undefined || passage === undefined || inserted.has(fact)) continue;
    if (collapse(body.bodyMarkdown).includes(collapse(passage))) continue;
    target.blocks.push(passage);
    inserted.add(fact);
  }

  // Openings next, against the same indexes, once a section.
  const opened = new Set<number>();
  for (const { section, text } of ops.openings) {
    const target = headed[section];
    const opening = text.trim();
    if (target === undefined || opened.has(section) || !isOpening(opening)) continue;
    const original = target.blocks[0];
    if (original === undefined || NOT_PROSE_RE.test(original)) {
      target.blocks.unshift(opening);
    } else if (opening.length < collapse(original).length) {
      target.blocks[0] = opening;
    } else {
      continue;
    }
    opened.add(section);
  }

  const ordered = isPermutation(ops.order, headed.length)
    ? ops.order.map((index) => headed[index]!)
    : headed;

  return {
    title: ops.title.trim() === "" ? body.title : ops.title,
    slug: body.slug,
    description: ops.description.trim() === "" ? body.description : ops.description,
    bodyMarkdown: markdownOf(preamble === undefined ? ordered : [preamble, ...ordered]),
  };
}
