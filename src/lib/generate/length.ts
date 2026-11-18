// SPEC §7 (*Length*) — the one length range, and the one count of a page's words.
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
  /** The words one section is written to, where the range is the share the pack's own sections fill. */
  each?: number;
}

/** The share of its maximum a new page aims at: below the stop line, as the old midpoint was. */
export const AIM = 0.8;

/** The words a page of this template is written to and held to. A new page keeps its type's floor, or a kept product
 *  page its kept row, or a short voice its own; it aims at the higher of that target and the share of its maximum its
 *  sections, the `covered` options or gaps and the pack's `questions` answer, never past the ceiling. `fitted` is the
 *  range of the sections the pack fills alone: no floor, and their share as its ceiling, so no page is told words its
 *  pack cannot source. `liveWords` is the body of the page an update refreshes; an update with no live page to measure
 *  against has no range. An update keeps within its share of the live page, never under `typeOf`'s floor, and one
 *  under that floor may grow to its target; one that may add sections (`grown`) may grow to its grown share. */
export function lengthRangeFor(
  template: Template,
  a: { questions?: number; covered?: number; voice?: LengthRange | null; liveWords?: number | null; grown?: boolean; kept?: boolean; typeOf?: LengthRange; fitted?: boolean } = {}
): LengthRange | null {
  const length = template.length;
  if ("ceiling" in length) {
    const own = a.voice ?? typeLength(template, a.kept)!;
    const ceiling = Math.min(length.ceiling, a.voice?.ceiling ?? Number.MAX_SAFE_INTEGER);
    // A voice's cap is shared by the sections the page has, so empty gap slots never shorten it.
    const capped = ceiling < length.ceiling;
    const bounds = sectionBounds(capped ? { ...template, sections: template.sections.filter((slot) => slot.when !== "gaps") } : template);
    const fixed = template.sections.filter((section) => section.repeat === undefined).length;
    const filled = Math.min(bounds.max, fixed + (a.covered ?? 0) + (a.questions ?? 0));
    if (a.fitted === true) return { floor: 0, target: Math.round((AIM * ceiling * filled) / bounds.max), ceiling: Math.round((ceiling * filled) / bounds.max), each: Math.round((AIM * ceiling) / bounds.max) };
    const coverage = Math.round((AIM * ceiling * Math.max(bounds.min, filled)) / bounds.max);
    return { floor: own.floor, target: Math.min(ceiling, Math.max(own.target, coverage)), ceiling };
  }
  const live = a.liveWords ?? null;
  if (live === null || live <= 0) return null;
  const share = length.withinShareOfLive;
  const up = a.grown === true ? (length.grownShare ?? share) : share;
  const type = a.typeOf ?? { floor: 0, target: 0, ceiling: 0 };
  const floor = Math.max(Math.floor(live * (1 - share)), type.floor);
  const ceiling = Math.max(Math.ceil(live * (1 + up)), live < type.floor ? type.target : 0);
  return { floor, target: Math.round((floor + ceiling) / 2), ceiling };
}

/** A type's own row, the kept row where the page is a product page: what an update of a page of that type is held to. */
export function typeLength(template: Template, kept = false): LengthRange | undefined {
  const length = template.length;
  if (!("ceiling" in length)) return undefined;
  if (kept && length.kept !== undefined && length.keptAim !== undefined) return { ...length.keptAim, ceiling: length.kept };
  return { floor: length.floor, target: length.target, ceiling: length.ceiling };
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
