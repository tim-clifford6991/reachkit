// BUILD §12 — the rows a block states, built once for both bodies.
//
// Split out of the renderers (rule 1.1) for the reason `omit.ts` and
// `format.ts` are: two bodies that each built their own rows could state
// different facts, different verdicts or different numbers, and no
// single-renderer test would see it. `nodes.tsx` (the HTML half) and
// `text.ts` (the plain-text twin) both read from here and neither builds a
// row of its own. Cost of reversing: inline each function into the two
// renderers — one edit, two copies.
//
// Every sentence goes through `copy()`; every number through `formatStat`.
// This module renders no markup and knows nothing about either body.
import { copy } from "@/lib/mail/language";
import { formatStat } from "./format";
import { keptStatRows } from "./omit";
import type { MailBlock } from "./types";

/** One rendered row of a `list` or `verdicts` block: the left cell always,
 *  the right cell only where the arm has one. A `verdicts` row's two
 *  halves stay two cells rather than one string joined by a character —
 *  a joiner written here would be a sentence this module authored. */
export interface RenderedRow {
  left: string;
  right?: string;
  href?: string;
}

/** The rows of a kept `list` or `verdicts` block, rendered through
 *  `copy()`. `unmeasured` is unreachable — `omit.ts` dropped the block —
 *  and is refused rather than defaulted, for the same reason `formatStat`
 *  refuses it. */
export function rowsOf(
  block: Extract<MailBlock, { block: "list" | "verdicts" }>
): readonly RenderedRow[] {
  if (block.items.kind === "unmeasured") {
    throw new Error(
      "rowsOf: an unmeasured block reached the renderer — BUILD §12 omits its section instead."
    );
  }
  if (block.block === "list") {
    return block.items.value.map((item) => ({
      left: copy(item.label, item.vars),
      ...(item.href === undefined ? {} : { href: item.href }),
    }));
  }
  return block.items.value.map((item) => ({
    left: copy(item.subject, item.subjectVars),
    right: copy(item.verdict),
  }));
}

/** The rows of a kept `facts` block, rendered through `copy()`. */
export function factRowsOf(
  block: Extract<MailBlock, { block: "facts" }>
): readonly { label: string; value: string }[] {
  return block.items.map((item) => ({ label: copy(item.label), value: item.value }));
}

/** The rows of a kept `stats` group, rendered through `copy()` and
 *  `formatStat`. An unmeasured change is no change stated, never a zero. */
export function statRowsOf(
  block: Extract<MailBlock, { block: "stats" }>
): readonly { label: string; value: string; change: string | null }[] {
  return keptStatRows(block).map((item) => ({
    label: copy(item.label),
    value: formatStat(item.value, item.format),
    change:
      item.change === undefined || item.change.kind === "unmeasured"
        ? null
        : formatStat(item.change, "delta"),
  }));
}
