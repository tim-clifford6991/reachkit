// BUILD §9 — one `account` mail per breakage, only to a customer who has not come back on their own: pages are held, how
// many, and reconnecting releases them. No further mail until it is reconnected and breaks again. Four conjuncts:
//   health <> 'ok'                     it is actually broken
//   now - health_changed_at >= 24 h    and has been, for long enough
//   broken_mail_sent_at is null        and we have not written yet
//   lastSignInAt < health_changed_at   and they have not seen it on a screen since
// The guard is data: stamped on hand-off, cleared by `writeHealth` back at `ok`, so it survives redeploys and retries.
// It rides `draft/generate`'s per-site daily loop, since no read path sees a customer who stays away.
import { DESTINATION_BREAKAGE_MAIL_DELAY_H } from "@/lib/config/constants";
import { env } from "@/lib/config/env";
import { sendEmail } from "@/lib/mail/send";
import { buildDestinationBroken } from "@/lib/mail/templates/account";
import { publishDb } from "../../db";
import { heldPages } from "../../switch";
import { liveDestinations, markBreakageMailSent } from "../store";

const HOUR_MS = 3_600_000;

/** The mail's one action: the destinations list and its Reconnect control (§4.7). */
export const DESTINATIONS_PATH = "/app/settings";

/** The occasion and payload: a copy key and a count, never a sentence or anything a vendor said. */
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

/** `auth.users.last_sign_in_at`, or `null`; imported at the call, as only this reaches the auth admin client. */
async function lastSignedIn(userId: string): Promise<Date | null> {
  const { identityAuth } = await import("@/lib/account/identity/auth");
  return identityAuth().lastSignInAt(userId);
}

/** The customer's last sign-in, from Supabase Auth, with `users.first_signed_in_at` as the floor if that cannot be
 *  read. The last, not the first, since the rule is "has not signed in since it broke". */
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
  const latest = await lastSignedIn(site.data.user_id);
  return {
    email: owner.data.email,
    lastSignInAt:
      first === null || (latest !== null && latest.getTime() > first.getTime()) ? latest ?? first : first,
  };
}

/** Whether one breakage mail is due now: the occasion, never a sentence or a send. */
export async function breakageMailDue(siteId: string, now: Date): Promise<BreakageMail> {
  const rows = await liveDestinations(siteId);
  const broken = rows.find((row) => row.health !== "ok" && row.broken_mail_sent_at === null);
  if (broken === undefined) return { due: false };

  const brokeAt = Date.parse(broken.health_changed_at);
  if (Number.isNaN(brokeAt)) return { due: false };
  if (now.getTime() - brokeAt < DESTINATION_BREAKAGE_MAIL_DELAY_H * HOUR_MS) return { due: false };

  const owner = await ownerOf(siteId);
  if (owner === null) return { due: false };
  // Never signed in at all is the strongest form of "not since it broke".
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

/** Sends the mail if due, then stamps the guard, never before, so a failed send is asked again next tick. Never throws:
 *  the daily loop's other work must not be lost to a mail. */
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
