// BUILD §4.7 — Billing, plate F3: the state, the plan and price (ours), the first-50 lines, the day access runs to,
// and one control to the one Stripe destination. No amount is read from Stripe (owner ruling, #34) and no refund
// date is shown (SPEC); `paid_through` arrives written, in the customer's own zone.
"use client";

import type React from "react";
import { Check } from "lucide-react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { useAction } from "./useAction";
import { SettingLine } from "./SettingRow";
import { PRICE_KEYS, type BillingSummary } from "../billing";
import { CARD, CARD_BODY, CARD_FOOT, CARD_LEAD, CARD_TITLE, TARGET } from "../frame";
import { OFFER_SPOTS, WEEK_PLAN } from "@/lib/config/constants";

/** REQ-097 c6's three statements, one key each, so the owner can write each one. */
const BILLING_UNREADABLE_KEYS: readonly CopyKey[] = [
  "settings.billing.unreachable",
  "settings.billing.try-again",
  "settings.billing.reach-a-person",
];

export function BillingPanel(p: { billing: BillingSummary }): React.JSX.Element {
  const { billing } = p;
  const action = useAction();
  const ended = billing.readable && billing.state === "ended";
  const cancelled = billing.readable && billing.state === "cancelled";
  const failed = billing.readable && !ended && billing.paymentFailed === true;
  const planLine = !billing.readable ? null : writtenLine(ended ? "settings.billing.ended.line" : "settings.billing.billed");
  const offline = billing.readable && ended && billing.pagesOfflineOn !== null ? writtenLine("settings.billing.ended.pages", { date: billing.pagesOfflineOn }) : null;
  const amount = writtenLine(PRICE_KEYS[0] ?? "price.amount");
  const price = [copy("plan.single", { weekPages: String(WEEK_PLAN.days) }), [amount, writtenLine("price.interval")].filter((part) => part !== null).join(" ")].join(" · ");
  // Active only where the status was read and is paid: an unread status makes no claim.
  const badge = !billing.readable ? null : billing.state !== "active" ? billing.state : billing.paymentFailed === false ? "active" : null;
  const since = billing.readable ? billing.customerSince : null;
  const checkIn = billing.readable ? billing.nextCheckIn : null;
  const busy = (key: "invoices" | "resume"): React.ReactNode =>
    action.pending === key ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null;

  const spot = (
    <>
      <span className="badge badge-ghost badge-sm h-auto min-h-5 wrap-anywhere" data-testid="billing-spot">
        {copy("offer.billing.spot", { of: String(OFFER_SPOTS) })}
      </span>
      <span className="text-sm wrap-anywhere">{copy("offer.billing.lock", { price: copy("price.amount") })}</span>
    </>
  );
  // The card's one solid primary, unless a failed payment's Pay holds it.
  const manage = (
    <button type="button" className={`btn ${failed ? "btn-soft" : "btn-primary"} ${TARGET}`} onClick={() => action.run("invoices")} disabled={action.pending !== null}>
      {busy("invoices")}
      {copy("settings.billing.manage")}
    </button>
  );

  return (
    <section className={CARD}>
      <div className={CARD_BODY}>
        <h2 className={CARD_TITLE}>{copy("settings.billing.title")}</h2>

        {failed ? (
          <div className="alert alert-warning alert-soft flex min-w-0 flex-wrap py-2" data-testid="billing-payment-failed">
            <p className="min-w-0 grow text-sm wrap-anywhere">{copy("settings.billing.payment-failed")}</p>
            <button type="button" className={`btn btn-primary ${TARGET}`} onClick={() => action.run("invoices")} disabled={action.pending !== null}>
              {copy("settings.billing.pay")}
            </button>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-col">
          {badge === null ? null : (
            <SettingLine
              label={copy("settings.billing.status")}
              testId="billing-row-status"
              value={{
                kind: "node",
                text: (
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className={badge === "active" ? "badge badge-success badge-soft badge-sm" : "badge badge-ghost badge-sm"} data-testid="billing-state">
                      {badge === "active" ? <Check size={14} strokeWidth={1.75} aria-hidden /> : null}
                      {copy(`settings.billing.${badge}`)}
                    </span>
                    {since === null ? null : spot}
                  </span>
                ),
              }}
            />
          )}
          <SettingLine label={copy("settings.billing.plan")} testId="billing-row-plan" value={{ kind: "text", text: price, full: price }} />
          <div className={`${CARD_LEAD} flex min-w-0 flex-col pb-1`}>
            {planLine === null ? null : <p data-testid={ended ? "billing-ended" : "billing-billed"}>{planLine}</p>}
            {offline === null ? null : <p data-testid="billing-offline">{offline}</p>}
            <p data-testid="billing-route">
              {ended ? copy("settings.billing.ended.contact") : copy("settings.billing.route", { control: copy("settings.billing.manage") })}
            </p>
          </div>
          {since === null ? null : (
            <SettingLine
              label={copy("offer.billing.since")}
              testId="billing-row-since"
              value={{ kind: "node", text: <span className="flex min-w-0 flex-wrap items-center gap-2"><span className="num num-phrase">{since}</span>{badge === null ? spot : null}</span> }}
            />
          )}
          {checkIn === null ? null : (
            <SettingLine
              label={copy("offer.billing.checkin")}
              testId="billing-row-checkin"
              value={{
                kind: "node",
                text: (
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3">
                    <span className="num num-phrase">{checkIn}</span>
                    <a className="link link-primary" href={`mailto:${copy("chrome.footer.contact.address")}`} data-testid="billing-founder">
                      {copy("offer.founder")}
                    </a>
                  </span>
                ),
              }}
            />
          )}
          {/* The date only: `paid_through`, the day the next invoice falls or, once cancelled, the day access ends. */}
          {!billing.readable || ended ? null : (
            <SettingLine
              label={copy(cancelled ? "settings.billing.access-until" : "settings.billing.next-invoice")}
              testId="billing-row-next-invoice"
              value={{ kind: "node", text: <span className="num num-phrase" data-testid="billing-next-invoice">{billing.accessUntil}</span> }}
            />
          )}
        </div>

        {/* One control to one destination: card, invoices and cancel all live behind it; resume is its own. */}
        <div className={CARD_FOOT}>
          <p className={`${CARD_LEAD} min-w-0`} data-testid="billing-manage-note">
            {copy("settings.billing.manage.note")}
          </p>
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            {cancelled ? (
              <>
                <span className="flex min-w-0" data-testid="action-resume">
                  <button type="button" className={`btn btn-soft btn-primary ${TARGET}`} onClick={() => action.run("resume")} disabled={action.pending !== null}>
                    {busy("resume")}
                    {copy("settings.billing.resume")}
                  </button>
                </span>
                <span className="flex min-w-0" data-testid="action-invoices">{manage}</span>
              </>
            ) : (
              <span className="flex min-w-0" data-testid="action-cancel">
                <span className="flex min-w-0" data-testid="action-invoices">{manage}</span>
              </span>
            )}
          </span>
        </div>

        {billing.readable ? null : (
          <div className="flex min-w-0 flex-col" data-testid="billing-unreadable">
            {BILLING_UNREADABLE_KEYS.map((key) => ({ key, line: writtenLine(key) }))
              .filter((written) => written.line !== null)
              .map((written) => (
                <p className={CARD_LEAD} key={written.key}>
                  {written.line}
                </p>
              ))}
          </div>
        )}
        {action.line === null ? null : <p className={CARD_LEAD}>{action.line}</p>}
      </div>
    </section>
  );
}
