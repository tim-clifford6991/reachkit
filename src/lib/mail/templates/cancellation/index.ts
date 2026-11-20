// SPEC §8, Retention — the `cancellation` mail. Every sentence is a key, and `sendEmail` refuses an empty subject or body.
import type { CopyKey } from "@/lib/presentation/copy";
import type { RetentionMail } from "../../retention/mail";

const SUBJECT = "mail.cancellation.subject" satisfies CopyKey;
const HEADING = "mail.cancellation.heading" satisfies CopyKey;
const LINE = "mail.cancellation.line" satisfies CopyKey;
const RESUME = "mail.cancellation.resume" satisfies CopyKey;
const PREHEADER = "mail.cancellation.preheader" satisfies CopyKey;

/** Cancelled, with the day access ends in the customer's zone. */
export function buildCancellation(a: { accessEndsOn: string }): RetentionMail {
  return {
    subject: SUBJECT,
    preheader: PREHEADER,
    blocks: [
      { block: "heading", text: HEADING },
      { block: "paragraph", text: LINE, vars: { accessEndsOn: a.accessEndsOn } },
      { block: "paragraph", text: RESUME },
    ],
  };
}
