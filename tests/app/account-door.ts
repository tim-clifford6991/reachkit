// tests/app/account-door.ts — BUILD §4.4–§4.6, issue #169
//
// The one door every `(account)/app` suite drives the session through.
//
// The four surfaces resolve who is asking through
// `src/app/(account)/app/_session/account.ts`, which reads the signed
// cookie and one `sites` row. A suite has neither, and `cookies()` outside
// a request scope throws — so each suite registers an account here instead.
//
// **It registers the reserved fixture account by default**, which is what
// keeps the existing screen suites asserting what they always asserted: the
// reserved account takes the fixture branch, so the model under test is the
// same model, and what changed is only *how the surface learned whose it
// is*. A suite that wants the live branch registers a real domain and
// mocks the store it then reaches.
//
// `reset()` restores the session-backed reader, which is what stops a suite
// that registered an account from leaking one into the next.
import type { AppAccount } from "@/app/(account)/app/_session/account";
import { setAppAccountReader } from "@/app/(account)/app/_session/account";
import { LIVE_ACCOUNT, RESERVED_ACCOUNT } from "./accounts";

// The two accounts live in `accounts.ts`, which imports no product module —
// a `vi.mock` factory for the seam can reach them without importing the
// module whose factory is still running. Re-exported here so a suite that
// only needs the door has one import.
export { LIVE_ACCOUNT, RESERVED_ACCOUNT };

/** Registers an account for the surfaces to resolve. */
export function signedInAs(account: AppAccount = RESERVED_ACCOUNT): void {
  setAppAccountReader(async () => ({ ok: true, account }));
}

/** Registers a request with no session at all — the arm every surface
 *  answers with §4.3's refusal. */
export function signedOut(): void {
  setAppAccountReader(async () => ({ ok: false, because: "no_session" }));
}

/** Registers a session whose account has not finished setup. */
export function withoutASite(): void {
  setAppAccountReader(async () => ({ ok: false, because: "no_site" }));
}

/** Restores the session-backed reader. */
export function resetAccount(): void {
  setAppAccountReader(null);
}
