// BUILD §12 · §2.1 · §2.3 — the design tokens a mail may use, resolved.
//
// A mail client is not a browser: `var(--accent)` resolves to nothing in
// most inboxes, so an email cannot reference BP-018's custom properties
// the way a screen does — it has to carry the resolved value inline. That
// is the one thing this file does. It is the single place in
// `src/lib/mail/**` where a colour or a font stack is written down;
// `frame.ts`, `text-frame.ts` and `blocks/html.ts` name tokens and never
// values, so no mail module can mint a colour.
//
// `tests/mail/shell/shell-tokens.test.ts` reads `src/ui/theme.css` and
// `src/ui/type.css` from disk and asserts every value below is the one
// those files declare, and that no other file under `src/lib/mail/**`
// contains a colour or font literal. A token edited here and not in
// `theme.css` fails; a hex written into a renderer fails.
//
// Light values only. Inbox support for `prefers-color-scheme` is partial
// and inconsistent, and BUILD §2.1's dark block is a screen rule; a mail
// that half-switched would be worse than one that did not. Reversal cost
// (rule 1.1): one `@media` block in `frame.ts` and a second table here.

/** The `:root` tokens of `src/ui/theme.css` this seam uses, and the two
 *  font stacks `.rk-fonts` binds in `src/ui/type.css`. A name absent from
 *  this map is not available to a mail — deliberately narrow. */
export const MAIL_TOKENS = Object.freeze({
  "--bg": "#f6f6f9",
  "--surface": "#ffffff",
  "--sunk": "#efeff4",
  "--line": "#eaeaf1",
  "--ink": "#191925",
  "--ink-2": "#5e5e73",
  "--ink-3": "#9695a8",
  "--accent": "#5b4be0",
  "--on-accent": "#ffffff",
  "--accent-bg": "#eeecfd",
  "--accent-line": "#ddd8fa",
  "--r-box": "14px",
  "--r-field": "9px",
  "--r-pill": "999px",
  // Ruling 10a's ladder (UI-SPEC §1, issue #376). A mail spent these as
  // bare pixel counts until the approved set fixed the rungs; naming them
  // here is what lets `frame.ts` and `blocks/html.ts` spend a size the way
  // they already spend a colour, and what makes a drifted rung fail below.
  "--h2": "25px",
  "--h3": "20px",
  "--t-body": "15px",
  "--t-sm": "13px",
  "--t-xs": "12px",
  "--t-eyebrow": "11px",
  "--font-ui": '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
  "--font-mono": '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const);

export type MailToken = keyof typeof MAIL_TOKENS;

/** The one reader. Every colour and font stack in a rendered mail comes
 *  through here, named. */
export function token(name: MailToken): string {
  return MAIL_TOKENS[name];
}
