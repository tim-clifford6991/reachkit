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
import { Lock } from "lucide-react";
import { useActionState, useState } from "react";
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { CardHead } from "@/ui/idiom";
import { Input } from "@/ui/components/Input";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { useAction } from "./useAction";
import { beginEmailChangeAction, cancelEmailChangeAction } from "../account-actions";
import { EMAIL_CHANGE_INITIAL, NEW_EMAIL_FIELD, refusalKeyOf } from "../account-state";
import type { SettingsModel } from "../model";

export function AccountPanel(p: { account: SettingsModel["account"] }): React.JSX.Element {
  const action = useAction();
  const [changeState, submitChange] = useActionState(beginEmailChangeAction, EMAIL_CHANGE_INITIAL);
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
    <Card state="default" title={<CardHead icon={<Lock size={15} strokeWidth={1.8} aria-hidden />} eyebrow={copy("settings.account.title")} />}>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-1" data-testid="setting-name">
          <span className="eyebrow text-[color:var(--ink-quiet)]">{copy("settings.account.name")}</span>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {/* `null` where the account has stated no name: the card shows an
                empty value rather than inventing one, and the label still
                names what is missing. */}
            <span className="min-w-0 wrap-anywhere">{p.account.name ?? ""}</span>
            <Btn label={copy("settings.edit")} size="sm" />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1" data-testid="setting-email">
          <span className="eyebrow text-[color:var(--ink-quiet)]">{copy("settings.account.email")}</span>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {/* §2.3: an address is a code-like string. The address the
                account signs in with — never the one awaiting confirmation,
                which has not replaced it and must not read as though it
                had (REQ-077 c2). */}
            <span className="num min-w-0 wrap-anywhere">{p.account.email}</span>
          </div>
        </div>

        {pending === null ? null : (
          <div
            className="flex min-w-0 flex-col gap-2 rounded-field border border-warning/40 border-l-4 border-l-warning bg-warning/10 p-3"
            data-testid="email-pending"
          >
            <span className="eyebrow text-[color:var(--ink-quiet)]">{copy("settings.account.email-pending")}</span>
            <span className="num min-w-0 wrap-anywhere" data-testid="email-pending-address">
              {pending.email}
            </span>
            {/* The moment, formatted once on the model in the customer's own
                zone. This card states no date of its own. */}
            <p className="text-xs text-[color:var(--ink-quiet)] wrap-anywhere">
              {copy("settings.account.email-pending-expires", { at: pending.expiresAt })}
            </p>
            <form action={cancelEmailChangeAction}>
              <Btn label={copy("settings.account.cancel-change")} size="sm" type="submit" />
            </form>
          </div>
        )}

        {/* One field, and it is the same field whether there is a change in
            flight or not: submitting it while one is pending replaces that
            one rather than adding a second, which is `beginEmailChange`'s
            own behaviour and REQ-077 c4's "or replace it". */}
        <form action={submitChange} className="flex min-w-0 flex-col gap-1" data-testid="email-change">
          {/* Two calls, not one with a spread: `InputProps` is a union in
              which `invalid: true` and `invalidMessage` arrive together, and
              spreading a maybe-object would defeat exactly the guarantee
              that union exists for. */}
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
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Btn label={copy("settings.account.change-email")} size="sm" type="submit" />
          </div>
        </form>
      </div>

      {p.account.noteKeys.map((key) => {
        const note = writtenLine(key);
        return note === null ? null : (
          <p key={key} className="text-xs text-[color:var(--ink-quiet)] wrap-anywhere">
            {note}
          </p>
        );
      })}

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span data-testid="action-sign_out">
          <Btn
            label={copy("settings.account.sign-out")}
            size="sm"
            variant="ghost"
            onClick={() => action.run("sign_out")}
          />
        </span>
      </div>

      {action.line === null ? null : <p className="text-xs text-[color:var(--ink-quiet)] wrap-anywhere">{action.line}</p>}
    </Card>
  );
}
