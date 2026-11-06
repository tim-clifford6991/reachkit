// BUILD §9 — one `account` mail per breakage, only to a customer who has not come back on their own: pages are held, how
// many, and reconnecting releases them. No further mail until it is reconnected and breaks again. Five conjuncts:
//   health <> 'ok'                     it is actually broken
//   it once worked                     never connected is the setup reminders' to chase, not a breakage
//   now - health_changed_at >= 24 h    and has been, for long enough
//   broken_mail_sent_at is null        and we have not written yet
//   lastSignInAt < health_changed_at   and they have not seen it on a screen since
// The guard is data: stamped on hand-off, cleared by `writeHealth` back at `ok`, so it survives redeploys and retries.
// It rides `draft/generate`'s per-site daily loop, since no read path sees a customer who stays away.
import { PAGES_LANDING_PATH } from "@/lib/account/identity/addresses";
import { DESTINATION_BREAKAGE_MAIL_DELAY_H } from "@/lib/config/constants";
import { sendEmail } from "@/lib/mail/send";
import { buildDestinationBroken } from "@/lib/mail/templates/account";
import { publishDb } from "../../db";
import { heldPages } from "../../switch";
import { liveDestinations, markBreakageMailSent, type DestinationRecord } from "../store";

const HOUR_MS = 3_600_000;

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
async function ownerOf(siteId: string): Promise<{ userId: string; email: string; lastSignInAt: Date | null } | null> {
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
    userId: site.data.user_id,
    email: owner.data.email,
    lastSignInAt:
      first === null || (latest !== null && latest.getTime() > first.getTime()) ? latest ?? first : first,
  };
}

/** Whether the site has ever had a page delivered; an unreadable answer is no, so a doubt never mails. */
async function hasPublication(siteId: string): Promise<boolean> {
  const { data, error } = await publishDb()
    .from<{ id: string }>("publications")
    .select("id")
    .eq("site_id", siteId)
    .limit(1);
  return error === null && (data?.length ?? 0) > 0;
}

/** Read from the health columns, never `config`. No column records a past success, so a hosted host that is not live
 *  counts as having worked only once a page went out. */
async function neverConnected(row: DestinationRecord): Promise<boolean> {
  if (row.health_reason === "never_connected") return true;
  // Setup's insert before its first check: nothing has been read from the site yet.
  if (row.kind !== "hosted") return row.health_reason === null;
  return row.hostname_state !== "live" && !(await hasPublication(row.site_id));
}

type Occasion = Extract<BreakageMail, { due: true }> & { userId: string };

async function occasionFor(siteId: string, now: Date): Promise<Occasion | null> {
  const rows = await liveDestinations(siteId);
  const broken = rows.find((row) => row.health !== "ok" && row.broken_mail_sent_at === null);
  if (broken === undefined) return null;

  const brokeAt = Date.parse(broken.health_changed_at);
  if (Number.isNaN(brokeAt)) return null;
  if (now.getTime() - brokeAt < DESTINATION_BREAKAGE_MAIL_DELAY_H * HOUR_MS) return null;
  if (await neverConnected(broken)) return null;

  const owner = await ownerOf(siteId);
  if (owner === null) return null;
  // Never signed in at all is the strongest form of "not since it broke".
  if (owner.lastSignInAt !== null && owner.lastSignInAt.getTime() >= brokeAt) return null;

  const held = await heldPages(siteId);
  return {
    due: true,
    destinationId: broken.id,
    held: held.count,
    to: owner.email,
    copy: "mail.account.destinationBroken.subject",
    userId: owner.userId,
  };
}

/** Whether one breakage mail is due now: the occasion, never a sentence or a send. */
export async function breakageMailDue(siteId: string, now: Date): Promise<BreakageMail> {
  const occasion = await occasionFor(siteId, now);
  if (occasion === null) return { due: false };
  const { destinationId, held, to, copy } = occasion;
  return { due: true, destinationId, held, to, copy };
}

/** The mail's one action: a sign-in link onto Settings › Pages and its Reconnect control (§4.7). Imported at the call,
 *  as identity pulls Supabase Auth. */
async function pagesLink(a: { userId: string; to: string }): Promise<string | null> {
  const { signInLinkTo } = await import("@/lib/account/identity/wire");
  return signInLinkTo({ ...a, landsOn: PAGES_LANDING_PATH });
}

/** What the send did. Every arm is reported; none is a silent skip. */
export type BreakageMailOutcome =
  | { sent: true; destinationId: string; held: number }
  | { sent: false; reason: "not-due" | "no-link" | "mail" };

/** Sends the mail if due, then stamps the guard, never before, so a failed send is asked again next tick. Never throws:
 *  the daily loop's other work must not be lost to a mail. */
export async function sendBreakageMail(siteId: string, now: Date): Promise<BreakageMailOutcome> {
  let due: Occasion | null;
  try {
    due = await occasionFor(siteId, now);
  } catch {
    return { sent: false, reason: "mail" };
  }
  if (due === null) return { sent: false, reason: "not-due" };

  try {
    // No working link, no send: the guard stays clear, so the next daily run asks again.
    const href = await pagesLink({ userId: due.userId, to: due.to });
    if (href === null) return { sent: false, reason: "no-link" };
    const mail = buildDestinationBroken({ held: due.held, href, at: now });
    const result = await sendEmail({ kind: "account", to: due.to, ...mail });
    if (!result.sent) return { sent: false, reason: "mail" };
    await markBreakageMailSent(due.destinationId, now);
    return { sent: true, destinationId: due.destinationId, held: due.held };
  } catch {
    return { sent: false, reason: "mail" };
  }
}
