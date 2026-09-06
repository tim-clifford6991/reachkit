// src/lib/account/billing/hosting-notices.ts — BUILD §13, §12
//
// One notice, sent once, stamped only after it was sent.
//
// REQ-076 criterion 11: "no customer's live pages go dark without both
// notices having been sent". `hosting-end.ts` refuses to stop a site
// missing either stamp, which makes the order below the whole guarantee:
//
//   1. open the retention window if it is not open yet — the day the
//      customer is about to be told is the day the column will hold;
//   2. send the mail;
//   3. stamp, **only** on `sent: true`.
//
// A send that failed leaves the stamp unset, so the next tick asks again
// and the stop queue keeps excluding the site in the meantime. That is the
// failure direction BP-060 decision 3 chose: the site goes on serving until
// somebody has actually been told.
//
// **It writes no sentence.** The two lines are copy keys and the day is a
// slot; what a customer reads is the owner's, in the registry.
//
// The `account` kind is `stoppable: false` by its register row — a customer
// cannot unsubscribe from being told their live pages are coming down —
// and `sendEmail` consults no suppression store for it.
import { sendEmail } from "@/lib/mail/send";
import { formatMailDate } from "@/lib/mail/blocks/format";
import { buildHostingEnd } from "@/lib/mail/templates/account";
import { hostedServingEndsAt } from "./hosting-end";
import { billingStore, type HostingNotice } from "./store";

export type HostingNoticeOutcome =
  | { sent: true; which: HostingNotice }
  /** `not_due` is not a failure: a subject the tick handed over that has
   *  since been sent, deleted or resumed is a subject with nothing owed. */
  | { sent: false; because: "not_due" | "store" | "mail" };

/** REQ-076 criterion 11 — one of the two notices, for one site.
 *
 *  `which` is re-derived here rather than trusted from the caller: the tick
 *  hands over a site id, and a site whose stamp landed between the queue
 *  and this call must not be told twice. */
export async function sendHostingEndNotice(siteId: string): Promise<HostingNoticeOutcome> {
  const store = billingStore();

  const read = await store.hosting(siteId);
  if (!read.ok) return { sent: false, because: "store" };
  const site = read.site;
  if (site === null) return { sent: false, because: "not_due" };

  // A deleted account is told nothing about a day it did not choose
  // (REQ-079 c6), and a site with no hosted destination has no such day.
  if (site.owner_deleted_at !== null) return { sent: false, because: "not_due" };
  if (!site.hasHostedPages) return { sent: false, because: "not_due" };

  const which: HostingNotice | null =
    site.hosting_end_notice_at === null
      ? "access_ended"
      : site.hosting_end_reminder_at === null
        ? "seven_days"
        : null;
  if (which === null) return { sent: false, because: "not_due" };

  const stopsOn = hostedServingEndsAt(site);

  // The window is opened before the mail goes, never after: the day the
  // customer is about to read must be the day the column holds, and a
  // stamp written afterwards could be a different day if the tick were
  // interrupted between the two.
  if (site.hosted_serving_ends_at === null) {
    const opened = await store.stampHostedServingEndsAt(siteId, stopsOn);
    if (!opened.ok) return { sent: false, because: "store" };
  }

  const mail = buildHostingEnd({
    occasion: which,
    stopsOn: formatMailDate(stopsOn, site.timezone),
  });

  const result = await sendEmail({
    kind: "account",
    to: site.owner_email,
    subject: mail.subject,
    blocks: mail.blocks,
  });
  if (!result.sent) return { sent: false, because: "mail" };

  // Only now. A stamp written before the send would let a mail that never
  // left take a customer's pages down on schedule.
  const stamped = await store.stampHostingNotice(siteId, which, new Date());
  if (!stamped.ok) {
    // The mail went and the stamp did not. Loud, because the next tick will
    // send a second copy of a notice the customer has already read — the
    // lesser of the two errors, and one an operator should still see.
    console.warn(JSON.stringify({ event: "hosting_notice_unstamped", siteId, which }));
    return { sent: false, because: "store" };
  }

  return { sent: true, which };
}
