// BUILD §13 — the sign-in link a completed payment sends.
//
// One directory per mail kind, named for the kind (ADR-040): a block list
// and nothing else. No shell, no formatter, no vendor knowledge, no
// conditional and no sentence of its own.
//
// **No opt-out control, and that is not an oversight.** On magic-link auth
// this mail *is* the credential. ADR-042 exists because an address-wide
// unsubscribe that reached `magic-link` would lock a paying customer out of
// the product with no recovery channel — the register row says
// `stoppable: false`, the send seam therefore asks no store, and this
// template carries no way to stop the one mail that is the way back in.
//
// The link arrives already built. This template does not know how a token
// is made, how long it lives or where it is redeemed — that is issue #35's
// — and it cannot compose itself without one, which is why `href` is a
// required field rather than an optional that could quietly render an
// action pointing nowhere.
import type { CopyKey } from "@/lib/presentation/copy";
import type { MailBlock } from "../../blocks/types";

const SUBJECT = "mail.magicLink.subject" satisfies CopyKey;
const BODY = "mail.magicLink.body" satisfies CopyKey;
const ACTION = "mail.magicLink.action" satisfies CopyKey;

export interface AccountMail {
  readonly subject: CopyKey;
  readonly blocks: readonly MailBlock[];
}

export function buildMagicLink(a: { href: string }): AccountMail {
  return {
    subject: SUBJECT,
    blocks: [
      { block: "paragraph", text: BODY },
      { block: "action", label: ACTION, href: a.href },
    ],
  };
}
