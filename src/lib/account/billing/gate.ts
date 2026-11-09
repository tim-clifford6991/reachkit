// src/lib/account/billing/gate.ts — BUILD §13
//
// **THE access gate.** Paid means `users.paid_through > now()` and a
// recorded `plan_status` other than `past_due`: paid through today, with no
// outstanding invoice (`docs/spec/decisions/2026-11-09-2525.md`). Both
// columns are read in the one row read, through `sites.user_id`. No vendor
// call.
//
// `canceled` is not in the clause: a cancelled customer owes nothing and
// keeps the month they paid for (REQ-076 c3). Deletion moves `paid_through`
// to `now()`, so this turns false at that instant without knowing deletion
// exists. Hosted serving keeps its own, longer rule (`hosted-serving.ts`).
//
// **It fails closed.** A store that cannot be read answers `false`. The
// three loops that call this — weekly re-measurement, daily generation,
// publishing — all *spend money* on a `true`, and spending a departed
// customer's money because a read failed is the worse of the two errors.
// The failure is loud in its own way: the tick reports a degraded run.
import { billingStore } from "./store";

/** THE access gate: paid through today, with no outstanding invoice.
 *
 *  One indexed read through `sites.user_id`, by the same filter the count
 *  below uses; p95 ≤ 10 ms, because three subsystems call it per unit of
 *  scheduled work. */
export async function hasActiveAccess(siteId: string): Promise<boolean> {
  const read = await billingStore().payingSiteCount(new Date(), siteId);
  return read.ok && read.count > 0;
}

/** Which of these sites' owners have active access right now, asked once
 *  per site through the gate above. */
export async function sitesWithActiveAccess(siteIds: readonly string[]): Promise<ReadonlySet<string>> {
  const decided = await Promise.all(siteIds.map(async (siteId) => [siteId, await hasActiveAccess(siteId)] as const));
  return new Set(decided.filter(([, active]) => active).map(([siteId]) => siteId));
}

/** How many sites had active access at `at`, by the same comparison. Throws
 *  where the store cannot answer: the spend ceiling's reader falls back to
 *  its smallest day, and a count of 0 would be a guess. */
export async function payingSitesAt(at: Date): Promise<number> {
  const read = await billingStore().payingSiteCount(at);
  if (!read.ok) throw new Error("paying sites unreadable");
  return read.count;
}
