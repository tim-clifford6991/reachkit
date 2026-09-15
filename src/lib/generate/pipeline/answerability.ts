// SPEC §7 · issue 475 — the answerability pass, bounded in code.
//
// "An answerability pass may only reorder existing sections, shorten a first
// block to 40–320 characters where a question heading already exists, and
// insert evidence already in the brief; it adds no question-shaped headings
// and never stuffs numerals."
//
// So the model no longer rewrites the page. It returns operations, and this
// pure function applies the ones inside the bound and drops the rest:
//
//   · `order`        a permutation of the page's heading sections. Anything
//                    that is not exactly a permutation is ignored.
//   · `firstBlock`   a shorter opening paragraph, taken only where the page's
//                    first section has a question-shaped heading, the text is
//                    within `ANSWER_FIRST_BLOCK_CHARS`, and it is shorter than
//                    the paragraph it replaces.
//   · `insertFacts`  a selected passage, word for word, appended to a
//                    section. An index outside the brief's facts, or a
//                    passage the page already carries, is ignored.
//   · `title`, `description`  the SEO half of the pass: the page's metadata,
//                    never its body.
//
// No operation can write a heading, so the pass cannot add a question-shaped
// one; the only words it can add to the body are the customer's own passages
// or a shortening of an opening paragraph, which the hard rules still read.
import { ANSWER_FIRST_BLOCK_CHARS } from "@/lib/config/constants";
import { isQuestionShaped } from "../rules/text";
import type { DraftBody } from "./steps";

export interface AnswerabilityOps {
  title: string;
  description: string;
  order: readonly number[];
  /** The shortened opening paragraph, or `""` for none. */
  firstBlock: string;
  insertFacts: readonly { section: number; fact: number }[];
}

interface Section {
  /** The heading line as written, or `null` for text before the first. */
  heading: string | null;
  /** Paragraph blocks, as written, blank-line separated in the page. */
  blocks: string[];
}

const HEADING_RE = /^[ \t]*#{1,6}[ \t]+(.*)$/;

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

function headingText(line: string): string {
  return HEADING_RE.exec(line)?.[1]?.trim() ?? "";
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

  const ordered = isPermutation(ops.order, headed.length)
    ? ops.order.map((index) => headed[index]!)
    : headed;

  const first = ordered[0];
  const shortened = ops.firstBlock.trim();
  const original = first?.blocks[0];
  if (
    preamble?.blocks.length === 0 &&
    first !== undefined &&
    first.heading !== null &&
    isQuestionShaped(headingText(first.heading)) &&
    original !== undefined &&
    !HEADING_RE.test(original) &&
    !HEADING_RE.test(shortened) &&
    !shortened.includes("\n") &&
    shortened.length >= ANSWER_FIRST_BLOCK_CHARS.min &&
    shortened.length <= ANSWER_FIRST_BLOCK_CHARS.max &&
    shortened.length < collapse(original).length
  ) {
    first.blocks[0] = shortened;
  }

  return {
    title: ops.title.trim() === "" ? body.title : ops.title,
    slug: body.slug,
    description: ops.description.trim() === "" ? body.description : ops.description,
    bodyMarkdown: markdownOf(preamble === undefined ? ordered : [preamble, ...ordered]),
  };
}
