// BUILD §12 — the rows a block states, built once so the HTML body and its text twin cannot state different facts.
// Every sentence goes through `copy()` and every number through `formatStat`; no markup here.
import { copy } from "@/lib/presentation/copy";
import { formatStat } from "./format";
import { keptStatRows } from "./omit";
import type { MailBlock } from "./types";

/** One `list` or `verdicts` row. A verdict stays two cells, since a joiner here would be an authored sentence. */
export interface RenderedRow {
  left: string;
  right?: string;
  href?: string;
  detail?: readonly string[];
  links?: readonly { label: string; href: string }[];
}

/** The rows of a kept `list` or `verdicts` block. `unmeasured` was dropped by `omit.ts`, so it is refused, not defaulted. */
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

/** One drawn `stats` row. `value` is `null` when unmeasured and `line` says so; otherwise `line` is what the figure is read against. */
export interface StatRowText {
  readonly label: string;
  readonly value: string | null;
  /** A written word that stands before the figure, or nothing. */
  readonly before: string | null;
  readonly change: string | null;
  readonly line: string | null;
}

/** A kept `stats` group's rows. An unmeasured change is not stated and an unmeasured number is its line, never a zero. */
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
