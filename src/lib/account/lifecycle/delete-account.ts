// BUILD §4.7, §13, §14 — delete account: signed out, subscription ended,
// tombstone stamped, and one mail about what is still live.
//
// REQ-079 criterion 6, in the order its clauses fall due, each step a
// precondition of the next:
//
//  1. the take-down loop runs — "pages are taken down at their destinations
//     as criterion 4 describes";
//  2. the subscription ends **at once**, "with no further charge and no
//     remaining paid access", through the billing module's own seam;
//  3. the tombstone and the promised purge date are stamped together
//     (ADR-051: two columns, and no `DELETE` of any kind);
//  4. every session is ended, so "a sign-in request at that address finds no
//     account";
//  5. where anything of either kind is left behind, one `account` mail goes
//     to the address being deleted.
//
// **A step that fails stops the ones after it.** A tombstone stamped after a
// take-down that never ran would leave the customer's pages live at their
// own destinations with no ReachKit surface left to say so.
//
// **There is no second switch for hosted serving.** `hostedServingState`
// reads the tombstone directly and answers `account_deleted` from the moment
// it is stamped, which outranks the retention window and means that window
// never begins — so neither hosting notice is ever due for this site.
//
// **The mail is composed after the tombstone**, and that only works because
// deletion is a tombstone rather than a delete: the rows are present and
// hidden, and `dbAdmin()` is the one client that still reaches them
// (ADR-051 point 3).
import { ERASURE_DAYS } from "@/lib/config/constants";
import { sendEmail } from "@/lib/mail/send";
import { buildAccountDeleted } from "@/lib/mail/templates/account";
import { endSubscriptionNow } from "../billing";
import { leftInWordPress, type LeftInWordPress } from "./left-in-wordpress";
import { lifecycleStore } from "./store";
import { unpublishEverything, type UnpublishAllResult } from "./unpublish-all";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DeleteAccountResult {
  readonly signedOut: true;
  readonly subscriptionEndedAt: Date;
  readonly stillLive: UnpublishAllResult["stillLive"];
  readonly leftInWordPress: LeftInWordPress;
  readonly purgeDueAt: Date;
  /** Whether criterion 6's mail went. `false` where there was nothing of
   *  either kind to say — and `false`, with the reason logged by the mail
   *  seam, where its sentences are still owner-owed. */
  readonly mailSent: boolean;
}

export type DeleteAccount =
  | { ok: true; result: DeleteAccountResult }
  | { ok: false; reason: "store" | "no_site" | "unpublish" | "subscription" };

export async function deleteAccount(a: {
  siteId: string;
  now?: Date;
}): Promise<DeleteAccount> {
  const now = a.now ?? new Date();
  const store = lifecycleStore();

  const read = await store.site(a.siteId);
  if (!read.ok) return { ok: false, reason: "store" };
  if (read.site === null) return { ok: false, reason: "no_site" };
  const userId = read.site.user_id;

  const account = await store.account(userId);
  if (!account.ok || account.account === null) return { ok: false, reason: "store" };

  // 1 — the take-down, before anything about the account changes.
  const takenDown = await unpublishEverything({ siteId: a.siteId, userId, now });
  if (!takenDown.ok) return { ok: false, reason: "unpublish" };

  const destinations = await store.destinations(a.siteId);
  const wordpressId =
    (destinations.ok ? destinations.destinations : []).find((row) => row.kind === "wordpress")?.id ??
    null;
  const wordpress = await leftInWordPress({
    outcomes: takenDown.result.outcomes,
    destinationId: wordpressId,
  });

  // 2 — the subscription, at once. `hasActiveAccess` is false from here.
  const ended = await endSubscriptionNow(userId, now);
  if (!ended.ok) return { ok: false, reason: "subscription" };

  // 3 — the tombstone and the promised date, stored rather than computed.
  const purgeDueAt = new Date(now.getTime() + ERASURE_DAYS * MS_PER_DAY);
  const stamped = await store.stampTombstone(userId, { deletedAt: now, purgeDueAt });
  if (!stamped.ok) return { ok: false, reason: "store" };

  // 4 — every session, not this one alone.
  const sessions = await store.endSessions(userId, now);
  if (!sessions.ok) return { ok: false, reason: "store" };

  // 5 — one mail, and only where something of *either* kind is left behind.
  const stillLive = takenDown.result.stillLive;
  const stillLiveCount = stillLive.reduce((sum, row) => sum + row.liveUrls.length, 0);
  const anythingLeft = stillLive.length > 0 || Object.keys(wordpress).length > 0;

  let mailSent = false;
  if (anythingLeft) {
    const mail = buildAccountDeleted({
      ...(stillLive.length === 0 ? {} : { stillLive: stillLiveCount }),
      leftInWordPress: wordpress,
    });
    const sent = await sendEmail({
      kind: "account",
      to: account.account.email,
      subject: mail.subject,
      blocks: mail.blocks,
      userId,
    });
    mailSent = sent.sent;
  }

  return {
    ok: true,
    result: {
      signedOut: true,
      subscriptionEndedAt: ended.endedAt,
      stillLive,
      leftInWordPress: wordpress,
      purgeDueAt,
      mailSent,
    },
  };
}
