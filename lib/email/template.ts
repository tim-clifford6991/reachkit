/**
 * Branded email template — the ONE design system every ReachKit email routes
 * through (intake 2026-07-26-email-system). Table-based + inline-styled + light
 * theme + ~600px + Outlook (MSO) safe, because email clients strip <style>,
 * external CSS, CSS vars, and (Gmail) SVG. The palette mirrors app/globals.css
 * `--c-*` as hardcoded hex (email can't read the CSS vars): violet accent
 * #6E56F7, ink #16141F, the score-band ramp. Logo is the hosted violet-tile PNG
 * (absolute URL — inline SVG doesn't render in Gmail).
 *
 * Compose an email from these block helpers (each returns an HTML string), then
 * wrap with `renderEmail({...})`. Every builder also returns a plain-text
 * alternative (see messages.ts) — never HTML-only.
 */

// Palette — mirrors app/globals.css --c-* (light), hardcoded for email clients.
export const EMAIL = {
  canvas: "#F5F4F9", // soft violet-tinted page bg (between --c-bg2 and --c-line)
  surface: "#FFFFFF", // --c-surface
  ink: "#16141F", // --c-ink (primary text)
  muted: "#57536A", // --c-muted
  faint: "#9A97A5", // --c-faint
  line: "#ECEAF3", // --c-line (hairline)
  fill: "#F4F2FA", // --c-fill (chip/track)
  accent: "#6E56F7", // --c-action (violet)
  accentSoft: "#F2EEFF", // --c-soft (violet tint)
  dark: "#322E4A", // --c-dark (score-card band)
  dark2: "#47416B", // --c-dark2 (gradient end)
} as const;

const LOGO_URL = "https://reachkit.app/reachkit-icon-512.png";
const APP_URL = "https://reachkit.app";
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Score-band hex (mirrors SCORE_BANDS oklch, converted for email). */
export function bandForEmail(score: number): { label: string; color: string } {
  const n = Math.round(score);
  if (n <= 29) return { label: "Invisible", color: "#E5484D" };
  if (n <= 49) return { label: "Hard to find", color: "#E0731C" };
  if (n <= 69) return { label: "Fair", color: "#C98A12" };
  if (n <= 84) return { label: "Findable", color: "#1F9D5B" };
  return { label: "Highly discoverable", color: "#17864A" };
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------------------------------------------------------------------------
// Block helpers — compose these into `blocks`
// ---------------------------------------------------------------------------

/** A paragraph of body copy. */
export function p(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${EMAIL.muted};">${html}</p>`;
}

/** A section heading inside the body. */
export function h(text: string): string {
  return `<h2 style="margin:26px 0 12px;font-family:${FONT};font-size:16px;font-weight:700;letter-spacing:-0.01em;color:${EMAIL.ink};">${esc(text)}</h2>`;
}

/** The primary violet CTA button. */
export function button(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;"><tr><td style="border-radius:10px;background:${EMAIL.accent};">
    <a href="${esc(url)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;">${esc(label)}</a>
  </td></tr></table>`;
}

/** The hero score card — big number, band color, driver line. */
export function scoreCard(args: { score: number; deltaText?: string; subline?: string }): string {
  const band = bandForEmail(args.score);
  const delta = args.deltaText
    ? `<div style="margin-top:6px;font-family:${FONT};font-size:14px;font-weight:600;color:#C3B2FF;">${esc(args.deltaText)}</div>`
    : "";
  const sub = args.subline
    ? `<div style="margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:#B8B3C9;">${esc(args.subline)}</div>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;border-radius:14px;background:${EMAIL.dark};background-image:linear-gradient(135deg,${EMAIL.dark},${EMAIL.dark2});"><tr><td style="padding:24px 26px;">
    <div style="font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#B8B3C9;">Discoverability score</div>
    <div style="margin-top:4px;">
      <span style="font-family:${FONT};font-size:44px;font-weight:800;line-height:1;color:#FFFFFF;">${Math.round(args.score)}</span>
      <span style="font-family:${FONT};font-size:18px;font-weight:600;color:#8E88A3;">/100</span>
      <span style="font-family:${FONT};font-size:14px;font-weight:700;color:${band.color};margin-left:10px;">${band.label}</span>
    </div>
    ${delta}${sub}
  </td></tr></table>`;
}

export interface StatRow {
  label: string;
  value: string;
  /** accent bar color; default violet. */
  color?: string;
}

/** A list of label→value rows with a left accent bar (changes / actions / alerts). */
export function rows(items: StatRow[]): string {
  if (items.length === 0) return "";
  const body = items
    .map(
      (r) => `<tr><td style="padding:11px 14px;border-left:3px solid ${r.color ?? EMAIL.accent};background:${EMAIL.fill};border-radius:0 8px 8px 0;">
        <span style="font-family:${FONT};font-size:14px;font-weight:600;color:${EMAIL.ink};">${esc(r.label)}</span>
        ${r.value ? `<span style="font-family:${FONT};font-size:14px;color:${EMAIL.muted};"> — ${esc(r.value)}</span>` : ""}
      </td></tr><tr><td style="height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 12px;">${body}</table>`;
}

/** A soft violet callout box for a single highlighted item. */
export function callout(title: string, body: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;border-radius:12px;background:${EMAIL.accentSoft};"><tr><td style="padding:16px 18px;">
    <div style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:${EMAIL.accent};">${esc(title)}</div>
    <div style="margin-top:5px;font-family:${FONT};font-size:15px;line-height:1.55;color:${EMAIL.ink};">${body}</div>
  </td></tr></table>`;
}

/** A thin divider. */
export function divider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid ${EMAIL.line};font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table>`;
}

// ---------------------------------------------------------------------------
// The shell
// ---------------------------------------------------------------------------

export function renderEmail(args: {
  /** Hidden inbox-preview text. */
  preheader: string;
  /** The big H1 at the top of the card. */
  heading: string;
  /** Pre-built block HTML (compose with the helpers above). */
  blocks: string[];
  /** Optional small print under the divider in the footer (e.g. why you got this). */
  footerNote?: string;
}): string {
  const year = 2026;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<title>${esc(args.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL.canvas};">
<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all;">${esc(args.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${EMAIL.canvas};"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
    <!-- header -->
    <tr><td style="padding:2px 4px 18px;">
      <a href="${APP_URL}" style="text-decoration:none;">
        <img src="${LOGO_URL}" width="34" height="34" alt="ReachKit" style="vertical-align:middle;border-radius:9px;display:inline-block;">
        <span style="font-family:${FONT};font-size:18px;font-weight:700;letter-spacing:-0.01em;color:${EMAIL.ink};vertical-align:middle;margin-left:9px;">ReachKit</span>
      </a>
    </td></tr>
    <!-- card -->
    <tr><td style="background:${EMAIL.surface};border:1px solid ${EMAIL.line};border-radius:16px;padding:30px 30px 26px;">
      <h1 style="margin:0 0 16px;font-family:${FONT};font-size:23px;font-weight:800;line-height:1.25;letter-spacing:-0.02em;color:${EMAIL.ink};">${esc(args.heading)}</h1>
      ${args.blocks.join("\n")}
    </td></tr>
    <!-- footer -->
    <tr><td style="padding:22px 8px 8px;">
      ${args.footerNote ? `<p style="margin:0 0 12px;font-family:${FONT};font-size:12px;line-height:1.5;color:${EMAIL.faint};">${args.footerNote}</p>` : ""}
      <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${EMAIL.faint};">
        <a href="${APP_URL}/app/settings" style="color:${EMAIL.muted};text-decoration:underline;">Manage preferences</a>
        &nbsp;·&nbsp;
        <a href="${APP_URL}" style="color:${EMAIL.muted};text-decoration:underline;">ReachKit</a>
        <br>Discoverability, measured. © ${year} ReachKit.
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

/** Shared plain-text footer so every text alternative ends consistently. */
export const TEXT_FOOTER = "\n\n—\nReachKit · Discoverability, measured.\nManage preferences: https://reachkit.app/app/settings";
