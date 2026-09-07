// BUILD §8 hard rule 7, and BUILD §14's standing line — nothing in the
// text handed to a destination that a
// reader of the published page would not see.
//
// This rule runs over the **Markdown and the markup embedded in it**, not
// over the rendered text, because it is about what ReachKit would hand to
// the customer's CMS. Off-screen positioning, zero sizing, colour matched
// to the background, comments, and alternative text carrying anything but a
// description of what it labels — each is text that reaches a machine
// reader and not a human one.
//
// **A hyperlink and its address are exempt**, because §8's sourcing rules
// require a draft to carry links: a rule that failed on an address would
// make two of §8's rules unsatisfiable together.
import type { RuleFailure } from "./types";

const FAILURE: RuleFailure = { rule: "no_hidden_text" };

/** An HTML comment reaches the destination and no reader. */
const COMMENT_RE = /<!--[\s\S]*?-->/;

/** Off-screen positioning, in the forms a style attribute can take. */
const OFFSCREEN_RE =
  /(?:position\s*:\s*absolute[^;"']*;?[^"']*(?:left|top)\s*:\s*-\s*\d)|(?:(?:left|top)\s*:\s*-\s*\d{3,}\s*px)|(?:text-indent\s*:\s*-\s*\d{3,})/i;

/** Sized to nothing: zero height, zero width, zero font size, or clipped
 *  to a one-pixel box. */
const ZERO_SIZE_RE =
  /(?:font-size\s*:\s*0)|(?:(?:height|width)\s*:\s*0(?:px|em|rem|%)?\s*[;"'])|(?:max-height\s*:\s*0)|(?:clip\s*:\s*rect\(\s*0)/i;

/** Hidden outright, which is the same promise broken more simply. */
const HIDDEN_RE = /(?:display\s*:\s*none)|(?:visibility\s*:\s*hidden)|(?:opacity\s*:\s*0(?:\.0+)?\s*[;"'])|(?:\shidden\s*[=>])|(?:aria-hidden\s*=\s*["']?true)/i;

/** Colour matched to the background — the classic form, and the only one a
 *  lexical pass can decide: the same colour named for both. */
const BACKGROUND_COLOUR_RE =
  /color\s*:\s*(#[0-9a-f]{3,8}|[a-z]+)[^;"']*;[^"']*background(?:-color)?\s*:\s*\1\b/i;

/** `<img alt="…">` and `[label](href "title")`. A description of what it
 *  labels is short and names the thing; a sentence about the brand is not.
 *  The line drawn here is a sentence: alternative text carrying a sentence
 *  terminator mid-string, or running past `ALT_TEXT_MAX`, is prose aimed
 *  somewhere other than at the image it labels. */
const ALT_TEXT_MAX = 120;
const ALT_ATTR_RE = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const IMAGE_ALT_RE = /!\[([^\]\n]*)\]\([^)\s]*(?:\s+["'][^"']*["'])?\)/g;
const LINK_TITLE_RE = /\[[^\]\n]*\]\([^)\s]+\s+["']([^"']*)["']\)/g;

function isDescriptive(label: string): boolean {
  const trimmed = label.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.length > ALT_TEXT_MAX) return false;
  // A sentence terminator with more text after it is prose, not a label.
  return !/[.!?]\s+\S/.test(trimmed);
}

function everyLabelDescriptive(markdown: string, pattern: RegExp): boolean {
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    const label = match[1] ?? match[2] ?? "";
    if (!isDescriptive(label)) return false;
  }
  return true;
}

export function checkHiddenText(a: { markdown: string }): RuleFailure | null {
  if (COMMENT_RE.test(a.markdown)) return FAILURE;
  if (OFFSCREEN_RE.test(a.markdown)) return FAILURE;
  if (ZERO_SIZE_RE.test(a.markdown)) return FAILURE;
  if (HIDDEN_RE.test(a.markdown)) return FAILURE;
  if (BACKGROUND_COLOUR_RE.test(a.markdown)) return FAILURE;
  if (!everyLabelDescriptive(a.markdown, ALT_ATTR_RE)) return FAILURE;
  if (!everyLabelDescriptive(a.markdown, IMAGE_ALT_RE)) return FAILURE;
  if (!everyLabelDescriptive(a.markdown, LINK_TITLE_RE)) return FAILURE;
  return null;
}
