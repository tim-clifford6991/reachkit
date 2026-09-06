// src/lib/account/provisioning/sign-in-link.ts — BUILD §13
//
// The port a sign-in link is issued through, and the reason it is a port.
//
// §13 ends "send magic link → `/setup`". Two halves make that sentence
// true: a link (a token, a row, an expiry, a redemption) and a mail. The
// token half is the identity module's — `auth_links`, `issueLink`,
// `redeemLink`, `currentSession` — and it is issue #35's, under its own
// migration sub-token. This module owns the *occasions* on which a link is
// sent, which is what §13 is about, and it holds no token.
//
// **It fails closed and says so.** With nothing registered, `issueSignInLink`
// answers `{ issued: false, reason: 'not_wired' }`. It does not invent a
// URL, and no mail is composed around one: a magic-link mail carrying a
// dead link is worse than no mail, because the founder spends their attempt
// on it and concludes the product is broken rather than that it is late.
// The 15-minute chase (REQ-024 c5) is what carries the link once #35 lands,
// and it is written to work from either state.
//
// The registration door is the same one `registerCorrectionRunner` and
// `registerSuppressionReader` use, for the same reason: a `src/lib` module
// cannot import the module that will own the thing, and a fake is worse
// than an honest refusal.

export type LinkPurpose = "sign_in";

export type IssuedLink =
  | { issued: true; url: string; expiresAt: Date }
  | { issued: false; reason: "vendor" | "not_wired" };

export type SignInLinkIssuer = (a: {
  userId: string;
  to: string;
  purpose: LinkPurpose;
}) => Promise<IssuedLink>;

const notWiredYet: SignInLinkIssuer = async () => ({ issued: false, reason: "not_wired" });

let issuer: SignInLinkIssuer = notWiredYet;

/** Wired by the module that owns `auth_links` (issue #35); `null` restores
 *  the fail-closed default. */
export function registerSignInLinkIssuer(next: SignInLinkIssuer | null): void {
  issuer = next ?? notWiredYet;
}

/** Whether anything at all has been registered here.
 *
 *  Issue #35's own wiring (`../identity/wire.ts`) reads this before it
 *  registers, so that an issuer somebody has deliberately put in place is
 *  never silently replaced by the default one. A suite that stands a
 *  counting double in front of this port is the case that matters: without
 *  this predicate, the first `sendSignInLink` call would wire the real
 *  issuer over the double and the suite would be measuring nothing. */
export function signInLinkIssuerWired(): boolean {
  return issuer !== notWiredYet;
}

export async function issueSignInLink(a: {
  userId: string;
  to: string;
}): Promise<IssuedLink> {
  return issuer({ userId: a.userId, to: a.to, purpose: "sign_in" });
}
