// SPEC §8, Retention (issue #569) — the `cancellation` mail. Every sentence is a
// key, owner-owed until the copy sheet (#568) lands; `sendEmail` refuses a
// mail still carrying `TODO(copy)`, so this sends nothing until then.
import type { CopyKey } from "@/lib/presentation/copy";
import type { RetentionMail } from "../../retention/mail";

const SUBJECT = "mail.cancellation.subject" satisfies CopyKey;
const LINE = "mail.cancellation.line" satisfies CopyKey;

/** The subscription is cancelled, with the day access ends — already
 *  written in the customer's zone. */
export function buildCancellation(a: { accessEndsOn: string }): RetentionMail {
  return {
    subject: SUBJECT,
    blocks: [
      { block: "heading", text: SUBJECT },
      { block: "paragraph", text: LINE, vars: { accessEndsOn: a.accessEndsOn } },
    ],
  };
}
