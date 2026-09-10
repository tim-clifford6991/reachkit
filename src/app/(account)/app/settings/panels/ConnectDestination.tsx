// BUILD §4.7 · REQ-060 — the one place a WordPress credential is typed.
//
// The Publishing card lists destinations with their health and the control
// the engine chose; until #240 every one of those controls was a bare
// `Btn` with nothing behind it, and `connect()` / `storeConfig()` had no
// caller on any screen. This component is that caller's front half.
//
// **One form, reached from three states.** A destination that has never
// held a credential (`connect`), one whose credential ran out
// (`reconnect`), and one whose credential is valid and cannot publish
// (`reconnect_other_account`) all need the same three fields — the word on
// the control differs because what the customer is being asked to do
// differs, and that word is the engine's choice rendered through the
// registry, not this component's.
//
// **Three fields: the site, the WordPress user, and that user's
// application password** (master's ruling, 2026-09-07). The user is not
// derivable — an application password authenticates as
// `username:app-password` and is scoped to the account that made it — so a
// form that asked for two would refuse every real site.
//
// **In the card, not a modal and not a route.** A second surface would be
// a second place to keep honest about a credential; a modal needs focus
// management this screen does not have. The form opens under the row it
// belongs to and closes when it succeeds.
//
// **Nothing here holds the credential after the call.** The password is
// state for as long as the customer is typing it and is cleared on every
// outcome, success or refusal — a refusal that left it in the field would
// leave a credential sitting in a DOM node on a screen the customer may
// walk away from. The site address is kept: retyping a URL that was right
// is friction with no purpose.
//
// **A refusal renders no sentence of its own.** The credential is
// validated by the health check, so what the customer reads is the
// destination's own state and line on the redrawn card. The redraw is the
// Server Function's `revalidatePath`, not a `useRouter().refresh()` here:
// the action already knows the path, and a hook would put an app-router
// context between this component and every suite that renders it to
// static markup. This component composes no message, and there is no
// member on `ConnectOutcome` for one to arrive in.
"use client";

import type React from "react";
import { useCallback, useState } from "react";
import { Btn } from "@/ui/components/Btn";
import { Input } from "@/ui/components/Input";
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

  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid="wp-credential">
      <Btn
        label={copy(ACTION_COPY_KEY[p.action])}
        size="sm"
        onClick={() => setOpen((was) => !was)}
      />

      {open ? (
        <div className="flex min-w-0 flex-col gap-2" data-testid="wp-credential-form">
          <Input
            label={copy("settings.destination.site-url")}
            name="site-url"
            value={siteUrl}
            onChange={setSiteUrl}
          />
          <Input
            label={copy("settings.destination.username")}
            name="wp-username"
            value={username}
            onChange={setUsername}
          />
          {/* `type="password"`: a credential rendered in clear text is a
              credential in a screenshot. The user name is not one — it is
              half of a pair, and hiding it would only stop the customer
              checking what they typed. */}
          <Input
            label={copy("settings.destination.app-password")}
            name="application-password"
            type="password"
            value={applicationPassword}
            onChange={setApplicationPassword}
          />
          {help === null ? null : <p className="text-xs text-[color:var(--ink-quiet)] wrap-anywhere">{help}</p>}
          <Btn
            label={copy("settings.destination.submit")}
            size="sm"
            disabled={running}
            onClick={submit}
          />
        </div>
      ) : null}
    </div>
  );
}
