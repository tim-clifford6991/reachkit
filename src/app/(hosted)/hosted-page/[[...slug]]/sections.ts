// An offering page's stored sections, found in its body's blocks by the headings generation recorded.
import { inlineText, type Block } from "@/lib/publish/render/markdown";

/** The words of a heading or title, for comparing the two: case, spacing
 *  and a trailing full stop or colon do not make them different. */
export function titleKey(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/[.:]$/, "").toLowerCase();
}

/** The blocks a heading's section spans, `to` exclusive; `null` where the body has no such heading. */
export function sectionAt(blocks: readonly Block[], heading: string): { from: number; to: number } | null {
  const from = blocks.findIndex((block) => block.kind === "heading" && titleKey(inlineText(block.children)) === titleKey(heading));
  const top = blocks[from];
  if (top?.kind !== "heading") return null;
  const next = blocks.findIndex((block, i) => i > from && block.kind === "heading" && block.level <= top.level);
  return { from, to: next < 0 ? blocks.length : next };
}

/** An offering page's "Where and when" (E10): its list of places, by its
 *  index in `blocks`. `null` where the page records none or the section lists no place. */
export function whereWhenOf(blocks: readonly Block[], heading: string | null | undefined): { list: number; places: string[] } | null {
  const section = heading === null || heading === undefined ? null : sectionAt(blocks, heading);
  if (section === null) return null;
  const list = blocks.findIndex((block, i) => i > section.from && i < section.to && block.kind === "list" && !block.ordered);
  const listed = blocks[list];
  if (listed?.kind !== "list") return null;
  return { list, places: listed.items.map((item) => inlineText(item).replace(/\s+/g, " ").trim()) };
}
