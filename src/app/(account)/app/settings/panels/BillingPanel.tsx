// Canvas: Settings — the billing half of the artboard's Account card: the
// price, the two rows beneath it, and three affordances onto the one Stripe
// surface. It draws no card of its own; `AccountPanel` composes it into one.
//
// This card states no billing value ReachKit computed. The price is the
// registry's — a public product fact — and the day is `users.paid_through`,
// this product's own access gate, arriving already written.
//
// `cancel` and `resume` are one position, two plan states (REQ-076 c6): a
// running plan offers Cancel plan, a cancelled one offers resume, so the
// closed offer of seven actions is stated across the two.
"use client";

import type React from "react";
import { Badge, Btn } from "@/ui/components";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { useAction } from "./useAction";
import { PRICE_KEYS, type BillingSummary } from "../billing";
import { CONTROLS, EXPLAIN, FIGURE, ROW, ROW_NAME, ROW_VALUE, SECTION, VALUE } from "../style";

/** REQ-097 c6's three statements, in the order the criterion names them.
 *  One key each, so the owner can write each of them. */
const BILLING_UNREADABLE_KEYS: readonly CopyKey[] = [
  "settings.billing.unreachable",
  "settings.billing.try-again",
  "settings.billing.reach-a-person",
];

/** The mask the artboard draws in front of the last four: punctuation
 *  standing in for digits nobody may see. */
const CARD_MASK = "••••";

/** The plan's state, opposite the card's own label — where the artboard
 *  draws it. Nothing to state where the account could not be read. */
export function BillingStateBadge(p: { billing: BillingSummary }): React.JSX.Element | null {
  if (!p.billing.readable) return null;
  return (
    <span data-testid="billing-state">
      <Badge tone={p.billing.state === "active" ? "ok" : "neutral"}>
        {copy(
          p.billing.state === "active" ? "settings.billing.active" : "settings.billing.cancelled"
        )}
      </Badge>
    </span>
  );
}

export function BillingPanel(p: { billing: BillingSummary }): React.JSX.Element {
  const { billing } = p;
  const action = useAction();
  const cancelling = billing.readable
    ? writtenLine("settings.billing.cancelling", { date: billing.accessUntil })
    : null;

  // The three price keys, in the order every price surface speaks them,
  // with the owner-owed ones dropped rather than rendered as a gap.
  const price = PRICE_KEYS.map((key) => writtenLine(key)).filter((line) => line !== null);
  const amount = writtenLine(PRICE_KEYS[0] ?? "price.amount");

  // Neither half of the next-invoice row is a second read: the day is the
  // access gate this card already states, and the amount is the price key.
  const nextInvoice = billing.readable
    ? [billing.accessUntil, amount].filter((part) => part !== null).join(" · ")
    : null;
  const cardOnFile =
    billing.readable && billing.cardLast4 !== null ? `${CARD_MASK} ${billing.cardLast4}` : null;

  return (
    <div className={SECTION}>
      {/* The artboard's plan row: the figure, and the interval quietly
          beside it. Both sit inside one test id — together they are the
          price. */}
      <div className={ROW}>
        <span className={ROW_NAME}>{copy("settings.billing.plan")}</span>
        <span className={ROW_VALUE} data-testid="billing-price">
          <span className={FIGURE}>{amount}</span>
          <span className={`num-phrase ${EXPLAIN}`}>{price.slice(1).join(" ")}</span>
        </span>
      </div>

      {nextInvoice === null ? null : (
        <div className={ROW}>
          <span className={ROW_NAME}>{copy("settings.billing.next-invoice")}</span>
          {/* A phrase of values — a day and an amount — so it folds where
              language folds; `.num`'s own nowrap is for a single token. */}
          <span className={`${VALUE} num-phrase`} data-testid="billing-next-invoice">
            {nextInvoice}
          </span>
        </div>
      )}

      {cardOnFile === null ? null : (
        <div className={ROW}>
          <span className={ROW_NAME}>{copy("settings.billing.card")}</span>
          <span className={VALUE} data-testid="billing-card">
            {cardOnFile}
          </span>
        </div>
      )}

      <div className={CONTROLS}>
        {/* The card is changed on the surface the invoices live on, so this
            is a second way in and not a second action (REQ-097 c1). */}
        <Btn
          label={copy("settings.billing.update-card")}
          size="sm"
          variant="secondary"
          pill
          onClick={() => action.run("invoices")}
        />
        <span data-testid="action-invoices">
          <Btn
            label={copy("settings.billing.invoices")}
            size="sm"
            variant="secondary"
            pill
            onClick={() => action.run("invoices")}
          />
        </span>
        {!billing.readable ? null : billing.state === "active" ? (
          <span data-testid="action-cancel">
            <Btn
              label={copy("settings.billing.cancel")}
              size="sm"
              variant="secondary"
              pill
              onClick={() => action.run("cancel")}
            />
          </span>
        ) : (
          <span data-testid="action-resume">
            <Btn
              label={copy("settings.billing.resume")}
              size="sm"
              variant="secondary"
              pill
              onClick={() => action.run("resume")}
            />
          </span>
        )}
      </div>

      {billing.readable ? null : (
        <div className={SECTION} data-testid="billing-unreadable">
          {BILLING_UNREADABLE_KEYS.map((key) => ({ key, line: writtenLine(key) }))
            .filter((written) => written.line !== null)
            .map((written) => (
              <p className={EXPLAIN} key={written.key}>
                {written.line}
              </p>
            ))}
        </div>
      )}

      {cancelling === null ? null : (
        <p className={EXPLAIN} data-testid="billing-cancelling">
          {cancelling}
        </p>
      )}
      {action.line === null ? null : <p className={EXPLAIN}>{action.line}</p>}
    </div>
  );
}
