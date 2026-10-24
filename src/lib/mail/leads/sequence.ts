// BUILD §4.2 — sweep, then release, then send: one sequence per address at a time, in delivery order, at most three touches a domain,
// and none for an address that opted out or subscribed. Read ADR-041 before "fixing" a lead who got no follow-ups:
// 1. A waiting sequence past its deadline is dropped forever, swept first on every run. Releasing it breaks REQ-010's bound that no
//    follow-up reaches an address more than 14 days after its page was delivered.
// 2. A re-delivery starts nothing: an existing `(lower(email), domain)` sequence in any state blocks a second, which would make six mails.
// The 14 days are arithmetic over pins in `src/lib/config/constants.ts`; a literal cadence here is a defect.
import {
  NURTURE_H,
  NURTURE_MAX_TOUCHES,
  SEQUENCE_START_DEADLINE_DAYS,
} from "@/lib/config/constants";
import { buildNurture, type NurtureTouch } from "../templates/nurture";
import { sendEmail } from "../send";
import { daysAfter, hoursAfter } from "./clock";
import { leadStore, type LeadRow } from "./store";
import { normaliseAddress, suppressionState } from "./suppress";
import { wireSuppressionReader } from "./wire";

function log(a: Record<string, unknown>): void {
  // Ids, transition, touch index and outcomes; never an address or a page body.
  console.log(JSON.stringify({ event: "lead_sequence", ...a }));
}

/** Keyed by `(lower(email), domain)`: a second delivery starts nothing (criterion 13), nor does a suppressed address (criterion 11).
 *  The partial unique index refuses the second, not a racy pre-check; a rejected write is success with no effect. */
export async function scheduleSequence(a: {
  email: string;
  domain: string;
  deliveredAt: Date;
}): Promise<void> {
  const email = normaliseAddress(a.email);
  const domain = a.domain.toLowerCase();

  const suppression = await suppressionState(email);
  if (suppression !== "send") {
    log({ outcome: "not-started", domain, reason: suppression, rule: "REQ-010 c11" });
    return;
  }

  const read = await leadStore().leadsForAddress(email);
  if (!read.ok) {
    log({ outcome: "not-started", domain, reason: "store-unreadable" });
    return;
  }

  const forDomain = read.leads.filter((lead) => lead.domain === domain);
  const delivered = forDomain
    .filter((lead) => lead.page_delivered_at !== null)
    .sort((left, right) => (left.page_delivered_at ?? "") < (right.page_delivered_at ?? "") ? 1 : -1);

  const target = delivered[0];
  if (target === undefined) {
    log({ outcome: "not-started", domain, reason: "no-delivered-page" });
    return;
  }

  const patched = await leadStore().patchLead(target.id, {
    sequence_state: "waiting",
    page_delivered_at: a.deliveredAt.toISOString(),
    touch_count: 0,
  });

  if (patched.ok) {
    log({ leadId: target.id, domain, outcome: "waiting" });
    return;
  }

  // The index refusing a second sequence is criterion 13 working (ADR-041 landmine 2).
  log({
    leadId: target.id,
    domain,
    outcome: patched.conflict ? "already-has-a-sequence" : "not-started",
    rule: patched.conflict ? "REQ-010 c13 (ADR-041)" : "store-refused",
  });
}

/** The nurture job's body: three steps, in this order only, in one place. */
export async function advanceSequences(now: Date): Promise<{
  dropped: number;
  released: number;
  sent: number;
}> {
  wireSuppressionReader();
  const dropped = await sweep(now);
  const released = await release(now);
  const sent = await sendDueTouches(now);
  return { dropped, released, sent };
}

/** Step 1: `waiting` rows past `SEQUENCE_START_DEADLINE_DAYS` go to `dropped`, first and on every run, so the stored state is true. No path back. */
async function sweep(now: Date): Promise<number> {
  const store = leadStore();
  const read = await store.leadsInSequenceState(["waiting"]);
  if (!read.ok) return 0;

  let dropped = 0;
  for (const lead of read.leads) {
    if (lead.page_delivered_at === null) continue;
    const deadline = daysAfter(new Date(lead.page_delivered_at), SEQUENCE_START_DEADLINE_DAYS);
    if (deadline.getTime() >= now.getTime()) continue;

    const patched = await store.patchLead(lead.id, {
      sequence_state: "dropped",
      dropped_at: now.toISOString(),
      next_touch_at: null,
    });
    if (!patched.ok) continue;
    dropped += 1;
    log({
      leadId: lead.id,
      domain: lead.domain,
      outcome: "dropped",
      reason: "start deadline passed",
      rule: "REQ-010 c12 (ADR-041) — dropped forever; there is no path back to running",
    });
  }
  return dropped;
}

/** Step 2: for each address with nothing running, its oldest `waiting` row by delivery, never for a suppressed address. */
async function release(now: Date): Promise<number> {
  const store = leadStore();
  const read = await store.leadsInSequenceState(["waiting", "running"]);
  if (!read.ok) return 0;

  const byAddress = new Map<string, LeadRow[]>();
  for (const lead of read.leads) {
    const address = lead.email.toLowerCase();
    const bucket = byAddress.get(address);
    if (bucket === undefined) byAddress.set(address, [lead]);
    else bucket.push(lead);
  }

  let released = 0;
  for (const [address, leads] of byAddress) {
    if (leads.some((lead) => lead.sequence_state === "running")) continue;

    const waiting = leads
      .filter((lead) => lead.sequence_state === "waiting" && lead.page_delivered_at !== null)
      .sort((left, right) => (left.page_delivered_at ?? "").localeCompare(right.page_delivered_at ?? ""));

    const next = waiting[0];
    if (next === undefined) continue;

    // A sequence never begins before its own page was delivered.
    if (new Date(next.page_delivered_at as string).getTime() > now.getTime()) continue;

    if ((await suppressionState(address)) !== "send") {
      log({ leadId: next.id, domain: next.domain, outcome: "not-released", rule: "REQ-010 c11" });
      continue;
    }

    const patched = await store.patchLead(next.id, {
      sequence_state: "running",
      sequence_started_at: now.toISOString(),
      touch_count: 0,
      next_touch_at: hoursAfter(now, NURTURE_H[0]).toISOString(),
    });
    if (!patched.ok) continue;
    released += 1;
    log({ leadId: next.id, domain: next.domain, outcome: "running" });
  }
  return released;
}

/** Step 3: every `running` row whose touch is due, measured from `sequence_started_at` (criterion 9: 24, 72 and 168 hours).
 *  Through `advanceLead`, as the `lead/nurture` job is, so the two cannot disagree on what a touch does. */
async function sendDueTouches(now: Date): Promise<number> {
  const store = leadStore();
  const read = await store.leadsInSequenceState(["running"]);
  if (!read.ok) return 0;

  let sent = 0;
  for (const lead of read.leads) {
    // The sweep asks the stored clock; the job is told by its event's arrival.
    if (lead.next_touch_at === null) continue;
    if (new Date(lead.next_touch_at).getTime() > now.getTime()) continue;
    const outcome = await advanceLead(lead, now, null);
    if (outcome.advanced) sent += 1;
  }
  return sent;
}

/** What one touch did; no arm pretends a mail went out that did not. */
export type TouchOutcome =
  | { advanced: true; touch: number; nextTouchAt: Date | null }
  | {
      advanced: false;
      reason:
        /** No such lead, or a store that could not be read. */
        | "no-lead"
        /** Not running: never started, dropped, stopped or finished. */
        | "not-running"
        /** Already recorded or not yet reached: per-touch dedupe, so a re-run sends nothing (REQ-010 c9). */
        | "already-recorded"
        /** REQ-010 c10 — they bought. */
        | "converted"
        /** REQ-010 c10/c11 — they opted out, or subscribed. */
        | "suppressed"
        /** Three touches have gone; there is no fourth. */
        | "finished"
        /** The seam refused (unwritten line, stopped preference, vendor); nothing recorded, so the touch is still owed. */
        | "not-sent";
    };

/** One lead, one touch, run by the sweep and the job. `expected` is the caller's touch index (`null` for the sweep);
 *  `(leadId, touchIndex)` dedupes inside a sequence, whose key stays the `(lower(email), domain)` index. */
async function advanceLead(
  lead: LeadRow,
  now: Date,
  expected: number | null
): Promise<TouchOutcome> {
  const store = leadStore();

  if (lead.sequence_state !== "running") {
    return { advanced: false, reason: "not-running" };
  }

  // REQ-010 c10, "stops on convert": stopped with its cause, so the stored state is true.
  if (lead.converted_at !== null) {
    await store.patchLead(lead.id, { sequence_state: "stopped", next_touch_at: null });
    log({ leadId: lead.id, domain: lead.domain, outcome: "stopped", cause: "converted", rule: "REQ-010 c10" });
    return { advanced: false, reason: "converted" };
  }

  // A subscribe or opt-out between runs stops the row, so the label converges on the fact.
  const suppression = await suppressionState(lead.email);
  if (suppression !== "send") {
    await store.patchLead(lead.id, { sequence_state: "stopped", next_touch_at: null });
    log({ leadId: lead.id, domain: lead.domain, outcome: "stopped", cause: suppression, rule: "REQ-010 c10/c11" });
    return { advanced: false, reason: "suppressed" };
  }

  // Touch `n` is sent while `touch_count` is `n`; any other index is a duplicate or out of order.
  if (expected !== null && expected !== lead.touch_count) {
    log({
      leadId: lead.id,
      domain: lead.domain,
      outcome: "touch-not-sent",
      reason: "already-recorded",
      touch: expected,
      at: lead.touch_count,
    });
    return { advanced: false, reason: "already-recorded" };
  }

  const touch = (lead.touch_count + 1) as NurtureTouch;
  if (touch > NURTURE_MAX_TOUCHES) {
    await store.patchLead(lead.id, { sequence_state: "finished", next_touch_at: null });
    return { advanced: false, reason: "finished" };
  }

  const mail = buildNurture({ email: lead.email, domain: lead.domain, touch });
  const result = await sendEmail({
    kind: "nurture",
    to: lead.email,
    subject: mail.subject,
    blocks: mail.blocks,
    reason: mail.reason,
    optOut: mail.optOut,
  });

  if (!result.sent) {
    // Nothing recorded: the touch is still owed, since a mail never ships a placeholder.
    log({ leadId: lead.id, domain: lead.domain, outcome: "touch-not-sent", reason: result.reason });
    return { advanced: false, reason: "not-sent" };
  }

  const count = lead.touch_count + 1;
  const done = count >= NURTURE_MAX_TOUCHES;
  const started = new Date(lead.sequence_started_at ?? now.toISOString());
  // Criterion 9's offsets from the start, from `NURTURE_H`.
  const nextTouchAt = done ? null : hoursAfter(started, NURTURE_H[count] as number);
  await store.patchLead(lead.id, {
    touch_count: count,
    sequence_state: done ? "finished" : "running",
    next_touch_at: nextTouchAt === null ? null : nextTouchAt.toISOString(),
  });
  log({ leadId: lead.id, domain: lead.domain, outcome: "touch-sent", touch: count });
  return { advanced: true, touch: count, nextTouchAt };
}

/** The per-touch entry point the `lead/nurture` job reaches through `src/jobs/engine.ts`'s `advanceSequence()`.
 *  The event's arrival is the due-ness: re-checking the stored clock would lose a touch to skew; the position check stops a double send. */
export async function advanceOneTouch(a: {
  leadId: string;
  touchIndex: number;
  now: Date;
}): Promise<TouchOutcome> {
  wireSuppressionReader();
  const read = await leadStore().readLead(a.leadId);
  if (!read.ok || read.lead === null) {
    log({ leadId: a.leadId, outcome: "touch-not-sent", reason: "no-lead" });
    return { advanced: false, reason: "no-lead" };
  }
  return advanceLead(read.lead, a.now, a.touchIndex);
}
