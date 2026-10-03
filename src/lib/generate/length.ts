// SPEC §7 (2026-09-29) *Length and the writer* · issue 1138 — the one length
// target, and the one count of a page's words.
//
// Round 1 (owner, 2026-10-02) told a page 1,200–1,800 words and graded it
// against 1,500–2,500, because the writer, the critic and the grader each
// held a target of their own. They read this one now: the page's kind
// (`contentKindOf`) chooses the row of `LENGTH_TARGETS`, and `bodyWords` is
// how every one of them counts.
import { LENGTH_TARGETS } from "@/lib/config/constants";
import { contentKindOf, type ContentKind } from "@/lib/opportunities/content-kind";
import type { Opportunity } from "@/lib/opportunities/types";
import { renderOf } from "./rules/text";

export interface LengthTarget {
  kind: Exclude<ContentKind, "update">;
  floor: number;
  ceiling: number;
}

/** The length a page is written to and held to. `null` for an update, which
 *  keeps to the page it updates, and for a type that writes no body. */
export function lengthTargetFor(o: Pick<Opportunity, "type" | "targetQuery">): LengthTarget | null {
  const kind = contentKindOf(o);
  if (kind === null || kind === "update") return null;
  return { kind, ...LENGTH_TARGETS[kind] };
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
