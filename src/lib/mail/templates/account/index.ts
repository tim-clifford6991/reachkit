// BUILD §13 — the `account` mails REQ-024 obliges, as block lists only (ADR-040); `stoppable: false`, since each is about money that left a bank.
// Every one names a way to reach a person (REQ-024 c3, c5), appended by the builders here so no mail can drop it.
// The chase never asks for payment again: no checkout URL, price key or `src/lib/account/checkout/**` import. Its two arms are two lists,
// not an `if`, so "here is your way in" can never be said without the link.
import { measured } from "@/lib/measure/measured";
import type { CopyKey } from "@/lib/presentation/copy";
import type { AccountMail } from "../magic-link";

/** Which of REQ-076 c11's two notices this is: two subjects, one body. */
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
const RENEWAL_REFUNDED_SUBJECT = "mail.account.renewal_refunded.subject" satisfies CopyKey;
const RENEWAL_REFUNDED = "mail.account.renewal_refunded" satisfies CopyKey;
const RENEWAL_REFUNDED_NEXT = Object.freeze({
  renewing: "mail.account.renewal_refunded.renewing" satisfies CopyKey,
  ending: "mail.account.renewal_refunded.ending" satisfies CopyKey,
});
const DELETED_SUBJECT = "mail.account.deleted.subject" satisfies CopyKey;
const DELETED_STILL_LIVE = "mail.account.deleted.still_live" satisfies CopyKey;
const DELETED_THEIRS_TO_KEEP = "mail.account.deleted.theirs_to_keep" satisfies CopyKey;

/** REQ-079 c6's four WordPress outcomes, each with a form that names where the posts are and one that cannot, both with the count.
 *  `already_gone` has one form: there is nothing there to find, so no place to write. */
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

/** The sentences' fixed order, so the mail reads the same whichever arms a run produced. */
const WORDPRESS_ORDER: readonly DeletedWordPressOutcome[] = Object.freeze([
  "returned_to_draft",
  "named_for_removal",
  "already_gone",
  "unreachable",
] as const);

/** REQ-060 c6's list as the sentence names it; the address is structure, built here, not by the module that tallied the counts. */
export interface DeletedPlace {
  readonly siteBaseUrl: string;
  readonly stampSlug: string;
}

function placeAddress(place: DeletedPlace): string | null {
  try {
    return new URL(place.stampSlug, place.siteBaseUrl).toString();
  } catch {
    // An unparseable base names no place; the sentence keeps its count.
    return null;
  }
}

export interface DeletedAccountMailInput {
  /** Pages still live at an unreachable destination; absent, not zero, where there are none. */
  readonly stillLive?: number;
  /** One entry per outcome that holds posts, so no sentence can render a zero. */
  readonly leftInWordPress: Partial<
    Record<DeletedWordPressOutcome, { count: number; place: DeletedPlace | null }>
  >;
}

/** REQ-079 c6's mail: one sentence per outcome with its own count, never a sum; no post listed; a place only where supplied.
 *  Whether to send is the caller's ("where nothing … is left behind, no such mail is sent"), so no empty mail is ever returned. */
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

/** The chase with an open account: the payment succeeded, here is the way in, here is a person. */
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

/** The chase before the account opens: no action, since it could only point somewhere that does not work. */
export function buildChaseWithoutLink(): AccountMail {
  return {
    subject: CHASE_SUBJECT,
    blocks: [
      { block: "paragraph", text: CHASE_NOT_OPEN_YET },
      { block: "notice", text: REACH_A_PERSON },
    ],
  };
}

/** REQ-024 c3: a second charged purchase bought no second subscription, and the person who will refund it is named. */
export function buildSecondPurchase(): AccountMail {
  return {
    subject: SECOND_PURCHASE_SUBJECT,
    blocks: [
      { block: "paragraph", text: NO_SECOND_SUBSCRIPTION },
      { block: "notice", text: REACH_A_PERSON },
    ],
  };
}

/** REQ-077 c3: sent to the old address saying the account now signs in elsewhere. It names neither address: the old is where it lands,
 *  and the new would put a live sign-in address in a mailbox being left. No action, since its reader may not be who made the change. */
export function buildAddressMoved(): AccountMail {
  return {
    subject: ADDRESS_MOVED_SUBJECT,
    blocks: [
      { block: "paragraph", text: ADDRESS_MOVED },
      { block: "notice", text: REACH_A_PERSON },
    ],
  };
}

/** REQ-076 c11: which day hosted serving stops and that the export stays open, as two blocks so neither can be dropped silently.
 *  `stopsOn` is written by the caller in the customer's zone (REQ-073 c3); no action, as nothing here is theirs to press. */
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

/** D10: the first renewal was refunded because no page went live in the first month; `next` is null where the day could not be read, so none is invented. */
export function buildRenewalRefunded(a: {
  amount: string;
  next: { kind: "renewing" | "ending"; date: string } | null;
}): AccountMail {
  return {
    subject: RENEWAL_REFUNDED_SUBJECT,
    blocks: [
      { block: "paragraph", text: RENEWAL_REFUNDED, vars: { amount: a.amount } },
      ...(a.next === null ? [] : [{ block: "paragraph" as const, text: RENEWAL_REFUNDED_NEXT[a.next.kind], vars: { date: a.next.date } }]),
      { block: "notice", text: REACH_A_PERSON },
    ],
  };
}

/** §9: a destination has needed reconnecting for 24 hours with no sign-in since. Pages are held, how many (a `stat`), and how to release them.
 *  `measured(held)`, not `measuredZero`: zero held is a real count, and the broken destination is the occasion. */
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
