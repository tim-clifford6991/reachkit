// SPEC §4 (2026-09-20, #908) — the first lines of a page, as readers see them.
//
// The Overview's small view of the page in review shows "a small view of it
// as readers will see it": its title and the opening it leads with. That
// opening is the body's **first paragraph**, with its Markdown resolved —
// not the raw source, where a reader would meet `**bold**` and a link's
// address as characters.
//
// **The product's one Markdown parser decides what a paragraph is**
// (`src/lib/publish/render/markdown.ts`, the module every sink already goes
// through). Nothing here re-implements the grammar; this file walks the
// blocks the parser returns and flattens one of them to text.
//
// **It is a preview, so it is cut.** A lead longer than `LEAD_MAX_CHARS`
// ends at the last word boundary before the limit and takes an ellipsis —
// the one place this screen shortens a customer's own words, and the card
// says what it is a view of. A body that has not been written yet has no
// lead, and the card shows the title alone rather than an empty box.
import { parseMarkdown, type Block, type Inline } from "@/lib/publish/render/markdown";

/** How much of the opening the card shows. A preview, not the page: the
 *  whole of it is one click away behind *Read it*, and a card that grew with
 *  the paragraph would push the three tiles under it off the first screen. */
export const LEAD_MAX_CHARS = 220;

/** The character a cut lead ends on. A value, not a sentence — the same
 *  standing as the dash `unmeasured` renders as. */
const ELLIPSIS = "…";

/** The first paragraph of a body, flattened to text and cut to length.
 *  Empty for a body that holds no paragraph at all, which is what an
 *  unwritten page has. */
export function leadOf(bodyMd: string | null | undefined): string {
  if (typeof bodyMd !== "string" || bodyMd.trim() === "") return "";
  const paragraph = parseMarkdown(bodyMd).find((block) => block.kind === "paragraph");
  if (paragraph === undefined) return "";
  return cut(textOf(paragraph).replace(/\s+/g, " ").trim());
}

/** A block's own text, with every inline resolved to the characters a reader
 *  sees. Total over the block union by construction — a block the parser can
 *  return and this function cannot read would be a compile error rather than
 *  a silently empty lead. */
function textOf(block: Block): string {
  switch (block.kind) {
    case "code":
      return block.text;
    case "rule":
      return "";
    case "list":
      return block.items.map(inlinesOf).join(" ");
    default:
      return inlinesOf(block.children);
  }
}

function inlinesOf(children: readonly Inline[]): string {
  return children.map(inlineOf).join("");
}

function inlineOf(inline: Inline): string {
  return inline.kind === "text" || inline.kind === "code" ? inline.text : inlinesOf(inline.children);
}

/** At most `LEAD_MAX_CHARS`, ending on a word. A cut mid-word reads as a
 *  typo; a cut at a space reads as a preview. */
function cut(text: string): string {
  if (text.length <= LEAD_MAX_CHARS) return text;
  const clipped = text.slice(0, LEAD_MAX_CHARS);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}${ELLIPSIS}`;
}
