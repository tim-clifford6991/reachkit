// SPEC §8, Retention (issue #569) — the `win-back` mail. Every sentence is a
// key, owner-owed until the copy sheet (#568) lands; `sendEmail` refuses a
// mail still carrying `TODO(copy)`, so this sends nothing until then.
import type { CopyKey } from "@/lib/presentation/copy";
import { appHref, type RetentionMail } from "../../retention/mail";
import { optOutControlFor } from "../first-page";

const SUBJECT = "mail.winback.subject" satisfies CopyKey;
const LINE = "mail.winback.line" satisfies CopyKey;
const ACTION = "mail.winback.action" satisfies CopyKey;
const REASON = "mail.reason.winback" satisfies CopyKey;

/** Once, 30 days after access ended: the way to Resume, in Settings. */
export function buildWinback(a: { email: string }): RetentionMail {
  return {
    subject: SUBJECT,
    blocks: [
      { block: "heading", text: SUBJECT },
      { block: "paragraph", text: LINE },
      { block: "action", label: ACTION, href: appHref("/app/settings") },
    ],
    reason: REASON,
    optOut: optOutControlFor(a.email),
  };
}
