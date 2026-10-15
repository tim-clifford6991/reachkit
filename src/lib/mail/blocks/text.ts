// BUILD §12 — the plain-text rendering of the same block list.
//
// The same `MailBlock[]`, rendered a second time, through the same
// omission decision (`omit.ts`), the same numeral formatter
// (`format.ts`) and the same row builder (`rows.ts`'s `rowsOf`). A
// template authors no text body and cannot omit one: `composeMail()`
// calls both renderers on one list, so the plain-text alternative is a
// property of the seam rather than of any template's diligence.
//
// This file holds no second omission rule and no second formatter. What
// differs between the two bodies is layout — line breaks, a URL written
// out beside its label — and nothing else.
import { copy } from "@/lib/presentation/copy";
import { generatedLabel } from "@/lib/presentation/generated";
import { formatStat } from "./format";
import { factRowsOf, rowsOf, statRowsOf } from "./rows";
import { isMeasuredEmpty, omittedIndexes } from "./omit";
import type { MailBlock } from "./types";

/** A plain-text body's one structural convention: blocks are separated by
 *  a blank line, rows within a block by a single one. Layout, not voice. */
const BLOCK_SEPARATOR = "\n\n";

function statLines(labelText: string, value: string, note: string | null): string {
  const head = `${labelText}: ${value}`;
  return note === null ? head : `${head}\n${note}`;
}

function rowLines(
  labelText: string,
  rows: readonly { left: string; right?: string; href?: string }[],
  emptyLine: string | null
): string {
  if (emptyLine !== null) return `${labelText}\n${emptyLine}`;
  // A row that leads somewhere writes its address beside it, as an action does.
  const lines = rows.map((item) => {
    const side = item.right ?? item.href;
    return side === undefined ? item.left : `${item.left}: ${side}`;
  });
  return [labelText, ...lines].join("\n");
}

/** BUILD §12's plain-text twin of an action. The URL is written out beside
 *  its label — never a bare naked URL with nothing saying what it is. */
function actionLine(labelText: string, href: string): string {
  return `${labelText}: ${href}`;
}

export function renderBlocksText(blocks: readonly MailBlock[]): {
  text: string;
  omitted: readonly number[];
} {
  const omitted = omittedIndexes(blocks);
  const dropped = new Set(omitted);
  const parts: string[] = [];

  for (const [index, block] of blocks.entries()) {
    if (dropped.has(index)) continue;
    switch (block.block) {
      case "heading":
        parts.push(copy(block.text, block.vars));
        break;
      case "paragraph":
        parts.push(copy(block.text, block.vars));
        break;
      case "stat":
        parts.push(
          statLines(
            copy(block.label),
            formatStat(block.value, block.format),
            block.note === undefined ? null : copy(block.note)
          )
        );
        break;
      case "list":
      case "verdicts":
        parts.push(
          isMeasuredEmpty(block)
            ? rowLines(copy(block.label), [], copy(block.emptyLine))
            : rowLines(copy(block.label), rowsOf(block), null)
        );
        break;
      case "facts":
        // One row per line, `label: value` — the plain-text twin of the
        // `dl`, in the same order, from the same builder.
        parts.push(factRowsOf(block).map((item) => `${item.label}: ${item.value}`).join("\n"));
        break;
      case "hero":
        // The headline number, its label and — where one was measured —
        // its change, in the twin's own two lines.
        parts.push(
          statLines(
            copy(block.label),
            block.change === undefined || block.change.kind === "unmeasured"
              ? formatStat(block.value, block.format)
              : `${formatStat(block.value, block.format)} (${formatStat(block.change, "delta")})`,
            block.note === undefined ? null : copy(block.note)
          )
        );
        break;
      case "stats":
        // One number per line, in the same order and from the same builder
        // the HTML grid reads: the twin states the same four numbers.
        parts.push(
          statRowsOf(block)
            .map((item) => {
              // A number nobody measured is its written line, on the line
              // its figure would stand on.
              if (item.value === null) return `${item.label}: ${item.line ?? ""}`;
              const value = item.before === null ? item.value : `${item.before} ${item.value}`;
              const figure = item.change === null ? value : `${value} (${item.change})`;
              return item.line === null ? `${item.label}: ${figure}` : `${item.label}: ${figure} · ${item.line}`;
            })
            .join("\n")
        );
        break;
      case "action":
        parts.push(actionLine(copy(block.label), block.href));
        break;
      case "notice":
        parts.push(copy(block.text, block.vars));
        break;
      case "pageBody":
        parts.push(
          `${generatedLabel({ pageTitle: block.pageTitle, written: block.written }).label}\n${block.markdown}`
        );
        break;
    }
  }

  return { text: parts.join(BLOCK_SEPARATOR), omitted };
}
