// BUILD §12 — the omission rule, decided once.
//
// "All values conditional: a missing number omits its section, never
// prints 0." The rule has three halves and this file owns the first:
//
//   1. A `stat`, `list` or `verdicts` block whose `Measured` is
//      `unmeasured` is dropped entirely — no zero, no dash, no
//      placeholder, and its `note` goes with it.
//   2. A measured zero prints as zero. There is no zero branch here to
//      delete: `omittedIndexes` narrows by exclusion, so the `zero` arm is
//      reachable only through the same path as `measured`.
//   3. A measured-but-empty list states its empty result in one written
//      line — that is a render, not an omission, and it lives in the two
//      renderers.
//
// Both `html.ts` and `text.ts` call this and neither computes an omission
// of its own. A rule that held in one body and not the other is the exact
// failure the single plain-text renderer exists to prevent.
import { COPY, TODO_COPY_MARKER, type CopyKey } from "@/lib/presentation/copy";
import type { MailBlock } from "./types";

/** §8, 2026-09-07: an owner-owed key renders its marker on a screen and
 *  sends nothing at all in a mail. So a block whose whole sentence is
 *  still unwritten is dropped here, with the rest of the omissions. */
function unwritten(key: CopyKey): boolean {
  return COPY[key] === TODO_COPY_MARKER;
}

/** Is this block dropped? Three reasons: an unmeasured value, an empty
 *  table, or a sentence the owner has not written yet (§8). */
function isOmitted(block: MailBlock): boolean {
  switch (block.block) {
    case "stat":
      return block.value.kind === "unmeasured";
    case "list":
    case "verdicts":
      return block.items.kind === "unmeasured";
    case "heading":
    case "paragraph":
    case "notice":
    case "eyebrow":
    case "footnote":
      return unwritten(block.text);
    case "meters":
      // Empty for the reason an empty `facts` table is: there is no
      // written line that says "no tiles".
      return block.items.length === 0;
    case "facts":
      // The one arm dropped for being *empty*: a `list` states its empty
      // result in a written line, and there is no such line for a fact
      // table — an empty `dl` is a blank in the middle of the card, which
      // is what §12's rule is against.
      return block.items.length === 0;
    default:
      return false;
  }
}

/** The indexes, in the caller's own order, of the blocks that are left
 *  out. The single decision both renderers read. */
export function omittedIndexes(blocks: readonly MailBlock[]): readonly number[] {
  const out: number[] = [];
  for (const [index, block] of blocks.entries()) {
    if (isOmitted(block)) out.push(index);
  }
  return out;
}

/** True where a conditional block was measured and came out empty — the
 *  "states that empty result in one written line" case. A stat is never
 *  empty: a measured number, zero included, is a result. */
export function isMeasuredEmpty(block: MailBlock): boolean {
  if (block.block !== "list" && block.block !== "verdicts") return false;
  const items = block.items;
  if (items.kind === "unmeasured") return false;
  return items.value.length === 0;
}
