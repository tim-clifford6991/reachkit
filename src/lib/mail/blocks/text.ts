// BUILD §12 — the plain-text twin of the same block list, through the same omission, formatter and row builder.
// `composeMail()` renders both bodies from one list, so no template can author or forget the text body; only layout differs.
import { copy } from "@/lib/presentation/copy";
import { generatedLabel } from "@/lib/presentation/generated";
import { formatStat } from "./format";
import { factRowsOf, rowsOf, statRowsOf, type RenderedRow } from "./rows";
import { isMeasuredEmpty, omittedIndexes } from "./omit";
import type { MailBlock } from "./types";

/** Blocks are separated by a blank line, rows within a block by one newline. */
const BLOCK_SEPARATOR = "\n\n";

function statLines(labelText: string, value: string, note: string | null): string {
  const head = `${labelText}: ${value}`;
  return note === null ? head : `${head}\n${note}`;
}

function rowLines(labelText: string | null, rows: readonly RenderedRow[], emptyLine: string | null): string {
  const head = labelText === null ? [] : [labelText];
  if (emptyLine !== null) return [...head, emptyLine].join("\n");
  // A row that leads somewhere writes its address beside it, as an action does.
  const lines = rows.map((item) => {
    const side = item.right ?? item.href;
    return [
      side === undefined ? item.left : `${item.left}: ${side}`,
      ...(item.detail ?? []),
      ...(item.links ?? []).map((link) => actionLine(link.label, link.href)),
    ].join("\n");
  });
  return [...head, ...lines].join("\n");
}

/** BUILD §12's text action: the URL beside its label, never bare. */
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
            ? rowLines(block.label === undefined ? null : copy(block.label), [], copy(block.emptyLine))
            : rowLines(block.label === undefined ? null : copy(block.label), rowsOf(block), null)
        );
        break;
      case "facts":
        // The `dl`'s twin: one `label: value` per line, in the same order.
        parts.push(factRowsOf(block).map((item) => `${item.label}: ${item.value}`).join("\n"));
        break;
      case "hero":
        // The headline number and, where measured, its change.
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
        // One number per line, from the builder the HTML grid reads.
        parts.push(
          statRowsOf(block)
            .map((item) => {
              // An unmeasured number is its written line, where its figure would stand.
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
