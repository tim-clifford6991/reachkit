// tests/account/identity/session.test.ts — BUILD §13, issue #35
//
// REQ-077 criterion 5, quoted: "Given the customer signs out, when they do,
// then that session ends and returning requires a fresh sign-in link."
//
// And BP-061's note on the same criterion: "Sign-out ends the current
// session only. Other devices keep their sessions; REQ-077 states no global
// sign-out and none is invented." The two-device case is what discriminates
// that, and it is the case a "tidy up by ending every session" change would
// fail.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

/** One cookie jar per test, standing in for the request's. `next/headers`
 *  is the only request-scoped thing this module touches. */
const jar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));

const { SESSION_COOKIE_NAME } = await import("../../../src/lib/account/identity/addresses");
const { mintSessionCookie } = await import("../../../src/lib/account/identity/cookie");
const { currentSession, sessionCookie, signOut } = await import(
  "../../../src/lib/account/identity/session"
);
const { setIdentityStore } = await import("../../../src/lib/account/identity/store");
const { SESSION_TTL_DAYS } = await import("../../../src/lib/config/constants");
const { addAccount, memoryIdentityStore, newMemoryIdentity } = await import("./memory-store");

let state = newMemoryIdentity();

beforeEach(() => {
  jar.clear();
  state = newMemoryIdentity();
  setIdentityStore(memoryIdentityStore(state));
});

function signIn(userId: string, siteId: string | null, issuedAt = new Date()): void {
  jar.set(SESSION_COOKIE_NAME, mintSessionCookie({ userId, siteId, issuedAt }));
}

describe("a session is what the cookie says, once the row agrees", () => {
  it("reads the account and its site", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    signIn(user.id, "site-9");
    expect(await currentSession()).toEqual({ userId: user.id, siteId: "site-9" });
  });

  it("no cookie is no session", async () => {
    expect(await currentSession()).toBeNull();
  });

  it("an empty cookie is no session", async () => {
    jar.set(SESSION_COOKIE_NAME, "");
    expect(await currentSession()).toBeNull();
  });

  it("a tampered cookie is no session", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    signIn(user.id, null);
    const value = jar.get(SESSION_COOKIE_NAME) ?? "";
    jar.set(SESSION_COOKIE_NAME, `${value}x`);
    expect(await currentSession()).toBeNull();
  });

  it("a cookie for an account that does not exist is no session", async () => {
    signIn("user-does-not-exist", null);
    expect(await currentSession()).toBeNull();
  });

  it("a cookie for a tombstoned account is no session (ADR-051 point 3)", async () => {
    const user = addAccount(state, {
      email: "gone@example.com",
      deleted_at: new Date().toISOString(),
    });
    signIn(user.id, null);
    expect(await currentSession()).toBeNull();
  });

  it("an unreadable store fails closed", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    signIn(user.id, null);
    state.failAccountRead = true;
    expect(await currentSession()).toBeNull();
  });

  it("a cookie past the signed window is no session", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    signIn(user.id, null, new Date(Date.now() - (SESSION_TTL_DAYS + 1) * 24 * 60 * 60 * 1000));
    expect(await currentSession()).toBeNull();
  });
});

describe('BP-061 decision 4 — a completed change ends the account\'s other sessions', () => {
  it("a session issued before the stamp is over", async () => {
    const stamp = new Date("2026-09-06T12:00:00.000Z");
    const user = addAccount(state, {
      email: "founder@example.com",
      sessions_valid_from: stamp.toISOString(),
    });
    signIn(user.id, null, new Date(stamp.getTime() - 1000));
    expect(await currentSession()).toBeNull();
  });

  it("the session issued at the stamp itself stands — it is the one that did the changing", async () => {
    const stamp = new Date("2026-09-06T12:00:00.000Z");
    const user = addAccount(state, {
      email: "founder@example.com",
      sessions_valid_from: stamp.toISOString(),
    });
    signIn(user.id, null, stamp);
    expect(await currentSession()).not.toBeNull();
  });
});

describe('REQ-077 c5 — "that session ends and returning requires a fresh sign-in link"', () => {
  it("sign-out ends this session", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    signIn(user.id, null);
    await signOut();
    expect(jar.has(SESSION_COOKIE_NAME)).toBe(false);
    expect(await currentSession()).toBeNull();
  });

  it("a second device's session is unaffected — no global sign-out is invented", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    // The phone's cookie, minted from the same account and kept aside: this
    // suite's jar is one browser's, so the second device is modelled as the
    // value that browser holds.
    const phone = mintSessionCookie({ userId: user.id, siteId: null, issuedAt: new Date() });

    signIn(user.id, null);
    await signOut();

    // The laptop is signed out; the phone's cookie still verifies against
    // the same account, because nothing about the account changed.
    jar.set(SESSION_COOKIE_NAME, phone);
    expect(await currentSession()).toEqual({ userId: user.id, siteId: null });
    expect(state.users[0]?.sessions_valid_from ?? null).toBeNull();
  });
});

describe("the cookie the redemption route sets", () => {
  it("is http-only, path-wide, lax and carries the signed window", () => {
    const cookie = sessionCookie({ userId: "user-1", siteId: null, issuedAt: new Date() });
    expect(cookie.name).toBe(SESSION_COOKIE_NAME);
    expect(cookie.options.httpOnly).toBe(true);
    expect(cookie.options.path).toBe("/");
    expect(cookie.options.sameSite).toBe("lax");
    expect(cookie.options.maxAge).toBe(SESSION_TTL_DAYS * 24 * 60 * 60);
  });

  it("is secure on an https deployment, which is what the fixture is", () => {
    expect(sessionCookie({ userId: "u", siteId: null, issuedAt: new Date() }).options.secure).toBe(
      true
    );
  });
});
