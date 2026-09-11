// src/lib/account/billing/access-gate.ts — BUILD §13 · ADR-050
//
// **Billing registering itself as the one answer to "who has active
// access".**
//
// `src/lib/scan/weekly/access.ts` declares a seam and throws while nothing
// is registered — the honest answer, because a default of "yes" measures
// sites nobody is paying for and a default of "no" tells a paying customer
// their week is not owed. It has thrown since it was written: nothing in
// `src/**` called `registerActiveAccessGate`, so the Monday tick could not
// run for a real customer at all (issue #180).
//
// This file is the missing call, and it lives here because ADR-050 puts
// the rule here: "Active access is `users.paid_through > now()` alone;
// `plan_status` is recorded and never read by the gate." The gate below
// holds no second expression of that — it asks `hasActiveAccess()`, the
// one reader, once per site.
//
// **Once per site, not one batched query.** The seam takes a set so that
// the weekly tick asks *the gate* once per tick rather than once per site,
// and that is what it does. Underneath, each answer is `hasActiveAccess()`,
// whose whole body is ADR-050's sentence: a batched `paid_through > now()`
// here would be a second place the rule is written, and the second place is
// the one that drifts when a clause looks like a tightening. The reads run
// together and each is one indexed row (`hasActiveAccess`'s own budget is
// p95 ≤ 10 ms); the candidate set is the sites due in one hour, in one
// zone.
//
// **The seam is imported by file, never through `@/lib/scan/weekly`.**
// `access.ts` imports nothing at all, where the barrel re-exports the
// selection, the measurement and the week account — and through them
// `@/lib/db`. This module is on `@/lib/account/billing`'s public interface,
// which `hasActiveAccess()` puts on the import graph of surfaces all over
// the product, so dragging a database client behind it would be paid for
// everywhere and needed nowhere.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-07: The billing access gate is installed at boot from billing's own
//   module, first in instrumentation register() and before the vendor read, and the install
//   throws (not logs) if a reader on the module graph gets no answer; the gate asks
//   hasActiveAccess() once per site (never a second paid_through > now()); a sites row with no
//   joined owner or date fails closed to no access. — #188

import { registerActiveAccessGate, sitesWithActiveAccess } from "@/lib/scan/weekly/access";
import { hasActiveAccess } from "./gate";

/** Which of these sites' owners have active access right now — ADR-050's
 *  rule, asked once per site through the one reader of it. */
async function activeAccessForSites(siteIds: readonly string[]): Promise<ReadonlySet<string>> {
  const decided = await Promise.all(
    siteIds.map(async (siteId) => [siteId, await hasActiveAccess(siteId)] as const)
  );
  return new Set(decided.filter(([, active]) => active).map(([siteId]) => siteId));
}

/**
 * Registers the gate, and proves it took.
 *
 * Called once from the application's boot path (`src/instrumentation.ts`,
 * Node runtime only). The probe afterwards is not ceremony: it asks the
 * question through **the same door the weekly selection uses**, with an
 * empty set — which `sitesWithActiveAccess` answers without reaching a
 * database — so what is established is that a reader on this module graph
 * gets an answer rather than a throw. The failure it catches is a boot that
 * registered into one instance of `access.ts` while the jobs route reads
 * another; the symptom of that, without this, is a Monday tick that throws
 * in production and nowhere else.
 *
 * It throws rather than logging. Instrumentation's own line is between a
 * fact this deployment can establish and a vendor it could not reach: this
 * is the first kind — local, needing nobody — so a deployment that cannot
 * decide who pays does not start.
 */
export async function installActiveAccessGate(): Promise<void> {
  registerActiveAccessGate(activeAccessForSites);
  await sitesWithActiveAccess("installActiveAccessGate", []);
}
