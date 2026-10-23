// SPEC §8, Retention (issue #569) — the `cancellation` mail. Every sentence is a
// key, owner-owed until the copy sheet (#568) lands; `sendEmail` refuses a
// mail still carrying `TODO(copy)`, so this sends nothing until then.
import type { CopyKey } from "@/lib/presentation/copy";
import type { RetentionMail } from "../../retention/mail";

const SUBJECT = "mail.cancellation.subject" satisfies CopyKey;
const LINE = "mail.cancellation.line" satisfies CopyKey;
const REFUNDED = "mail.cancellation.refunded" satisfies CopyKey;

/** The subscription is cancelled, with the day access ends — already
 *  written in the customer's zone — and, when this cancel was refunded,
 *  that the first payment came back. */
export function buildCancellation(a: { accessEndsOn: string; refunded: boolean }): RetentionMail {
  return {
    subject: SUBJECT,
    blocks: [
      { block: "heading", text: SUBJECT },
      { block: "paragraph", text: a.refunded ? REFUNDED : LINE, vars: { accessEndsOn: a.accessEndsOn } },
    ],
  };
}
