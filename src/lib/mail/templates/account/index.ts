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
import { measured } from "@/lib/measure/measured";
import type { CopyKey } from "@/lib/presentation/copy";
import type { AccountMail } from "../magic-link";

/** Which of REQ-076 criterion 11's two notices this is. Two occasions, two
 *  subjects, one body: what changes between them is why the customer is
 *  hearing from us, not what they are being told. */
export type HostingEndOccasion = "access_ended" | "seven_days";

const CHASE_SUBJECT = "mail.account.chase.subject" satisfies CopyKey;
const CHASE_LINK_READY = "mail.account.chase.link_ready" satisfies CopyKey;
const CHASE_NOT_OPEN_YET = "mail.account.chase.not_open_yet" satisfies CopyKey;
const CHASE_ACTION = "mail.magicLink.action" satisfies CopyKey;
const SECOND_PURCHASE_SUBJECT = "mail.account.second_purchase.subject" satisfies CopyKey;
const ADDRESS_MOVED_SUBJECT = "mail.account.address_moved.subject" satisfies CopyKey;
const ADDRESS_MOVED = "mail.account.address_moved" satisfies CopyKey;
const NO_SECOND_SUBSCRIPTION = "mail.account.no_second_subscription" satisfies CopyKey;
const REACH_A_PERSON = "mail.account.reach_a_person" satisfies CopyKey;
const DELETED_SUBJECT = "mail.account.deleted.subject" satisfies CopyKey;
const DELETED_STILL_LIVE = "mail.account.deleted.still_live" satisfies CopyKey;
const DELETED_THEIRS_TO_KEEP = "mail.account.deleted.theirs_to_keep" satisfies CopyKey;

/** The four WordPress outcomes REQ-079 criterion 6 names, each with the two
 *  forms its sentence takes: one that names the place ReachKit's posts come
 *  up together in the customer's own site, one that says the posts are there
 *  and ReachKit cannot point to them — and it still carries its count.
 *
 *  `already_gone` has one form, not two, because that sentence names no
 *  place "because there is nothing there to find". A second form here would
 *  be a place for a place to be written. */
const WORDPRESS_LINES = Object.freeze({
  returned_to_draft: Object.freeze({
    withPlace: "mail.account.deleted.wordpress.returned_to_draft" satisfies CopyKey,
    withoutPlace: "mail.account.deleted.wordpress.returned_to_draft.no_place" satisfies CopyKey,
  }),
  named_for_removal: Object.freeze({
    withPlace: "mail.account.deleted.wordpress.named_for_removal" satisfies CopyKey,
    withoutPlace: "mail.account.deleted.wordpress.named_for_removal.no_place" satisfies CopyKey,
  }),
  already_gone: Object.freeze({
    withPlace: null,
    withoutPlace: "mail.account.deleted.wordpress.already_gone" satisfies CopyKey,
  }),
  unreachable: Object.freeze({
    withPlace: "mail.account.deleted.wordpress.unreachable" satisfies CopyKey,
    withoutPlace: "mail.account.deleted.wordpress.unreachable.no_place" satisfies CopyKey,
  }),
});

export type DeletedWordPressOutcome = keyof typeof WORDPRESS_LINES;

/** The order the four sentences stand in. Fixed here rather than taken from
 *  a map's iteration order, so the mail reads the same whichever arms a
 *  particular run produced. */
const WORDPRESS_ORDER: readonly DeletedWordPressOutcome[] = Object.freeze([
  "returned_to_draft",
  "named_for_removal",
  "already_gone",
  "unreachable",
] as const);

/** REQ-060 c6's list, as the values the sentence names it by. Composing the
 *  address is this template's job for the same reason an `action` block's
 *  `href` is: an address is structure, not voice, and the module that
 *  tallied the counts builds no URL text. */
export interface DeletedPlace {
  readonly siteBaseUrl: string;
  readonly stampSlug: string;
}

function placeAddress(place: DeletedPlace): string | null {
  try {
    return new URL(place.stampSlug, place.siteBaseUrl).toString();
  } catch {
    // A base that will not parse is no place to send anybody. The sentence
    // falls back to the form that names none and still carries its count.
    return null;
  }
}

export interface DeletedAccountMailInput {
  /** How many pages are still live at a destination that could not be
   *  reached. Absent — not zero — where there are none. */
  readonly stillLive?: number;
  /** One entry per outcome that holds posts. An outcome holding none is
   *  absent, never present with a count of none, so no sentence here can
   *  render a zero. */
  readonly leftInWordPress: Partial<
    Record<DeletedWordPressOutcome, { count: number; place: DeletedPlace | null }>
  >;
}

/**
 * REQ-079 criterion 6's mail.
 *
 * **One sentence per outcome, each with its own count.** No block below
 * carries two outcomes, and no count in it is the sum of two arms: the
 * caller hands one entry per arm and this builder writes one paragraph per
 * entry it was handed.
 *
 * **It lists no post, whatever the number**, and it names a place only
 * where the caller supplied one.
 *
 * Whether this mail is sent at all is criterion 6's last sentence and the
 * caller's: "Where nothing of either kind is left behind, no such mail is
 * sent." A builder that returned an empty mail would be one call away from
 * sending it.
 */
export function buildAccountDeleted(a: DeletedAccountMailInput): AccountMail {
  const blocks: AccountMail["blocks"][number][] = [];

  if (a.stillLive !== undefined) {
    blocks.push({ block: "paragraph", text: DELETED_STILL_LIVE, vars: { count: String(a.stillLive) } });
  }

  for (const outcome of WORDPRESS_ORDER) {
    const entry = a.leftInWordPress[outcome];
    if (entry === undefined) continue;
    const lines = WORDPRESS_LINES[outcome];
    const place =
      lines.withPlace === null || entry.place === null ? null : placeAddress(entry.place);
    blocks.push(
      place === null
        ? { block: "paragraph", text: lines.withoutPlace, vars: { count: String(entry.count) } }
        : {
            block: "paragraph",
            text: lines.withPlace as CopyKey,
            vars: { count: String(entry.count), place },
          }
    );
  }

  if (Object.keys(a.leftInWordPress).length > 0) {
    blocks.push({ block: "paragraph", text: DELETED_THEIRS_TO_KEEP });
  }

  return {
    subject: DELETED_SUBJECT,
    blocks: [...blocks, { block: "notice", text: REACH_A_PERSON }],
  };
}
const HOSTING_END_SUBJECT: Readonly<Record<HostingEndOccasion, CopyKey>> = Object.freeze({
  access_ended: "mail.account.hosting_end.access_ended.subject",
  seven_days: "mail.account.hosting_end.seven_days.subject",
});
const HOSTING_END_STOPS_ON = "mail.account.hosting_end.stops_on" satisfies CopyKey;
const HOSTING_END_EXPORT_STAYS = "mail.account.hosting_end.export_stays" satisfies CopyKey;
const BROKEN_SUBJECT = "mail.account.destinationBroken.subject" satisfies CopyKey;
const BROKEN_BODY = "mail.account.destinationBroken.body" satisfies CopyKey;
const BROKEN_HELD = "mail.account.destinationBroken.held" satisfies CopyKey;
const BROKEN_ACTION = "mail.account.destinationBroken.action" satisfies CopyKey;

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

/** REQ-076 criterion 11 — one of the two notices a customer with pages on
 *  the hosted CMS is owed before those pages stop being served: which day
 *  serving stops, and that their export stays open afterwards.
 *
 *  **Two statements, two blocks.** The criterion requires both — "they are
 *  told in writing which day it stops **and** that their pages remain
 *  exportable afterwards" — and a notice that carried the day inside a
 *  sentence about the export would be one edit away from dropping one of
 *  them with nothing failing.
 *
 *  `stopsOn` is the day, already written in the customer's own zone by the
 *  caller (REQ-073 c3). Nothing here formats a date: a template that could
 *  format one would be a second date formatter, and the two would disagree
 *  the day one of them was corrected.
 *
 *  It carries no action block. There is nothing for the customer to press:
 *  the day is not theirs to change, and the export lives on a surface they
 *  already have. `REACH_A_PERSON` is the way out, as in every `account`
 *  mail. */
export function buildHostingEnd(a: {
  occasion: HostingEndOccasion;
  stopsOn: string;
}): AccountMail {
  return {
    subject: HOSTING_END_SUBJECT[a.occasion],
    blocks: [
      { block: "paragraph", text: HOSTING_END_STOPS_ON, vars: { date: a.stopsOn } },
      { block: "paragraph", text: HOSTING_END_EXPORT_STAYS },
      { block: "notice", text: REACH_A_PERSON },
    ],
  };
}

/**
 * §9, one mail per breakage: a destination has needed reconnecting
 * for 24 hours and the customer has not signed in since it broke.
 *
 * Three things, in order: pages are being held, how many, and the way to
 * release them. The count is a `stat` block rather than a numeral inside
 * the sentence — §12's omission rule lives in the shell, and a template
 * that formatted its own number would be a second numeral formatter.
 *
 * `measured(held)` and not `measuredZero`: zero held pages is a real
 * count, and the occasion this mail is sent on is a broken destination,
 * not a backlog. A destination that broke before anything queued behind it
 * is still broken, and the customer is still the only one who can fix it.
 */
export function buildDestinationBroken(a: { held: number; href: string; at: Date }): AccountMail {
  return {
    subject: BROKEN_SUBJECT,
    blocks: [
      { block: "paragraph", text: BROKEN_BODY },
      { block: "stat", label: BROKEN_HELD, value: measured(a.held, a.at), format: "integer" },
      { block: "action", label: BROKEN_ACTION, href: a.href },
      { block: "notice", text: REACH_A_PERSON },
    ],
  };
}
