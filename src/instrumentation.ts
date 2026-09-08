// BUILD §15 — the application's one boot path.
//
// Next calls `register()` **once** when a server instance is initiated, and
// it must complete before that instance handles a request
// (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`).
// That is the shape BP-005 asks for and `src/lib/config/env.ts` states in
// its own header: "a deployment cannot start half-configured". Until now
// nothing said it at boot — `env` threw whenever the first route that
// imported it was loaded, and the checkout module's boot hook (#123) had no
// caller at all.
//
// **Why the instrumentation hook and not the jobs `serve()` bootstrap.**
// `serve()` is not a separate process: `src/jobs/index.ts` is mounted by
// `src/app/api/jobs/[[...slug]]/route.ts`, one route inside this same Next
// application. Wiring the assertion there would run it when that route's
// module is first loaded, which is neither "at boot" nor everywhere — the
// surfaces that actually start a checkout (`/pricing`, the report's offer,
// `/api/stripe/webhook`) can be served by an instance that never loads the
// jobs route, and would be exactly the half-configured deployment this
// closes. It would also put an engine-configuration check inside a
// transport adapter, which ARCHITECTURE rule 1 forbids. The hook runs for
// every surface, once, before any of them answers.
//
// **What fails the boot, and what does not.** The line is between a fact
// this deployment can establish and a vendor it could not reach:
//
//  - A binding that does not parse throws out of `register()` — `env` is
//    local, needs nobody, and is BP-005's own promise.
//  - **Billing's access gate not taking** throws out of `register()`
//    (issue #180). ADR-050 puts "who has active access" in billing, and
//    `src/lib/scan/weekly/access.ts` throws while nothing is registered
//    rather than guess — so a deployment that boots without the
//    registration cannot run a Monday tick for any customer. Registering
//    is local and needs nobody, so it is asserted like `env` and not like
//    the price: it is done first, before the vendor read, because the
//    vendor arm below may return early and a gate registered after that
//    return would be a gate registered on some boots only.
//  - **The deleted-account mail's WordPress place port not being wired**
//    is registered here and does not throw (issue #160). The seam in
//    `src/lib/account/lifecycle/left-in-wordpress.ts` answers "no place"
//    while nothing is registered, which is a true answer rather than a
//    broken one — every sentence still carries its count — so an
//    unregistered port costs one mail its link and nothing else. It is
//    registered beside the gate because it is the same kind of fact: local,
//    needing nobody, and done before the vendor arm that may return early.
//  - A live Price that **differs from `PRICE_OBJECT_SPEC`** throws out of
//    `register()`, carrying `PriceObjectMismatch`'s own message: the field,
//    what was expected, what was found. A deployment that would charge
//    against a price this repository does not describe does not start.
//  - A vendor that could not be read at all is logged and does not stop the
//    boot. Every scaled instance runs this hook on its cold start, so a
//    hard dependency on one live Stripe round-trip would turn a Stripe
//    outage into an outage of screens that take no payment — and it would
//    assert nothing either way, because a read that did not happen has
//    established nothing about the price. `verifyPrice()` already keeps
//    those two apart under the same names (`mismatch` / `vendor`); this
//    hook keeps them apart for the same reason.
//
// The module holds no invariant of its own — it calls the one the checkout
// module owns (`src/lib/account/checkout/boot.ts`) and knows nothing about
// what is being asserted.

/** One structured line, the shape `src/app/api/_log.ts` uses. Every field
 *  is a name from a closed set — never a binding's value, never a vendor
 *  payload, never the price id. */
function log(
  check: "checkout" | "access-gate" | "stamp-place" | "clock",
  outcome: "checked" | "unchecked",
  reason?: string
): void {
  const line = { event: "boot_invariants", check, outcome, ...(reason === undefined ? {} : { reason }) };
  if (outcome === "unchecked") console.error(JSON.stringify(line));
  else console.log(JSON.stringify(line));
}

/**
 * Next's boot hook. Called in every runtime, so the work is guarded on the
 * Node.js one: the assertion reads server-only bindings and the payment
 * vendor's SDK, neither of which belongs in an edge bundle. The imports are
 * inside the guard for the same reason — the guide's own recommendation,
 * and here it is load-bearing rather than tidy.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // The clock binding, before anything else asserts anything (issue #305).
  // `RK_FIXED_NOW` freezes what every surface calls today — it is what lets
  // the layout sweep photograph screens whose content is a function of the
  // date — and a real deployment carrying one would serve a date that is not
  // the date. It is local and needs nobody, so it is asserted like `env`:
  // the process does not start.
  const { assertClockBinding } = await import("@/lib/config/now");
  assertClockBinding();
  log("clock", "checked");

  // ADR-050's gate, first: it is local, it needs nobody, and the vendor arm
  // below returns early on an unreadable Stripe. A registration after that
  // return would hold on the boots where Stripe answered and not on the
  // others, which is exactly the half-configured deployment this hook
  // closes.
  const { installActiveAccessGate } = await import("@/lib/account/billing");
  await installActiveAccessGate();
  log("access-gate", "checked");

  // ADR-083 Decision 4's port, for the same reason and in the same place:
  // local, needing nobody, and ahead of the arm that may return early.
  const { installStampCapability } = await import(
    "@/lib/publish/destinations/wordpress/stamp-place"
  );
  installStampCapability();
  log("stamp-place", "checked");

  const { assertCheckoutBootInvariants } = await import("@/lib/account/checkout/boot");
  const { PriceObjectMismatch } = await import("@/lib/account/checkout/price-object");

  try {
    await assertCheckoutBootInvariants();
  } catch (error) {
    if (error instanceof PriceObjectMismatch) throw error;
    log("checkout", "unchecked", error instanceof Error ? error.name : "unknown");
    return;
  }
  log("checkout", "checked");
}
