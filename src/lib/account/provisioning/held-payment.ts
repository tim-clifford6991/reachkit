// src/lib/account/provisioning/held-payment.ts — BUILD §13
//
// Whether a completed payment is held against an address for which no
// account exists — the fact REQ-020 criterion 4's middle answer is about.
//
// There is no `payments` table in this schema, deliberately: the durable
// record of a payment is the `users` row the webhook writes, and a second
// table holding the same fact is a second thing to keep true. So the
// question is asked of the vendor, which is where a completed session with
// no account of ours actually lives.
//
// **It answers `false` when it cannot tell.** Telling somebody their
// payment is held, and their account is opening, when we cannot see whether
// either is so, sets them waiting for a mail that is not coming. The other
// line at least names the way to buy.
//
// This module offers no purchase and builds no checkout: REQ-024 criterion
// 6's "with no further purchase offered" is a property of what this returns
// — a boolean — rather than of a caller's restraint.
import { stripe } from "../stripe/client";

/** How far back a completed session is still "held against" an address. A
 *  parameter, not a pin: it bounds one vendor listing, and the answer it
 *  feeds is a written line rather than a decision about money. Wide enough
 *  that the 24-hour backstop has long since fired for anything older. */
const HELD_PAYMENT_LOOKBACK_DAYS = 7;

export async function heldPaymentFor(address: string): Promise<boolean> {
  const since = Math.floor(Date.now() / 1000) - HELD_PAYMENT_LOOKBACK_DAYS * 24 * 60 * 60;
  try {
    const sessions = await stripe().checkout.sessions.list({
      created: { gte: since },
      customer_details: { email: address },
      status: "complete",
      limit: 1,
    });
    return sessions.data.length > 0;
  } catch {
    return false;
  }
}
