// BUILD §12 · §2.1 — the one branded shell, HTML half.
//
// Header, body slot, the whole-mail line slot, footer, and the opt-out
// slot rendered when one is supplied. There is one frame and every mail
// wears it; a template supplies blocks and nothing else, so no kind can
// grow a frame of its own.
//
// Every colour, radius and font stack is named through `tokens.ts` — no
// hex literal and no font stack is written in this file
// (`tests/mail/shell/shell-tokens.test.ts` reads the source and holds it
// to that). Every sentence arrives already rendered from `compose.ts`;
// this file contains no `copy()` call and authors no string.
import { escapeHtml } from "../blocks/html";
import { token } from "./tokens";

export interface FrameParts {
  /** The product's name, rendered from its copy key by `compose.ts`. */
  wordmark: string;
  /** The block rows, already rendered as `<tr>`s by `renderBlocksHtml`. */
  rows: string;
  /** The one line a mail carries when its conditional sections said
   *  nothing — or when the week behind it could not be measured. `null`
   *  on a mail that has something to say. */
  wholeMailLine: string | null;
  /**
   * UI-SPEC S20's footer, in the order the set draws it: the reason this
   * mail was sent, the way to stop it where it can be stopped, then the
   * imprint band — wordmark · imprint · the note that a plain-text twin
   * travels with it.
   *
   * `reason` is `null` only on the three kinds the approved set does not
   * draw, whose line the owner has not written
   * (`tests/mail/shell/footer.test.ts` names them); `imprint` is `null`
   * until the owner writes the imprint itself, which the set brackets.
   */
  reason: string | null;
  imprint: string | null;
  plainTextNote: string;
  /** Rendered when the caller supplies a stop control. Its label is
   *  chosen by the mechanism, in `compose.ts`, never by a template. */
  optOut: { href: string; label: string } | null;
}

function optOutHtml(optOut: FrameParts["optOut"]): string {
  if (optOut === null) return "";
  return `<p style="margin:0;padding-top:8px"><a href="${escapeHtml(optOut.href)}" style="color:${token("--ink-3")};text-decoration:underline">${escapeHtml(optOut.label)}</a></p>`;
}

/** The middle dot the imprint band's parts are set between. Layout, not
 *  voice — the set draws the three as one line, and a joiner is a
 *  separator rather than a sentence this file authored. */
const BAND_SEPARATOR = " · ";

function footerHtml(parts: FrameParts): string {
  const reason =
    parts.reason === null ? "" : `<p style="margin:0">${escapeHtml(parts.reason)}</p>`;
  const band = [parts.wordmark, parts.imprint, parts.plainTextNote]
    .filter((piece): piece is string => piece !== null && piece !== "")
    .join(BAND_SEPARATOR);
  return [
    reason,
    optOutHtml(parts.optOut),
    `<p style="margin:0;padding-top:8px">${escapeHtml(band)}</p>`,
  ].join("");
}

function wholeMailLineHtml(line: string | null): string {
  if (line === null) return "";
  return `<tr><td style="padding:0 0 16px 0;font-family:${token("--font-ui-mail")};font-size:15px;line-height:1.55;color:${token("--ink-2")}">${escapeHtml(line)}</td></tr>`;
}

/**
 * The card's own head: the brand mark and the wordmark, over a hairline.
 *
 * **Inside the card, not above it** — S20 draws it that way, and the owner's
 * render caught this sitting outside on the page ground (2026-09-09). The
 * mark is a filled square in the accent, drawn as a table cell rather than
 * an image: an inbox blocks remote images by default, and a brand that
 * depends on one is a brand most readers never see.
 */
function brandHeadHtml(wordmark: string): string {
  const mark = `<td width="18" style="width:18px;padding:0 8px 0 0"><div style="width:14px;height:14px;border-radius:4px;background:${token("--accent")}"></div></td>`;
  return [
    `<tr><td style="padding:0 0 14px 0;border-bottom:1px solid ${token("--line")}">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>`,
    mark,
    `<td style="font-family:${token("--font-ui-mail")};font-size:${token("--t-body")};font-weight:700;letter-spacing:-0.02em;color:${token("--ink")}">${escapeHtml(wordmark)}</td>`,
    `</tr></table></td></tr>`,
    `<tr><td style="height:18px;line-height:18px;font-size:0">&nbsp;</td></tr>`,
  ].join("");
}

/** The frame. One 600px column on the page background, one card on the
 *  surface colour with the brand in its head, and the footer below — the
 *  same bands `text-frame.ts` writes, in the same order. */
export function frameHtml(parts: FrameParts): string {
  return [
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>`,
    `<body style="margin:0;padding:0;background:${token("--bg")}">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${token("--bg")};padding:24px 12px">`,
    `<tr><td align="center">`,
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%">`,
    `<tr><td style="background:${token("--surface")};border:1px solid ${token("--line")};border-radius:${token("--r-box")};padding:22px">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">`,
    brandHeadHtml(parts.wordmark),
    parts.rows,
    wholeMailLineHtml(parts.wholeMailLine),
    `</table>`,
    `</td></tr>`,
    // The whole footer is mono, as S20 draws it — the reason line included,
    // not only the imprint band.
    `<tr><td style="padding:14px 0 0 0;font-family:${token("--font-mono-mail")};font-size:${token("--t-xs")};line-height:1.5;color:${token("--ink-3")}">`,
    footerHtml(parts),
    `</td></tr>`,
    `</table></td></tr></table></body></html>`,
  ].join("");
}
