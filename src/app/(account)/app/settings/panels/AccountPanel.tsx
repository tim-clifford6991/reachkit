// BUILD §4.7 — "**Account** (name, email, magic-link note, change email, sign
// out)", wired to identity (#134).
//
// Two settable keys, `name` and `email`, and one of the seven actions,
// `sign_out`. "change email" is the control for the `email` setting, not an
// eighth action: REQ-070 criterion 2's list of what the screen *does* besides
// change settings names invoices, cancel, resume, sign out, export, unpublish
// and delete — and changing an address is changing a setting.
//
// **This card decides nothing about an address change.** Whether a typed
// address can be used, whether a link went out, whether a change is still in
// flight and when it lapses are all `src/lib/account/identity/`'s, reached
// through the two Server Functions in `../account-actions.ts`. The card
// submits, renders the arm it is handed, and holds no clock, no validator and
// no second copy of the window.
//
// **The notes are the keys identity returns**, in `noteKeys`' own order —
// REQ-077 criterion 1's two lines. The card holds no array of its own, so a
// third line is a change in one place.
//
// **There is no password anywhere on this card** because there is no password
// in the product (§13: identity is a magic link). The note exists to say so,
// and the absence of a password control is not an oversight to be tidied
// later.
//
// **An owner-owed line renders as nothing, never as a placeholder.** That
// includes the three refusals `beginEmailChange` can answer with: until they
// are written, a refused change states nothing, which is this screen's
// standing convention (`writtenLine`) and not a swallowed error — the call
// was made, the answer was read, and the sentence is the owner's. `Input`'s
// own contract says the same thing from the other side: there is no call
// shape that marks a field invalid without supplying the line explaining
// why, so the field is only marked invalid once there is one to show.
"use client";

import type React from "react";
import { ArrowRight, FileText, Lock } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { useAction } from "./useAction";
import { SettingRow } from "./SettingRow";
import { beginEmailChangeAction, cancelEmailChangeAction } from "../account-actions";
import { EMAIL_CHANGE_INITIAL, NEW_EMAIL_FIELD, refusalKeyOf } from "../account-state";
import type { SettingsModel } from "../model";

export function AccountPanel(p: { account: SettingsModel["account"]; pages: number }): React.JSX.Element {
  const action = useAction();
  const [changeState, submitChange, changing] = useActionState(beginEmailChangeAction, EMAIL_CHANGE_INITIAL);
  const [cancelling, startCancelling] = useTransition();
  // The typed address, kept across a refusal — `Input`'s contract ("the
  // invalid value stays intact") and REQ-077's own shape: a customer told
  // "that address already belongs to an account" must not also have to
  // retype it. An uncontrolled field would be cleared by React's own
  // post-action form reset, which is the opposite of what is wanted here.
  const [typed, setTyped] = useState("");
  const refusal = refusalKeyOf(changeState);
  const refusalLine = refusal === null ? null : writtenLine(refusal);
  const pending = p.account.pending;

  return (
    <section className="card card-border min-w-0 bg-base-100">
      <div className="card-body gap-4">
        <h2 className="card-title text-base">
          <Lock size={20} strokeWidth={1.75} aria-hidden />
          {copy("settings.account.title")}
        </h2>

        {/* The settable rows every Settings tab draws (`SettingRow`): the
            name at the near edge, the value at the far one (#1089). */}
        <div className="flex min-w-0 flex-col">
          <SettingRow name={copy("settings.account.name")} testId="setting-name">
            {/* An account with no stated name shows an empty value, never an
                invented one.
                **And no Edit beside it** (SPEC §4, 2026-09-20, #908, issue
                #913: "a control that cannot act is not drawn"). There is no
                writer of `users.name` anywhere in this product — the column
                is read by the card and by the mail shell and written by
                nothing — so the press was drawn with no handler behind it
                and could never have stored a name. It returns with its
                writer, on the same footing as the calendar's Move. */}
            <span className="min-w-0 wrap-anywhere">{p.account.name ?? ""}</span>
          </SettingRow>

          <SettingRow name={copy("settings.account.email")} testId="setting-email">
            {/* The address the account signs in with — never the one awaiting
                confirmation (REQ-077 c2). */}
            <span className="num min-w-0 wrap-anywhere">{p.account.email}</span>
          </SettingRow>
        </div>

        {pending === null ? null : (
          <div className="alert alert-warning alert-soft flex min-w-0 flex-col items-start gap-2" data-testid="email-pending">
            <span className="text-sm font-semibold">{copy("settings.account.email-pending")}</span>
            <span className="num min-w-0 wrap-anywhere" data-testid="email-pending-address">
              {pending.email}
            </span>
            {/* The moment arrives formatted on the model, in the customer's
                own zone. */}
            <p className="text-xs wrap-anywhere">
              {copy("settings.account.email-pending-expires", { at: pending.expiresAt })}
            </p>
            <form action={() => startCancelling(() => cancelEmailChangeAction())}>
              <button type="submit" className="btn btn-ghost btn-sm" disabled={cancelling}>
                {cancelling ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
                {copy("settings.account.cancel-change")}
              </button>
            </form>
          </div>
        )}

        {/* One field whether or not a change is in flight: submitting while
            one is pending replaces it (REQ-077 c4). */}
        <form action={submitChange} className="flex min-w-0 flex-col gap-2" data-testid="email-change">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-sm text-base-content/70">{copy("settings.account.new-email")}</span>
            <input
              className={refusalLine === null ? "input num w-full" : "input input-error num w-full"}
              name={NEW_EMAIL_FIELD}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-invalid={refusalLine !== null}
            />
          </label>
          {refusalLine === null ? null : <p className="text-xs text-error wrap-anywhere">{refusalLine}</p>}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button type="submit" className="btn btn-soft btn-primary btn-sm" disabled={changing}>
              {changing ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
              {copy("settings.account.change-email")}
            </button>
          </div>
        </form>

        {p.account.noteKeys.map((key) => {
          const note = writtenLine(key);
          return note === null ? null : (
            <p key={key} className="text-xs text-base-content/70 wrap-anywhere">
              {note}
            </p>
          );
        })}

        <div
          className="bg-base-200 rounded-box flex min-w-0 flex-wrap items-center gap-2 p-3 text-sm"
          role="group"
          aria-label={copy("settings.account.signin.label")}
          data-testid="account-signin"
        >
          <span>{copy("settings.account.signin.mail")}</span>
          <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
          <span>{copy("settings.account.signin.open")}</span>
          <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
          <span>{copy("settings.account.signin.in")}</span>
        </div>

        {/* REQ-078: export is always available, so nothing gates this control. */}
        <div className="border-base-300 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t pt-4" data-testid="action-export">
          <div className="flex min-w-0 items-start gap-2">
            <FileText size={20} strokeWidth={1.75} aria-hidden className="shrink-0" />
            <span className="flex min-w-0 flex-col">
              <strong className="text-sm">{copy("settings.content.export")}</strong>
              <span className="text-xs text-base-content/70 wrap-anywhere">
                {copy("settings.account.export.note", { pages: String(p.pages) })}
              </span>
            </span>
          </div>
          <button type="button" className="btn btn-soft btn-primary btn-sm" onClick={() => action.run("export")} disabled={action.pending !== null}>
            {action.pending === "export" ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
            {copy("settings.content.export")}
          </button>
        </div>

        <div className="border-base-300 flex min-w-0 flex-wrap items-center gap-2 border-t pt-4">
          <span data-testid="action-sign_out">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => action.run("sign_out")}
              disabled={action.pending !== null}
            >
              {action.pending === "sign_out" ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
              {copy("settings.account.sign-out")}
            </button>
          </span>
        </div>

        {action.line === null ? null : <p className="text-xs text-base-content/70 wrap-anywhere">{action.line}</p>}
      </div>
    </section>
  );
}

