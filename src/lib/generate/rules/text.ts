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

/** Every address a fragment of Markdown links or states. */
export function linksOf(markdownFragment: string): string[] {
  // `matchAll` starts where a shared global pattern was last left.
  MD_LINK_RE.lastIndex = 0;
  BARE_URL_RE.lastIndex = 0;
  const out = [...markdownFragment.matchAll(MD_LINK_RE)].map((match) => match[2]!);
  for (const match of markdownFragment.replace(MD_LINK_RE, " ").matchAll(BARE_URL_RE)) out.push(match[0]);
  return out;
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
  // A container's fence (`:::answer`, `:::`) is not words: the box's label
  // is the renderer's, and what a reader meets is what stands inside.
  out = out.replace(DIRECTIVE_FENCE_RE, "");
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

/** The opening or closing line of a container block (SPEC §7, 2026-09-20):
 *  `:::answer`, `:::takeaways`, `:::`. */
const DIRECTIVE_FENCE_RE = /^[ \t]*:::[ \t]*[\w-]*[ \t]*$/gm;
const DIRECTIVE_LINE_RE = /^[ \t]*:::[ \t]*[\w-]*[ \t]*$/;

/** One sentence of a draft, in both projections. */
export interface Sentence {
  /** The words a reader meets in it. */
  text: string;
  /** Whether the Markdown it came from carried an address. */
  hasLink: boolean;
  /** The addresses it links, as written (issue 1135): what the sourcing
   *  rules hold against the pages the facts were read from. Only
   *  `sentencesOf` fills it. */
  links?: readonly string[];
}

/** A sentence, with the Markdown it was read from — what a rule needs to tell
 *  the page's own words from a cited source's, which stand inside a link's
 *  label. A block carries no `raw`: its Markdown is `sourceBlocksOf`'s. */
export interface SourceSentence extends Sentence {
  raw: string;
}

/** One block of a draft — a paragraph, a heading, a block quote, or one
 *  list item. Blocks are the scope of the people rules: a quotation and its
 *  attribution belong to one block, and a link three paragraphs away does
 *  not source it. */
export interface TextBlock extends Sentence {
  /** True where the block is a Markdown block quote (`>`), which is one of
   *  the two shapes a quoted remark takes. */
  quoted: boolean;
  /** A heading line, or one list item — neither is a paragraph that could
   *  answer a question on its own. */
  heading: boolean;
  listItem: boolean;
}

/** A sentence ends at `.`, `!` or `?` followed by whitespace or the end of
 *  a block. Deliberately simple and deliberately over-eager at an
 *  abbreviation: splitting "Inc. sells" into two sentences can only *fail*
 *  a draft that would otherwise pass (the link and the figure land in
 *  different pieces), and a hard rule that errs toward stopping a page is
 *  the safe direction. */
export const SENTENCE_END_RE = /(?<=[.!?])\s+/;

/**
 * A block's Markdown, cut into its sentences.
 *
 * **A link is never cut in two** (issue 1187). A cited page's title is often
 * a sentence of its own — `[We tested 15 tools. Here are the best.](…)` —
 * and cutting at its full stop left the first half a sentence with no
 * address beside it: a sourced figure read as an unsourced one, and the
 * source's words as the page's.
 */
export function splitSentences(blockMarkdown: string): string[] {
  const links: string[] = [];
  MD_LINK_RE.lastIndex = 0;
  const held = blockMarkdown.replace(MD_LINK_RE, (link) => `\u0000${links.push(link) - 1}\u0000`);
  return held
    .split(SENTENCE_END_RE)
    .map((piece) => piece.replace(/\u0000(\d+)\u0000/g, (_, index: string) => links[Number(index)] ?? ""));
}

/** The reader's words of a fragment that are the page's own: a link's label
 *  is the cited page's words, or its name, and is left out. */
export function ownWordsOf(markdownFragment: string): string {
  MD_LINK_RE.lastIndex = 0;
  return renderOf(markdownFragment.replace(MD_LINK_RE, " ")).replace(/\s+/g, " ").trim();
}

/**
 * One block of the draft as it stands **in the source**, with the offsets
 * it occupies there.
 *
 * `from` and `to` index the Markdown the caller passed, so a caller that
 * has to point at a block — the editor's lint marks (issue 932) — points
 * at the same span the rules reasoned over rather than splitting the text
 * again with rules of its own. That second splitter is the thing this
 * member exists to prevent: two notions of where a block begins is how a
 * mark comes to underline the sentence next to the offending one.
 */
export interface SourceBlock {
  raw: string;
  quoted: boolean;
  /** The offset of `raw`'s first character in the Markdown it came from. */
  from: number;
  /** One past the offset of its last. */
  to: number;
}

/**
 * Every block of the draft, in document order, in the source's own
 * coordinates.
 *
 * The scope of the block-scoped rules — `checkInventedPeople`,
 * `checkUnsourcedTestimonial` and the two beside them all iterate what
 * this returns, through `blocksOf`.
 */
export function sourceBlocksOf(markdown: string): SourceBlock[] {
  const out: SourceBlock[] = [];
  let current: string[] = [];
  let currentQuoted = false;
  /** Where the first line now in `current` begins, in `markdown`. */
  let currentFrom = 0;
  /** Where the line being read begins. `+ 1` for the `\n` split ate. */
  let at = 0;

  const flush = (): void => {
    const joined = current.join("\n");
    const raw = joined.trim();
    if (raw.length > 0) {
      // `trim()` moves both edges; the offsets follow it, so the span is
      // the block's own characters and not the blank lines around them.
      const lead = joined.length - joined.trimStart().length;
      out.push({ raw, quoted: currentQuoted, from: currentFrom + lead, to: currentFrom + lead + raw.length });
    }
    current = [];
    currentQuoted = false;
  };

  for (const line of markdown.split("\n")) {
    const lineAt = at;
    at += line.length + 1;
    // A container's fence separates blocks exactly as a blank line does, so
    // what stands in a box is read as the paragraph or the list it is.
    const isBlank = line.trim().length === 0 || DIRECTIVE_LINE_RE.test(line);
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
    if (current.length === 0) currentFrom = lineAt;
    currentQuoted = isQuote;
    current.push(line);
    if (isHeading) flush();
  }
  flush();
  return out;
}

/** Every block of the draft, in document order. */
export function blocksOf(markdown: string): TextBlock[] {
  return sourceBlocksOf(markdown).map((fragment) => ({
    text: renderOf(fragment.raw).replace(/\s+/g, " ").trim(),
    hasLink: hasLink(fragment.raw),
    quoted: fragment.quoted,
    heading: HEADING_LINE_RE.test(fragment.raw),
    listItem: LIST_ITEM_RE.test(fragment.raw),
  }));
}

const HEADING_LINE_RE = /^[ \t]*#{1,6}[ \t]+/;
const LIST_ITEM_RE = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/;

/** The words of every heading in the draft, in document order. */
export function headingsOf(markdown: string): string[] {
  return blocksOf(markdown)
    .filter((block) => block.heading)
    .map((block) => block.text);
}

/** Words a question opens with, when it is written without its mark. */
const INTERROGATIVE_RE =
  /^(?:what|why|how|when|where|which|who|whose|can|could|does|do|did|is|are|should|will|would)\b/i;

/** A heading shaped as a question: it ends in `?`, or it opens the way a
 *  question does. The pass that must add none, and the rule that counts
 *  them, read this one definition. */
export function isQuestionShaped(heading: string): boolean {
  const text = heading.trim();
  return text.endsWith("?") || INTERROGATIVE_RE.test(text);
}

/** One comparable form of a heading: its words, lower-cased, without the
 *  question mark or the surrounding space. */
export function headingKey(heading: string): string {
  return heading.replace(/[?!.:]+$/, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** One item of a reference list: a linked page title and a short tail —
 *  "- [Pricing — Rival](https://…), read on 3 October 2026". */
const REFERENCE_ITEM_RE = /^[ \t]*[-*+][ \t]+\[[^\]\n]*\]\([^)\s]+\)[^\n]{0,40}$/;

/**
 * The draft with every reference list blanked: a heading whose section is
 * nothing but linked page titles — the sources list code writes at the foot
 * of a page (SPEC §7, 2026-09-29; issue 1135).
 *
 * The rules judge what the page says, and a cited page's title is not the
 * page saying it: "We tested 15 tools", the title of a source, is neither an
 * invented test nor an untraceable number. Each blanked character becomes a
 * space, so every offset into the Markdown still points where it did — the
 * editor's marks are placed in the same coordinates.
 */
export function withoutReferenceLists(markdown: string): string {
  const lines = markdown.split("\n");
  const out = [...lines];
  for (let at = 0; at < lines.length; at++) {
    if (!HEADING_LINE_RE.test(lines[at]!)) continue;
    let end = at + 1;
    let items = 0;
    while (end < lines.length && !HEADING_LINE_RE.test(lines[end]!)) {
      if (lines[end]!.trim().length > 0) {
        if (!REFERENCE_ITEM_RE.test(lines[end]!)) {
          items = -1;
          break;
        }
        items++;
      }
      end++;
    }
    if (items <= 0) continue;
    for (let line = at; line < end; line++) out[line] = " ".repeat(lines[line]!.length);
    at = end - 1;
  }
  return out.join("\n");
}

/** Every sentence of the draft, in document order. A sentence never spans
 *  a block boundary. */
export function sentencesOf(markdown: string): SourceSentence[] {
  const out: SourceSentence[] = [];
  for (const fragment of sourceBlocksOf(markdown)) {
    // Split the Markdown itself, so each piece keeps the addresses that
    // stand inside it; then render each piece to the reader's words.
    for (const piece of splitSentences(fragment.raw)) {
      const text = renderOf(piece).replace(/\s+/g, " ").trim();
      if (text.length === 0 && !hasLink(piece)) continue;
      out.push({ text, hasLink: hasLink(piece), links: linksOf(piece), raw: piece });
    }
  }
  return out;
}
