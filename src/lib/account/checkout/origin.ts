// src/lib/account/checkout/origin.ts — BUILD §13
//
// Where the buyer came from, and whether checkout may start from there.
//
// §13: "Stripe Checkout from the report (scan id in metadata) or any price
// surface (scanless — no fabricated scan id)." The `pricing` arm carries no
// `scanId` field at all, so a scanless surface cannot fabricate one: that
// sentence is a property of this type rather than of a call site's
// discipline. The type is unchanged from the seam issue #19 was written
// against.
//
// The scan's status is re-read here, server-side, rather than trusted from
// whatever the page thought when it rendered: a tab left open while a scan
// was still running would otherwise start checkout against a report that
// does not exist. A `degraded` pass still produced a report, so it resolves
// like `done`.
import { accountStore, type ScanStatus } from "../store";

/** Where the buyer came from. Unchanged from the declared seam. */
export type CheckoutOrigin = { kind: "report"; scanId: string } | { kind: "pricing" };

export type ResolvedOrigin =
  | { ok: true; scanId: string | null; domain: string | null }
  | { ok: false; reason: "origin_scan_incomplete" };

/** The statuses that mean a report exists to buy from. Written as a set
 *  over the whole union so a fifth status is a decision, never a default
 *  branch that quietly admits it. */
const HAS_REPORT: Readonly<Record<ScanStatus, boolean>> = Object.freeze({
  running: false,
  done: true,
  degraded: true,
  failed: false,
});

export async function resolveOrigin(origin: CheckoutOrigin): Promise<ResolvedOrigin> {
  // A price surface resolves with no read at all: there is nothing to check
  // and nothing a read could supply.
  if (origin.kind === "pricing") return { ok: true, scanId: null, domain: null };

  const read = await accountStore().scan(origin.scanId);
  // An unreadable store and a missing scan are both "no report we can see",
  // and neither may start a checkout that claims one.
  if (!read.ok || read.scan === null) return { ok: false, reason: "origin_scan_incomplete" };
  if (!HAS_REPORT[read.scan.status]) return { ok: false, reason: "origin_scan_incomplete" };

  return { ok: true, scanId: origin.scanId, domain: read.scan.domain };
}
