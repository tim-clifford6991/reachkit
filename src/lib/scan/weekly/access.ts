// BUILD §11 — the one gate this module asks, and no second definition of it
//
// ADR-050: "Active access is `users.paid_through > now()` alone;
// `plan_status` is recorded and never read by the gate." That reader is
// `hasActiveAccess()` in `src/lib/account/billing/`, which issue #34
// builds; neither the module nor `users.paid_through` is on disk yet, and
// `eslint.config.mjs`'s `no-billing-internal-import` already fences the
// column off from everything but billing's own public interface.
//
// So this file does what `src/lib/scan/correction.ts` does for the
// pipeline it could not yet call: it declares the one seam the gate
// registers itself through, and **answers honestly while nothing is
// registered** — it throws. It does not read `plan_status`, it does not
// invent a `paid_through` of its own, and it does not default to "yes"
// (which would measure, and bill us for, sites nobody is paying for) or to
// "no" (which would tell a paying customer their week is not owed).
// Selecting sites to spend money on is not a place for a guess.
//
// One member, taking a set: the weekly tick asks about every due site at
// once, so the gate is asked once per tick rather than once per site.

/** The gate, as the weekly measurement needs it: which of these sites'
 *  owners have active access right now. Implemented by
 *  `src/lib/account/billing`'s `hasActiveAccess()` (#34) and by nothing
 *  else — this module holds no second definition of active. */
export type ActiveAccessGate = (siteIds: readonly string[]) => Promise<ReadonlySet<string>>;

let gate: ActiveAccessGate | null = null;

/** Registered once, by billing, at its own module load. `null` clears it,
 *  which is what a test does when it is finished with its double. */
export function registerActiveAccessGate(fn: ActiveAccessGate | null): void {
  gate = fn;
}

export class ActiveAccessGateNotRegistered extends Error {
  constructor(caller: string) {
    super(
      `src/lib/scan/weekly/access.ts: ${caller} asked which sites have active access ` +
        "before billing registered the gate (ADR-050, issue #34). Nothing here may " +
        "answer that question on billing's behalf."
    );
    this.name = "ActiveAccessGateNotRegistered";
  }
}

/** Throws where nothing is registered — loudly, so a deployment that ticks
 *  before billing exists fails visibly instead of measuring the wrong set
 *  of sites and reporting a quiet success. */
export async function sitesWithActiveAccess(
  caller: string,
  siteIds: readonly string[]
): Promise<ReadonlySet<string>> {
  if (gate === null) throw new ActiveAccessGateNotRegistered(caller);
  if (siteIds.length === 0) return new Set();
  return gate(siteIds);
}
