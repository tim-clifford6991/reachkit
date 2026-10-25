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
// **One affordance, one destination** (#925). REQ-097 c1: "ReachKit offers
// no separate control per item and presents no field, form, stepper,
// cancellation control, confirmation step or consequence screen" for the
// card, the invoices, the billing address, the VAT number or cancelling —
// "the only thing ReachKit offers for it is a control to that same one
// destination". §4.7's three controls all led to `billing.surfaceHref`, and
// for a while this card drew all three of them: three pills in front of one
// destination, which reads as three destinations and leaves the customer
// guessing which pill holds the thing they came for. There is one now —
// *Manage billing in Stripe* — with §4.7's three things named in the line
// under it. Cancel plan is that control: cancelling is done on Stripe's
// surface, and this screen shows no confirmation step of its own.
//
// **`cancel` and `resume` are one position, two plan states** (REQ-076 c6).
// A running plan offers Cancel plan; a cancelled one offers resume. That is
// why the closed offer of seven actions is stated across the two states
// rather than in one render — `tests/app/settings/screen.test.tsx` asserts
// the union.
"use client";

import type React from "react";
import { CircleCheck, ExternalLink } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { useAction } from "./useAction";
import { SettingRow } from "./SettingRow";
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

export function BillingPanel(p: { billing: BillingSummary }): React.JSX.Element {
  const { billing } = p;
  const action = useAction();
  // REQ-097 c5 keeps every billing *value* off this surface, so an
  // unreadable read costs the customer two statements and no number: the
  // plan word, the price and the one control still stand, and the date and
  // the cancel/resume choice — the two things that depend on having read
  // the account — are replaced by REQ-097 c6's three sentences (#228).
  // Inside the refund window a cancel ends access at once, so the refund line replaces "keeps running".
  const refundWindow =
    billing.readable && billing.refundUntil !== null
      ? writtenLine("settings.billing.refund-window", { date: billing.refundUntil })
      : null;
  // Under the plan: the cancelled arm's date, else the refund window, else how billing runs.
  const planLine = !billing.readable
    ? null
    : billing.state === "cancelled"
      ? writtenLine("settings.billing.cancelling", { date: billing.accessUntil })
      : (refundWindow ?? writtenLine("settings.billing.billed"));

  // **One of the two lines beside the figure, not both** (owner,
  // 2026-09-21, on #925). `PRICE_COPY_KEYS` is `price.amount`,
  // `price.vat_included` and `price.interval`, and this card drew the last
  // two together — "€49 VAT included per month, VAT included", because
  // `price.interval` already says it. `price.interval` is the one drawn:
  // it carries both facts a price needs beside the figure, the interval and
  // the VAT, where `price.vat_included` alone would state the VAT and lose
  // the interval. No key changed and no word was rewritten — the other
  // surfaces that speak the offer are untouched, and `PRICE_KEYS` is still
  // what this card reads the figure and the line from, so a price stated
  // two ways is still impossible.
  const interval = writtenLine("price.interval");

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

  const pill = (key: CopyKey, run: () => void): React.JSX.Element => (
    <button type="button" className="btn btn-soft btn-primary btn-sm" onClick={run} disabled={action.pending !== null}>
      {action.pending === "resume" ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
      {copy(key)}
    </button>
  );

  /** The one way to the one destination. `btn-primary` because it is this
   *  card's only control and `docs/DESIGN.md` allows one solid primary per
   *  screen; the icon is the card's own, at the badge size a control takes. */
  const manage = (run: () => void): React.JSX.Element => (
    <button type="button" className="btn btn-primary btn-sm" onClick={run} disabled={action.pending !== null}>
      {action.pending === "invoices" ? <span className="loading loading-spinner loading-xs" aria-hidden /> : <ExternalLink size={16} strokeWidth={1.75} aria-hidden />}
      {copy("settings.billing.manage")}
    </button>
  );

  return (
    <section className="card card-border min-w-0 bg-base-100">
      <div className="card-body gap-4">
        <h2 className="card-title text-base">{copy("settings.billing.title")}</h2>

        {/* The settable-row shape every Settings tab draws (`SettingRow`,
            #1089): the name at the near edge, the value at the far one. */}
        <div className="flex min-w-0 flex-col">
          {!billing.readable ? null : (
            <SettingRow name={copy("settings.billing.status")} testId="billing-row-status">
              <span
                className={billing.state === "active" ? "badge badge-success badge-soft" : "badge badge-ghost"}
                data-testid="billing-state"
              >
                {billing.state === "active" ? <CircleCheck size={14} strokeWidth={1.75} aria-hidden /> : null}
                {copy(billing.state === "active" ? "settings.billing.active" : "settings.billing.cancelled")}
              </span>
            </SettingRow>
          )}
          <SettingRow
            name={copy("settings.billing.plan")}
            testId="billing-row-plan"
            below={
              <div className="flex min-w-0 flex-col gap-1 text-xs text-base-content/70">
                {planLine === null ? null : (
                  <p
                    className="wrap-anywhere"
                    data-testid={billing.readable && billing.state === "cancelled" ? "billing-cancelling" : refundWindow === null ? "billing-billed" : "billing-refund"}
                  >
                    {planLine}
                  </p>
                )}
                <p className="wrap-anywhere" data-testid="billing-route">
                  {copy("settings.billing.route", { control: copy("settings.billing.manage") })}
                </p>
              </div>
            }
          >
            <span className="flex min-w-0 flex-wrap items-baseline gap-2" data-testid="billing-price">
              <span className="figure text-xl wrap-anywhere">{amount}</span>
              {interval === null ? null : (
                <span className="num-phrase text-xs text-base-content/70 wrap-anywhere">{interval}</span>
              )}
            </span>
          </SettingRow>
          {nextInvoice === null ? null : (
            <SettingRow name={copy("settings.billing.next-invoice")} testId="billing-row-next-invoice">
              <span className="num num-phrase min-w-0 wrap-anywhere" data-testid="billing-next-invoice">
                {nextInvoice}
              </span>
            </SettingRow>
          )}
        </div>

        {/* **One control, and the line says what is behind it** (#925).
            REQ-097 c1 always said there was one destination — "the only
            thing ReachKit offers for it is a control to that same one
            destination" — and three pills in front of it read as three
            destinations, so the customer had to guess which one held the
            thing they came for. Update card, invoices and Cancel plan were
            all `openPortal()` (`../billing-actions.ts`); now they are one
            press, and the sentence under it names all three.

            **`action-cancel` marks this same control**, because cancelling
            *is* what pressing it does: `cancel` and `invoices` are one
            affordance now, and the closed offer of seven actions
            (`../settable.ts`) is still complete on the screen rather than
            complete in a list. `resume` is the one that does not belong
            here — after the paid-through date it opens a new subscription
            instead of the portal (`resumePlan`), so it stays its own
            control in its own plan state, which is the position §4.7 gave
            it and REQ-076 c6's "two plan states, one position". */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {!billing.readable || billing.state === "active" ? (
            // `flex min-w-0` on the outer marker is load-bearing, not
            // decoration: a flex item is blockified, so the inner marker is
            // a box the height of the button inside it. Left inline it keeps
            // its own line-box height — the 15px body's, shorter than a
            // `btn-sm` — and the button stands outside its own parent at
            // every width, which is a check-2 offender the layout sweep
            // reports by name. Found by rendering this card at 390, 768 and
            // 1280 in both themes before the PR was opened.
            <span className="flex min-w-0" data-testid="action-cancel">
              <span data-testid="action-invoices">
                {manage(() => action.run("invoices"))}
              </span>
            </span>
          ) : (
            <>
              <span data-testid="action-invoices">{manage(() => action.run("invoices"))}</span>
              <span data-testid="action-resume">
                {pill("settings.billing.resume", () => action.run("resume"))}
              </span>
            </>
          )}
        </div>
        <p className="text-xs text-base-content/70 wrap-anywhere" data-testid="billing-manage-note">
          {copy("settings.billing.manage.note")}
        </p>

        {billing.readable ? null : (
          <div className="flex min-w-0 flex-col gap-1" data-testid="billing-unreadable">
            {BILLING_UNREADABLE_KEYS.map((key) => ({ key, line: writtenLine(key) }))
              .filter((written) => written.line !== null)
              .map((written) => (
                <p className="text-xs text-base-content/70 wrap-anywhere" key={written.key}>
                  {written.line}
                </p>
              ))}
          </div>
        )}
        {action.line === null ? null : <p className="text-xs text-base-content/70 wrap-anywhere">{action.line}</p>}
      </div>
    </section>
  );
}
