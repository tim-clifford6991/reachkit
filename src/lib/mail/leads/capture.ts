// BUILD §4.2 — one insert, confirmed only after it commits.
//
// The control this backs asks for an email address and nothing else: no
// account, no password, no payment, no further field, and the argument type
// is what says so — none of them is representable in the call.
//
// **Fail closed.** The confirmation is the last statement in the function,
// so no code path can confirm a capture that did not commit: a store that
// will not take the row means the submission is refused in writing and
// nothing is confirmed (REQ-003 c10). This is the opposite of the scan
// limiter, which fails **open** — `SPEC.md` §11's asymmetry, deliberate in
// both directions: letting an extra stranger scan costs a few cents, while
// telling a founder their address was taken when it was not costs them the
// page they traded it for.
//
// **Nothing else happens on the visitor's request.** No model call, no
// vendor round trip, no queue. Writing the page costs ~7¢ and is spent in
// the job, on identified leads only (`SPEC.md` §4.2), which is also why
// the confirmation can only ever state that the address was accepted —
// the one thing true at that moment.
//
// **Read ADR-041 before adding a suppression check here.** Capture does not
// consult `email_suppressions`. A suppressed address that submits the
// control for a different domain still gets that domain's page: REQ-010 c3
// against c11, and the mechanism that makes it so is the `stoppable: false`
// register row, not a branch in this file.
import { leadStore } from "./store";
import { normaliseAddress } from "./suppress";

/** Form only, and deliberately little of it: one `@`, something either
 *  side of it, a dot in the domain part, no whitespace. Whether an address
 *  accepts mail is not knowable here and is not this function's question —
 *  a bounce is criterion 8's, handled where the mail is sent. Anything
 *  stricter refuses real addresses, which costs a founder their page. */
const ADDRESS_FORM = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export type CaptureResult =
  | { captured: true; leadId: string }
  | { captured: false; reason: "invalid-address" | "unavailable" };

export async function captureLead(a: {
  scanId: string;
  email: string;
}): Promise<CaptureResult> {
  const email = normaliseAddress(a.email);
  if (!ADDRESS_FORM.test(email)) return { captured: false, reason: "invalid-address" };

  const store = leadStore();

  // The domain is written onto the lead here and is read-only thereafter
  // (BP-029 decision 1): the sequence's natural key is
  // `(lower(email), domain)` and a unique index cannot reach through
  // `scan_id` to `scans.domain`.
  const scan = await store.scanDomain(a.scanId);
  if (!scan.ok || scan.domain === null) {
    // A scan we cannot read and a scan that is not there are both "we
    // cannot take this submission", which is the `unavailable` arm — the
    // union has two reasons and neither of these is the visitor's address
    // being malformed. The cause is logged so the two stay distinguishable
    // to us without inventing a third thing to tell the visitor.
    console.warn(
      JSON.stringify({
        event: "lead_capture_refused",
        cause: scan.ok ? "scan-absent" : "scan-unreadable",
        scanId: a.scanId,
      })
    );
    return { captured: false, reason: "unavailable" };
  }

  const inserted = await store.insertLead({
    scanId: a.scanId,
    email,
    domain: scan.domain.toLowerCase(),
  });
  if (!inserted.ok) {
    console.warn(JSON.stringify({ event: "lead_capture_refused", cause: "insert-failed" }));
    return { captured: false, reason: "unavailable" };
  }

  // Last statement in the function, and after the write: the row exists.
  return { captured: true, leadId: inserted.id };
}
