// SPEC §7 (2026-09-29, *Length and the writer*; rewritten by D41) — the one
// length range, and the one count of a page's words.
//
// Each type's template states its length in words of body text (D42); an
// update keeps within a share of the page it updates. The writer, the length
// check and the evaluation's grader read this one range, and `bodyWords` is
// how every one of them counts.
import type { Template } from "./templates";
import { renderOf } from "./rules/text";

export interface LengthRange {
  floor: number;
  ceiling: number;
}

/** The words a page of this template is written to and held to. `liveWords`
 *  is the body of the page an update refreshes; an update with no live page
 *  to measure against has no range. */
export function lengthRangeFor(template: Template, liveWords: number | null = null): LengthRange | null {
  if ("floor" in template.length) return { floor: template.length.floor, ceiling: template.length.ceiling };
  if (liveWords === null || liveWords <= 0) return null;
  const share = template.length.withinShareOfLive;
  return { floor: Math.floor(liveWords * (1 - share)), ceiling: Math.ceil(liveWords * (1 + share)) };
}

/** The words under a page's headings: its body without the short-answer and
 *  takeaways boxes. What an update is measured by against the page it
 *  refreshes — a page written before those boxes existed gains them when it
 *  is refreshed, and that is not the page growing. */
export function sectionWords(markdown: string): number {
  return bodyWords(markdown.replace(/^[ \t]*:::[\w-]+[ \t]*\n[\s\S]*?\n[ \t]*:::[ \t]*$/gm, ""));
}

/** Words of body text: the words a reader meets, with the Markdown that
 *  sets them — link addresses, heading and list markers, table rules —
 *  taken out. */
export function bodyWords(markdown: string): number {
  const text = renderOf(markdown)
    .replace(/^[ \t]*:::.*$/gm, "")
    .replace(/^[ \t|:-]+$/gm, "")
    .replace(/\|/g, " ");
  return (text.match(/\S+/g) ?? []).length;
}
