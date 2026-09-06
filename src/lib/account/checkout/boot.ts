// src/lib/account/checkout/boot.ts — BUILD §13
//
// The checkout module's boot hook, and nothing else. ADR-052's third point
// is that the live Price is checked against the checked-in spec rather than
// trusted; this is where that check is called from, so the application's
// startup path holds one import and no knowledge of what is being asserted.
//
// It rethrows. A deployment that would take payments against a price this
// repository does not describe does not start — the same footing
// `src/lib/config/env.ts` puts a missing binding on, for the same reason:
// half-configured is the state that charges somebody the wrong amount.
//
// Wiring this into startup is the application container's (BP-001's); this
// module owns the assertion, never the schedule it runs on.
import { assertLivePriceMatchesSpec } from "./price-object";

export async function assertCheckoutBootInvariants(): Promise<void> {
  await assertLivePriceMatchesSpec();
}
