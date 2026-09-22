// SPEC §7 (2026-09-20) · issue #931 — what gets published, counted.
//
// "…what gets published (address, title, description, structured data,
// links, length)."
//
// Three counts, and all three are read **off the body in front of the
// customer** rather than off a record of it. That is the whole reason this
// is a function and not a stored number: the customer may have edited the
// page since it was written, and a count taken at generation would tell them
// about a page that no longer exists.
//
// Pure, and it counts through the one parser (`markdown.ts`) rather than
// with expressions of its own: a link is what the serialiser calls a link,
// and a question heading is what the FAQ schema will call one. A second
// definition here is how the card comes to disagree with the page.
import { parseMarkdown, type Block, type Inline } from "@/lib/publish/render/markdown";

export interface PublishedCounts {
  /** Every link the page will carry. */
  readonly links: number;
  /** How many question-and-answer pairs are declared to a search engine —
   *  the FAQ schema's own count, which is one per heading written as a
   *  question. */
  readonly questions: number;
  /** The characters a reader meets: the text of the page, not its Markdown.
   *  Markup is not length — a page of the same words with more emphasis in
   *  it is not a longer page. */
  readonly characters: number;
}

/** The text a reader meets in one inline run, with the markup dropped. */
function inlineText(nodes: readonly Inline[]): string {
  let out = "";
  for (const node of nodes) {
    if (node.kind === "text" || node.kind === "code") out += node.text;
    else out += inlineText(node.children);
  }
  return out;
}

/** Every link in one inline run, however deeply it sits. */
function countLinks(nodes: readonly Inline[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node.kind === "text" || node.kind === "code") continue;
    if (node.kind === "link") n += 1;
    n += countLinks(node.children);
  }
  return n;
}

/** A heading written as a question — the FAQ schema's own test, and the
 *  reason this counts headings rather than sentences: a question in a
 *  paragraph is not a declared question-and-answer pair. */
function isQuestion(text: string): boolean {
  return text.trim().endsWith("?");
}

/** Walks one block and adds what it carries to the running totals. */
function walk(block: Block, totals: { links: number; questions: number; characters: number }): void {
  switch (block.kind) {
    case "heading": {
      const text = inlineText(block.children);
      totals.characters += text.length;
      totals.links += countLinks(block.children);
      if (isQuestion(text)) totals.questions += 1;
      return;
    }
    case "paragraph":
    case "quote":
      totals.characters += inlineText(block.children).length;
      totals.links += countLinks(block.children);
      return;
    case "list":
      for (const item of block.items) {
        totals.characters += inlineText(item).length;
        totals.links += countLinks(item);
      }
      return;
    case "code":
      // A fence's text is the page's too: a reader meets it, and a
      // `robots.txt` block is length whatever else it is.
      totals.characters += block.text.length;
      return;
    case "table":
      for (const row of [block.head, ...block.rows]) {
        for (const cell of row) {
          totals.characters += inlineText(cell).length;
          totals.links += countLinks(cell);
        }
      }
      return;
    case "answer":
      // The short-answer box's label is the product's word, not the
      // customer's page, so it is not length. Its blocks are.
      for (const inner of block.children) walk(inner, totals);
      return;
    case "guides":
      // The related-guides list is links to the customer's own pages, and
      // each is a link the page carries.
      totals.links += block.items.length;
      for (const item of block.items) totals.characters += item.label.length;
      return;
    case "rule":
      return;
  }
}

/**
 * The three counts, off the body as it stands.
 *
 * A body that parses to nothing counts zero of everything, which is the
 * honest answer for an empty draft and draws a card with only its address
 * and title on it.
 */
export function publishedCounts(bodyMd: string): PublishedCounts {
  const totals = { links: 0, questions: 0, characters: 0 };
  for (const block of parseMarkdown(bodyMd)) walk(block, totals);
  return totals;
}
