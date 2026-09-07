// BUILD §4.7 · §13 — the Server Functions behind the account card's three
// controls: sign out, start an address change, call one off.
//
// A file of its own, and a `"use server"` one, because all three reach
// things a client bundle cannot have. `signOut()` writes a cookie;
// `beginEmailChange()` reads the store, issues a link and sends a mail;
// `cancelEmailChange()` spends the live token. `actions.ts` — which a
// `"use client"` panel imports directly — must stay a module with none of
// that on its graph, so it imports these by reference rather than becoming
// this file.
//
// A thin adapter and nothing else (`ARCHITECTURE.md` rule 1). Every rule
// about what an address change *is* — that `users.email` does not move
// until the link is used, that a second call replaces the pending address
// rather than adding one, that a send which does not leave takes the
// pending change back out with it — belongs to
// `src/lib/account/identity/email-change.ts` and is not restated here.
// This file reads a form field, calls the seam, and hands back the key the
// seam named.
//
// **Which account is acting is the session's, not a fixture.** These three
// write, and a write against a stand-in id would be a write against
// somebody else's row. `currentSession()` answers `null` for an absent,
// forged, expired or tombstoned cookie, and each function below refuses
// rather than guessing — `src/middleware.ts` has already turned away a
// request with no cookie at all, so reaching here with no session means the
// session ended between the render and the press.
//
// **The engine is imported inside the call, not at the top**, the same as
// `calendar/publishing-actions.ts`: `@/lib/account/identity` reaches
// `@/lib/db`, which parses every environment binding the moment it is
// evaluated, and this module is imported statically by a client component
// — that is how a Server Function gets its reference. A top-level import
// would make merely *rendering* Settings require a full server
// environment, and would take the layout build and the presentation sweeps
// with it.
"use server";

import { revalidatePath } from "next/cache";
import type { ActionOutcome } from "./actions";
import { NEW_EMAIL_FIELD, type EmailChangeState } from "./account-state";

/** The screen these three write to. Revalidated after a change so the card
 *  re-reads `accountCard()` and shows what actually happened, rather than a
 *  client-side guess at it. */
const SETTINGS_PATH = "/app/settings";

/** Where a signed-out customer lands: the public front page, on a full
 *  navigation. Not a client-side route change — the cookie has just been
 *  deleted, and only a real request re-runs `src/middleware.ts` with the
 *  jar as it now is. */
const AFTER_SIGN_OUT = "/";

async function identity(): Promise<typeof import("@/lib/account/identity")> {
  return import("@/lib/account/identity");
}

/**
 * REQ-077 criterion 5. Ends **this** session and hands the browser to the
 * public front page.
 *
 * The `elsewhere` arm carries the destination because that arm is the one
 * `useAction` navigates on, and a navigation is exactly what has to happen:
 * a client-side route change would leave the deleted cookie unnoticed by
 * every already-rendered piece of the app.
 *
 * No global sign-out, and none is invented: other devices keep their
 * sessions, which is `signOut()`'s own promise and BP-061's note on it.
 */
export async function signOutAction(): Promise<ActionOutcome> {
  const { signOut } = await identity();
  await signOut();
  return { done: "elsewhere", href: AFTER_SIGN_OUT };
}

/**
 * REQ-077 criterion 2. Hands the typed address to `beginEmailChange` and
 * reports the key it answered with.
 *
 * The seam is not caught and its answer is not second-guessed. A `try` here
 * that fell back to "sent" would tell a customer a link is in their inbox
 * when no mail left the process — the one answer this control must never
 * give — so a failure below the seam surfaces as a failure. The three
 * refusals are values, not throws, and each carries its own line.
 */
export async function beginEmailChangeAction(
  _previous: EmailChangeState,
  form: FormData
): Promise<EmailChangeState> {
  const raw = form.get(NEW_EMAIL_FIELD);
  const value = typeof raw === "string" ? raw : "";

  const { beginEmailChange, currentSession } = await identity();
  const session = await currentSession();
  if (session === null) {
    // The session ended between the render and the press. Nothing was
    // attempted, and "we could not start the change just now" is what is
    // true — never "that address is not valid", which would send them to
    // retype an address that was never the problem.
    return {
      answer: "refused",
      lineKey: "settings.account.email-change-unavailable",
      value,
    };
  }

  const begun = await beginEmailChange(session.userId, value);
  if (!begun.ok) return { answer: "refused", lineKey: begun.lineKey, value };

  revalidatePath(SETTINGS_PATH);
  return { answer: "sent" };
}

/**
 * REQ-077 criterion 4. Calls the change off: the three pending columns are
 * cleared and the link already in the customer's inbox stops working. The
 * account is unchanged, because it never changed.
 *
 * Returns nothing. What happened is visible in the card the revalidation
 * re-reads — the pending block is gone — and a line saying so would be a
 * sentence about a state the customer can already see the absence of.
 */
export async function cancelEmailChangeAction(): Promise<void> {
  const { cancelEmailChange, currentSession } = await identity();
  const session = await currentSession();
  if (session === null) return;
  await cancelEmailChange(session.userId);
  revalidatePath(SETTINGS_PATH);
}
