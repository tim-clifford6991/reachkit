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
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { CardHead } from "@/ui/idiom";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { useAction } from "./useAction";
import { PLAN_KEY, PRICE_KEYS, type BillingSummary } from "../billing";

/** REQ-097 c6's three statements, in the order the criterion names them.
 *  One key each: a single key would let the second and third be lost by
 *  writing the first (#136's own reasoning, applied to the read as well as
 *  to the press). */
const BILLING_UNREADABLE_KEYS: readonly CopyKey[] = [
  "settings.billing.unreachable",
  "settings.billing.try-again",
  "settings.billing.reach-a-person",
];

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

  return (
    <Card state="default" title={<CardHead eyebrow={copy("settings.billing.title")} />}>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="eyebrow opacity-60">{copy("settings.billing.plan")}</span>
          <span className="min-w-0 wrap-anywhere" data-testid="billing-plan">
            {writtenLine(PLAN_KEY)}
          </span>
          {/* §2.3: a price is numerals. */}
          <span className="num min-w-0 wrap-anywhere" data-testid="billing-price">
            {price.join(" ")}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span data-testid="action-invoices">
          <Btn
            label={copy("settings.billing.invoices")}
            size="sm"
            variant="ghost"
            onClick={() => action.run("invoices")}
          />
        </span>
        {/* The card is changed on the same surface the invoices live on, so
            this is a second way in and not a second action (REQ-097 c1). */}
        <Btn
          label={copy("settings.billing.update-card")}
          size="sm"
          onClick={() => action.run("invoices")}
        />
        {!billing.readable ? null : billing.state === "active" ? (
          <span data-testid="action-cancel">
            <Btn label={copy("settings.billing.cancel")} size="sm" onClick={() => action.run("cancel")} />
          </span>
        ) : (
          <span data-testid="action-resume">
            <Btn label={copy("settings.billing.resume")} size="sm" onClick={() => action.run("resume")} />
          </span>
        )}
      </div>

      {billing.readable ? null : (
        <div className="flex min-w-0 flex-col gap-1" data-testid="billing-unreadable">
          {BILLING_UNREADABLE_KEYS.map((key) => ({ key, line: writtenLine(key) }))
            .filter((written) => written.line !== null)
            .map((written) => (
              <p className="text-xs opacity-60 wrap-anywhere" key={written.key}>
                {written.line}
              </p>
            ))}
        </div>
      )}
      {cancelling === null ? null : (
        <p className="text-xs opacity-60 wrap-anywhere" data-testid="billing-cancelling">
          {cancelling}
        </p>
      )}
      {action.line === null ? null : <p className="text-xs opacity-60 wrap-anywhere">{action.line}</p>}
    </Card>
  );
}
