// BUILD §4.3 — asks a founder who paid to finish setup, as a block list only (ADR-040).
// The sign-in link to the setup screen is the whole mail (REQ-025 c6), so `href` is passed in and an unissued link sends nothing (`reminders.ts`).
// No opt-out (`stoppable: false`): an unsubscribe that reached it would strand a paying customer outside the product (ADR-042).
import { SETUP_MINUTES } from "@/lib/config/constants";
import type { CopyKey } from "@/lib/presentation/copy";
import type { MailBlock } from "../../blocks/types";

// Keys named once, so the string-literal sweep never reads a key field as a written sentence.
const SUBJECT = "mail.setupReminder.subject" satisfies CopyKey;
const BODY = "mail.setupReminder.body" satisfies CopyKey;
const PREHEADER = "mail.setupReminder.preheader" satisfies CopyKey;
const ACTION = "mail.setupReminder.action" satisfies CopyKey;
const REASON = "mail.reason.setupReminder" satisfies CopyKey;
const WRITTEN = "mail.setupReminder.written" satisfies CopyKey;
const CONNECT_AT = "mail.setupReminder.connect" satisfies CopyKey;
const CONNECT = "mail.setupReminder.connectAny" satisfies CopyKey;
const CONNECT_ACTION = "setup.connect.title" satisfies CopyKey;

export interface SetupReminderMail {
  readonly subject: CopyKey;
  readonly preheader: CopyKey;
  readonly blocks: readonly MailBlock[];
  /** SPEC §8's "why it arrived"; the shell renders none until it is written. */
  readonly reason: CopyKey;
}

/** A stamped site that is not live is asked for the one missing step, Connect, by its DNS provider where that is known. */
export interface ConnectPending {
  readonly written: boolean;
  readonly provider: string | null;
}

function connectBlocks(c: ConnectPending): MailBlock[] {
  const step: MailBlock =
    c.provider === null
      ? { block: "paragraph", text: CONNECT }
      : { block: "paragraph", text: CONNECT_AT, vars: { provider: c.provider } };
  return c.written ? [{ block: "paragraph", text: WRITTEN }, step] : [step];
}

export function buildSetupReminder(a: { signInHref: string; connect?: ConnectPending }): SetupReminderMail {
  return {
    subject: SUBJECT,
    // Setup is done on the connect arm, so its inbox line is the step left.
    preheader: a.connect === undefined ? PREHEADER : CONNECT,
    reason: REASON,
    blocks: [
      // Opens on its subject line, as the other sequence mails do.
      { block: "heading", text: SUBJECT },
      ...(a.connect === undefined
        ? [{ block: "paragraph", text: BODY, vars: { setupMinutes: String(SETUP_MINUTES) } } as const]
        : connectBlocks(a.connect)),
      { block: "action", label: a.connect === undefined ? ACTION : CONNECT_ACTION, href: a.signInHref },
    ],
  };
}
