// BUILD §9 — one mail per breakage, and only to a customer who has not
// come back on their own.
//
// A destination that has needed reconnecting for 24 hours, whose customer
// has not signed in since it broke, gets **one** `account` mail: pages are
// being held, how many, and reconnecting releases them. No further mail
// about that destination until it is reconnected and breaks again.
//
// **Four conjuncts, and each one is falsifiable on its own:**
//
//   health <> 'ok'                             it is actually broken
//   now - health_changed_at >= 24 h            and has been, for long enough
//   broken_mail_sent_at is null                and we have not written yet
//   lastSignInAt < health_changed_at           and they have not seen it
//
// The last is what keeps this mail from being noise. A customer who signed
// in after the destination broke has already been shown the state and the
// Reconnect action on every screen they opened; writing to them as well
// says nothing they were not told.
//
// **The guard is data, not memory.** `broken_mail_sent_at` is stamped when
// the send is handed off and cleared by `writeHealth` on every transition
// back to `ok`. So "until it is reconnected and breaks again" needs no
// rule anyone has to remember and survives a redeploy, a retry and a
// second tick on the same day.
//
// **It rides an existing job.** The occasion is one where the customer has
// *not* come to a screen, so no read path can supply it; it is evaluated
// inside `draft/generate`'s per-site daily loop — the same loop that would
// otherwise be preparing the page that is now being held. §11's kill
// switch stops that job, so a breakage mail can be delayed by a stop,
// during which the product already says its work stopped.
import { DESTINATION_BREAKAGE_MAIL_DELAY_H } from "@/lib/config/constants";
import { env } from "@/lib/config/env";
import { sendEmail } from "@/lib/mail/send";
import { buildDestinationBroken } from "@/lib/mail/templates/account";
import { publishDb } from "../../db";
import { heldPages } from "../../switch";
import { liveDestinations, markBreakageMailSent } from "../store";

const HOUR_MS = 3_600_000;

/** Where the mail's one action lands: the screen that carries the
 *  destinations list and its Reconnect control (§4.7). */
export const DESTINATIONS_PATH = "/app/settings";

/** The occasion, and its payload. A copy key and a count — never a
 *  sentence, and never anything a vendor said. */
export type BreakageMail =
  | { due: false }
  | {
      due: true;
      destinationId: string;
      held: number;
      to: string;
      copy: "mail.account.destinationBroken.subject";
    };

interface SiteOwner {
  user_id: string;
}

interface OwnerRow {
  email: string;
  first_signed_in_at: string | null;
}

interface SpentLink {
  spent_at: string | null;
}

/** The newest redeemed sign-in link's moment, or `null` where none has
 *  been redeemed. `purpose = 'sign_in'` on purpose: an email-change link
 *  is redeemed from a mailbox and is not somebody arriving at the
 *  product. */
async function lastLinkRedeemed(userId: string): Promise<Date | null> {
  const { data, error } = await publishDb()
    .from<SpentLink>("auth_links")
    .select("spent_at")
    .eq("user_id", userId)
    .eq("purpose", "sign_in")
    .not("spent_at", "is", null)
    .order("spent_at", { ascending: false })
    .limit(1);
  if (error !== null || data === null) return null;
  const stamp = data[0]?.spent_at;
  return stamp === undefined || stamp === null ? null : new Date(stamp);
}

/**
 * The moment this customer last signed in, or `null` where they never
 * have.
 *
 * **The last sign-in is the newest spent sign-in link** (#35): a link is
 * the credential in a magic-link product, so the moment one was redeemed
 * *is* the moment somebody signed in, and the newest of them is the last
 * time anybody did. `users.first_signed_in_at` is read as the floor
 * beneath it — it is stamped by provisioning and survives a link row being
 * aged out — so a customer whose links have been cleaned up still counts
 * as having been here.
 *
 * The criterion this answers is "has not signed in **since** it broke", so
 * the first sign-in alone would not do: a customer who signed in on the
 * day they paid and again this morning would be written to about a
 * destination they have already seen the state of on every screen they
 * opened.
 */
async function ownerOf(siteId: string): Promise<{ email: string; lastSignInAt: Date | null } | null> {
  const site = await publishDb()
    .from<SiteOwner>("sites")
    .select("user_id")
    .eq("id", siteId)
    .single();
  if (site.error !== null || site.data === null) return null;

  const owner = await publishDb()
    .from<OwnerRow>("users")
    .select("email, first_signed_in_at")
    .eq("id", site.data.user_id)
    .single();
  if (owner.error !== null || owner.data === null) return null;

  const firstStamp = owner.data.first_signed_in_at;
  const first = firstStamp === null ? null : new Date(firstStamp);
  const latest = await lastLinkRedeemed(site.data.user_id);
  return {
    email: owner.data.email,
    lastSignInAt:
      first === null || (latest !== null && latest.getTime() > first.getTime()) ? latest ?? first : first,
  };
}

/**
 * Whether one breakage mail is due for this site right now.
 *
 * Returns the occasion and its payload, never a sentence and never a send:
 * what to say is the copy registry's, and sending is `sendBreakageMail`'s.
 */
export async function breakageMailDue(siteId: string, now: Date): Promise<BreakageMail> {
  const rows = await liveDestinations(siteId);
  const broken = rows.find((row) => row.health !== "ok" && row.broken_mail_sent_at === null);
  if (broken === undefined) return { due: false };

  const brokeAt = Date.parse(broken.health_changed_at);
  if (Number.isNaN(brokeAt)) return { due: false };
  if (now.getTime() - brokeAt < DESTINATION_BREAKAGE_MAIL_DELAY_H * HOUR_MS) return { due: false };

  const owner = await ownerOf(siteId);
  if (owner === null) return { due: false };
  // Never signed in at all is "has not signed in since it broke" — the
  // strongest form of the condition, not an exception to it.
  if (owner.lastSignInAt !== null && owner.lastSignInAt.getTime() >= brokeAt) return { due: false };

  const held = await heldPages(siteId);
  return {
    due: true,
    destinationId: broken.id,
    held: held.count,
    to: owner.email,
    copy: "mail.account.destinationBroken.subject",
  };
}

/** What the send did. Every arm is reported; none is a silent skip. */
export type BreakageMailOutcome =
  | { sent: true; destinationId: string; held: number }
  | { sent: false; reason: "not-due" | "mail" };

/**
 * Sends the one breakage mail if it is due, and stamps the guard.
 *
 * The stamp is written **after** the send, never before: a stamp written
 * first would turn a send that never happened into a breakage the customer
 * is never told about, and the next tick asking again is exactly what
 * should happen when a send fails.
 *
 * It never throws. It is called from inside a daily per-site loop whose
 * other work — preparing tomorrow's page — must not be lost because a mail
 * did not go out.
 */
export async function sendBreakageMail(siteId: string, now: Date): Promise<BreakageMailOutcome> {
  let due: BreakageMail;
  try {
    due = await breakageMailDue(siteId, now);
  } catch {
    return { sent: false, reason: "mail" };
  }
  if (!due.due) return { sent: false, reason: "not-due" };

  try {
    const mail = buildDestinationBroken({
      held: due.held,
      href: `${env.NEXT_PUBLIC_APP_URL}${DESTINATIONS_PATH}`,
      at: now,
    });
    const result = await sendEmail({ kind: "account", to: due.to, ...mail });
    if (!result.sent) return { sent: false, reason: "mail" };
    await markBreakageMailSent(due.destinationId, now);
    return { sent: true, destinationId: due.destinationId, held: due.held };
  } catch {
    return { sent: false, reason: "mail" };
  }
}
