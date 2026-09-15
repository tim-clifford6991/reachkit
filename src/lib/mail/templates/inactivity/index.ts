// SPEC §8, Retention (issue #569) — the `inactivity` mail. Every sentence is a
// key, owner-owed until the copy sheet (#568) lands; `sendEmail` refuses a
// mail still carrying `TODO(copy)`, so this sends nothing until then.
import type { CopyKey } from "@/lib/presentation/copy";
import { appHref, type RetentionMail } from "../../retention/mail";
import { optOutControlFor } from "../first-page";

const SUBJECT = "mail.inactivity.subject" satisfies CopyKey;
const LINE = "mail.inactivity.line" satisfies CopyKey;
const ACTION = "mail.inactivity.action" satisfies CopyKey;
const REASON = "mail.reason.inactivity" satisfies CopyKey;

/** Idle 7 days while pages publish: the way back to the Overview. */
export function buildInactivity(a: { email: string }): RetentionMail {
  return {
    subject: SUBJECT,
    blocks: [
      { block: "heading", text: SUBJECT },
      { block: "paragraph", text: LINE },
      { block: "action", label: ACTION, href: appHref("/app") },
    ],
    reason: REASON,
    optOut: optOutControlFor(a.email),
  };
}
