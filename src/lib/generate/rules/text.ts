// BUILD §8 — the one derivation from a draft's Markdown to the words a
// reader meets, and the one notion of "in the same sentence".
//
// Several of §8's hard rules are scoped to a sentence or to a block, and
// several read "what the reader reads" rather than the Markdown that
// produces it. Both of those are derivations, and each exists exactly once
// here: two derivations of "the reader's words" would let a rule pass on
// one and fail on the other, and two notions of "the same sentence" would
// let a figure be sourced by a link that is not beside it.
//
// **Why the splitter takes Markdown and not rendered text.** Whether a
// statement carries a link is a property of the Markdown — the rendered
// text of a link is its label, and the address is gone. So this module
// splits the Markdown, and each piece carries *both* projections: the
// reader's words (`text`) and whether the piece contained a link
// (`hasLink`). A rule then matches on what the reader reads and decides on
// what the page would carry, without either side re-deriving the other.
//
// This module has no dependency and does not parse Markdown into a tree:
// it is a lexical pass, which is what makes it deterministic and what keeps
// it out of the renderer's business (the draft screen's renderer is
// `src/app/(account)/app/draft/[draftId]/markdown.ts`, and `src/lib` may
// never import from `src/app`).

/** `[label](href)` — the label is what a reader meets, the href is what
 *  makes the statement sourced. */
const MD_LINK_RE = /\[([^\]\n]*)\]\(([^)\s]+)\)/g;
/** A bare address a destination would linkify. Counts as a link for the
 *  sourcing rules: the reader can open it. */
const BARE_URL_RE = /https?:\/\/[^\s<>)\]]+/g;
/** `<a href="…">` — markup embedded in the Markdown. */
const HTML_ANCHOR_RE = /<a\b[^>]*\bhref\s*=/gi;

/** True where this fragment of Markdown carries an address a reader can
 *  open. */
export function hasLink(markdownFragment: string): boolean {
  MD_LINK_RE.lastIndex = 0;
  BARE_URL_RE.lastIndex = 0;
  HTML_ANCHOR_RE.lastIndex = 0;
  return (
    MD_LINK_RE.test(markdownFragment) ||
    BARE_URL_RE.test(markdownFragment) ||
    HTML_ANCHOR_RE.test(markdownFragment)
  );
}

/** Markdown syntax removed, leaving the words. Applied to a fragment or to
 *  a whole document; `renderOf` is the whole-document name for it, kept
 *  separate only so call sites read as what they mean.
 *
 *  A link becomes its label, an image becomes nothing (its alt text is not
 *  words the reader meets in the flow of the page — the hidden-text rule
 *  reads alt text separately, over the Markdown), and every other marker is
 *  dropped. Text a Markdown construct would not produce is left as it
 *  stands: the safe direction, since a rule then reads more rather than
 *  less. */
export function renderOf(markdown: string): string {
  let out = markdown;
  // Fenced code: keep the code's own lines, drop the fence.
  out = out.replace(/^[ \t]*(?:```|~~~)[^\n]*$/gm, "");
  // HTML comments and embedded markup: neither is words the reader meets.
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  // Images before links — `![alt](src)` would otherwise leave a stray `!`.
  out = out.replace(/!\[[^\]\n]*\]\([^)\s]*\)/g, "");
  out = out.replace(MD_LINK_RE, "$1");
  out = out.replace(/<[^>]+>/g, "");
  // Block markers at the head of a line.
  out = out.replace(/^[ \t]*>[ \t]?/gm, "");
  out = out.replace(/^[ \t]*#{1,6}[ \t]+/gm, "");
  out = out.replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/gm, "");
  out = out.replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, "");
  // Inline emphasis and code markers.
  out = out.replace(/(\*\*|__)(.+?)\1/g, "$2");
  out = out.replace(/(\*|_)(?!\s)(.+?)(?<!\s)\1/g, "$2");
  out = out.replace(/`+([^`]+)`+/g, "$1");
  return out;
}

/** One sentence of a draft, in both projections. */
export interface Sentence {
  /** The words a reader meets in it. */
  text: string;
  /** Whether the Markdown it came from carried an address. */
  hasLink: boolean;
}

/** One block of a draft — a paragraph, a heading, a block quote, or one
 *  list item. Blocks are the scope of the people rules: a quotation and its
 *  attribution belong to one block, and a link three paragraphs away does
 *  not source it. */
export interface TextBlock extends Sentence {
  /** True where the block is a Markdown block quote (`>`), which is one of
   *  the two shapes a quoted remark takes. */
  quoted: boolean;
}

/** A sentence ends at `.`, `!` or `?` followed by whitespace or the end of
 *  a block. Deliberately simple and deliberately over-eager at an
 *  abbreviation: splitting "Inc. sells" into two sentences can only *fail*
 *  a draft that would otherwise pass (the link and the figure land in
 *  different pieces), and a hard rule that errs toward stopping a page is
 *  the safe direction. */
const SENTENCE_END_RE = /(?<=[.!?])\s+/;

function blockFragments(markdown: string): Array<{ raw: string; quoted: boolean }> {
  const out: Array<{ raw: string; quoted: boolean }> = [];
  let current: string[] = [];
  let currentQuoted = false;

  const flush = (): void => {
    const raw = current.join("\n").trim();
    if (raw.length > 0) out.push({ raw, quoted: currentQuoted });
    current = [];
    currentQuoted = false;
  };

  for (const line of markdown.split("\n")) {
    const isBlank = line.trim().length === 0;
    const isQuote = /^[ \t]*>/.test(line);
    const isListItem = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/.test(line);
    const isHeading = /^[ \t]*#{1,6}[ \t]+/.test(line);
    if (isBlank) {
      flush();
      continue;
    }
    // A heading, a list item, or a change of quotedness starts a new block:
    // each is its own scope for the block-scoped rules.
    if ((isHeading || isListItem || isQuote !== currentQuoted) && current.length > 0) {
      flush();
    }
    currentQuoted = isQuote;
    current.push(line);
    if (isHeading) flush();
  }
  flush();
  return out;
}

/** Every block of the draft, in document order. */
export function blocksOf(markdown: string): TextBlock[] {
  return blockFragments(markdown).map((fragment) => ({
    text: renderOf(fragment.raw).replace(/\s+/g, " ").trim(),
    hasLink: hasLink(fragment.raw),
    quoted: fragment.quoted,
  }));
}

/** Every sentence of the draft, in document order. A sentence never spans
 *  a block boundary. */
export function sentencesOf(markdown: string): Sentence[] {
  const out: Sentence[] = [];
  for (const fragment of blockFragments(markdown)) {
    // Split the Markdown itself, so each piece keeps the addresses that
    // stand inside it; then render each piece to the reader's words.
    for (const piece of fragment.raw.split(SENTENCE_END_RE)) {
      const text = renderOf(piece).replace(/\s+/g, " ").trim();
      if (text.length === 0 && !hasLink(piece)) continue;
      out.push({ text, hasLink: hasLink(piece) });
    }
  }
  return out;
}
