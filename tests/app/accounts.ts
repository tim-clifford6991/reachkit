// tests/app/accounts.ts — issue #169
//
// The accounts every `(account)` suite signs in as, as plain data.
//
// **Deliberately separate from `account-door.ts`, which imports the seam
// itself.** A `vi.mock` factory for `_session/account` that reached for the
// door would be importing the module whose factory is still running — the
// mock waits on the import, the import waits on the mock, and the suite
// hangs rather than failing. Keeping the values in a module that imports
// nothing of the product's makes that unrepresentable.
import type { AppAccount } from "@/app/(account)/app/_session/account";

/** The reserved fixture account. `example.com` is IANA-reserved and can
 *  never be a customer's domain, which is what makes "the fixture answers
 *  only for this account" a fact about the name rather than a flag. */
export const RESERVED_ACCOUNT: AppAccount = Object.freeze({
  userId: "00000000-0000-0000-0000-0000000000a1",
  siteId: "00000000-0000-0000-0000-0000000000b1",
  domain: "example.com",
  createdAt: new Date("2026-08-17T06:00:00.000Z"),
  // The zone the shell's own fixture states (REQ-073 c1 — a stated zone,
  // never the machine's).
  timeZone: "America/New_York",
  mode: "autopilot",
});

/** A real customer's account: a domain no fixture answers for, so every
 *  surface takes its live branch. */
export const LIVE_ACCOUNT: AppAccount = Object.freeze({
  userId: "00000000-0000-0000-0000-0000000000a2",
  siteId: "00000000-0000-0000-0000-0000000000b2",
  domain: "acme.test",
  createdAt: new Date("2026-08-24T06:00:00.000Z"),
  timeZone: "America/New_York",
  mode: "autopilot",
});

/** UI-SPEC S13's customer (issue #353): the deep pass has read their market
 *  once and no weekly pass has run, so `/app` answers with the week-0 arm.
 *  A live domain, like `LIVE_ACCOUNT`'s — the arm is a property of what has
 *  been measured, not of which branch answers, and a fixture account could
 *  only ever show one of the two states. */
export const WEEK_ZERO_ACCOUNT: AppAccount = Object.freeze({
  userId: "00000000-0000-0000-0000-0000000000a3",
  siteId: "00000000-0000-0000-0000-0000000000b3",
  domain: "newco.test",
  createdAt: new Date("2026-08-31T06:00:00.000Z"),
  timeZone: "America/New_York",
  mode: "autopilot",
});
