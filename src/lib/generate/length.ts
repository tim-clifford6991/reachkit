// SPEC §7 (2026-09-29, *Length and the writer*; rewritten by D41) — the one
// length range, and the one count of a page's words.
//
// Each type's template states its length in words of body text (D42); an
// update keeps within a share of the page it updates. The writer, the length
// check and the evaluation's grader read this one range, and `bodyWords` is
// how every one of them counts.
import { sectionBounds, type Template } from "./templates";
import { renderOf } from "./rules/text";

export interface LengthRange {
  floor: number;
  /** The words the writer aims for. */
  target: number;
  ceiling: number;
}

/** The share of its maximum a new page aims at: below the stop line, as the old midpoint was. */
export const AIM = 0.8;

/** The words a page of this template is written to and held to. A new page
 *  answers its fixed sections and the pack's `questions`, each given the
 *  same share of the type's maximum, which caps it; a short, complete page
 *  is never stopped for its length (owner ruling B7). `cap` is a lower
 *  maximum a voice sets. `liveWords` is the body of the page an update
 *  refreshes; an update with no live page to measure against has no range.
 *  An update that may add sections (`grown`, issue 1521) keeps its floor
 *  and may grow to its grown share. */
export function lengthRangeFor(
  template: Template,
  a: { questions?: number; cap?: number; liveWords?: number | null; grown?: boolean } = {}
): LengthRange | null {
  if ("ceiling" in template.length) {
    const ceiling = Math.min(template.length.ceiling, a.cap ?? Number.MAX_SAFE_INTEGER);
    const bounds = sectionBounds(template);
    const fixed = template.sections.filter((section) => section.repeat === undefined).length;
    const answered = Math.min(bounds.max, Math.max(bounds.min, fixed + (a.questions ?? 0)));
    return { floor: 0, target: Math.round((AIM * ceiling * answered) / bounds.max), ceiling };
  }
  const live = a.liveWords ?? null;
  if (live === null || live <= 0) return null;
  const share = template.length.withinShareOfLive;
  const up = a.grown === true ? (template.length.grownShare ?? share) : share;
  const floor = Math.floor(live * (1 - share));
  const ceiling = Math.ceil(live * (1 + up));
  return { floor, target: Math.round((floor + ceiling) / 2), ceiling };
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
