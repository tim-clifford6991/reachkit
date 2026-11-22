// The one place a WordPress credential is typed (REQ-060): site, user and application password, in the *Where pages go
// live* dialog. The password is cleared on every outcome that sent it; a refused credential is the redrawn line's state
// (SPEC §5, no vendor text). Only a non-https address is refused here.
"use client";

import type React from "react";
import { useCallback, useState, useTransition } from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { writtenLine } from "../../_shell/written";
import { connectWordPress } from "../destination-actions";

/** The three states this form answers, and the word each is offered under.
 *  Total over the actions that need a credential: `none` and `set_dns` are
 *  not here, because neither is asking for one. */
export type CredentialAction = "connect" | "reconnect" | "reconnect_other_account";

const ACTION_COPY_KEY: Record<CredentialAction, CopyKey> = {
  connect: "settings.publishing.connect",
  reconnect: "settings.publishing.reconnect",
  reconnect_other_account: "settings.publishing.reconnect-other-account",
};

export function ConnectDestination(p: { action: CredentialAction }): React.JSX.Element {
  const [siteUrl, setSiteUrl] = useState("");
  const [username, setUsername] = useState("");
  const [applicationPassword, setApplicationPassword] = useState("");
  // Issue 1196: React's pending state, and a line when the request never
  // came back — a rejected promise used to leave the button disabled forever.
  const [running, startRunning] = useTransition();
  const [line, setLine] = useState<CopyKey | null>(null);
  const help = writtenLine("settings.destination.app-password.help");

  const submit = useCallback(() => {
    startRunning(async () => {
      setLine(null);
      const outcome = await connectWordPress({ siteUrl, username, applicationPassword }).catch(() => null);
      // Nothing was sent on an https refusal, so the password is kept to spare a re-paste.
      if (outcome !== null && "httpsOnly" in outcome) return setLine("settings.destination.https-only");
      // Cleared otherwise. The card is redrawn from the server either
      // way, and what it then says about this destination is the state the
      // check found — including on a refusal, which is a state and not a
      // rejected form (ADR-086).
      setApplicationPassword("");
      if (outcome === null) setLine("settings.answer.could-not-ask");
    });
  }, [applicationPassword, siteUrl, username]);

  const field = (
    label: string,
    name: string,
    value: string,
    set: (next: string) => void,
    type: "text" | "password" = "text",
    describedBy?: string
  ): React.JSX.Element => (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-sm text-base-content/70">{label}</span>
      <input
        className="input w-full"
        type={type}
        name={name}
        value={value}
        onChange={(e) => set(e.target.value)}
        aria-invalid={describedBy === undefined ? undefined : true}
        aria-describedby={describedBy}
      />
    </label>
  );

  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid="wp-credential">
      <h4 className="text-sm font-semibold">{copy(ACTION_COPY_KEY[p.action])}</h4>
      <div className="flex min-w-0 flex-col gap-2" data-testid="wp-credential-form">
        {field(
          copy("settings.destination.site-url"),
          "site-url",
          siteUrl,
          setSiteUrl,
          "text",
          line === "settings.destination.https-only" ? "wp-credential-line" : undefined
        )}
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
        {help === null ? null : <p className="text-xs text-base-content/70 wrap-anywhere">{help}</p>}
        <button type="button" className="btn btn-primary min-h-11 self-start" disabled={running} onClick={submit}>
          {running ? <span className="loading loading-spinner loading-xs" aria-hidden /> : null}
          {copy("settings.destination.submit")}
        </button>
        {line !== null ? (
          <p id="wp-credential-line" role="alert" className="text-xs text-error wrap-anywhere">
            {copy(line)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
