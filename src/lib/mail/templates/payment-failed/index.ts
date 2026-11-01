// SPEC §8, Retention — the `payment-failed` mail. Every sentence is a key, and `sendEmail` refuses one still carrying `TODO(copy)`.
import { PRICE_EUR_CENTS } from "@/lib/config/constants";
import type { CopyKey } from "@/lib/presentation/copy";
import { appHref, type RetentionMail } from "../../retention/mail";

const SUBJECT = "mail.paymentFailed.subject" satisfies CopyKey;
const LINE = "mail.paymentFailed.line" satisfies CopyKey;
const PREHEADER = "mail.paymentFailed.preheader" satisfies CopyKey;
const ACTION = "mail.paymentFailed.action" satisfies CopyKey;

/** The renewal failed: the way to the billing tab, which needs no other settings read. */
export function buildPaymentFailed(): RetentionMail {
  return {
    subject: SUBJECT,
    preheader: PREHEADER,
    blocks: [
      { block: "heading", text: SUBJECT },
      { block: "paragraph", text: LINE, vars: { price: `€${PRICE_EUR_CENTS / 100}` } },
      { block: "action", label: ACTION, href: appHref("/app/settings/billing") },
    ],
  };
}
