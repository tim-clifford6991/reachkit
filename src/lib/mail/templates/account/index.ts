// BUILD §13 — the `account` mails REQ-024 obliges: the 15-minute chase and
// the second-purchase notice.
//
// One directory per mail kind (ADR-040). `account` is `stoppable: false`:
// both mails below tell a founder something about money that has left their
// bank, and neither is a mail anybody may unsubscribe from.
//
// **Every one of these names a way to reach a person.** REQ-024 criteria 3
// and 5 both require it, so `REACH_A_PERSON` is appended by the builders
// here rather than remembered at two call sites — a mail that dropped it
// would be structurally impossible to produce from this file.
//
// **The chase never asks for payment again.** There is no action block
// carrying a checkout URL in this file, no price key, and nothing importing
// `src/lib/account/checkout/**` from it. The two chase arms are two block
// lists, not one list with a conditional: "here is your way in" and "we are
// still opening your account" are different statements, and a template that
// chose between them with an `if` would be one edit away from saying the
// first while carrying no link.
import type { CopyKey } from "@/lib/presentation/copy";
import type { AccountMail } from "../magic-link";

const CHASE_SUBJECT = "mail.account.chase.subject" satisfies CopyKey;
const CHASE_LINK_READY = "mail.account.chase.link_ready" satisfies CopyKey;
const CHASE_NOT_OPEN_YET = "mail.account.chase.not_open_yet" satisfies CopyKey;
const CHASE_ACTION = "mail.magicLink.action" satisfies CopyKey;
const SECOND_PURCHASE_SUBJECT = "mail.account.second_purchase.subject" satisfies CopyKey;
const ADDRESS_MOVED_SUBJECT = "mail.account.address_moved.subject" satisfies CopyKey;
const ADDRESS_MOVED = "mail.account.address_moved" satisfies CopyKey;
const NO_SECOND_SUBSCRIPTION = "mail.account.no_second_subscription" satisfies CopyKey;
const REACH_A_PERSON = "mail.account.reach_a_person" satisfies CopyKey;

/** The chase where the account is open and a link exists: the payment
 *  succeeded, here is the way in, here is a person. */
export function buildChaseWithLink(a: { href: string }): AccountMail {
  return {
    subject: CHASE_SUBJECT,
    blocks: [
      { block: "paragraph", text: CHASE_LINK_READY },
      { block: "action", label: CHASE_ACTION, href: a.href },
      { block: "notice", text: REACH_A_PERSON },
    ],
  };
}

/** The chase where the account is not open yet: the payment succeeded, it
 *  is not open, here is a person. It carries no action at all — an action
 *  here could only point somewhere that does not work. */
export function buildChaseWithoutLink(): AccountMail {
  return {
    subject: CHASE_SUBJECT,
    blocks: [
      { block: "paragraph", text: CHASE_NOT_OPEN_YET },
      { block: "notice", text: REACH_A_PERSON },
    ],
  };
}

/** REQ-024 criterion 3: a founder whose second purchase was charged is told
 *  that it bought no second subscription, and named one way to reach a
 *  person — the person who will refund it. */
export function buildSecondPurchase(): AccountMail {
  return {
    subject: SECOND_PURCHASE_SUBJECT,
    blocks: [
      { block: "paragraph", text: NO_SECOND_SUBSCRIPTION },
      { block: "notice", text: REACH_A_PERSON },
    ],
  };
}

/** REQ-077 criterion 3 (issue #35): "one `account` mail (REQ-064) goes to
 *  the old address saying the account now signs in at a different address
 *  and this one no longer can."
 *
 *  **It names neither address.** The mail arrives at the old one, so
 *  printing it says nothing; printing the new one would put the account's
 *  live credential-bearing address into a mailbox the customer has just
 *  told us they are leaving — which is exactly the mailbox somebody else
 *  may be reading. The line says what happened, and that is all REQ-077
 *  asks it to say.
 *
 *  **It carries no action.** There is nothing for the reader of the old
 *  address to do: the change is already made, and a control here could only
 *  offer to undo something this mail's reader may not be the person who
 *  did. It keeps the notice naming a way to reach a person, which is the
 *  invariant this file's header states and the only route back for someone
 *  who did not expect this mail. */
export function buildAddressMoved(): AccountMail {
  return {
    subject: ADDRESS_MOVED_SUBJECT,
    blocks: [
      { block: "paragraph", text: ADDRESS_MOVED },
      { block: "notice", text: REACH_A_PERSON },
    ],
  };
}
