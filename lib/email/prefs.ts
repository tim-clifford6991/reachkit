/**
 * Email preferences (intake 2026-07-26-email-system). Each user has an
 * `email_prefs` jsonb map { emailType: boolean }. An ABSENT key means the type's
 * DEFAULT applies — so an existing user (`{}`) gets sensible defaults with no
 * backfill. Transactional emails (login-link) are NOT gated — you always get the
 * link you need to access what you paid for.
 */

/** The gated (preference-controllable) email types. `login-link` is excluded —
 *  transactional, always sent. */
export type EmailType =
  | "welcome"
  | "scan-ready"
  | "weekly-digest"
  | "score-alert"
  | "daily-focus"
  | "subscription-canceled";

/** Per-type default when the user hasn't set a preference. Weekly digest + status
 *  updates default ON (the retention core); the DAILY nudge defaults OFF (opt-in —
 *  a daily email is easy to find spammy, so users choose it, they don't get
 *  surprised by it). subscription-canceled is transactional-ish (always useful),
 *  default ON. */
export const DEFAULT_ON: Record<EmailType, boolean> = {
  welcome: true,
  "scan-ready": true,
  "weekly-digest": true,
  "score-alert": true,
  "daily-focus": false,
  "subscription-canceled": true,
};

/** Human labels for the settings toggles. */
export const EMAIL_PREF_LABELS: Record<EmailType, { label: string; hint: string }> = {
  welcome: { label: "Welcome & onboarding", hint: "A one-time getting-started email" },
  "scan-ready": { label: "Report ready", hint: "When a deep scan finishes" },
  "weekly-digest": { label: "Weekly digest", hint: "Your score, what changed, this week's plan (Mondays)" },
  "score-alert": { label: "Score alerts", hint: "When your discoverability moves meaningfully" },
  "daily-focus": { label: "Daily focus", hint: "A nudge for the single action due today (off by default)" },
  "subscription-canceled": { label: "Billing notices", hint: "Cancellation & plan changes" },
};

type Prefs = Record<string, unknown> | null | undefined;

/** Should we send `type` to a user with these prefs? Absent key ⇒ the default. */
export function shouldSendEmail(prefs: Prefs, type: EmailType): boolean {
  const v = prefs && typeof prefs === "object" ? (prefs as Record<string, unknown>)[type] : undefined;
  if (typeof v === "boolean") return v;
  return DEFAULT_ON[type];
}
