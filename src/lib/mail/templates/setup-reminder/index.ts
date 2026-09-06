// BUILD §4.3 — the mail that asks a founder who paid to finish setup.
//
// One directory per mail kind, named for the kind (ADR-040), holding a
// block list and nothing else: no shell, no formatter, no vendor
// knowledge, no conditional, no sentence of its own.
//
// **The link is the whole mail.** REQ-025 c6's reminder has to carry "a
// working way back in" — a sign-in link that lands on the setup screen
// itself. So the action block's `href` is not decoration around a message;
// it is the thing being sent, which is why `buildSetupReminder` takes the
// href rather than composing one, and why a reminder whose link could not
// be issued is never sent at all (`reminders.ts`).
//
// `setup-reminder` is `stoppable: false` in the register: this is a mail
// to somebody who has paid, about the thing they paid for, and it carries
// no opt-out for the same reason the sign-in mail does not — an
// address-wide unsubscribe that reached it would strand a paying customer
// outside the product with no way back in (ADR-042).
import type { CopyKey } from "@/lib/presentation/copy";
import type { MailBlock } from "../../blocks/types";

// The keys this template speaks, named once each — the convention
// `templates/first-page/index.ts` establishes, so a key sitting in a field
// called `subject` or `text` is never mistaken by the string-literal sweep
// for a sentence written there.
const SUBJECT = "mail.setupReminder.subject" satisfies CopyKey;
const BODY = "mail.setupReminder.body" satisfies CopyKey;
const ACTION = "mail.setupReminder.action" satisfies CopyKey;

export interface SetupReminderMail {
  readonly subject: CopyKey;
  readonly blocks: readonly MailBlock[];
}

export function buildSetupReminder(a: { signInHref: string }): SetupReminderMail {
  return {
    subject: SUBJECT,
    blocks: [
      { block: "paragraph", text: BODY },
      { block: "action", label: ACTION, href: a.signInHref },
    ],
  };
}
