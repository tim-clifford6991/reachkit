// BUILD §4.7 — "**Account** (name, email, magic-link note, change email, sign
// out)".
//
// Two settable keys, `name` and `email`, and one of the seven actions,
// `sign_out`. "change email" is the control for the `email` setting, not an
// eighth action: REQ-070 criterion 2's list of what the screen *does* besides
// change settings names invoices, cancel, resume, sign out, export, unpublish
// and delete — and changing an address is changing a setting.
//
// The magic-link note is the one genuinely owner-owed sentence on this screen:
// §4.7 names it and prints no note, and nothing else in the spec writes one.
// It renders as nothing until the owner writes it — never as a placeholder,
// and never as the key.
//
// There is no password anywhere on this card because there is no password in
// the product (§13: identity is a magic link). The note exists to say so, and
// the absence of a password control is not an oversight to be tidied later.
"use client";

import type React from "react";
import { Btn } from "@/ui/components/Btn";
import { Card } from "@/ui/components/Card";
import { copy } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { useAction } from "./useAction";
import type { SettingsModel } from "../model";

export function AccountPanel(p: { account: SettingsModel["account"] }): React.JSX.Element {
  const action = useAction();
  const magicLink = writtenLine("settings.account.magic-link");

  return (
    <Card state="default" title={<h2>{copy("settings.account.title")}</h2>}>
      <div className="rk-settings-fields">
        <div className="rk-settings-field" data-testid="setting-name">
          <span className="rk-settings-label">{copy("settings.account.name")}</span>
          <div className="rk-settings-row">
            <span className="rk-settings-value">{p.account.name}</span>
            <Btn label={copy("settings.edit")} size="sm" />
          </div>
        </div>

        <div className="rk-settings-field" data-testid="setting-email">
          <span className="rk-settings-label">{copy("settings.account.email")}</span>
          <div className="rk-settings-row">
            {/* §2.3: an address is a code-like string. */}
            <span className="rk-settings-value num">{p.account.email}</span>
            <Btn label={copy("settings.account.change-email")} size="sm" />
          </div>
        </div>
      </div>

      {magicLink === null ? null : <p className="rk-settings-line">{magicLink}</p>}

      <div className="rk-settings-row">
        <span data-testid="action-sign_out">
          <Btn
            label={copy("settings.account.sign-out")}
            size="sm"
            variant="ghost"
            onClick={() => action.run("sign_out")}
          />
        </span>
      </div>

      {action.line === null ? null : <p className="rk-settings-line">{action.line}</p>}
    </Card>
  );
}
