// BUILD §4.7 — the Billing card's values, and why there are so few of them.
//
// **REQ-097 is the constraint this file exists to make structural.** The
// owner's 2026-09-02 statement: "a billing figure ReachKit renders is a
// second copy of a fact Stripe holds, and a second copy is what goes stale
// in front of a paying customer." Criterion 5, verbatim: "Given a customer
// who wants the date or amount of their next invoice, which card is on
// file, or what they have been invoiced before, when they go to find out,
// then no ReachKit surface states any of those values — a screen or a mail
// alike — and Settings offers criterion 1's control in their place."
//
// §4.7 names four things on this card — plan, next invoice, card, invoices
// link — and REQ-097's first open question was which of the two readings
// holds: Settings reads Stripe and shows the next invoice and the card, or
// Settings shows the plan, the price and the control and nothing else. It
// was put to the owner on issue #34 and **answered: the plan, the price and
// the control.** So the two values that were `FromStripe` are gone, and
// with them the brand — a provenance type with no inhabitants would read to
// the next person as though this card still rendered something of Stripe's.
//
// What is left is three kinds of fact, and every one of them is ReachKit's
// own to state:
//   · **the plan and its price**, as copy keys. REQ-097's own non-goal says
//     it: "€49/mo is a public product fact stated on every price surface …
//     not a value Stripe holds about one customer". `PRICE_COPY_KEYS` is
//     the same three keys the report's pricing card and /pricing speak the
//     offer through, so the price cannot be stated two ways;
//   · **the date access ends** — `users.paid_through`, the product's own
//     access gate (ADR-050), which REQ-076 criterion 3 requires the
//     customer be told. No invoice, no amount and no card stands behind it;
//   · **the one destination** — REQ-097 criterion 1's billing surface,
//     which every billing control on this card leads to.
//
// **There is no number here that came from a vendor, and no formatter that
// could make one.** `tests/app/settings/screen.test.tsx` subtracts the
// price copy and the access-end date from the card's text and asserts no
// digit survives, which is the same assertion #107 made about `FromStripe`,
// re-aimed at the shape the ruling left.
import type { CopyKey } from "@/lib/presentation/copy";
import { PRICE_COPY_KEYS } from "@/lib/account/checkout/copy-keys";

/** Whether the plan is running or has been cancelled. It selects which of
 *  `cancel` / `resume` the card offers. It is `users.cancelled_at` — the
 *  fact Stripe reported and this product recorded — and never a comparison
 *  against the paid-through date: ADR-050 keeps that date the access gate,
 *  and a cancelled customer inside their paid period still has access. */
export type PlanState = "active" | "cancelled";

/** The one plan (REQ-022 c3). A key, because the words are the owner's. */
export const PLAN_KEY = "plan.single" satisfies CopyKey;

/** The price, through the three keys every price surface already speaks it
 *  through. Re-exported rather than re-listed: two lists of price keys is
 *  how two surfaces come to quote two prices. */
export const PRICE_KEYS: readonly CopyKey[] = PRICE_COPY_KEYS;

export interface BillingSummary {
  state: PlanState;
  /** The `{date}` of §4.7's "cancelling keeps everything running until
   *  {date}", and REQ-076 criterion 3's "the exact date their access ends".
   *  Written in the customer's own stated zone by `assembleSettings`
   *  (REQ-073 c3) — this card never formats one itself. */
  accessUntil: string;
  /** REQ-097 c1's one destination: Stripe's own billing surface, where the
   *  card, the invoices, the billing address, the VAT number and cancelling
   *  are all done. Every billing control on the screen leads here. */
  surfaceHref: string;
}
