// src/lib/account/provisioning/due-work.ts — BUILD §13
//
// The two due-work queries behind REQ-024's backstops, so that a founder
// who has paid is written to at 15 minutes and has an open account at 24
// hours, whatever the webhook did.
//
// Both take an explicit `now`. Due-ness is then a pure function of a clock
// this module is handed, testable at 14:59 and 15:01 without travelling in
// time and without a scheduler.
//
// **The two read different places, and the difference is the point.**
//
//   · `paymentsAwaitingSignIn` reads our own `users` rows: a payment that
//     reached us, an account that opened, and nobody signed in. The clock
//     it compares against is `users.created_at` rather than the charge
//     instant. The row is written by the webhook within seconds of the
//     charge, so the two differ by the webhook's own latency; and where the
//     webhook never ran there is no row at all, which is precisely the case
//     the *other* query covers. Reading the vendor every fifteen minutes to
//     recover those seconds would be a vendor listing per tick, forever,
//     for no fact anybody acts on.
//
//   · `paymentsWithoutAccounts` reads the vendor: a completed session with
//     no `users` row is, by construction, invisible to our own tables. This
//     is the only query in the product that must go to Stripe to find out
//     what we do not have.
//
// Neither writes anything. `chase.ts` and `backstop.ts` own what happens to
// what these return.
import { PAYMENT_BACKSTOP_H, PAYMENT_CHASE_MINUTES } from "@/lib/config/constants";
import { accountStore } from "../store";
import { stripe } from "../stripe/client";

/** Every account whose payment completed at least `PAYMENT_CHASE_MINUTES`
 *  ago, at which nobody has signed in and which has not already been
 *  chased. Returned as checkout session ids, which is what
 *  `chaseSignIn` takes. */
export async function paymentsAwaitingSignIn(now: Date): Promise<readonly string[]> {
  const before = new Date(now.getTime() - PAYMENT_CHASE_MINUTES * 60 * 1000);
  const read = await accountStore().accountsAwaitingSignIn(before);
  if (!read.ok) return [];
  return read.accounts
    .map((account) => account.checkout_session_id)
    .filter((sessionId): sessionId is string => sessionId !== null);
}

/** Every completed Checkout Session charged at least `PAYMENT_BACKSTOP_H`
 *  ago for which no account exists. */
export async function paymentsWithoutAccounts(now: Date): Promise<readonly string[]> {
  const cutoff = Math.floor((now.getTime() - PAYMENT_BACKSTOP_H * 60 * 60 * 1000) / 1000);
  // A lower bound as well as an upper one: without it this listing walks
  // every session this product has ever taken, every tick, forever. Two
  // backstop windows back is the oldest a session can be and still be one
  // the previous tick could plausibly have missed.
  const floor = cutoff - PAYMENT_BACKSTOP_H * 60 * 60;

  let sessions;
  try {
    sessions = await stripe().checkout.sessions.list({
      created: { gte: floor, lte: cutoff },
      status: "complete",
      limit: 100,
    });
  } catch {
    // A vendor we cannot list is not a set of payments with no accounts.
    // Returning nothing is what is true; the next tick asks again.
    return [];
  }

  const store = accountStore();
  const due: string[] = [];
  for (const session of sessions.data) {
    const existing = await store.accountByCheckoutSession(session.id);
    // An unreadable store must not make a session look unprovisioned: the
    // backstop would then try to open an account that already exists.
    if (!existing.ok) continue;
    if (existing.account === null) due.push(session.id);
  }
  return due;
}
