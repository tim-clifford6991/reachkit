// tests/account/identity/session.test.ts — BUILD §13, issues #35, #468
//
// Reading the session, and ending it. Since #468 the session is Supabase
// Auth's: `currentSession()` asks `getUser()` who the cookie belongs to,
// then holds the answer to the `users` row — a tombstoned or unreadable
// account is no session whatever Supabase says. Supabase's half runs
// through `./fake-auth.ts`; the real adapter's use of `getUser()` rather
// than `getSession()` alone is `./auth.test.ts`'s.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

/** One cookie jar per test, standing in for the request's. `next/headers`
 *  is the only request-scoped thing this module touches. A cookie written
 *  empty or with `maxAge: 0` is removed, as a browser would. */
const jar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    get: (name: string) => {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string, options?: { maxAge?: number }) => {
      if (value === "" || options?.maxAge === 0) jar.delete(name);
      else jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));

const { currentSession, signOut, signOutEverywhere } = await import(
  "../../../src/lib/account/identity/session"
);
const { setIdentityStore } = await import("../../../src/lib/account/identity/store");
const { setIdentityAuth } = await import("../../../src/lib/account/identity/auth");
const { addAccount, memoryIdentityStore, newMemoryIdentity } = await import("./memory-store");
const { FAKE_AUTH_COOKIE, addAuthUser, fakeIdentityAuth, newFakeAuth, signedInCookie } = await import(
  "./fake-auth"
);

let state = newMemoryIdentity();
let auth = newFakeAuth();

beforeEach(() => {
  jar.clear();
  state = newMemoryIdentity();
  auth = newFakeAuth();
  setIdentityStore(memoryIdentityStore(state));
  setIdentityAuth(fakeIdentityAuth(auth));
});

function account(patch: Partial<Parameters<typeof addAccount>[1]> = {}) {
  const user = addAccount(state, { email: "founder@example.com", ...patch });
  addAuthUser(auth, { id: user.id, email: user.email });
  return user;
}

/** A browser signed in as `userId`: a session Supabase knows, in the jar. */
function signIn(userId: string): string {
  const [, token] = signedInCookie(auth, userId).split("=") as [string, string];
  jar.set(FAKE_AUTH_COOKIE, token);
  return token;
}

describe("a session is what Supabase verifies, once the row agrees", () => {
  it("reads the account and its site", async () => {
    const user = account();
    signIn(user.id);
    expect(await currentSession()).toEqual({ userId: user.id, siteId: state.sites[0]?.id });
  });

  it("an account whose site does not exist yet has a null site, never an invented one", async () => {
    const user = account();
    state.sites = [];
    signIn(user.id);
    expect(await currentSession()).toEqual({ userId: user.id, siteId: null });
  });

  it("no cookie is no session", async () => {
    expect(await currentSession()).toBeNull();
  });

  it("an empty cookie is no session", async () => {
    jar.set(FAKE_AUTH_COOKIE, "");
    expect(await currentSession()).toBeNull();
  });

  it("a cookie Supabase never issued is no session — the forgery `getUser()` exists to stop", async () => {
    account();
    jar.set(FAKE_AUTH_COOKIE, "a-token-i-wrote-myself");
    expect(await currentSession()).toBeNull();
  });

  it("a session Supabase has revoked is no session", async () => {
    const user = account();
    const token = signIn(user.id);
    const session = auth.sessions.find((s) => s.accessToken === token);
    if (session !== undefined) session.revoked = true;
    expect(await currentSession()).toBeNull();
  });

  it("a session for an account with no row is no session", async () => {
    addAuthUser(auth, { id: "user-does-not-exist", email: "ghost@example.com" });
    signIn("user-does-not-exist");
    expect(await currentSession()).toBeNull();
  });

  it("a session for a tombstoned account is no session (ADR-051 point 3)", async () => {
    const user = account({ email: "gone@example.com", deleted_at: new Date().toISOString() });
    signIn(user.id);
    expect(await currentSession()).toBeNull();
  });

  it("an unreadable store fails closed", async () => {
    const user = account();
    signIn(user.id);
    state.failAccountRead = true;
    expect(await currentSession()).toBeNull();
  });
});

describe('REQ-077 c5 — "that session ends and returning requires a fresh sign-in link"', () => {
  it("sign-out ends this session and clears the cookie", async () => {
    const user = account();
    const token = signIn(user.id);
    await signOut();
    expect(jar.has(FAKE_AUTH_COOKIE)).toBe(false);
    expect(auth.sessions.find((s) => s.accessToken === token)?.revoked).toBe(true);
    expect(await currentSession()).toBeNull();
  });

  it("a second device's session is unaffected — no global sign-out is invented", async () => {
    const user = account();
    // The phone's session, kept aside: this suite's jar is one browser's,
    // so the second device is modelled as the value that browser holds.
    const [, phone] = signedInCookie(auth, user.id).split("=") as [string, string];

    signIn(user.id);
    await signOut();

    jar.set(FAKE_AUTH_COOKIE, phone);
    expect(await currentSession()).toEqual({ userId: user.id, siteId: state.sites[0]?.id });
    expect(auth.signOuts).toEqual([]);
  });
});

describe("a deleted account ends every session it holds — `admin.signOut(token, \"global\")`", () => {
  it("ends this session and every other device's", async () => {
    const user = account();
    const [, phone] = signedInCookie(auth, user.id).split("=") as [string, string];
    const token = signIn(user.id);

    expect(await signOutEverywhere(user.id)).toEqual({ ok: true });
    expect(auth.signOuts).toEqual([{ accessToken: token, scope: "global" }]);
    expect(auth.sessions.every((s) => s.revoked)).toBe(true);
    jar.set(FAKE_AUTH_COOKIE, phone);
    expect(await currentSession()).toBeNull();
  });

  it("refuses to end an account the request is not signed in as", async () => {
    const mine = account();
    const theirs = account({ email: "theirs@example.com" });
    signIn(mine.id);
    expect(await signOutEverywhere(theirs.id)).toEqual({ ok: false });
    expect(auth.signOuts).toEqual([]);
  });

  it("refuses with no session at all", async () => {
    const user = account();
    expect(await signOutEverywhere(user.id)).toEqual({ ok: false });
  });

  it("says so when Supabase refuses the revocation", async () => {
    const user = account();
    signIn(user.id);
    auth.failSignOut = true;
    expect(await signOutEverywhere(user.id)).toEqual({ ok: false });
  });
});
