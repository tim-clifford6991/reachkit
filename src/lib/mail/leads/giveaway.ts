// BUILD §4.2 — one page, once, or a written message saying why not. The job's, never the visitor's request: ~7¢ on identified leads only.
// Writing the page is §8's, through the port in `ports.ts`; this module maps its two refusals to two causes.
// One page per report (SPEC §2): stored on the scan, written only by the pending lead that claims it; later leads get it free, a retry re-sends.
// Read ADR-041 before adding a suppression check: `first-page` kinds are unstoppable (REQ-010 c3), and their opt-out stops the follow-up, not the page.
// Nothing is recorded as delivered that was not: every advance follows `sent: true`, and `abandoned` says neither owed thing arrived.
import {
  FIRST_PAGE_CLAIM_STALE_MINUTES,
  FIRST_PAGE_RETRY_MINUTES,
  FIRST_PAGE_RETRY_WINDOW_H,
} from "@/lib/config/constants";
import type { CopyKey } from "@/lib/presentation/copy";
import { sendEmail } from "../send";
import { buildFirstPage } from "../templates/first-page";
import { buildFirstPageUnavailable } from "../templates/first-page-unavailable";
import { hoursAfter, minutesAfter } from "./clock";
import { readFirstPageOffer, type FirstPageOffer } from "./offer";
import { writeDraft } from "./ports";
import { scheduleSequence } from "./sequence";
import { leadStore, type LeadRow } from "./store";
import { wireSuppressionReader } from "./wire";

/** The four ways a page can fail to arrive; a fifth is a change to this union and the map below. */
export type FirstPageFailure =
  | "no-page-to-write" // the current report no longer offers one
  | "writing-failed" // §8 could not produce a page
  | "writing-refused" // hard rules or the claim check refused it
  | "delivery-failed"; // the window closed on the page itself

/** Criterion 7's "and why": a `Record`, so a cause with no key fails to compile. The report reads the same map. */
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
  // Cause, retry count and transition; never an address or a page body.
  console.log(JSON.stringify({ event: "lead_first_page", ...a }));
}

function asFailure(value: string | null): FirstPageFailure {
  return value !== null && value in FIRST_PAGE_UNAVAILABLE_COPY
    ? (value as FirstPageFailure)
    : "delivery-failed";
}

/** When the next attempt is due, from stored facts since the job is re-entrant. Never attempted is now; past `FIRST_PAGE_RETRY_MINUTES` is never. */
export function nextAttemptAt(lead: LeadRow): Date | null {
  if (lead.first_page_first_attempt_at === null) return new Date(0);
  const first = new Date(lead.first_page_first_attempt_at);
  const spacing = FIRST_PAGE_RETRY_MINUTES[lead.first_page_attempts - 1];
  if (spacing === undefined) return null;
  return minutesAfter(first, spacing);
}

/** Every lead owed one of the two things and ready for its next attempt. */
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

  // Terminal states are answered from the row, so a second call sends no second page.
  if (lead.first_page_state === "sent") return { delivered: "page" };
  if (lead.first_page_state === "notice_sent") {
    return { delivered: "unavailable-notice", cause: asFailure(lead.first_page_failure) };
  }
  if (lead.first_page_state === "abandoned") {
    return { delivered: "none", cause: asFailure(lead.first_page_failure) };
  }

  // The 24-hour window runs from the stored first attempt; once closed, nothing is attempted or recorded as delivered.
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
    // Could not look is not "nothing worth writing", and must not be told as if it were.
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
    const page = await reportPage(lead, offer, now);
    if (page.kind === "deferred") {
      log({ leadId: lead.id, outcome: "deferred", cause: page.cause, attempts });
      return { delivered: "none", cause: "delivery-failed" };
    }
    if (page.kind === "unavailable") return sendNotice(lead, page.cause, now, attempts);
    title = page.title;
    markdown = page.markdown;
    await store.patchLead(lead.id, {
      first_page_state: "written",
      first_page_title: title,
      first_page_markdown: markdown,
    });
    log({ leadId: lead.id, outcome: page.wrote ? "written" : "reused", attempts });
  }

  if (title === null || markdown === null) {
    // `written` without a page is never produced here; rewriting it would be a second generation.
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
    preheader: mail.preheader,
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

type ReportPage =
  | { kind: "page"; title: string; markdown: string; wrote: boolean }
  | { kind: "unavailable"; cause: FirstPageFailure }
  | { kind: "deferred"; cause: "stored-page-unreadable" | "page-being-written" };

/** The report's one page: stored, or written now by the claimant and stored for later leads. */
async function reportPage(
  lead: LeadRow,
  offer: Extract<FirstPageOffer, { offered: true }>,
  now: Date
): Promise<ReportPage> {
  const store = leadStore();
  const stored = await store.scanFirstPage(lead.scan_id);
  if (!stored.ok) return { kind: "deferred", cause: "stored-page-unreadable" };
  if (stored.page?.state === "written") {
    return { kind: "page", title: stored.page.title, markdown: stored.page.markdown, wrote: false };
  }
  if (stored.page?.state === "refused") return { kind: "unavailable", cause: "no-page-to-write" };

  const claim = await store.claimScanFirstPage(
    lead.scan_id,
    now,
    minutesAfter(now, -FIRST_PAGE_CLAIM_STALE_MINUTES)
  );
  if (!claim.ok || !claim.claimed) return { kind: "deferred", cause: "page-being-written" };

  // The one place the draft port is reached, and only by the claimant.
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
  if (written.written) {
    const settled = await store.settleScanFirstPage(lead.scan_id, {
      state: "written",
      title: written.title,
      markdown: written.markdown,
    });
    if (!settled.ok) log({ leadId: lead.id, outcome: "page-not-stored", scanId: lead.scan_id });
    return { kind: "page", title: written.title, markdown: written.markdown, wrote: true };
  }
  // A refusal is the report's answer and is kept; a failure releases the claim for a later lead.
  await store.settleScanFirstPage(lead.scan_id, { state: written.refused ? "refused" : "released" });
  return { kind: "unavailable", cause: written.refused ? "writing-refused" : "writing-failed" };
}

/** A vendor rejection with no retry window ends the window early, rather than six attempts at an address that never accepts mail. */
function isPermanent(result: { sent: false; reason: string; retryUntil?: Date }): boolean {
  return result.reason === "vendor" && result.retryUntil === undefined;
}

/** Criterion 7's message: unstoppable since it closes the founder's request, naming its cause through the one map. */
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
    preheader: mail.preheader,
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

/** Neither thing arrived; nothing is shown or recorded as delivered. */
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
