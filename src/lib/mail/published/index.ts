// BUILD §12 — the occasion of the `published` mail.
//
// REQ-062 criterion 5: "Given verification has completed, when the customer
// is told about that page, then one message carries its live address
// together with the outcome of all four checks, and it is sent on the same
// occasion whether every check passed or any failed."
//
// **The outcome never enters the decision to send.** There is no branch
// here on `found` against `page_not_found` against `could_not_confirm`, and
// no branch on whether a check failed. The only reasons this module does
// not send are reasons that have nothing to do with what was found: the
// check has not been recorded, the page has no address, or there is no
// account to write to. Whether the customer has switched this mail off is
// BP-016's, consulted inside `sendEmail` — a different mechanism, and one
// the outcome likewise never reaches.
//
// This module lives under `src/lib/mail/` and not under
// `src/lib/publish/verify/` on purpose: the verification leaf records what
// it saw and stops, and putting the send inside it would make the
// publishing subsystem import the mail seam for one occasion. The job runs
// the check and then tells; the two obligations of one tick are visible in
// the job, not hidden inside the check.
import { dbAdmin } from "@/lib/db";
import { tellingFor } from "@/lib/publish/verify";
import { sendEmail } from "../send";
import { buildPublished } from "../templates/published";

/** Why a telling did not go out. Every arm is reported; none is a silent
 *  skip, and not one of them is "a check failed". */
export type PublishedTellingOutcome =
  | { sent: true; id: string }
  | { sent: false; reason: "no-check-recorded" | "no-account" | "mail" };

interface SiteRow {
  id: string;
  user_id: string;
  timezone: string | null;
}

interface MinimalResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface MinimalQuery<T> extends PromiseLike<MinimalResult<T>> {
  select(columns: string): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

/** The same narrow cast `src/lib/publish/db.ts` documents: `sites.timezone`
 *  is one of the columns absent from the generated `Database` type. */
function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

/** The zone a site states its times in. Falls back to UTC where the founder
 *  has not set one — a date in the wrong zone is still the date ReachKit
 *  looked, and withholding the whole mail over a missing zone would make a
 *  setting the customer never filled in a reason to send nothing. */
const FALLBACK_ZONE = "UTC";

/**
 * Sends the `published` mail for one publication.
 *
 * Called by the `publish/verify` job immediately after the check, in every
 * arm, and never from inside the check itself.
 */
export async function sendPublishedMail(publicationId: string): Promise<PublishedTellingOutcome> {
  const telling = await tellingFor(publicationId);
  if (telling === null) return { sent: false, reason: "no-check-recorded" };

  const { data: sites, error: siteError } = await untyped()
    .from<SiteRow>("sites")
    .select("id, user_id, timezone")
    .eq("id", telling.siteId)
    .limit(1);
  if (siteError !== null) {
    throw new Error(`sendPublishedMail(${publicationId}): ${siteError.message}`);
  }
  const site = sites?.[0];
  if (site === undefined) return { sent: false, reason: "no-account" };

  const { data: users, error: userError } = await untyped()
    .from<{ email: string }>("users")
    .select("email")
    .eq("id", site.user_id)
    .limit(1);
  if (userError !== null) {
    throw new Error(`sendPublishedMail(${publicationId}): ${userError.message}`);
  }
  const to = users?.[0]?.email;
  if (to === undefined) return { sent: false, reason: "no-account" };

  const mail = buildPublished({ telling, timeZone: site.timezone ?? FALLBACK_ZONE });
  const result = await sendEmail({
    kind: "published",
    to,
    userId: site.user_id,
    subject: mail.subject,
    blocks: mail.blocks,
  });

  return result.sent ? { sent: true, id: result.id } : { sent: false, reason: "mail" };
}
