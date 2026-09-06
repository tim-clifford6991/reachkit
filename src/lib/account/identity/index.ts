// src/lib/account/identity/index.ts — BUILD §13, §4.7
//
// The identity module's one door: the link, the session, and the address a
// customer signs in with.
//
// Importing this module wires the sign-in-link issuer into the seam issue
// #33 declared (`./wire.ts`) — the same load-time wiring
// `src/lib/mail/leads/index.ts` does for the send seam's stoppability port,
// and for the same reason: a port left unfilled fails closed and a founder
// who paid gets no way in.
import { wireSignInLinkIssuer } from "./wire";

wireSignInLinkIssuer();

export { SESSION_COOKIE_NAME, SIGNIN_PATH, deadLinkPath, signInLinkPath } from "./addresses";
export { issueLink, redeemLink } from "./links";
export { DEAD_LINK_KEY, type IssuedLink, type RedeemedLink } from "./outcomes";
export { currentSession, sessionCookie, signOut, type Session } from "./session";
export {
  ACCOUNT_NOTE_KEYS,
  accountCard,
  beginEmailChange,
  cancelEmailChange,
  type AccountCard,
  type BeginEmailChange,
} from "./email-change";
export { identityStore, setIdentityStore, type IdentityStore, type LinkPurpose } from "./store";
export { wireSignInLinkIssuer, unwireSignInLinkIssuer } from "./wire";
