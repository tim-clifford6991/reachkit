// SPEC §8, Retention (issue #569) — the `payment-failed` mail. Every sentence is a
// key, owner-owed until the copy sheet (#568) lands; `sendEmail` refuses a
// mail still carrying `TODO(copy)`, so this sends nothing until then.
import type { CopyKey } from "@/lib/presentation/copy";
import { appHref, type RetentionMail } from "../../retention/mail";

const SUBJECT = "mail.paymentFailed.subject" satisfies CopyKey;
const LINE = "mail.paymentFailed.line" satisfies CopyKey;
const ACTION = "mail.paymentFailed.action" satisfies CopyKey;

/** The renewal failed: the way to the billing card in Settings. */
export function buildPaymentFailed(): RetentionMail {
  return {
    subject: SUBJECT,
    blocks: [
      { block: "heading", text: SUBJECT },
      { block: "paragraph", text: LINE },
      { block: "action", label: ACTION, href: appHref("/app/settings") },
    ],
  };
}
