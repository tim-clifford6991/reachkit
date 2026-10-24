// BUILD §13 — the sign-in link a completed payment sends, as a block list only (ADR-040).
// No opt-out: this mail is the credential, and an unsubscribe that reached it would lock a paying customer out (ADR-042, `stoppable: false`).
// `href` arrives built and is required, so the action can never point nowhere.
import type { CopyKey } from "@/lib/presentation/copy";
import type { MailBlock } from "../../blocks/types";

const SUBJECT = "mail.magicLink.subject" satisfies CopyKey;
const HEADING = "mail.magicLink.heading" satisfies CopyKey;
const BODY = "mail.magicLink.body" satisfies CopyKey;
const ACTION = "mail.magicLink.action" satisfies CopyKey;
const FACT_FOR = "mail.magicLink.fact.for" satisfies CopyKey;
const REASON = "mail.reason.magicLink" satisfies CopyKey;

export interface AccountMail {
  readonly subject: CopyKey;
  readonly blocks: readonly MailBlock[];
  /** S20's footer line; absent only on the kinds `tests/mail/shell/footer.test.ts` names. */
  readonly reason?: CopyKey;
}

/** SPEC §8's sign-in mail: heading, line, the action straight after, then the address as a fact row,
 *  so someone sent it at an unfamiliar address sees that beside the button. */
export function buildMagicLink(a: { href: string; address: string }): AccountMail {
  return {
    subject: SUBJECT,
    reason: REASON,
    blocks: [
      { block: "heading", text: HEADING },
      { block: "paragraph", text: BODY },
      { block: "action", label: ACTION, href: a.href },
      { block: "facts", items: [{ label: FACT_FOR, value: a.address }] },
    ],
  };
}
