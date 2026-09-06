// src/lib/account/provisioning/backstop.ts — BUILD §13
//
// REQ-024 criterion 6: twenty-four hours after a payment against which no
// account opened, "an account is open against that payment and a sign-in
// link to it has been sent to the address that paid, with no second charge
// and nothing required of the founder beyond opening that link."
//
// **No second charge, ever.** This file creates no charge and calls no
// checkout: it opens the account from the session that already paid, by
// calling the same `provisionFromPayment` the webhook calls. It imports
// nothing that could take money.
//
// **Running twice provisions once.** It has no idempotency of its own and
// needs none — `provisionFromPayment`'s two database constraints are the
// guarantee, and a second run takes the replay branch.
//
// **The firing is itself the alert.** The backstop existing is insurance;
// the backstop *firing* means the webhook path failed for a paying
// customer, which is a fact somebody should see rather than a quietly
// self-healing system.
import { provisionFromPayment } from "./provision";

export type BackstopOutcome =
  | { provisioned: true; replay: boolean }
  | { provisioned: false; because: string };

export async function backstopProvision(sessionId: string): Promise<BackstopOutcome> {
  console.warn(
    JSON.stringify({
      event: "provisioning_backstop_fired",
      sessionId,
      // Written out because a reader of this line should not have to infer
      // it: a paying customer went unprovisioned long enough for the
      // 24-hour net to catch them.
      meaning: "the webhook path did not open an account for a completed payment",
    })
  );

  const result = await provisionFromPayment(sessionId);
  if (result.created) return { provisioned: true, replay: false };
  if (result.duplicate === "replay") return { provisioned: true, replay: true };
  return { provisioned: false, because: result.duplicate ?? result.refused ?? "unknown" };
}
