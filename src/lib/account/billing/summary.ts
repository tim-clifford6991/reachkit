// src/lib/account/billing/summary.ts — BUILD §13, §4.7
//
// What the Settings billing card reads — and, as much as anything, what it
// does not.
//
// **REQ-097 governs this file.** Criterion 5, verbatim: "Given a customer
// who wants the date or amount of their next invoice, which card is on
// file, or what they have been invoiced before, when they go to find out,
// then no ReachKit surface states any of those values — a screen or a mail
// alike — and Settings offers criterion 1's control in their place." So
// this summary carries no next-invoice date, no next-invoice amount, no
// card brand and no `last4`. It makes **no Stripe read at all**: there is
// nothing on it Stripe holds.
//
// That is a departure from BP-060's published interface, which returns
// `nextInvoice` and `card` "read from Stripe at request time". BP-060 is
// the older artifact and REQ-097 declares the conflict rather than hiding
// it (`blocked-by: [REQ-076, BP-060, BP-055]`). REQ-097's own first open
// question — does Settings read Stripe and show those values, or show the
// plan, the price and the control? — was put to the owner on this issue and
// answered: **the plan, the price and the control.** The PR records it.
//
// What is left is exactly the three kinds of fact ReachKit legitimately
// holds:
//   · **the plan and its price** — a public product fact stated on every
//     price surface, not a value Stripe holds about one customer (REQ-097's
//     own non-goal says so), and carried as copy keys so the words stay the
//     owner's;
//   · **`paidThrough`** — `users.paid_through`, this product's own access
//     gate (ADR-050). REQ-076 criterion 3 requires the customer be told
//     "the exact date their access ends", and that date is this column. It
//     is not a billing value: no invoice, no amount and no card stands
//     behind it;
//   · **whether the plan is cancelled** — `users.cancelled_at`, which
//     selects whether the card offers cancel or resume (REQ-076 c6).
//
// **Instants, never formatted dates.** The customer's own stated time zone
// is applied at render (REQ-073 c3), never here — a date formatted in this
// module would be formatted in the server's zone and would be wrong for
// every customer who is not in it.
//
// `plan_status` is carried for display and is used in **no conditional in
// this file** (ADR-050). `state` is derived from `cancelled_at`, which is
// the fact the card is actually asking about.
import { PRICE_COPY_KEYS } from "../checkout/copy-keys";
import { billingStore } from "./store";

/** Whether the plan is running or has been cancelled. It selects which of
 *  cancel / resume the card offers. Derived from `cancelled_at` and never
 *  from a date comparison against `paid_through`: a cancelled customer
 *  inside their paid period still has access, and a card that read the gate
 *  would offer them a cancel control they had already used. */
export type PlanState = "active" | "cancelled";

export interface BillingSummary {
  readonly state: PlanState;
  /** The one plan. One key, because there is one plan (REQ-022 c3). */
  readonly planKey: "plan.single";
  /** The price, as the three keys every price surface already speaks it
   *  through — never a number this module read back from the vendor. */
  readonly priceKeys: typeof PRICE_COPY_KEYS;
  /** REQ-076 c3's "the exact date their access ends", as an instant. */
  readonly paidThrough: Date;
  readonly cancelledAt: Date | null;
  /** What Stripe last said about the subscription. Recorded, displayable,
   *  and read by no gate and no branch (ADR-050). */
  readonly planStatus: string;
  /** REQ-097 c1: the invoices are on the portal, and the card offers a
   *  control to it rather than a list of its own. A literal, so a second
   *  destination cannot be introduced by a call site. */
  readonly invoicesVia: "portal";
}

export type BillingSummaryResult =
  | { ok: true; summary: BillingSummary }
  | { ok: false; reason: "no_account" | "store" };

/** REQ-076 criterion 1, under REQ-097 — what the Settings billing card
 *  reads. One indexed read of `users`; no vendor call. */
export async function billingSummary(userId: string): Promise<BillingSummaryResult> {
  const read = await billingStore().account(userId);
  if (!read.ok) return { ok: false, reason: "store" };
  if (read.account === null) return { ok: false, reason: "no_account" };

  const account = read.account;
  return {
    ok: true,
    summary: {
      state: account.cancelled_at === null ? "active" : "cancelled",
      planKey: "plan.single",
      priceKeys: PRICE_COPY_KEYS,
      paidThrough: new Date(account.paid_through),
      cancelledAt: account.cancelled_at === null ? null : new Date(account.cancelled_at),
      planStatus: account.plan_status,
      invoicesVia: "portal",
    },
  };
}
