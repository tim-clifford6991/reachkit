// BUILD §12, §9 — the occasion of the `draft-ready` mail.
//
// §9: "no page publishes at all without their having been told, on the
// pair it actually publishes under, either the interval they have to stop
// it or that no interval exists." The decision behind that telling was
// built with the veto leaf — `tellingFor` picks which of §12's three
// things the mail says, `issueVetoLink` mints the one stop link it
// carries, and `recordTold` is what the `customer_told` guard reads — and
// nothing composed or sent it. So a real customer was never told a page
// was in review, and the guard held every page forever (#174).
//
// **`recordTold` is written only after the send seam accepted the mail.**
// That order is the whole of the promise, and it is the opposite of the
// convenient one: recording first and sending after would mark a page told
// on the strength of a mail that never left, and the guard would then let
// it publish in silence — which is precisely the failure §9's clause
// exists to prevent. A refused send leaves the page untold and held, and
// the next tick owes the telling again.
//
// **Once per page, and the natural key is the record itself.** The seam
// this module calls is not idempotent (`send.ts` says so), so this module
// carries its own key: a page already told on the pair now in force is not
// told again. That is `toldCurrentPair`'s answer and not a second rule —
// and it is deliberately the *pair*, not the page: a customer who changes
// their mode or window is owed a fresh telling, because what they were
// last told has stopped being true (REQ-057 c8).
//
// **It refuses to speak about a page that is not in review.** The mail is
// the `generating → in_review` edge's, so a draft in any other state is
// not one this occasion has arisen for. That check is here rather than at
// the call site because a mail sent at the wrong moment is a false
// statement to a customer, and the caller that would make it is the one
// least able to see it.
//
// This module lives under `src/lib/mail/` and not inside the veto leaf,
// for the reason the `published` mail's does: the leaf decides and stops,
// and putting the send inside it would make the publishing subsystem
// import the mail seam for one occasion.
import { dbAdmin } from "@/lib/db";
import { env } from "@/lib/config/env";
import { explainChoice } from "@/lib/opportunities";
import { machineDraftFor } from "@/lib/publish/machine";
import {
  isUnsuppressible,
  issueVetoLink,
  recordTold,
  tellingFor,
  toldCurrentPair,
  vetoLinkPath,
} from "@/lib/publish/publishable";
import type { DestinationKind } from "@/lib/publish/types";
import { sendEmail } from "../send";
import {
  buildDraftReady,
  type DraftReadyPage,
  type DraftReadyWhy,
  type TellableTelling,
} from "../templates/draft-ready";

/** Why a telling did not go out. Every arm is reported and none is a
 *  silent skip — a page nobody was told about is a page that will not
 *  publish, so the reason has to be legible. */
export type DraftReadyOutcome =
  | { sent: true; id: string }
  | {
      sent: false;
      reason:
        | "no-draft"
        | "not-in-review"
        | "already-told"
        | "not-yet-tellable"
        | "no-account"
        | "mail";
    };

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

/** The same narrow cast `src/lib/publish/db.ts` documents: several columns
 *  this module reads are absent from the generated `Database` type. */
function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

/**
 * The absolute address of the stop link (#154's `GET /veto/{token}`).
 *
 * Composed here, from the one binding that knows where this deployment
 * answers, because a mail carries no host of its own and a relative link
 * in an inbox reaches nothing. `vetoLinkPath` owns the shape of the path
 * and this owns nothing but the origin.
 */
function stopHref(token: string): string {
  return new URL(vetoLinkPath(token), env.NEXT_PUBLIC_APP_URL).toString();
}

/** The moment the page publishes, in the zone the customer set.
 *
 *  There is no fallback zone here, and that is the point: `tellingFor`
 *  answers `not_yet_tellable` where the site states none, so this function
 *  is never reached without one. A default would name a moment in a zone
 *  nobody chose, which REQ-073 c1 forbids and which this mail exists to
 *  state exactly. */
function writePublishesAt(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(at);
}

/**
 * Tells the customer their page is in review.
 *
 * Called at the `generating → in_review` edge, immediately after the move
 * and never before it: the mail says a page is waiting for them, and a
 * page that has not entered review is not.
 */
export async function sendDraftReadyMail(a: {
  draftId: string;
  destination: DestinationKind;
  at?: Date;
}): Promise<DraftReadyOutcome> {
  const at = a.at ?? new Date();

  // The machine's own reader, not a second select of the same columns:
  // the pair this mail speaks about and the pair the `customer_told` guard
  // compares against must be one answer (#174).
  const draft = await machineDraftFor(a.draftId);
  if (draft === null) return { sent: false, reason: "no-draft" };
  if (draft.state !== "in_review") return { sent: false, reason: "not-in-review" };
  if (toldCurrentPair(draft).told) return { sent: false, reason: "already-told" };

  // The stop link is minted before the telling, because the telling
  // carries it: at a window of zero this answers an empty token and
  // `tellingFor` composes the arm that offers no interval at all.
  const stopAction = await issueVetoLink(a.draftId, at);
  const telling = await tellingFor({ draft, destination: a.destination, stopAction });
  if (telling.kind === "not_yet_tellable") return { sent: false, reason: "not-yet-tellable" };

  const account = await recipient(draft.siteId, a.draftId);
  if (account === null) return { sent: false, reason: "no-account" };

  // §12's "title, why-data" (issue #183). The page's own row carries the
  // title and the body the label belongs to; §7's row carries the evidence
  // it was chosen on. Both are **read**: nothing here re-measures a
  // volume, and nothing composes a title of its own.
  const page = await readPage(a.draftId);

  const mail = buildDraftReady({
    telling: telling as TellableTelling,
    ...(page.page === null ? {} : { page: page.page }),
    ...(page.why === null ? {} : { why: page.why }),
    ...(telling.kind === "approval_only"
      ? {}
      : { publishesAt: writePublishesAt(telling.publishesAt, account.timeZone) }),
    ...(telling.kind === "interval" && telling.stopAction.token !== ""
      ? { stopHref: stopHref(telling.stopAction.token) }
      : {}),
  });

  const result = await sendEmail({
    kind: "draft-ready",
    to: account.email,
    userId: account.userId,
    subject: mail.subject,
    subjectVars: mail.subjectVars,
    blocks: mail.blocks,
    reason: mail.reason,
    // §4.7's switch is asked for every other draft-ready mail. The one
    // occasion it is not is autopilot at a veto window of zero, where this
    // mail is the whole of the telling and no interval to stop the page
    // exists — the register names that occasion and `isUnsuppressible` is
    // the one place it is decided (REQ-057 c7).
    ...(isUnsuppressible(telling) ? { suppressible: false as const } : {}),
  });

  if (!result.sent) return { sent: false, reason: "mail" };

  // After, and only after. See the module header.
  await recordTold(a.draftId, telling, draft.governing, at);
  return { sent: true, id: result.id };
}

/**
 * The page this mail is about, and why §7 chose it.
 *
 * One read of the draft's own row and one of the opportunity's, and both
 * are reads: the evidence is what §7 stored when it chose the page, which
 * is the same stored evidence the draft screen renders. Re-measuring it
 * here would state a volume the page was not chosen on and would make the
 * mail and the screen disagree about one measurement.
 *
 * A page with no title is a page that cannot be in review, so `null` there
 * is the honest arm rather than a title composed on the spot. A `fix`
 * opportunity's evidence is a barrier and a URL — no search and no volume
 * — and §9's "Fix never automates" means one cannot reach this mail; its
 * why-data is `null` rather than a line invented for it.
 */
async function readPage(
  draftId: string
): Promise<{ page: DraftReadyPage | null; why: DraftReadyWhy | null }> {
  const { data, error } = await untyped()
    .from<{ title: string | null; body_md: string | null; opportunity_id: string | null }>("drafts")
    .select("title, body_md, opportunity_id")
    .eq("id", draftId)
    .limit(1);
  if (error !== null) throw new Error(`sendDraftReadyMail(${draftId}): ${error.message}`);

  const row = data?.[0];
  const title = row?.title ?? null;
  const page: DraftReadyPage | null =
    title === null || title === "" ? null : { title, markdown: row?.body_md ?? "" };

  const opportunityId = row?.opportunity_id ?? null;
  if (opportunityId === null) return { page, why: null };

  const choice = await explainChoice(opportunityId);
  if (choice === null) return { page, why: null };

  const evidence = choice.evidence;
  // Two of §7's three families carry a search and its volume; `fix`
  // carries a barrier, and says nothing here.
  const why: DraftReadyWhy | null =
    evidence.family === "fix" ? null : { query: evidence.query, volume: evidence.volume };

  return { page, why };
}

/** The address to write to, and the zone to write the moment in. */
async function recipient(
  siteId: string,
  draftId: string
): Promise<{ email: string; userId: string; timeZone: string } | null> {
  const { data: sites, error: siteError } = await untyped()
    .from<{ id: string; user_id: string; timezone: string | null }>("sites")
    .select("id, user_id, timezone")
    .eq("id", siteId)
    .limit(1);
  if (siteError !== null) {
    throw new Error(`sendDraftReadyMail(${draftId}): ${siteError.message}`);
  }
  const site = sites?.[0];
  if (site === undefined || site.timezone === null) return null;

  const { data: users, error: userError } = await untyped()
    .from<{ email: string }>("users")
    .select("email")
    .eq("id", site.user_id)
    .limit(1);
  if (userError !== null) {
    throw new Error(`sendDraftReadyMail(${draftId}): ${userError.message}`);
  }
  const email = users?.[0]?.email;
  if (email === undefined) return null;

  return { email, userId: site.user_id, timeZone: site.timezone };
}
