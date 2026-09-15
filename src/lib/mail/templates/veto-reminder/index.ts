// SPEC §8, Retention (issue #569) — the `veto-reminder` mail. Every sentence is a
// key, owner-owed until the copy sheet (#568) lands; `sendEmail` refuses a
// mail still carrying `TODO(copy)`, so this sends nothing until then.
import type { CopyKey } from "@/lib/presentation/copy";
import { appHref, type RetentionMail } from "../../retention/mail";
import { optOutControlFor } from "../first-page";

const SUBJECT = "mail.vetoReminder.subject" satisfies CopyKey;
const LINE = "mail.vetoReminder.line" satisfies CopyKey;
const ACTION = "mail.vetoReminder.action" satisfies CopyKey;
const REASON = "mail.reason.vetoReminder" satisfies CopyKey;

/** A draft in review, unopened, with under six hours of its window left.
 *  `closesAt` arrives already written in the customer's zone. */
export function buildVetoReminder(a: {
  email: string;
  draftId: string;
  page: string;
  closesAt: string;
}): RetentionMail {
  return {
    subject: SUBJECT,
    blocks: [
      { block: "heading", text: SUBJECT },
      { block: "paragraph", text: LINE, vars: { page: a.page, closesAt: a.closesAt } },
      { block: "action", label: ACTION, href: appHref(`/app/draft/${encodeURIComponent(a.draftId)}`) },
    ],
    reason: REASON,
    optOut: optOutControlFor(a.email),
  };
}
