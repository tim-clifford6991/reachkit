// BUILD §4.3 — asks a founder who paid to finish setup, as a block list only (ADR-040).
// The sign-in link to the setup screen is the whole mail (REQ-025 c6), so `href` is passed in and an unissued link sends nothing (`reminders.ts`).
// No opt-out (`stoppable: false`): an unsubscribe that reached it would strand a paying customer outside the product (ADR-042).
import type { CopyKey } from "@/lib/presentation/copy";
import type { MailBlock } from "../../blocks/types";

// Keys named once, so the string-literal sweep never reads a key field as a written sentence.
const SUBJECT = "mail.setupReminder.subject" satisfies CopyKey;
const BODY = "mail.setupReminder.body" satisfies CopyKey;
const ACTION = "mail.setupReminder.action" satisfies CopyKey;
const REASON = "mail.reason.setupReminder" satisfies CopyKey;

export interface SetupReminderMail {
  readonly subject: CopyKey;
  readonly blocks: readonly MailBlock[];
  /** SPEC §8's "why it arrived"; the shell renders none until it is written. */
  readonly reason: CopyKey;
}

export function buildSetupReminder(a: { signInHref: string }): SetupReminderMail {
  return {
    subject: SUBJECT,
    reason: REASON,
    blocks: [
      // Opens on its subject line, as the other sequence mails do.
      { block: "heading", text: SUBJECT },
      { block: "paragraph", text: BODY },
      { block: "action", label: ACTION, href: a.signInHref },
    ],
  };
}
