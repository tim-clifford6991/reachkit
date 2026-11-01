// SPEC §8, Retention — the `cancellation` mail. Every sentence is a key, and `sendEmail` refuses one still carrying `TODO(copy)`.
import type { CopyKey } from "@/lib/presentation/copy";
import type { RetentionMail } from "../../retention/mail";

const SUBJECT = "mail.cancellation.subject" satisfies CopyKey;
const LINE = "mail.cancellation.line" satisfies CopyKey;
const REFUNDED = "mail.cancellation.refunded" satisfies CopyKey;
const RESUME = "mail.cancellation.resume" satisfies CopyKey;
const PREHEADER = "mail.cancellation.preheader" satisfies CopyKey;

/** Cancelled, with the day access ends in the customer's zone and, when refunded, that the first payment came back. */
export function buildCancellation(a: { accessEndsOn: string; refunded: boolean }): RetentionMail {
  return {
    subject: SUBJECT,
    preheader: PREHEADER,
    blocks: [
      { block: "heading", text: SUBJECT },
      { block: "paragraph", text: a.refunded ? REFUNDED : LINE, vars: { accessEndsOn: a.accessEndsOn } },
      // Access runs on until the end date, so only that arm can still resume.
      ...(a.refunded ? [] : [{ block: "paragraph", text: RESUME } as const]),
    ],
  };
}
