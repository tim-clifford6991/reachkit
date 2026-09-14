// BUILD §4.7 — "**Billing** (plan, next invoice, card, invoices link, Update
// card / Cancel plan + 'cancelling keeps everything running until {date}')".
//
// **This card states no billing value at all.** REQ-097 c5: "no ReachKit
// surface states" the date or amount of the next invoice, the card on file,
// or the invoice history — and REQ-097's first open question, which of
// §4.7's four things survive that, was answered by the owner on issue #34:
// the plan, the price and the control. So the next-invoice row and the card
// row are gone, and the control stands in their place, which is exactly
// what criterion 5's last clause asks for.
//
// What is rendered is the plan name and the price, from the copy registry —
// REQ-097's own non-goal keeps "€49/mo" a public product fact rather than a
// value Stripe holds about one customer — and, where §4.7's cancelling line
// has a day to name, the day access ends. That day is `users.paid_through`,
// this product's own gate (ADR-050) and the date REQ-076 criterion 3
// requires the customer be told. Nothing here formats it: it arrives
// written, in the customer's own zone.
//
// **Three affordances, one destination.** REQ-097 c1: "ReachKit offers no
// separate control per item and presents no field, form, stepper,
// cancellation control, confirmation step or consequence screen" for the
// card, the invoices, the billing address, the VAT number or cancelling —
// "the only thing ReachKit offers for it is a control to that same one
// destination". So §4.7's three controls all lead to `billing.surfaceHref`.
// Cancel plan is one of them: cancelling is done on Stripe's surface, and
// this screen shows no confirmation step of its own.
//
// **`cancel` and `resume` are one position, two plan states** (REQ-076 c6).
// A running plan offers Cancel plan; a cancelled one offers resume. That is
// why the closed offer of seven actions is stated across the two states
// rather than in one render — `tests/app/settings/screen.test.tsx` asserts
// the union.
"use client";

import type React from "react";
import { CreditCard } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { useAction } from "./useAction";
import { PRICE_KEYS, type BillingSummary } from "../billing";

/** REQ-097 c6's three statements, in the order the criterion names them.
 *  One key each: a single key would let the second and third be lost by
 *  writing the first (#136's own reasoning, applied to the read as well as
 *  to the press). */
const BILLING_UNREADABLE_KEYS: readonly CopyKey[] = [
  "settings.billing.unreachable",
  "settings.billing.try-again",
  "settings.billing.reach-a-person",
];

/** The mask in front of the last four: punctuation standing in for digits
 *  nobody may see, not a sentence. */
const CARD_MASK = "\u2022\u2022\u2022\u2022";

export function BillingPanel(p: { billing: BillingSummary }): React.JSX.Element {
  const { billing } = p;
  const action = useAction();
  // REQ-097 c5 keeps every billing *value* off this surface, so an
  // unreadable read costs the customer two statements and no number: the
  // plan word, the price and the one control still stand, and the date and
  // the cancel/resume choice — the two things that depend on having read
  // the account — are replaced by REQ-097 c6's three sentences (#228).
  const cancelling = billing.readable
    ? writtenLine("settings.billing.cancelling", { date: billing.accessUntil })
    : null;

  // The three price keys, in the order every price surface speaks them,
  // with the owner-owed ones dropped rather than rendered as a gap.
  const price = PRICE_KEYS.map((key) => writtenLine(key)).filter((line) => line !== null);

  // S18's "next invoice" row, and **neither half of it is a second copy of
  // anything** (#374): the day is `users.paid_through` — the access gate
  // this card already states in its cancelling line — and the amount is the
  // same `price.amount` key every price surface speaks. One read, no vendor
  // value, and the two cannot disagree with the line below them because
  // they are the same date.
  // The AMOUNT alone beside the day — `price.amount`, which is the figure
  // the set draws on this row. The interval ("per month, VAT included") is
  // a fact about the plan and belongs beside the headline, not on a row
  // stating one invoice.
  const amount = writtenLine(PRICE_KEYS[0] ?? "price.amount");
  const nextInvoice = billing.readable
    ? [billing.accessUntil, amount].filter((part) => part !== null).join(" · ")
    : null;
  // The card on file. Drawn only where something read one — see
  // `billing.ts`: `users` holds no card, so this is the fixture's row and
  // the live account has none until a Stripe read exists.
  const cardOnFile =
    billing.readable && billing.cardLast4 !== null
      ? `${CARD_MASK} ${billing.cardLast4}`
      : null;

  const pill = (key: CopyKey, run: () => void): React.JSX.Element => (
    <button type="button" className="btn btn-outline btn-sm" onClick={run}>
      {copy(key)}
    </button>
  );

  return (
    <section className="card card-border min-w-0 bg-base-100">
      <div className="card-body gap-4">
        <h2 className="card-title text-base">
          <CreditCard size={20} strokeWidth={1.75} aria-hidden />
          {copy("settings.billing.title")}
        </h2>

        {/* The price is the card's one headline number; the badge says
            whether it is running. */}
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
          <span className="flex min-w-0 flex-wrap items-baseline gap-2" data-testid="billing-price">
            <span className="num text-3xl font-semibold wrap-anywhere">{amount}</span>
            <span className="num-phrase text-xs text-base-content/60 wrap-anywhere">{price.slice(1).join(" ")}</span>
          </span>
          {!billing.readable ? null : (
            <span
              className={billing.state === "active" ? "badge badge-success badge-soft" : "badge badge-ghost"}
              data-testid="billing-state"
            >
              {copy(billing.state === "active" ? "settings.billing.active" : "settings.billing.cancelled")}
            </span>
          )}
        </div>

        {nextInvoice === null && cardOnFile === null ? null : (
          <dl className="border-base-300 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 border-t pt-4 text-sm">
            {nextInvoice === null ? null : (
              <>
                <dt className="text-base-content/70">{copy("settings.billing.next-invoice")}</dt>
                <dd className="num num-phrase text-right" data-testid="billing-next-invoice">
                  {nextInvoice}
                </dd>
              </>
            )}
            {cardOnFile === null ? null : (
              <>
                <dt className="text-base-content/70">{copy("settings.billing.card")}</dt>
                <dd className="num text-right" data-testid="billing-card">
                  {cardOnFile}
                </dd>
              </>
            )}
          </dl>
        )}

        {/* All three lead to REQ-097 c1's one billing surface. */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {pill("settings.billing.update-card", () => action.run("invoices"))}
          <span data-testid="action-invoices">{pill("settings.billing.invoices", () => action.run("invoices"))}</span>
          {!billing.readable ? null : billing.state === "active" ? (
            <span data-testid="action-cancel">{pill("settings.billing.cancel", () => action.run("cancel"))}</span>
          ) : (
            <span data-testid="action-resume">{pill("settings.billing.resume", () => action.run("resume"))}</span>
          )}
        </div>

        {billing.readable ? null : (
          <div className="flex min-w-0 flex-col gap-1" data-testid="billing-unreadable">
            {BILLING_UNREADABLE_KEYS.map((key) => ({ key, line: writtenLine(key) }))
              .filter((written) => written.line !== null)
              .map((written) => (
                <p className="text-xs text-base-content/60 wrap-anywhere" key={written.key}>
                  {written.line}
                </p>
              ))}
          </div>
        )}
        {cancelling === null ? null : (
          <p className="text-xs text-base-content/60 wrap-anywhere" data-testid="billing-cancelling">
            {cancelling}
          </p>
        )}
        {action.line === null ? null : <p className="text-xs text-base-content/60 wrap-anywhere">{action.line}</p>}
      </div>
    </section>
  );
}
