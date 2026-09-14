// BUILD §4.7 · REQ-060 — the one place a WordPress credential is typed.
//
// One form, reached from three states (`connect`, `reconnect`,
// `reconnect_other_account`); the word on the control is the engine's
// choice. Three fields: site, WordPress user, application password
// (2026-09-07). In the card, under its row — not a modal, not a route.
//
// The password is cleared on every outcome. A refusal renders no sentence of
// its own: the redrawn card states the destination's health (SPEC §5 — no
// vendor text).

"use client";

import type React from "react";
import { useCallback, useState } from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { connectWordPress } from "../destination-actions";

/** The three states this form answers, and the word each is offered under.
 *  Total over the actions that need a credential: `none` and `set_dns` are
 *  not here, because neither is asking for one. */
export type CredentialAction = "connect" | "reconnect" | "reconnect_other_account";

/** The test ids here are `wp-`, not `destination-`: `screen.test.tsx`
 *  counts `[data-testid^="destination-"]` to hold "one live destination per
 *  site" to a single row, and a second element under that prefix would be a
 *  second destination as far as that assertion can tell. */

const ACTION_COPY_KEY: Record<CredentialAction, CopyKey> = {
  connect: "settings.publishing.connect",
  reconnect: "settings.publishing.reconnect",
  reconnect_other_account: "settings.publishing.reconnect-other-account",
};

export function ConnectDestination(p: { action: CredentialAction }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [applicationPassword, setApplicationPassword] = useState("");
  const [running, setRunning] = useState(false);
  const help = writtenLine("settings.destination.app-password.help");

  const submit = useCallback(() => {
    setRunning(true);
    void connectWordPress({ siteUrl, username, applicationPassword }).then((outcome) => {
      // Cleared on both arms. The card is redrawn from the server either
      // way, and what it then says about this destination is the state the
      // check found — including on a refusal, which is a state and not a
      // rejected form (ADR-086).
      setApplicationPassword("");
      setRunning(false);
      if (outcome.connected) setOpen(false);
    });
  }, [applicationPassword, siteUrl, username]);

  const field = (
    label: string,
    name: string,
    value: string,
    set: (next: string) => void,
    type: "text" | "password" = "text"
  ): React.JSX.Element => (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-sm text-base-content/70">{label}</span>
      <input
        className="input w-full"
        type={type}
        name={name}
        value={value}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );

  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid="wp-credential">
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen((was) => !was)}>
        {copy(ACTION_COPY_KEY[p.action])}
      </button>

      {open ? (
        <div className="flex min-w-0 flex-col gap-2" data-testid="wp-credential-form">
          {field(copy("settings.destination.site-url"), "site-url", siteUrl, setSiteUrl)}
          {field(copy("settings.destination.username"), "wp-username", username, setUsername)}
          {/* `type="password"`: a credential in clear text is a credential in
              a screenshot. */}
          {field(
            copy("settings.destination.app-password"),
            "application-password",
            applicationPassword,
            setApplicationPassword,
            "password"
          )}
          {help === null ? null : <p className="text-xs text-base-content/60 wrap-anywhere">{help}</p>}
          <button type="button" className="btn btn-primary btn-sm" disabled={running} onClick={submit}>
            {copy("settings.destination.submit")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
