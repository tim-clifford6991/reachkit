// src/lib/account/identity/index.ts — BUILD §13, §4.7
//
// The identity module's one door: the link, the session, and the address a
// customer signs in with — all three on Supabase Auth since #468.
//
// Importing this module wires the sign-in-link issuer into the seam issue
// #33 declared (`./wire.ts`) — the same load-time wiring
// `src/lib/mail/leads/index.ts` does for the send seam's stoppability port,
// and for the same reason: a port left unfilled fails closed and a founder
// who paid gets no way in.
import { wireSignInLinkIssuer } from "./wire";

wireSignInLinkIssuer();

export {
  CONFIRM_PATH,
  SIGNIN_PATH,
  confirmLinkPath,
  deadLinkPath,
  isAuthCookieName,
  type ConfirmType,
} from "./addresses";
export {
  identityAuth,
  setIdentityAuth,
  type CookieIO,
  type CookieToSet,
  type IdentityAuth,
} from "./auth";
export { issueLink, redeemLink } from "./links";
export { DEAD_LINK_KEY, type IssuedLink, type RedeemedLink } from "./outcomes";
export {
  currentSession,
  requestCookieIO,
  signOut,
  signOutEverywhere,
  type Session,
} from "./session";
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
