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
import { copy } from "@/lib/presentation/copy";
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
  detail?: readonly string[];
  links?: readonly { label: string; href: string }[];
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
      ...(item.detail === undefined ? {} : { detail: item.detail.map((line) => copy(line.text, line.vars)) }),
      ...(item.links === undefined ? {} : { links: item.links.map((link) => ({ label: copy(link.label, link.vars), href: link.href })) }),
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
  return block.items.map((item) => ({ label: copy(item.label, item.labelVars), value: item.value }));
}

/** One drawn row of a `stats` group. `value` is `null` where the number was
 *  not measured, and `line` then says so; otherwise `line` is what the
 *  figure is read against, or nothing. */
export interface StatRowText {
  readonly label: string;
  readonly value: string | null;
  /** A written word that stands before the figure, or nothing. */
  readonly before: string | null;
  readonly change: string | null;
  readonly line: string | null;
}

/** The rows of a kept `stats` group, rendered through `copy()` and
 *  `formatStat`. An unmeasured change is no change stated, never a zero,
 *  and an unmeasured number is its written line, never a figure. */
export function statRowsOf(block: Extract<MailBlock, { block: "stats" }>): readonly StatRowText[] {
  return keptStatRows(block).map((item) => {
    const label = copy(item.label, item.labelVars);
    if (item.value.kind === "unmeasured") {
      return {
        label,
        value: null,
        before: null,
        change: null,
        line: item.unmeasuredLine === undefined ? null : copy(item.unmeasuredLine),
      };
    }
    return {
      label,
      value: formatStat(item.value, item.format),
      before: item.before === undefined ? null : copy(item.before),
      change:
        item.change === undefined || item.change.kind === "unmeasured"
          ? null
          : formatStat(item.change, "delta"),
      line: item.note === undefined ? null : copy(item.note.text, item.note.vars),
    };
  });
}
