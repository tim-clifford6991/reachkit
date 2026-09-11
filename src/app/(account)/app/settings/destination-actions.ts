// BUILD §4.7 · §9 — the Server Function behind the credential form.
//
// The M10 gap (#240): every WordPress engine part was built and tested —
// client, adapter, marks, SEO detection, unpublish, `canPublish`,
// `canStamp`, health — and `connect()` / `storeConfig()` had no caller
// anywhere under `src/app/**`, so a customer could not connect their
// WordPress at all. This file is the missing call and nothing more: it
// reads two values, names the account, calls the seam and hands back what
// the seam answered (`ARCHITECTURE.md` rule 1).
//
// **The credential passes through and is never held.** It arrives as an
// argument, goes into `connect`/`reconnect` — which seal it through
// `storeConfig` — and is referenced nowhere after. This module keeps no
// copy, writes no log line, and its return type has **no member a
// credential, a URL or a vendor string could travel in**: the outcome is a
// boolean and a `HealthReason` token from a closed union. That is what
// makes §9's "credentials … never logged" hold here as a property of the
// signature rather than as care taken at the call site.
//
// **Which account.** The session's, through `_session/account.ts` — never a
// value the browser sent. A Server Function is an addressable endpoint, so
// neither a site id nor a destination id is a parameter: one would let any
// signed-in customer write another account's destination. Which row is
// written is derived here, from that account's own live set.
//
// **Connect or reconnect is derived, not asked for.** A founder who chose
// WordPress at setup already has a row (`applySetupChoice` writes it
// `expired`/`never_connected`), and a founder who did not has none. The
// browser cannot know or be trusted to say which, and the two calls differ
// in exactly one way — whether a row is inserted — so this file asks the
// database and picks.
//
// **A refusal stores the credential and keeps the state the check found.**
// That is `connect`/`reconnect`'s own rule and not this file's: the
// credential is validated by the health check, never by the act of
// connecting, so what the customer reads afterwards is the *state's* line
// on a redrawn card rather than a sentence this form composed. Nothing the
// customer's site said comes back through here.
//
// **A session-less press lands on `/signin`**, like every other settings
// outcome (DECISIONS 2026-09-07, #134).
//
// **The engine is imported at the call, not at the top.** This module is
// imported statically by a client component — that is how a Server Function
// gets its reference — and `@/lib/publish/destinations` reaches
// `@/lib/db`, which parses every environment binding the moment it is
// evaluated. Deferring it keeps merely *rendering* Settings free of the
// database, the same way `change-actions.ts` does.
"use server";

// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-07: WordPress connect: DestinationAction gains a connect member for a
//   never-connected WordPress destination; the credential form lives in the Publishing card
//   (no route, no modal), takes site URL and application password only, the account from the
//   session; the password is never echoed, cleared on every outcome, and exists only sealed
//   inside storeConfig/withConfig; the credential is validated by the health check, never by
//   the act of connecting, so a refusal is a state with a control, not a bounced form;
//   disconnect stays in the Danger zone's unpublish-all step; setup's hand-off is one line on
//   the waiting screen pointing at the card. — #240
//
// DECISIONS 2026-09-07: The WordPress connect form asks for three fields — site address,
//   WordPress username, application password — because an application password authenticates
//   as username:password; the credential travels one way into storeConfig and ConnectOutcome
//   has no member a credential, URL or vendor string could ride in; a refusal is the health
//   check's state redrawn on the card, never a form-shaped sentence; setup's hand-off is the
//   destination row itself (the waiting screen redirects the moment the pass ends). — #252

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SIGNIN_PATH } from "@/lib/account/identity/addresses";
import type { HealthReason } from "@/lib/publish/types";

/**
 * What connecting answered.
 *
 * Two arms and no third, and **nothing on either can carry a string the
 * customer's site wrote**: `because` is a `HealthReason`, a token from the
 * closed union the health check concluded with, which the card already
 * renders through the registry. A `message` member here is exactly the
 * route a vendor payload would take to a screen.
 */
const SETTINGS_PATH = "/app/settings";

export type ConnectOutcome =
  | { connected: true }
  | { connected: false; because: HealthReason };

/** The credential, as the form hands it over.
 *
 *  **Three fields and no fourth** (master's ruling, 2026-09-07). A
 *  WordPress application password authenticates as
 *  `username:app-password` and is scoped to the account that created it,
 *  so the user it was issued to is part of the credential and not
 *  something this product can derive. What is *not* here is the point of
 *  the shape: no site id, no destination id, no kind — the account is the
 *  session's and which row to write is derived from it. */
export interface WordPressCredential {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

async function siteId(): Promise<string> {
  const { appAccount } = await import("../_session/account");
  const account = await appAccount();
  if (!account.ok) redirect(SIGNIN_PATH);
  return account.account.siteId;
}

async function actor(): Promise<{ kind: "customer"; userId: string }> {
  const { appAccount } = await import("../_session/account");
  const account = await appAccount();
  if (!account.ok) redirect(SIGNIN_PATH);
  return { kind: "customer", userId: account.account.userId };
}

/**
 * REQ-060 — the customer's WordPress, connected.
 *
 * The whole of the decision here is *which* call: a live WordPress
 * destination is reconnected, and a site with none has one created. Both
 * seal the credential and both let the health check say whether it works.
 *
 * The address and the user name are trimmed and nothing else is done to
 * them: normalising a site address is `WordPressConfig`'s business and
 * guessing at a password is nobody's. The password is not trimmed at all —
 * WordPress's own application passwords carry spaces, and a product that
 * quietly edited a credential would refuse a correct one.
 */
export async function connectWordPress(credential: WordPressCredential): Promise<ConnectOutcome> {
  const { connect, listDestinations, reconnect } = await import("@/lib/publish/destinations");

  const config = {
    baseUrl: credential.siteUrl.trim(),
    username: credential.username.trim(),
    applicationPassword: credential.applicationPassword,
  };

  const site = await siteId();
  const by = await actor();
  const existing = (await listDestinations(site)).find((d) => d.kind === "wordpress");

  const result =
    existing === undefined
      ? await connect({ siteId: site, kind: "wordpress", config, by })
      : await reconnect({ destinationId: existing.id, config, by });

  // The card is redrawn from the server on **both** arms, and that is the
  // whole of how a customer learns what happened. A refusal is a state the
  // check found — the row now carries it, with its own written line and
  // its own control — so re-rendering the card *is* the answer, and this
  // function needs no sentence of its own to hand back
  // (`account-actions.ts` does the same after an email change).
  revalidatePath(SETTINGS_PATH);
  return result.ok ? { connected: true } : { connected: false, because: result.reason };
}
