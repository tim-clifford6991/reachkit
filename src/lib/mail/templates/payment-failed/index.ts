// SPEC §8, Retention — the `payment-failed` mail. Every sentence is a key, and `sendEmail` refuses one still carrying `TODO(copy)`.
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
