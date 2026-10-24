// BUILD §12 — "a missing number omits its section, never prints 0", decided once for both bodies.
// An unmeasured `stat`, `hero`, `list` or `verdicts` goes with its note; a measured zero prints; a measured-empty list is a written line, rendered not omitted.
import type { MailBlock } from "./types";

/** A block with no `Measured` value (heading, action, notice, page body) is never dropped. */
function isOmitted(block: MailBlock): boolean {
  switch (block.block) {
    case "stat":
    case "hero":
      return block.value.kind === "unmeasured";
    case "stats":
      // Each number is omitted on its own; the group goes only when none is kept.
      return keptStatRows(block).length === 0;
    case "list":
    case "verdicts":
      return block.items.kind === "unmeasured";
    case "facts":
      // Dropped for being empty: a fact table has no empty line, and an empty `dl` is a blank in the card.
      return block.items.length === 0;
    default:
      return false;
  }
}

/** The indexes of the blocks left out, in the caller's order; both renderers read this. */
export function omittedIndexes(blocks: readonly MailBlock[]): readonly number[] {
  const out: number[] = [];
  for (const [index, block] of blocks.entries()) {
    if (isOmitted(block)) out.push(index);
  }
  return out;
}

/** The drawn rows of a `stats` group: the measured ones, and the unmeasured ones that carry a line saying so. */
export function keptStatRows(
  block: Extract<MailBlock, { block: "stats" }>
): readonly Extract<MailBlock, { block: "stats" }>["items"][number][] {
  return block.items.filter((item) => item.value.kind !== "unmeasured" || item.unmeasuredLine !== undefined);
}

/** A list measured and empty, which states one written line. A stat is never empty: zero is a result. */
export function isMeasuredEmpty(block: MailBlock): boolean {
  if (block.block !== "list" && block.block !== "verdicts") return false;
  const items = block.items;
  if (items.kind === "unmeasured") return false;
  return items.value.length === 0;
}
