// src/lib/account/identity/wire.ts — BUILD §13
//
// Plugging the token half of a sign-in link into the seam the mail half
// declared.
//
// `../provisioning/sign-in-link.ts` (issue #33) holds `issueSignInLink` as
// a **port** with a fail-closed default: with nothing registered it answers
// `{ issued: false, reason: 'not_wired' }` and no magic-link mail is
// composed around a URL that does not exist. This module is what fills it,
// and it is the only place that does — the same shape, and for the same
// reason, as `src/lib/mail/leads/wire.ts` filling the send seam's
// stoppability port.
//
// Idempotent, and called from `./index.ts` at module load and from
// `sendSignInLink` itself, so no caller has to remember to wire it and no
// ordering of imports can leave a paid customer's link silently unissued.
//
// **It never replaces an issuer somebody else registered.** The port has
// one registration door and more than one thing may come through it — a
// suite standing a counting double in front of it, most of all. Wiring on
// top of that would leave the suite measuring the real issuer while
// believing it was measuring its own, so this checks first and defers.
import { registerSignInLinkIssuer, signInLinkIssuerWired } from "../provisioning/sign-in-link";
import { issueLink } from "./links";

let wired = false;

export function wireSignInLinkIssuer(): void {
  if (wired || signInLinkIssuerWired()) return;
  registerSignInLinkIssuer(async (a) => {
    const issued = await issueLink({ userId: a.userId, to: a.to, purpose: a.purpose });
    return issued.issued
      ? { issued: true, url: issued.url, expiresAt: issued.expiresAt }
      : { issued: false, reason: "vendor" };
  });
  wired = true;
}

/** The suites' door back out, so one test's wiring cannot leak into the
 *  next: this restores the seam's fail-closed default. */
export function unwireSignInLinkIssuer(): void {
  registerSignInLinkIssuer(null);
  wired = false;
}
