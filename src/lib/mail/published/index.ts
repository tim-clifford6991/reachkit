// BUILD §12 — the occasion of the `published` mail: one message with the live address and all four check outcomes, whatever they were (REQ-062 c5).
// The outcome never enters the decision to send; only an unrecorded check, a page without an address or no account stops it.
// The customer's switch is asked inside `sendEmail`, which the outcome never reaches either.
// Page 1 only (SPEC §8, decision 2026-10-19-1593): later pages are told in the Monday mail.
// It lives here, not in `src/lib/publish/verify/`, so publishing does not import the mail seam; the job runs the check, then tells.
import { dbAdmin } from "@/lib/db";
import { tellingFor } from "@/lib/publish/verify";
import { sendEmail } from "../send";
import { buildPublished } from "../templates/published";

/** Why a telling did not go out: every arm reported, and none is "a check failed". */
export type PublishedTellingOutcome =
  | { sent: true; id: string }
  | { sent: false; reason: "no-check-recorded" | "not-first-page" | "no-account" | "mail" };

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
  not(column: string, operator: string, value: unknown): MinimalQuery<T>;
  order(column: string, options: { ascending: boolean }): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

/** The narrow cast `src/lib/publish/db.ts` documents: `sites.timezone` is missing from the generated `Database` type. */
function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

/** The site's zone, else UTC: a missing setting must not withhold the mail. */
const FALLBACK_ZONE = "UTC";

/** Sends the `published` mail for one publication, from the `publish/verify` job right after the check, in every arm. */
export async function sendPublishedMail(publicationId: string): Promise<PublishedTellingOutcome> {
  const telling = await tellingFor(publicationId);
  if (telling === null) return { sent: false, reason: "no-check-recorded" };
  if (!(await isFirstLivePage(publicationId, telling.siteId))) return { sent: false, reason: "not-first-page" };

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
    preheader: mail.preheader,
    blocks: mail.blocks,
    reason: mail.reason,
  });

  return result.sent ? { sent: true, id: result.id } : { sent: false, reason: "mail" };
}

/** Whether no other publication of the site went live before this one. A
 *  page taken down later still counts: the customer was told about page 1. */
async function isFirstLivePage(publicationId: string, siteId: string): Promise<boolean> {
  const { data, error } = await untyped()
    .from<{ id: string }>("publications")
    .select("id")
    .eq("site_id", siteId)
    .not("published_at", "is", null)
    .order("published_at", { ascending: true })
    .limit(1);
  if (error !== null) throw new Error(`sendPublishedMail(${publicationId}): ${error.message}`);
  const first = data?.[0];
  return first === undefined || first.id === publicationId;
}
