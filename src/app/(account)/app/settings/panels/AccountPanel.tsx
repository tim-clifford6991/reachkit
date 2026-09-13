// Canvas: Settings — the artboard's first card: who the account is, what the
// plan costs, and the controls that change either. The plan's state is the
// badge opposite the card's own label.
//
// Two settable keys, `name` and `email`, and one of the seven actions,
// `sign_out`. "change email" is the control for the `email` setting, not an
// eighth action.
//
// This card decides nothing about an address change: whether a typed address
// can be used, whether a link went out and when it lapses are identity's,
// reached through the two Server Functions in `../account-actions.ts`.
//
// There is no password anywhere on it because there is no password in the
// product; the note exists to say so. An owner-owed line renders as nothing,
// never as a placeholder.
"use client";

import type React from "react";
import { Lock } from "lucide-react";
import { useActionState, useState } from "react";
import { Btn, Card, Input } from "@/ui/components";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { useAction } from "./useAction";
import { BillingPanel, BillingStateBadge } from "./BillingPanel";
import { beginEmailChangeAction, cancelEmailChangeAction } from "../account-actions";
import { EMAIL_CHANGE_INITIAL, NEW_EMAIL_FIELD, refusalKeyOf } from "../account-state";
import type { BillingSummary } from "../billing";
import type { SettingsModel } from "../model";
import {
  CARD_HEAD,
  CARD_LABEL,
  CONTROLS,
  EXPLAIN,
  GLYPH,
  ROW,
  ROW_NAME,
  ROW_VALUE,
  SECTION,
  STACK,
  STEP_WARN,
  STROKE,
  VALUE,
} from "../style";

export function AccountPanel(p: {
  account: SettingsModel["account"];
  billing: BillingSummary;
}): React.JSX.Element {
  const action = useAction();
  const [changeState, submitChange] = useActionState(beginEmailChangeAction, EMAIL_CHANGE_INITIAL);
  // The typed address, kept across a refusal: a customer told "that address
  // already belongs to an account" must not also have to retype it.
  const [typed, setTyped] = useState("");
  const refusal = refusalKeyOf(changeState);
  const refusalLine = refusal === null ? null : writtenLine(refusal);
  const pending = p.account.pending;

  return (
    <Card
      state="default"
      title={
        <div className={CARD_HEAD}>
          <span className={CARD_LABEL}>
            <Lock size={GLYPH} strokeWidth={STROKE} aria-hidden />
            <span className="eyebrow">{copy("settings.account.title")}</span>
          </span>
          <BillingStateBadge billing={p.billing} />
        </div>
      }
    >
      <div className={SECTION}>
        <div className={ROW} data-testid="setting-email">
          <span className={ROW_NAME}>{copy("settings.account.email")}</span>
          {/* The address the account signs in with — never the one awaiting
              confirmation, which has not replaced it. */}
          <span className={VALUE}>{p.account.email}</span>
        </div>

        <div className={ROW} data-testid="setting-name">
          <span className={ROW_NAME}>{copy("settings.account.name")}</span>
          <span className={ROW_VALUE}>
            {/* An account that has stated no name shows an empty value
                rather than an invented one; the label still names it. */}
            <span className="min-w-0 wrap-anywhere">{p.account.name ?? ""}</span>
            <Btn label={copy("settings.edit")} size="sm" variant="secondary" pill />
          </span>
        </div>

        <BillingPanel billing={p.billing} />

        {/* The notes are the keys identity returned, in its own order — the
            card holds no list, so a third line is a change in one place.
            Their own box, because the plan's lines now share this card. */}
        <div className={SECTION} data-testid="account-notes">
          {p.account.noteKeys.map((key) => {
            const note = writtenLine(key);
            return note === null ? null : (
              <p key={key} className={EXPLAIN}>
                {note}
              </p>
            );
          })}
        </div>

        {pending === null ? null : (
          <div className={STEP_WARN} data-testid="email-pending">
            <span className="eyebrow opacity-60">{copy("settings.account.email-pending")}</span>
            <span className={VALUE} data-testid="email-pending-address">
              {pending.email}
            </span>
            {/* The moment, formatted once on the model in the customer's own
                zone. This card states no date of its own. */}
            <p className={EXPLAIN}>
              {copy("settings.account.email-pending-expires", { at: pending.expiresAt })}
            </p>
            <form action={cancelEmailChangeAction}>
              <Btn
                label={copy("settings.account.cancel-change")}
                size="sm"
                variant="secondary"
                pill
                type="submit"
              />
            </form>
          </div>
        )}

        {/* One field, and the same field whether a change is in flight or
            not: submitting it while one is pending replaces that one. */}
        <form action={submitChange} className={STACK} data-testid="email-change">
          {/* Two calls, not one with a spread: `InputProps` is a union in
              which `invalid` and `invalidMessage` arrive together. */}
          {refusalLine === null ? (
            <Input
              name={NEW_EMAIL_FIELD}
              label={copy("settings.account.new-email")}
              placeholder={copy("settings.account.new-email")}
              value={typed}
              onChange={setTyped}
            />
          ) : (
            <Input
              name={NEW_EMAIL_FIELD}
              label={copy("settings.account.new-email")}
              placeholder={copy("settings.account.new-email")}
              value={typed}
              onChange={setTyped}
              invalid
              invalidMessage={refusalLine}
            />
          )}
          <div className={CONTROLS}>
            <Btn
              label={copy("settings.account.change-email")}
              size="sm"
              variant="secondary"
              pill
              type="submit"
            />
            <span data-testid="action-sign_out">
              <Btn
                label={copy("settings.account.sign-out")}
                size="sm"
                variant="secondary"
                pill
                onClick={() => action.run("sign_out")}
              />
            </span>
          </div>
        </form>

        {action.line === null ? null : <p className={EXPLAIN}>{action.line}</p>}
      </div>
    </Card>
  );
}
