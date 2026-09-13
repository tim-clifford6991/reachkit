// BUILD §12 · §2.1 · §2.3 — the HTML rendering of the ten blocks.
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
import type { Measured } from "@/lib/measure/measured";
import { copy } from "@/lib/presentation/copy";
import { generatedLabel } from "@/lib/presentation/generated";
import { token, type MailToken } from "../shell/tokens";
import { formatStat } from "./format";
import { omittedIndexes, isMeasuredEmpty } from "./omit";
import type { CopyVars, MailBlock, NoticeTone } from "./types";

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
  return `<span style="font-family:${token("--font-mono-mail")};font-variant-numeric:tabular-nums">${escapeHtml(text)}</span>`;
}

function row(inner: string): string {
  return `<tr><td style="padding:0 0 16px 0;font-family:${token("--font-ui-mail")};font-size:${token("--t-body")};line-height:1.55;color:${token("--ink")}">${inner}</td></tr>`;
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
        `<tr><td style="padding:7px 0;border-bottom:1px solid ${token("--line")};font-family:${token("--font-mono-mail")};font-size:${token("--t-sm")};color:${token("--ink-2")}">${escapeHtml(item.label)}</td>` +
        `<td align="right" style="padding:7px 0;border-bottom:1px solid ${token("--line")};font-size:${token("--t-sm")};color:${token("--ink")}">${mono(item.value)}</td></tr>`
    )
    .join("");
  return row(
    `<dl style="margin:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table></dl>`
  );
}

/** The one written line over a heading, saying which mail this is. */
function renderEyebrow(text: string): string {
  return row(
    `<div style="font-size:${token("--t-eyebrow")};text-transform:uppercase;font-weight:700;letter-spacing:0.1em;color:${token("--ink-3")}">${escapeHtml(text)}</div>`
  );
}

/** A figure's direction, in the theme's meaning colours. A flat week is a
 *  result and takes the quiet pair rather than a colour claiming movement. */
function chipTones(value: number): readonly [MailToken, MailToken, MailToken] {
  if (value > 0) return ["--ok-bg", "--ok-line", "--ok"];
  if (value < 0) return ["--bad-bg", "--bad-line", "--bad"];
  return ["--sunk", "--line", "--ink-2"];
}

/** The chip a tile's movement rides in. The figure is written by the one
 *  numeral formatter — the sign carries the direction, so no arrow glyph is
 *  minted here. */
function chipHtml(delta: string, value: number): string {
  const [bg, line, ink] = chipTones(value);
  return (
    `<span style="display:inline-block;padding:2px 10px;border-radius:${token("--r-pill")};` +
    `background:${token(bg)};border:1px solid ${token(line)};color:${token(ink)};` +
    `font-size:${token("--t-xs")};font-weight:600">${mono(delta)}</span>`
  );
}

/** One rendered tile of a `statRow`. */
export interface TileLine {
  label: string;
  value: string;
  /** The movement chip, or `null` where this week has none to state. */
  delta: { text: string; value: number } | null;
}

/** The row of figures the canvas heads the digest with: equal cells, each a
 *  card of an eyebrow label, the figure in mono, and its movement beside
 *  it. */
function renderStatRow(tiles: readonly TileLine[]): string {
  const width = Math.floor(100 / Math.max(tiles.length, 1));
  const cells = tiles
    .map((tile, index) => {
      const gap = index === 0 ? "" : "padding-left:12px;";
      const chip = tile.delta === null ? "" : `<span style="padding-left:8px">${chipHtml(tile.delta.text, tile.delta.value)}</span>`;
      return (
        `<td width="${width}%" valign="top" style="${gap}width:${width}%">` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${token("--surface")};border:1px solid ${token("--line")};border-radius:${token("--r-field")}">` +
        `<tr><td style="padding:14px">${label(tile.label)}` +
        `<span style="font-size:${token("--h2")};font-weight:600;color:${token("--ink")}">${mono(tile.value)}</span>${chip}` +
        `</td></tr></table></td>`
      );
    })
    .join("");
  return row(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>`
  );
}

/** The judged pages, as the canvas draws them: one sunk panel, one mono
 *  line per page, its verdict word at the right of that line. The label is
 *  drawn only where the section is not already named above it. */
function renderVerdicts(
  labelText: string | null,
  rows: readonly RenderedRow[],
  emptyLine: string | null
): string {
  const head = labelText === null ? "" : label(labelText);
  if (emptyLine !== null) {
    return row(`${head}<p style="margin:0;color:${token("--ink-2")}">${escapeHtml(emptyLine)}</p>`);
  }
  const lines = rows
    .map((item) => {
      const right =
        item.right === undefined
          ? ""
          : `<td align="right" valign="top" style="padding:4px 0;font-size:${token("--t-sm")};color:${token("--ink-2")}">${escapeHtml(item.right)}</td>`;
      return (
        `<tr><td style="padding:4px 0;font-family:${token("--font-mono-mail")};font-size:${token("--t-sm")};line-height:1.5;color:${token("--ink")}">` +
        `${escapeHtml(item.left)}</td>${right}</tr>`
      );
    })
    .join("");
  return row(
    `${head}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${token("--sunk")};border-radius:${token("--r-field")}">` +
      `<tr><td style="padding:14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${lines}</table></td></tr></table>`
  );
}

function renderAction(labelText: string, href: string): string {
  const safe = safeHref(href);
  if (safe === null) {
    return row(`<p style="margin:0">${escapeHtml(labelText)}</p>`);
  }
  return row(
    `<a href="${escapeHtml(safe)}" style="display:inline-block;padding:11px 18px;border-radius:${token("--r-pill")};background:${token("--accent")};color:${token("--on-accent")};text-decoration:none;font-family:${token("--font-ui-mail")};font-size:${token("--t-body")};font-weight:700">${escapeHtml(labelText)}</a>`
  );
}

const NOTICE_TONES: Readonly<Record<NoticeTone, readonly [MailToken, MailToken]>> = Object.freeze({
  accent: ["--accent-bg", "--accent-line"],
  warn: ["--warn-bg", "--warn-line"],
});

function renderNotice(
  text: string,
  tone: NoticeTone,
  link: { href: string; label: string } | null
): string {
  const [bg, line] = NOTICE_TONES[tone];
  const linkHtml =
    link === null
      ? ""
      : `<p style="margin:0;padding-top:4px"><a href="${escapeHtml(link.href)}" style="color:${token("--accent")};font-size:${token("--t-sm")}">${escapeHtml(link.label)}</a></p>`;
  return row(
    `<div style="padding:12px 14px;border-radius:${token("--r-box")};background:${token(bg)};border:1px solid ${token(line)};color:${token("--ink-2")}">${escapeHtml(text)}${linkHtml}</div>`
  );
}

function renderPageBody(labelText: string, markdown: string): string {
  return row(
    `${label(labelText)}<pre style="margin:0;padding:14px;border-radius:${token("--r-field")};background:${token("--sunk")};border:1px solid ${token("--line")};font-family:${token("--font-mono-mail")};font-size:${token("--t-sm")};line-height:1.5;white-space:pre-wrap;color:${token("--ink")}">${escapeHtml(markdown)}</pre>`
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

/** The kept tiles of a `statRow`, rendered through `copy()` and the one
 *  numeral formatter. Shared with the plain-text renderer so the two bodies
 *  cannot state different figures. A tile whose own value was not measured
 *  is dropped here — §12's rule, one tile at a time. */
export function tilesOf(block: Extract<MailBlock, { block: "statRow" }>): readonly TileLine[] {
  const out: TileLine[] = [];
  for (const tile of block.tiles) {
    if (tile.value.kind === "unmeasured") continue;
    const delta = tile.delta;
    out.push({
      label: copy(tile.label),
      value: formatStat(tile.value, tile.format),
      delta:
        delta === undefined || delta.kind === "unmeasured"
          ? null
          : { text: formatStat(delta, "delta"), value: delta.value },
    });
  }
  return out;
}

/** A notice's sentence slots, with its count written in where it states
 *  one. The count reaches the sentence through its own slot, already
 *  formatted, so this arm mints no second numeral formatter either. */
export function noticeVarsOf(block: Extract<MailBlock, { block: "notice" }>): CopyVars | undefined {
  const count: Measured<number> | undefined = block.count;
  if (count === undefined) return block.vars;
  return { ...block.vars, count: formatStat(count, "integer") };
}

/** A notice's link, where it carries one an inbox should follow. */
export function noticeLinkOf(
  block: Extract<MailBlock, { block: "notice" }>
): { href: string; label: string } | null {
  const href = block.href;
  const linkLabel = block.linkLabel;
  if (href === undefined || linkLabel === undefined) return null;
  const safe = safeHref(href);
  return safe === null ? null : { href: safe, label: copy(linkLabel) };
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
      case "list": {
        if (isMeasuredEmpty(block)) {
          parts.push(renderRows(copy(block.label), [], copy(block.emptyLine)));
          break;
        }
        parts.push(renderRows(copy(block.label), rowsOf(block), null));
        break;
      }
      case "verdicts": {
        const head = block.label === undefined ? null : copy(block.label);
        parts.push(
          isMeasuredEmpty(block)
            ? renderVerdicts(head, [], copy(block.emptyLine))
            : renderVerdicts(head, rowsOf(block), null)
        );
        break;
      }
      case "eyebrow":
        parts.push(renderEyebrow(copy(block.text)));
        break;
      case "statRow":
        parts.push(renderStatRow(tilesOf(block)));
        break;
      case "facts":
        parts.push(renderFacts(factRowsOf(block)));
        break;
      case "action":
        parts.push(renderAction(copy(block.label), block.href));
        break;
      case "notice":
        parts.push(
          renderNotice(
            copy(block.text, noticeVarsOf(block)),
            block.tone ?? "accent",
            noticeLinkOf(block)
          )
        );
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
