// The theme's values a mail may use, resolved.
//
// A mail client is not a browser: `var(--color-primary)` resolves to nothing
// in most inboxes, so a mail carries the resolved value inline. This is the
// one place in `src/lib/mail/**` a colour or a font stack is written down;
// the renderers name tokens and never values. The names are the theme's own
// (`src/ui/theme.css`), and `tests/mail/shell/shell-tokens.test.ts` holds
// every value here equal to the one declared there, so the two cannot drift.
//
// Light values only: inbox support for `prefers-color-scheme` is partial, and
// a mail that half-switched would be worse than one that did not.

/** The `:root` tokens of `src/ui/theme.css` this seam uses, and the two
 *  font stacks `.rk-fonts` binds in `src/ui/type.css`. A name absent from
 *  this map is not available to a mail — deliberately narrow. */
export const MAIL_TOKENS = Object.freeze({
  "--bg": "#f3f4fb",
  "--color-base-100": "#ffffff",
  "--color-base-200": "#eef0f8",
  "--color-base-300": "#e8e9f3",
  "--color-base-content": "#1e2233",
  "--ink-2": "#646579",
  "--ink-3": "#6a6b80",
  "--color-primary": "#5b4be0",
  "--color-primary-content": "#ffffff",
  "--accent-bg": "#eeecfd",
  "--accent-line": "#ddd8fa",
  "--r-box": "14px",
  "--r-field": "9px",
  "--r-pill": "999px",
  // Ruling 10a's ladder (UI-SPEC §1, issue #376). A mail spent these as
  // bare pixel counts until the approved set fixed the rungs; naming them
  // here is what lets `document.tsx` and `blocks/nodes.tsx` spend a size the way
  // they already spend a colour, and what makes a drifted rung fail below.
  "--h2": "25px",
  "--h3": "20px",
  "--t-body": "15px",
  "--t-sm": "13px",
  "--t-xs": "12px",
  "--t-eyebrow": "11px",
  "--font-ui": '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
  "--font-mono": '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',

  // ── The two stacks a mail actually renders in ──────────────────────
  //
  // The two above are the product's, and a mail cannot have them: an inbox
  // loads no webfont, and `ui-sans-serif` / `system-ui` — the generics the
  // screens fall back through — are understood by almost no mail client.
  // Outlook and several webmail readers skip the whole declaration and
  // render the default, which is a **serif**: every numeral in the mail
  // then loses ruling 7a (mono numerals) and the card stops looking like
  // the product at all. Found on the owner's own render, 2026-09-09.
  //
  // So a mail names these instead — faces that are *installed*, in the
  // order a reader is likeliest to have one. They are the only two values
  // in this file with no counterpart in `theme.css`, and
  // `tests/mail/shell/shell-tokens.test.ts` names them as the exception
  // with this reason rather than widening its rule.
  "--font-ui-mail": "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  "--font-mono-mail": "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
} as const);

export type MailToken = keyof typeof MAIL_TOKENS;

/** The one reader. Every colour and font stack in a rendered mail comes
 *  through here, named. */
export function token(name: MailToken): string {
  return MAIL_TOKENS[name];
}
