// BUILD §4.2 — sweep, then release, then send.
//
// At most one sequence per address at a time, in the order the pages were
// delivered, at most three touches per domain, and nothing at all for an
// address that has opted out or subscribed.
//
// **Read ADR-041 before "fixing" a lead who received no follow-ups.** Two
// of its three landmines are this file's, and both read from inside the
// code exactly like defects:
//
// 1. **A waiting sequence past its deadline is dropped forever.** The sweep
//    runs *before* the release step, on *every* invocation, so the terminal
//    state is reached even on a run that releases nothing. There is no code
//    path from `dropped` to `running`. Releasing them "because they only
//    missed their slot" is one line, and it breaks the only bound REQ-010
//    places on elapsed time: a start no later than 7 days plus a last touch
//    at 168 hours is "no follow-up about a domain ever reaches an address
//    more than 14 days after that domain's page was delivered to it". A
//    released sequence mails a stranger about a scan they have forgotten,
//    which is the mailing-list-I-regret outcome the user story names.
// 2. **A re-delivery starts nothing.** `scheduleSequence` writes nothing
//    when a sequence for `(lower(email), domain)` already exists in any
//    state, running or finished or stopped alike. The second `leads` row
//    keeps a null `sequence_state` forever. It reads as a lost enqueue and
//    is not one: criterion 14's line promises the page "and up to three
//    further emails about that domain", and a second sequence makes it six.
//
// The 14-day guarantee is **arithmetic over two pins**, never a third check
// that could drift from them. Every cadence below comes from
// `src/lib/config/constants.ts`; a literal 24, 72, 168, 3 or 7 in this file
// would be a defect.
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
  // Lead id, domain, transition, touch index, drop reason and suppression
  // outcome — never an address in clear text, and never a page body.
  console.log(JSON.stringify({ event: "lead_sequence", ...a }));
}

/** BP-029's declared entry point. Keyed by `(lower(email), domain)`: a
 *  second delivery of the same domain's page to the same address starts
 *  nothing (criterion 13), and nothing at all is started for a suppressed
 *  address (criterion 11's last limb).
 *
 *  The sequence lives on the lead row whose page was just delivered — the
 *  row `deliverFirstPage` has already stamped `page_delivered_at` on. The
 *  partial unique index is what refuses a second one; this function does
 *  not pre-check for it, because a check is a race and a uniqueness claim
 *  is the database's to hold. A rejected write is swallowed as
 *  success-with-no-effect: it is a legal outcome, never an error to retry. */
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

  // The index refusing a second sequence for this `(address, domain)` is
  // criterion 13 working, not a failure. ADR-041 landmine 2.
  log({
    leadId: target.id,
    domain,
    outcome: patched.conflict ? "already-has-a-sequence" : "not-started",
    rule: patched.conflict ? "REQ-010 c13 (ADR-041)" : "store-refused",
  });
}

/** The nurture job's body. Three steps, in this order and no other, called
 *  from one function so the order is visible in one place. */
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

/** Step 1. Every `waiting` row whose own page was delivered more than
 *  `SEQUENCE_START_DEADLINE_DAYS` ago, to `dropped`. It runs first and on
 *  every invocation, so the terminal state is reached even on a run that
 *  releases nothing — otherwise the stored state is a lie about what is
 *  still due. There is no path back. */
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

/** Step 2. For each address with nothing running, the oldest surviving
 *  `waiting` row by `page_delivered_at`. One at a time, in delivery order,
 *  and never for a suppressed address. */
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

/** Step 3. Every `running` row whose next touch has come round. The offsets
 *  are measured from `sequence_started_at`, not from the previous touch:
 *  criterion 9 fixes them "at 24, 72 and 168 hours after that domain's
 *  sequence begins".
 *
 *  Each row is advanced by `advanceLead` — the same function the
 *  `lead/nurture` job reaches through `advanceOneTouch`, so the sweep and
 *  the job cannot come to disagree about what one touch does. */
async function sendDueTouches(now: Date): Promise<number> {
  const store = leadStore();
  const read = await store.leadsInSequenceState(["running"]);
  if (!read.ok) return 0;

  let sent = 0;
  for (const lead of read.leads) {
    // The sweep asks the stored clock whether this row is due; the job is
    // told by the event's own arrival (see `advanceOneTouch`).
    if (lead.next_touch_at === null) continue;
    if (new Date(lead.next_touch_at).getTime() > now.getTime()) continue;
    const outcome = await advanceLead(lead, now, null);
    if (outcome.advanced) sent += 1;
  }
  return sent;
}

/** What one touch did. Every arm is a state the caller may be told about;
 *  none of them pretends a mail went out that did not. */
export type TouchOutcome =
  | { advanced: true; touch: number; nextTouchAt: Date | null }
  | {
      advanced: false;
      reason:
        /** No such lead, or a store that could not be read. */
        | "no-lead"
        /** The sequence is not running — never started, dropped, stopped or
         *  already finished. */
        | "not-running"
        /** The event is for a touch this sequence has already recorded, or
         *  for one it has not reached. Per-touch dedupe: a re-run sends
         *  nothing (REQ-010 c9). */
        | "already-recorded"
        /** REQ-010 c10 — they bought. */
        | "converted"
        /** REQ-010 c10/c11 — they opted out, or subscribed. */
        | "suppressed"
        /** Three touches have gone; there is no fourth. */
        | "finished"
        /** The send seam refused the mail — an unwritten line, a stopped
         *  preference, or the vendor. Nothing was recorded, so the touch is
         *  still owed. */
        | "not-sent";
    };

/**
 * One lead, one touch — the body both the sweep and the `lead/nurture` job
 * run.
 *
 * `expected` is the touch index the caller believes this sequence is on, or
 * `null` for the sweep, which takes the row's own position as given. The
 * job passes the index its event carries: `(leadId, touchIndex)` is
 * per-touch dedupe **inside** a sequence and never the sequence key, which
 * stays the `(lower(email), domain)` partial unique index. A second
 * delivery of the same event finds `touch_count` already past it and sends
 * nothing.
 */
async function advanceLead(
  lead: LeadRow,
  now: Date,
  expected: number | null
): Promise<TouchOutcome> {
  const store = leadStore();

  if (lead.sequence_state !== "running") {
    return { advanced: false, reason: "not-running" };
  }

  // REQ-010 c10 — "stops on convert". The row is stopped with its cause
  // rather than left labelled `running` and skipped on every later run: the
  // stored state is otherwise a lie about what is still due.
  if (lead.converted_at !== null) {
    await store.patchLead(lead.id, { sequence_state: "stopped", next_touch_at: null });
    log({ leadId: lead.id, domain: lead.domain, outcome: "stopped", cause: "converted", rule: "REQ-010 c10" });
    return { advanced: false, reason: "converted" };
  }

  // A subscribe or an opt-out between two invocations stops the row here
  // rather than leaving it labelled `running` and sending nothing every
  // time the job runs. The send seam would refuse the mail anyway; this is
  // the label converging on the fact.
  const suppression = await suppressionState(lead.email);
  if (suppression !== "send") {
    await store.patchLead(lead.id, { sequence_state: "stopped", next_touch_at: null });
    log({ leadId: lead.id, domain: lead.domain, outcome: "stopped", cause: suppression, rule: "REQ-010 c10/c11" });
    return { advanced: false, reason: "suppressed" };
  }

  // The position: touch `n` is sent while `touch_count` is still `n`. An
  // event naming any other index is a duplicate or an out-of-order delivery
  // and sends nothing.
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
    // Nothing is recorded: the touch is still owed, and a later run may
    // still send it. An unwritten line is the owner's debt (DECISIONS
    // 2026-09-05 — "a mail never ships a placeholder"), not a reason to
    // mark this touch done.
    log({ leadId: lead.id, domain: lead.domain, outcome: "touch-not-sent", reason: result.reason });
    return { advanced: false, reason: "not-sent" };
  }

  const count = lead.touch_count + 1;
  const done = count >= NURTURE_MAX_TOUCHES;
  const started = new Date(lead.sequence_started_at ?? now.toISOString());
  // Criterion 9's offsets, measured from the sequence's start and taken
  // from `NURTURE_H` — a literal 24, 72 or 168 here would be a defect.
  const nextTouchAt = done ? null : hoursAfter(started, NURTURE_H[count] as number);
  await store.patchLead(lead.id, {
    touch_count: count,
    sequence_state: done ? "finished" : "running",
    next_touch_at: nextTouchAt === null ? null : nextTouchAt.toISOString(),
  });
  log({ leadId: lead.id, domain: lead.domain, outcome: "touch-sent", touch: count });
  return { advanced: true, touch: count, nextTouchAt };
}

/**
 * BP-029's per-touch entry point — what `src/jobs/engine.ts`'s
 * `advanceSequence()` calls, and through it the `lead/nurture` job.
 *
 * **Due-ness is the event's, not the row's.** The sweep reads
 * `next_touch_at` to decide whether a touch has come round; here the
 * platform's own delay is what scheduled the delivery, so the event
 * arriving *is* the due-ness. Re-checking the stored clock would lose a
 * touch forever to a second of skew — there is no re-delivery for a touch
 * this function declines. What stops a double send is the position check,
 * which is exact.
 */
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
