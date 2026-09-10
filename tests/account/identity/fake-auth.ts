// tests/account/identity/fake-auth.ts — BUILD §13 (#468)
//
// Supabase Auth, as the suites need it: an in-memory `IdentityAuth` that
// keeps GoTrue's observable rules — one live token per user and type (the
// newest wins), a token works once, `verifyOtp` writes the session cookie,
// an email change moves the address only on the new address's token, and
// `signOut` scopes `global` / `others` / `local` — with no network at all.
//
// Installed with `setIdentityAuth(fakeIdentityAuth(state))`; the real
// adapter (`src/lib/account/identity/auth.ts`) is exercised against a
// mocked `@supabase/supabase-js` / `@supabase/ssr` in `auth.test.ts`.
import type { ConfirmType } from "../../../src/lib/account/identity/addresses";
import type { CookieIO, IdentityAuth } from "../../../src/lib/account/identity/auth";
import { EMAIL_CHANGE_TTL_H, SIGNIN_LINK_TTL_H } from "../../../src/lib/config/constants";

/** A cookie name `isAuthCookieName` accepts, as `@supabase/ssr` would
 *  derive it for a project whose host's first label is `fake`. */
export const FAKE_AUTH_COOKIE = "sb-fake-auth-token";

export interface FakeAuthUser {
  id: string;
  email: string;
  lastSignInAt: Date | null;
}

export interface FakeToken {
  hash: string;
  userId: string;
  type: ConfirmType;
  newEmail: string | null;
  used: boolean;
  /** Superseded by a newer token of the same type for the same user. */
  superseded: boolean;
  /** The project's OTP expiry — set in the dashboard to the pinned TTL. */
  expiresAt: Date;
}

export interface FakeSession {
  accessToken: string;
  userId: string;
  revoked: boolean;
}

export interface FakeAuthState {
  users: FakeAuthUser[];
  tokens: FakeToken[];
  sessions: FakeSession[];
  signOuts: { accessToken: string; scope: string }[];
  deleted: string[];
  generated: { kind: "sign_in" | "email_change"; email: string; newEmail?: string }[];
  failEnsure: boolean;
  failGenerate: boolean;
  failVerify: boolean;
  failSignOut: boolean;
  failDelete: boolean;
  now: () => Date;
  next: number;
}

export function newFakeAuth(): FakeAuthState {
  return {
    users: [],
    tokens: [],
    sessions: [],
    signOuts: [],
    deleted: [],
    generated: [],
    failEnsure: false,
    failGenerate: false,
    failVerify: false,
    failSignOut: false,
    failDelete: false,
    now: () => new Date(),
    next: 1,
  };
}

const lower = (s: string): string => s.trim().toLowerCase();

/** An `auth.users` row with a known id — the id the suite's `users` row
 *  carries, which is what #468 makes true in production. */
export function addAuthUser(state: FakeAuthState, a: { id: string; email: string }): FakeAuthUser {
  const user: FakeAuthUser = { id: a.id, email: lower(a.email), lastSignInAt: null };
  state.users.push(user);
  return user;
}

/** A live session for `userId`, and the `Cookie` header value that carries
 *  it — a customer who signed in earlier. */
export function signedInCookie(state: FakeAuthState, userId: string): string {
  const accessToken = `access-${state.next++}`;
  state.sessions.push({ accessToken, userId, revoked: false });
  return `${FAKE_AUTH_COOKIE}=${accessToken}`;
}

function sessionFrom(state: FakeAuthState, io: CookieIO): FakeSession | null {
  const token = io.getAll().find((c) => c.name === FAKE_AUTH_COOKIE)?.value;
  if (token === undefined || token.length === 0) return null;
  const session = state.sessions.find((s) => s.accessToken === token);
  if (session === undefined || session.revoked) return null;
  if (!state.users.some((u) => u.id === session.userId)) return null;
  return session;
}

export function fakeIdentityAuth(state: FakeAuthState): IdentityAuth {
  return {
    async ensureUser(email) {
      if (state.failEnsure) return { ok: false };
      const existing = state.users.find((u) => u.email === lower(email));
      if (existing !== undefined) return { ok: true, userId: existing.id };
      const user = addAuthUser(state, { id: `auth-${state.next++}`, email });
      return { ok: true, userId: user.id };
    },

    async deleteUser(userId) {
      if (state.failDelete) return { ok: false };
      state.users = state.users.filter((u) => u.id !== userId);
      state.deleted.push(userId);
      return { ok: true };
    },

    async generateLink(a) {
      state.generated.push(a.kind === "sign_in" ? { kind: a.kind, email: a.email } : { ...a });
      if (state.failGenerate) return { ok: false };
      let user = state.users.find((u) => u.email === lower(a.email));
      // GoTrue's `magiclink` creates the user it is asked for; the issuer
      // then refuses the mismatch, which is the case worth being able to
      // reach.
      if (user === undefined) {
        if (a.kind !== "sign_in") return { ok: false };
        user = addAuthUser(state, { id: `auth-${state.next++}`, email: a.email });
      }
      const type: ConfirmType = a.kind === "sign_in" ? "magiclink" : "email_change";
      for (const t of state.tokens) {
        if (t.userId === user.id && t.type === type) t.superseded = true;
      }
      const hash = `hash-${state.next++}`;
      state.tokens.push({
        hash,
        userId: user.id,
        type,
        newEmail: a.kind === "email_change" ? lower(a.newEmail) : null,
        used: false,
        superseded: false,
        expiresAt: new Date(
          state.now().getTime() +
            (type === "magiclink" ? SIGNIN_LINK_TTL_H : EMAIL_CHANGE_TTL_H) * 60 * 60 * 1000
        ),
      });
      return { ok: true, userId: user.id, tokenHash: hash, type };
    },

    async verifyLink(io, a) {
      if (state.failVerify) return { ok: false, reason: "unknown" };
      const token = state.tokens.find((t) => t.hash === a.tokenHash && t.type === a.type);
      if (token === undefined) return { ok: false, reason: "unknown" };
      // GoTrue answers `otp_expired` for a used or superseded token too.
      if (token.used || token.superseded) return { ok: false, reason: "expired" };
      if (state.now().getTime() >= token.expiresAt.getTime()) return { ok: false, reason: "expired" };
      const user = state.users.find((u) => u.id === token.userId);
      if (user === undefined) return { ok: false, reason: "unknown" };
      token.used = true;
      if (token.newEmail !== null) user.email = token.newEmail;
      user.lastSignInAt = state.now();
      const accessToken = `access-${state.next++}`;
      state.sessions.push({ accessToken, userId: user.id, revoked: false });
      io.setAll([
        {
          name: FAKE_AUTH_COOKIE,
          value: accessToken,
          options: { httpOnly: true, sameSite: "lax", secure: false, path: "/" },
        },
      ]);
      return { ok: true, userId: user.id, email: user.email, accessToken };
    },

    async sessionUser(io) {
      const session = sessionFrom(state, io);
      return session === null ? null : { userId: session.userId, accessToken: session.accessToken };
    },

    async endSession(io) {
      const session = sessionFrom(state, io);
      if (session !== null) session.revoked = true;
      io.setAll([{ name: FAKE_AUTH_COOKIE, value: "", options: { path: "/", maxAge: 0 } }]);
    },

    async signOutEverywhere(accessToken, scope) {
      state.signOuts.push({ accessToken, scope });
      if (state.failSignOut) return { ok: false };
      const owner = state.sessions.find((s) => s.accessToken === accessToken);
      if (owner === undefined) return { ok: false };
      for (const s of state.sessions) {
        if (s.userId !== owner.userId) continue;
        if (scope === "others" && s.accessToken === accessToken) continue;
        s.revoked = true;
      }
      return { ok: true };
    },

    async lastSignInAt(userId) {
      return state.users.find((u) => u.id === userId)?.lastSignInAt ?? null;
    },
  };
}

/** A `CookieIO` over a plain map — a browser's jar, for the suites that
 *  call identity without a request. A cleared cookie (empty value or
 *  `maxAge: 0`) is removed, as a browser would. */
export function cookieJarIO(jar: Map<string, string>): CookieIO {
  return {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (list) => {
      for (const c of list) {
        if (c.value === "" || c.options["maxAge"] === 0) jar.delete(c.name);
        else jar.set(c.name, c.value);
      }
    },
  };
}
