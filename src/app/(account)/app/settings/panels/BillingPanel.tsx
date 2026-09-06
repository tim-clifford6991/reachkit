// BUILD §4.7 — "**Billing** (plan, next invoice, card, invoices link, Update
// card / Cancel plan + 'cancelling keeps everything running until {date}')".
//
// **Every value on this card came from Stripe and none of them was computed
// here.** REQ-097 c5: "no ReachKit surface states" the date or amount of the
// next invoice, the card on file, or the invoice history. The values §4.7 does
// name are therefore carried as `FromStripe` (`../billing.ts`) — text Stripe
// produced, with the fact that Stripe produced it — and this file renders
// `.text` and does no formatting of its own. There is no number here to get
// wrong, because there is no number here at all.
//
// **Three affordances, one destination.** REQ-097 c1: "ReachKit offers no
// separate control per item and presents no field, form, stepper,
// cancellation control, confirmation step or consequence screen" for the card,
// the invoices, the billing address, the VAT number or cancelling — "the only
// thing ReachKit offers for it is a control to that same one destination". So
// §4.7's three controls all lead to `billing.surfaceHref`, and two of them
// (`invoices` and Update card) are the same action: the card *is* where the
// invoices are.
//
// **`cancel` and `resume` are one position, two plan states** (REQ-076 c6). A
// running plan offers Cancel plan; a cancelled one offers resume. That is why
// the closed offer of seven actions is stated across the two states rather
// than in one render — `tests/app/settings/screen.test.tsx` asserts the union.
//
// The `{date}` in §4.7's cancelling line is `billing.accessUntil`, which is
// Stripe's date for the end of the paid period. ADR-050 keeps the access gate
// on `users.paid_through` alone and that gate is not this card's; nothing here
// compares dates or derives one.
"use client";

import type React from "react";
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { useAction } from "./useAction";
import type { BillingSummary } from "../billing";

export function BillingPanel(p: { billing: BillingSummary }): React.JSX.Element {
  const { billing } = p;
  const action = useAction();
  const cancelling = writtenLine("settings.billing.cancelling", { date: billing.accessUntil.text });

  return (
    <Card state="default" title={<h2>{copy("settings.billing.title")}</h2>}>
      <div className="rk-settings-fields">
        <div className="rk-settings-field">
          <span className="rk-settings-label">{copy("settings.billing.plan")}</span>
          {/* §2.3: a price, a date and a card number are numerals. */}
          <span className="rk-settings-value num" data-testid="billing-plan">
            {billing.plan.text}
          </span>
        </div>
        <div className="rk-settings-field">
          <span className="rk-settings-label">{copy("settings.billing.next-invoice")}</span>
          <span className="rk-settings-value num" data-testid="billing-next-invoice">
            {billing.nextInvoice.text}
          </span>
        </div>
        <div className="rk-settings-field">
          <span className="rk-settings-label">{copy("settings.billing.card")}</span>
          <span className="rk-settings-value num" data-testid="billing-card">
            {billing.card.text}
          </span>
        </div>
      </div>

      <div className="rk-settings-row">
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
        {billing.state === "active" ? (
          <span data-testid="action-cancel">
            <Btn label={copy("settings.billing.cancel")} size="sm" onClick={() => action.run("cancel")} />
          </span>
        ) : (
          <span data-testid="action-resume">
            <Btn label={copy("settings.billing.resume")} size="sm" onClick={() => action.run("resume")} />
          </span>
        )}
      </div>

      {cancelling === null ? null : <p className="rk-settings-line">{cancelling}</p>}
      {action.line === null ? null : <p className="rk-settings-line">{action.line}</p>}
    </Card>
  );
}
