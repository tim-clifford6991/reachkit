// BUILD §12 · §2.1 · §2.3 — the HTML rendering of the eight blocks.
//
// One render function per arm, table-based (the only layout an inbox can
// be relied on to lay out), every colour and font stack named through
// `shell/tokens.ts` and never written here, every sentence through
// `copy()`. Omission is `omit.ts`'s decision, read once at the top; this
// file contains no second rule about what is dropped.
//
// Numerals — BUILD §2.3, "every numeral, date, URL, search query and
// code-like string is JetBrains Mono with tabular-nums". A screen gets
// that from `.num` in `type.css`; a mail has no stylesheet, so `mono()`
// below is the one place the same two declarations are written inline,
// and every numeral in a mail goes through it.
import { copy } from "@/lib/presentation/copy";
import { generatedLabel } from "@/lib/presentation/generated";
import { token } from "../shell/tokens";
import { formatStat } from "./format";
import { omittedIndexes, isMeasuredEmpty } from "./omit";
import type { MailBlock } from "./types";

const ESCAPES: Readonly<Record<string, string>> = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
});

/** Every string that reaches the HTML body passes through here — a
 *  rendered sentence, a page title, a markdown body, a URL. There is no
 *  second path into the body. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/** A URL is only ever emitted as an `href`, and only when it is one of the
 *  two schemes an inbox should follow. Anything else is rendered as text,
 *  never as a link — a mail is the one surface where a hostile `href`
 *  costs the reader their account. */
function safeHref(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.toString();
}

function mono(text: string): string {
  return `<span style="font-family:${token("--font-mono")};font-variant-numeric:tabular-nums">${escapeHtml(text)}</span>`;
}

function row(inner: string): string {
  return `<tr><td style="padding:0 0 16px 0;font-family:${token("--font-ui")};font-size:${token("--t-body")};line-height:1.55;color:${token("--ink")}">${inner}</td></tr>`;
}

function label(text: string): string {
  return `<div style="font-size:${token("--t-eyebrow")};text-transform:uppercase;letter-spacing:0.04em;color:${token("--ink-3")};padding-bottom:4px">${escapeHtml(text)}</div>`;
}

function renderHeading(text: string): string {
  return row(
    `<h3 style="margin:0;font-size:${token("--h3")};font-weight:700;letter-spacing:-0.02em;color:${token("--ink")}">${escapeHtml(text)}</h3>`
  );
}

function renderParagraph(text: string): string {
  return row(`<p style="margin:0">${escapeHtml(text)}</p>`);
}

function renderStat(labelText: string, value: string, note: string | null): string {
  const noteLine =
    note === null
      ? ""
      : `<div style="font-size:${token("--t-sm")};color:${token("--ink-3")};padding-top:4px">${escapeHtml(note)}</div>`;
  return row(
    `${label(labelText)}<div style="font-size:${token("--h2")};font-weight:700;color:${token("--ink")}">${mono(value)}</div>${noteLine}`
  );
}

/** One rendered row of a `list` or `verdicts` block: the left cell always,
 *  the right cell only where the arm has one. A `verdicts` row's two
 *  halves stay two cells rather than one string joined by a character —
 *  a joiner written here would be a sentence this file authored. */
export interface RenderedRow {
  left: string;
  right?: string;
}

function renderRows(labelText: string, rows: readonly RenderedRow[], emptyLine: string | null): string {
  if (emptyLine !== null) {
    return row(`${label(labelText)}<p style="margin:0;color:${token("--ink-2")}">${escapeHtml(emptyLine)}</p>`);
  }
  const items = rows
    .map((item) => {
      const right =
        item.right === undefined
          ? ""
          : `<td align="right" style="padding:6px 0;border-bottom:1px solid ${token("--line")};color:${token("--ink-2")}">${escapeHtml(item.right)}</td>`;
      return `<tr><td style="padding:6px 0;border-bottom:1px solid ${token("--line")};color:${token("--ink")}">${escapeHtml(item.left)}</td>${right}</tr>`;
    })
    .join("");
  return row(`${label(labelText)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table>`);
}

/** The `dl` the approved shell draws (UI-SPEC S20): a label in the ui face
 *  at the eyebrow size, its value in mono on the same row, hairline-ruled.
 *  `<dl>`/`<dt>`/`<dd>` is the set's own markup and it is what the plain
 *  reading of "mono fact rows" asks for; the table wrapper stays because a
 *  `dl` is the one element inboxes lay out least predictably. */
function renderFacts(rows: readonly { label: string; value: string }[]): string {
  const items = rows
    .map(
      (item) =>
        `<tr><td style="padding:7px 0;border-bottom:1px solid ${token("--line")};font-size:${token("--t-sm")};color:${token("--ink-2")}">${escapeHtml(item.label)}</td>` +
        `<td align="right" style="padding:7px 0;border-bottom:1px solid ${token("--line")};font-size:${token("--t-sm")};color:${token("--ink")}">${mono(item.value)}</td></tr>`
    )
    .join("");
  return row(
    `<dl style="margin:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table></dl>`
  );
}

function renderAction(labelText: string, href: string): string {
  const safe = safeHref(href);
  if (safe === null) {
    return row(`<p style="margin:0">${escapeHtml(labelText)}</p>`);
  }
  return row(
    `<a href="${escapeHtml(safe)}" style="display:inline-block;padding:11px 18px;border-radius:${token("--r-pill")};background:${token("--accent")};color:${token("--on-accent")};text-decoration:none;font-weight:700">${escapeHtml(labelText)}</a>`
  );
}

function renderNotice(text: string): string {
  return row(
    `<div style="padding:12px 14px;border-radius:${token("--r-field")};background:${token("--accent-bg")};border:1px solid ${token("--accent-line")};color:${token("--ink-2")}">${escapeHtml(text)}</div>`
  );
}

function renderPageBody(labelText: string, markdown: string): string {
  return row(
    `${label(labelText)}<pre style="margin:0;padding:14px;border-radius:${token("--r-field")};background:${token("--sunk")};border:1px solid ${token("--line")};font-family:${token("--font-mono")};font-size:${token("--t-sm")};line-height:1.5;white-space:pre-wrap;color:${token("--ink")}">${escapeHtml(markdown)}</pre>`
  );
}

/** The rows of a kept `list` or `verdicts` block, rendered through
 *  `copy()`. Shared with the plain-text renderer so the two bodies cannot
 *  carry different rows. `unmeasured` is unreachable — `omit.ts` dropped
 *  the block — and is refused rather than defaulted, for the same reason
 *  `formatStat` refuses it. */
export function rowsOf(
  block: Extract<MailBlock, { block: "list" | "verdicts" }>
): readonly RenderedRow[] {
  if (block.items.kind === "unmeasured") {
    throw new Error(
      "rowsOf: an unmeasured block reached the renderer — BUILD §12 omits its section instead."
    );
  }
  if (block.block === "list") {
    return block.items.value.map((item) => ({ left: copy(item.label, item.vars) }));
  }
  return block.items.value.map((item) => ({
    left: copy(item.subject, item.subjectVars),
    right: copy(item.verdict),
  }));
}

/** The rows of a kept `facts` block, rendered through `copy()`. Shared with
 *  the plain-text renderer for the same reason `rowsOf` is: two bodies that
 *  built their own rows could state different facts. */
export function factRowsOf(
  block: Extract<MailBlock, { block: "facts" }>
): readonly { label: string; value: string }[] {
  return block.items.map((item) => ({ label: copy(item.label), value: item.value }));
}

/** Renders the block list, minus the blocks `omit.ts` drops, as the rows
 *  of the frame's one table. Returns the same `omitted` indexes the text
 *  renderer returns — the one decision, read twice. */
export function renderBlocksHtml(blocks: readonly MailBlock[]): {
  html: string;
  omitted: readonly number[];
} {
  const omitted = omittedIndexes(blocks);
  const dropped = new Set(omitted);
  const parts: string[] = [];

  for (const [index, block] of blocks.entries()) {
    if (dropped.has(index)) continue;
    switch (block.block) {
      case "heading":
        parts.push(renderHeading(copy(block.text, block.vars)));
        break;
      case "paragraph":
        parts.push(renderParagraph(copy(block.text, block.vars)));
        break;
      case "stat":
        parts.push(
          renderStat(
            copy(block.label),
            formatStat(block.value, block.format),
            // The note travels with its value or not at all: this block
            // is only reached when the value was kept.
            block.note === undefined ? null : copy(block.note)
          )
        );
        break;
      case "list":
      case "verdicts": {
        if (isMeasuredEmpty(block)) {
          parts.push(renderRows(copy(block.label), [], copy(block.emptyLine)));
          break;
        }
        parts.push(renderRows(copy(block.label), rowsOf(block), null));
        break;
      }
      case "facts":
        parts.push(renderFacts(factRowsOf(block)));
        break;
      case "action":
        parts.push(renderAction(copy(block.label), block.href));
        break;
      case "notice":
        parts.push(renderNotice(copy(block.text, block.vars)));
        break;
      case "pageBody":
        parts.push(
          renderPageBody(
            generatedLabel({ pageTitle: block.pageTitle, written: block.written }).label,
            block.markdown
          )
        );
        break;
    }
  }

  return { html: parts.join(""), omitted };
}
