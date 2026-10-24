// The theme's values a mail may use, resolved.
//
// Most inboxes resolve no `var()`, so this is the one place in `src/lib/mail/**` a resolved colour or font stack is written;
// `tests/mail/shell/shell-tokens.test.ts` holds each equal to `src/ui/theme.css`. Light only: a half-switched dark mail is worse.

/** The theme tokens and `.rk-fonts` stacks a mail may use; deliberately narrow. */
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
  // The type ladder (UI-SPEC §1), named so a drifted rung fails the token test.
  "--h2": "25px",
  "--h3": "20px",
  "--t-body": "15px",
  "--t-sm": "13px",
  "--t-xs": "12px",
  "--t-eyebrow": "11px",
  "--font-ui": '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
  "--font-mono": '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',

  // The stacks a mail renders in: inboxes load no webfont and many skip `system-ui`, falling back to serif, so these name
  // installed faces. The only values with no `theme.css` counterpart; the token test names them as the exception.
  "--font-ui-mail": "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  "--font-mono-mail": "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
} as const);

export type MailToken = keyof typeof MAIL_TOKENS;

/** The one reader of every colour and font stack in a mail. */
export function token(name: MailToken): string {
  return MAIL_TOKENS[name];
}
