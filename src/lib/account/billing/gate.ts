// src/lib/account/billing/gate.ts — BUILD §13
//
// **THE access gate. Read ADR-050 before changing anything in this file.**
//
// ADR-050, verbatim: "Active access is `users.paid_through > now()` alone;
// `plan_status` is recorded and never read by the gate." The body below is
// that sentence and nothing else — one column, one comparison, resolved
// through `sites.user_id`. No `plan_status`, no `cancelled_at`, no
// `deleted_at`, no vendor call.
//
// The obvious improvement — "and the subscription is actually active" — is
// the bug. It is one clause to add, it reads like a tightening, and it is
// invisible in every test written with a live subscription. What it
// actually does is take a cancelled customer's remaining paid month away
// from them (REQ-076 c3: "measurement, generation and publishing continue
// unchanged until that date") and cut off a customer whose renewal card
// bounced (REQ-076 c8: "whether or not its latest renewal was paid"). Both
// are promises the product sells on. `tests/account/billing/gate.test.ts`
// is written so that adding the clause fails.
//
// Deletion is not an exception to the rule either: it moves `paid_through`
// to `now()`, so this expression turns false at the moment of deletion
// without knowing that deletion exists (REQ-079 c6, another issue's write).
//
// **It fails closed.** A store that cannot be read answers `false`. The
// three loops that call this — weekly re-measurement, daily generation,
// publishing — all *spend money* on a `true`, and spending a departed
// customer's money because a read failed is the worse of the two errors.
// The failure is loud in its own way: the tick reports a degraded run.
import { billingStore } from "./store";

/** REQ-076 criterion 8 — THE access gate. See ADR-050 before changing this.
 *
 *  One indexed read of `users.paid_through` through `sites.user_id`; p95
 *  ≤ 10 ms, because three subsystems call it per unit of scheduled work. */
export async function hasActiveAccess(siteId: string): Promise<boolean> {
  const read = await billingStore().paidThroughForSite(siteId);
  if (!read.ok || read.paidThrough === null) return false;
  return read.paidThrough.getTime() > Date.now();
}
