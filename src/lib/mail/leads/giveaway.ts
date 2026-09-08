// BUILD §4.2 — one page, once, or a written message saying why not.
//
// The draft is generated **only after** the email is submitted (~7¢, spent
// on identified leads only), and never on the visitor's request: this
// function is the job's, and `captureLead` enqueues nothing and calls no
// model. Writing the page itself is §8's (issue #44) and is reached through
// the declared port in `ports.ts` — this module maps its two refusals to
// two causes and holds no rule of its own about how a page is written.
//
// **One `generateDraft()` call per lead, ever.** The guard is
// `first_page_state`: the port is reached from exactly one place below, and
// only while the state is `pending`. A retry re-sends what was written and
// never re-writes it, so an abandoned delivery costs one generation and not
// seven.
//
// **Read ADR-041 before adding a suppression check to this send.**
// `first-page` and `first-page-unavailable` are `stoppable: false`, so the
// send seam does not consult `email_suppressions` for them. A suppressed
// address that submitted the control for a *different* domain still
// receives that domain's page. It reads as the one thing no mail system may
// ever do, and it is REQ-010 c3: "a mail the founder cannot stop: it is the
// thing they asked for, sent once, in answer to their own submission". The
// opt-out in that same mail stops the follow-up, not the page.
//
// **Nothing is recorded as delivered that was not.** Every state advance
// below happens after the send seam says `sent: true`, and the terminal
// `abandoned` state says in the row itself that neither of the two things
// the founder was owed arrived.
import { FIRST_PAGE_RETRY_MINUTES, FIRST_PAGE_RETRY_WINDOW_H } from "@/lib/config/constants";
import type { CopyKey } from "@/lib/presentation/copy";
import { sendEmail } from "../send";
import { buildFirstPage } from "../templates/first-page";
import { buildFirstPageUnavailable } from "../templates/first-page-unavailable";
import { hoursAfter, minutesAfter } from "./clock";
import { readFirstPageOffer } from "./offer";
import { writeDraft } from "./ports";
import { scheduleSequence } from "./sequence";
import { leadStore, type LeadRow } from "./store";
import { wireSuppressionReader } from "./wire";

/** The four ways a page can fail to arrive. One member per cause, and the
 *  union is closed: a fifth cause is a change to this type and to the map
 *  below, never a new string at a call site. */
export type FirstPageFailure =
  | "no-page-to-write" // the current report no longer offers one
  | "writing-failed" // §8 could not produce a page
  | "writing-refused" // hard rules or the claim check refused it
  | "delivery-failed"; // the window closed on the page itself

/** REQ-010 criterion 7's "and why", made enforceable. A `Record` over the
 *  union, so a cause with no key of its own is a compile error rather than
 *  a review comment. Exported because the report's own surface renders the
 *  **same** key in place for a founder still looking at it — one map, read
 *  twice, rather than two that drift. */
export const FIRST_PAGE_UNAVAILABLE_COPY: Readonly<Record<FirstPageFailure, CopyKey>> =
  Object.freeze({
    "no-page-to-write": "mail.firstPageUnavailable.no-page-to-write",
    "writing-failed": "mail.firstPageUnavailable.writing-failed",
    "writing-refused": "mail.firstPageUnavailable.writing-refused",
    "delivery-failed": "mail.firstPageUnavailable.delivery-failed",
  });

export type DeliveryOutcome =
  | { delivered: "page" }
  | { delivered: "unavailable-notice"; cause: FirstPageFailure }
  | { delivered: "none"; cause: FirstPageFailure };

function log(a: Record<string, unknown>): void {
  // Cause, retry count and state transition — never an address in clear
  // text, never a page body.
  console.log(JSON.stringify({ event: "lead_first_page", ...a }));
}

function asFailure(value: string | null): FirstPageFailure {
  return value !== null && value in FIRST_PAGE_UNAVAILABLE_COPY
    ? (value as FirstPageFailure)
    : "delivery-failed";
}

/** When this lead's next attempt is due. Driven by the two stored facts —
 *  the first attempt's time and how many have been made — never by an
 *  in-memory counter, because the job is re-entrant. A lead never attempted
 *  is due now; a lead past the end of `FIRST_PAGE_RETRY_MINUTES` is not due
 *  again, and the window closes on it. */
export function nextAttemptAt(lead: LeadRow): Date | null {
  if (lead.first_page_first_attempt_at === null) return new Date(0);
  const first = new Date(lead.first_page_first_attempt_at);
  const spacing = FIRST_PAGE_RETRY_MINUTES[lead.first_page_attempts - 1];
  if (spacing === undefined) return null;
  return minutesAfter(first, spacing);
}

/** The job's due-work query: every lead owed one of the two things and
 *  ready for its next attempt. */
export async function dueFirstPageDeliveries(now: Date): Promise<readonly string[]> {
  const read = await leadStore().leadsInFirstPageState(["pending", "written"]);
  if (!read.ok) return [];
  return read.leads
    .filter((lead) => {
      const due = nextAttemptAt(lead);
      return due !== null && due.getTime() <= now.getTime();
    })
    .map((lead) => lead.id);
}

export async function deliverFirstPage(leadId: string, now = new Date()): Promise<DeliveryOutcome> {
  wireSuppressionReader();
  const store = leadStore();
  const read = await store.readLead(leadId);
  if (!read.ok) return { delivered: "none", cause: "delivery-failed" };
  if (read.lead === null) return { delivered: "none", cause: "no-page-to-write" };

  const lead = read.lead;

  // Three terminal states, answered from the row rather than re-attempted.
  // "Sent once, in answer to their own submission" is what makes the second
  // call a no-op rather than a second page.
  if (lead.first_page_state === "sent") return { delivered: "page" };
  if (lead.first_page_state === "notice_sent") {
    return { delivered: "unavailable-notice", cause: asFailure(lead.first_page_failure) };
  }
  if (lead.first_page_state === "abandoned") {
    return { delivered: "none", cause: asFailure(lead.first_page_failure) };
  }

  // The 24-hour window is measured from the **first** attempt, which is why
  // its time is a stored fact. Once it closes, no further attempt is made
  // and nothing is shown or recorded as delivered.
  const firstAttemptAt =
    lead.first_page_first_attempt_at === null ? now : new Date(lead.first_page_first_attempt_at);
  if (now.getTime() >= hoursAfter(firstAttemptAt, FIRST_PAGE_RETRY_WINDOW_H).getTime()) {
    return abandon(lead, asFailure(lead.first_page_failure), now);
  }

  await store.patchLead(lead.id, {
    first_page_first_attempt_at: firstAttemptAt.toISOString(),
    first_page_attempts: lead.first_page_attempts + 1,
  });
  const attempts = lead.first_page_attempts + 1;

  const offerRead = await readFirstPageOffer(lead.scan_id);
  if (!offerRead.read) {
    // We could not look. That is not "this scan found nothing worth
    // writing", and it must not be told to the founder as if it were.
    log({ leadId: lead.id, outcome: "deferred", cause: "offer-unreadable", attempts });
    return { delivered: "none", cause: "delivery-failed" };
  }

  if (!offerRead.offer.offered) {
    return sendNotice(lead, "no-page-to-write", now, attempts);
  }
  const offer = offerRead.offer;

  let title = lead.first_page_title;
  let markdown = lead.first_page_markdown;

  if (lead.first_page_state === "pending") {
    // The one place the draft port is reached, and only from `pending`.
    const written = await writeDraft({
      leadId: lead.id,
      scanId: lead.scan_id,
      page: {
        title: offer.title,
        pagesFound: offer.pagesFound,
        targetQuery: offer.targetQuery,
        volume: offer.volume,
        rival: offer.rival,
        format: offer.format,
      },
    });
    if (!written.written) {
      return sendNotice(
        lead,
        written.refused ? "writing-refused" : "writing-failed",
        now,
        attempts
      );
    }
    title = written.title;
    markdown = written.markdown;
    await store.patchLead(lead.id, {
      first_page_state: "written",
      first_page_title: title,
      first_page_markdown: markdown,
    });
    log({ leadId: lead.id, outcome: "written", attempts });
  }

  if (title === null || markdown === null) {
    // A row in `written` with no page on it is a state this module never
    // produces; treating it as writable again would be a second generation.
    return sendNotice(lead, "writing-failed", now, attempts);
  }

  const mail = buildFirstPage({
    email: lead.email,
    pageTitle: title,
    markdown,
    targetQuery: offer.targetQuery,
    volume: offer.volume,
    pagesFound: offer.pagesFound,
  });

  const result = await sendEmail({
    kind: "first-page",
    to: lead.email,
    subject: mail.subject,
    subjectVars: mail.subjectVars,
    blocks: mail.blocks,
    reason: mail.reason,
    optOut: mail.optOut,
  });

  if (!result.sent) {
    log({ leadId: lead.id, outcome: "page-not-sent", reason: result.reason, attempts });
    if (isPermanent(result)) return abandon(lead, "delivery-failed", now);
    return { delivered: "none", cause: "delivery-failed" };
  }

  await store.patchLead(lead.id, {
    first_page_state: "sent",
    page_delivered_at: now.toISOString(),
  });
  log({ leadId: lead.id, domain: lead.domain, outcome: "page-sent", attempts });

  // The sequence begins no earlier than the delivery of its own page.
  await scheduleSequence({ email: lead.email, domain: lead.domain, deliveredAt: now });
  return { delivered: "page" };
}

/** A vendor rejection with no retry window is permanent: the window ends
 *  early rather than spending six attempts on an address that will never
 *  accept mail. */
function isPermanent(result: { sent: false; reason: string; retryUntil?: Date }): boolean {
  return result.reason === "vendor" && result.retryUntil === undefined;
}

/** Criterion 7's message. Unstoppable on its own grounds — it closes the
 *  request the founder made — and it names its cause through the one
 *  exhaustive map. */
async function sendNotice(
  lead: LeadRow,
  cause: FirstPageFailure,
  now: Date,
  attempts: number
): Promise<DeliveryOutcome> {
  const store = leadStore();
  await store.patchLead(lead.id, { first_page_failure: cause });

  const mail = buildFirstPageUnavailable({
    email: lead.email,
    causeLine: FIRST_PAGE_UNAVAILABLE_COPY[cause],
  });
  const result = await sendEmail({
    kind: "first-page-unavailable",
    to: lead.email,
    subject: mail.subject,
    blocks: mail.blocks,
    optOut: mail.optOut,
  });

  if (!result.sent) {
    log({ leadId: lead.id, outcome: "notice-not-sent", cause, reason: result.reason, attempts });
    if (isPermanent(result)) return abandon(lead, cause, now);
    return { delivered: "none", cause };
  }

  await store.patchLead(lead.id, { first_page_state: "notice_sent" });
  log({ leadId: lead.id, outcome: "notice-sent", cause, attempts });
  return { delivered: "unavailable-notice", cause };
}

/** The terminal state in which neither of the two things arrived. Nothing
 *  is shown or recorded as delivered. */
async function abandon(
  lead: LeadRow,
  cause: FirstPageFailure,
  now: Date
): Promise<DeliveryOutcome> {
  await leadStore().patchLead(lead.id, {
    first_page_state: "abandoned",
    first_page_failure: cause,
    dropped_at: now.toISOString(),
  });
  log({
    leadId: lead.id,
    outcome: "abandoned",
    cause,
    rule: "REQ-010 c8 — the window closed; nothing is recorded as delivered",
  });
  return { delivered: "none", cause };
}
