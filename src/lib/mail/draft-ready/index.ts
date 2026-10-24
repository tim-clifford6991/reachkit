// BUILD §12, §9 — the occasion of the `draft-ready` mail: no page publishes without the customer told, on the pair it publishes under,
// the interval to stop it or that none exists. `tellingFor` picks the telling, `issueVetoLink` mints the link, `recordTold` feeds the guard.
// `recordTold` is written only after the seam accepted the mail: recording first would let a page publish in silence. A refused send leaves
// the page held and owed again next tick; a mail the customer switched off is a telling declined, so it is recorded, and the page still goes live on its day.
// Once per pair, not per page: changing mode or window is owed a fresh telling (REQ-057 c8), and `toldCurrentPair` is that key.
// It refuses a draft not `in_review`, since a mail at the wrong moment is a false statement the caller is least able to see.
// It lives here, not in the veto leaf, so publishing does not import the mail seam for one occasion.
import { dbAdmin } from "@/lib/db";
import { env } from "@/lib/config/env";
import { MAIL_PAGE_LINES } from "@/lib/config/constants";
import { readRecordedFact } from "@/lib/generate/fact";
import type { TargetEngine } from "@/lib/opportunities/types";
import { BAND_LABELS } from "@/lib/presentation/bands";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { explainChoice } from "@/lib/opportunities";
import { machineDraftFor } from "@/lib/publish/machine";
import { nameInZone } from "@/lib/publish/destinations/hosted/dns-guide";
import { recordForHost } from "@/lib/publish/setup/cards";
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
  type DraftReadyRecord,
  type DraftReadyWhy,
  type TellableTelling,
} from "../templates/draft-ready";

/** Why a telling did not go out: every arm reported, since an untold page will not publish. */
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
        | "preference-off"
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

/** The narrow cast `src/lib/publish/db.ts` documents: some columns read here are missing from the generated `Database` type. */
function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

/** The stop link's absolute address (`GET /veto/{token}`): a mail has no host, so the origin comes from the binding; `vetoLinkPath` owns the path. */
function stopHref(token: string): string {
  return new URL(vetoLinkPath(token), env.NEXT_PUBLIC_APP_URL).toString();
}

/** The setting an unconnected hosted address needs, written as the Overview writes it. */
function withRecord(telling: TellableTelling): { record?: DraftReadyRecord } {
  if (telling.destination?.copy !== "mail.draftReady.dest.addressNotConnected") return {};
  const host = telling.destination.site;
  const record = recordForHost({ hostname: host, cnameTarget: env.HOSTED_EDGE_CNAME_TARGET });
  if (record === null) return {};
  return { record: { type: record.type, name: nameInZone(record.name, host.slice(host.indexOf(".") + 1)), value: record.value } };
}

/** The publish moment in the customer's zone, with no fallback: `tellingFor` answers `not_yet_tellable` without one (REQ-073 c1). */
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

/** Tells the customer their page is in review, called right after the `generating → in_review` move, never before. */
export async function sendDraftReadyMail(a: {
  draftId: string;
  destination: DestinationKind;
  at?: Date;
}): Promise<DraftReadyOutcome> {
  const at = a.at ?? new Date();

  // The machine's own reader, so the pair this mail names and the pair the `customer_told` guard compares are one answer.
  const draft = await machineDraftFor(a.draftId);
  if (draft === null) return { sent: false, reason: "no-draft" };
  if (draft.state !== "in_review") return { sent: false, reason: "not-in-review" };
  if (toldCurrentPair(draft).told) return { sent: false, reason: "already-told" };

  // The link is minted before the telling that carries it; at a zero window it is empty and the telling offers no interval.
  const stopAction = await issueVetoLink(a.draftId, at);
  const telling = await tellingFor({ draft, destination: a.destination, stopAction });
  if (telling.kind === "not_yet_tellable") return { sent: false, reason: "not-yet-tellable" };

  const account = await recipient(draft.siteId, a.draftId);
  if (account === null) return { sent: false, reason: "no-account" };

  // §12's "title, why-data": the draft's title and body and §7's stored evidence, both read, never re-measured or composed.
  const page = await readPage(a.draftId);

  const mail = buildDraftReady({
    telling: telling as TellableTelling,
    ...(page.page === null ? {} : { page: page.page }),
    ...(page.why === null ? {} : { why: page.why }),
    // SPEC §8: *Read the full page* deep-links to the page's address in the app, the one the calendar opens.
    readHref: readHref(a.draftId),
    publishesAt: writePublishesAt(telling.publishesAt, account.timeZone),
    ...(telling.kind === "interval" && telling.stopAction.token !== ""
      ? { stopHref: stopHref(telling.stopAction.token) }
      : {}),
    ...withRecord(telling as TellableTelling),
  });

  const result = await sendEmail({
    kind: "draft-ready",
    to: account.email,
    userId: account.userId,
    subject: mail.subject,
    subjectVars: mail.subjectVars,
    blocks: mail.blocks,
    reason: mail.reason,
    // §4.7's switch is asked except at autopilot with a zero window, where this mail is the whole telling; `isUnsuppressible` decides (REQ-057 c7).
    ...(isUnsuppressible(telling) ? { suppressible: false as const } : {}),
  });

  // A switched-off mail must never hold the page it would have announced.
  if (!result.sent && result.reason === "preference-off") {
    await recordTold(a.draftId, telling, draft.governing, at, false);
    return { sent: false, reason: "preference-off" };
  }
  if (!result.sent) return { sent: false, reason: "mail" };

  // Recorded only after the send; see the module header.
  await recordTold(a.draftId, telling, draft.governing, at, true);
  return { sent: true, id: result.id };
}

/** The page and why §7 chose it: two reads of stored evidence, the same the draft screen renders, so mail and screen agree.
 *  No title means not in review, so `null`; a `fix` opportunity cannot reach this mail (§9), so its why-data is `null`. */
async function readPage(
  draftId: string
): Promise<{ page: DraftReadyPage | null; why: DraftReadyWhy | null }> {
  const { data, error } = await untyped()
    .from<{
      title: string | null;
      body_md: string | null;
      opportunity_id: string | null;
      grounded_fact: unknown;
    }>("drafts")
    .select("title, body_md, opportunity_id, grounded_fact")
    .eq("id", draftId)
    .limit(1);
  if (error !== null) throw new Error(`sendDraftReadyMail(${draftId}): ${error.message}`);

  const row = data?.[0];
  const title = row?.title ?? null;
  // The page's first lines (SPEC §8), cut by `firstLines` under a pin: the mail is where a reader decides to open the page.
  const page: DraftReadyPage | null =
    title === null || title === "" ? null : { title, markdown: firstLines(row?.body_md ?? "") };

  const opportunityId = row?.opportunity_id ?? null;
  if (opportunityId === null) return { page, why: null };

  const choice = await explainChoice(opportunityId);
  if (choice === null) return { page, why: null };

  const evidence = choice.evidence;
  // Two of §7's three families carry a search and volume; `fix` carries a barrier and says nothing here.
  if (evidence.family === "fix") return { page, why: null };

  // The other fact rows, read off what was stored at choice: who answers today, the site's band, and the grounding page.
  const answered = answeredBy(evidence.target?.engines ?? []);
  const source = writtenFrom(row?.grounded_fact);
  const why: DraftReadyWhy = {
    query: evidence.query,
    volume: evidence.volume,
    ...(answered === undefined ? {} : { answeredBy: copy(answered) }),
    ...(choice.fitBand === null ? {} : { chances: copy(BAND_LABELS.winnability[choice.fitBand]) }),
    ...(source === undefined ? {} : { writtenFrom: source }),
  };

  return { page, why };
}

/** The page's address in the app, off the deployment's binding as the stop link is. */
function readHref(draftId: string): string {
  return new URL(`/app/draft/${encodeURIComponent(draftId)}`, env.NEXT_PUBLIC_APP_URL).toString();
}

/** SPEC §8: who answers this search today, in one word, from the engines stored on the row (`TargetFacts.engines`).
 *  The customer, somebody else, nobody, or unmeasured (no row). Which, not how many: a count would be a second figure. */
function answeredBy(engines: readonly TargetEngine[]): CopyKey | undefined {
  if (engines.some((engine) => engine.standing === "names_you")) return "mail.draftReady.fact.you";
  if (engines.some((engine) => engine.standing === "names_others")) {
    return "mail.draftReady.fact.others";
  }
  // An engine that answered and named no one is "nobody" too, never "other sites".
  if (engines.length > 0 && engines.every((engine) => engine.standing === "no_answer" || engine.standing === "names_no_one")) {
    return "mail.draftReady.fact.nobody";
  }
  return undefined;
}

/** The grounding passage's address, or `undefined` (no row) where generation recorded none. */
function writtenFrom(groundedFact: unknown): string | undefined {
  const recorded = readRecordedFact(groundedFact);
  const url = recorded?.url ?? "";
  return url === "" ? undefined : url;
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

/** SPEC §8's "page's first lines": cut at a paragraph boundary within `MAIL_PAGE_LINES`, since a mid-clause cut reads as broken. */
function firstLines(markdown: string): string {
  const paragraphs = markdown.split(/\n\s*\n/).filter((part) => part.trim() !== "");
  return paragraphs.slice(0, MAIL_PAGE_LINES).join("\n\n");
}
