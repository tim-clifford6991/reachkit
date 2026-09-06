// BUILD §4.7 — the Billing card's values, and the provenance that makes them
// legal to render.
//
// REQ-097 (2026-09-02 owner statement) is the constraint this file exists to
// make structural: "a billing figure ReachKit renders is a second copy of a
// fact Stripe holds, and a second copy is what goes stale in front of a
// paying customer." Criterion 5, verbatim: "Given a customer who wants the
// date or amount of their next invoice, which card is on file, or what they
// have been invoiced before, when they go to find out, then no ReachKit
// surface states any of those values."
//
// §4.7 nonetheless names four things on the card — plan, next invoice, card,
// invoices link — and REQ-097's first open question, still unruled, is
// whether Settings reads Stripe and shows them or shows a control in their
// place. This build renders them, under the reading the owner's own brief for
// this issue states: **the values come from Stripe's surface, and ReachKit
// renders no billing number it computed.** That reading is enforced here
// rather than asserted in prose.
//
// `FromStripe` is how. Every billing value on the model is one — a string
// Stripe produced, carried with the fact that Stripe produced it — and there
// is no constructor that takes a number, a date, a currency or an amount in
// cents. So a renderer cannot format money, a model cannot total anything,
// and a future "just work out the renewal date from paid_through" is a type
// error rather than a review comment. The single construction path is
// `fromStripe`, which is the same shape ADR-012 gives `GeneratedText`
// ("`fromStored` is the only construction path"), for the same reason:
// deleting the brand looks like tidying and is forbidden.
//
// The three controls §4.7 names lead to one destination, not three.
// REQ-097 c1: "ReachKit offers no separate control per item and presents no
// field, form, stepper, cancellation control, confirmation step or
// consequence screen for any of them" — so `surfaceHref` is one address and
// `invoices`, `Update card` and `Cancel plan` are three affordances onto it.

/** A billing value ReachKit did not compute. The brand is nominal: two
 *  `FromStripe` values are interchangeable only because both came from the
 *  same place, and nothing but `fromStripe` can make one. */
export interface FromStripe {
  readonly from: "stripe";
  /** Stripe's own rendering of the value, as text. Never a number, a date or
   *  an amount this product could arithmetic on. */
  readonly text: string;
}

/** The one construction path. `text` is what Stripe's API or surface already
 *  rendered — this function formats nothing and parses nothing. */
export function fromStripe(text: string): FromStripe {
  return Object.freeze({ from: "stripe", text });
}

/** Whether the plan is running or has been cancelled. It selects which of
 *  `cancel` / `resume` the card offers, and it is a state Stripe reports —
 *  never one derived here from a date comparison (ADR-050 keeps the access
 *  gate on `paid_through` alone, and that gate is not this card's). */
export type PlanState = "active" | "cancelled";

export interface BillingSummary {
  state: PlanState;
  /** §4.7's "plan". */
  plan: FromStripe;
  /** §4.7's "next invoice". */
  nextInvoice: FromStripe;
  /** §4.7's "card". */
  card: FromStripe;
  /** The `{date}` of §4.7's "cancelling keeps everything running until
   *  {date}" — Stripe's date for the end of the paid period, not one this
   *  product worked out. */
  accessUntil: FromStripe;
  /** REQ-097 c1's one destination: Stripe's own billing surface, where the
   *  card, the invoices, the billing address, the VAT number and cancelling
   *  are all done. Every billing control on the screen leads here. */
  surfaceHref: string;
}

/** Every value on the summary that is a billing value, in one place, so a
 *  test can walk them without naming them a second time — and so a field
 *  added to `BillingSummary` without `FromStripe` is a compile error here
 *  before it is a defect on the screen. */
export function billingValues(summary: BillingSummary): readonly FromStripe[] {
  return [summary.plan, summary.nextInvoice, summary.card, summary.accessUntil];
}
