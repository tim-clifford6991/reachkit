// tests/account/identity/auth.test.ts — BUILD §13 (#468)
//
// The real Supabase Auth adapter (`supabaseIdentityAuth`), against doubles
// of the two clients it drives: the service-role client's `auth.admin`
// (`@/lib/db`) and an `@supabase/ssr` server client. Every other identity
// suite stands `./fake-auth.ts` in front of the port; this one is what
// holds the port's own promises to the vendor's API:
//
//   · links are minted by `generateLink` (`magiclink`, `email_change_new`)
//     with `redirectTo` on our own `/auth/confirm`, and the hash that comes
//     back is Supabase's `hashed_token` — Supabase's mailer sends nothing;
//   · redemption is `verifyOtp({ token_hash, type })`, and `otp_expired` is
//     the one dead reason GoTrue can name;
//   · who is asking is `getUser()` — verified by Supabase — never
//     `getSession()` alone, which would believe the cookie;
//   · sign-out-everywhere is `admin.signOut(token, "global")`.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const mocks = vi.hoisted(() => {
  const admin = {
    createUser: vi.fn(),
    generateLink: vi.fn(),
    deleteUser: vi.fn(),
    signOut: vi.fn(),
    getUserById: vi.fn(),
  };
  const session = {
    verifyOtp: vi.fn(),
    getUser: vi.fn(),
    getSession: vi.fn(),
    signOut: vi.fn(),
  };
  const created: { url: string; key: string; options: Record<string, unknown> }[] = [];
  return { admin, session, created };
});

vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({ auth: { admin: mocks.admin } }),
  db: () => ({}),
}));

type SetAll = (c: { name: string; value: string; options: Record<string, unknown> }[]) => void;
let setAll: SetAll = () => undefined;

vi.mock("@supabase/ssr", () => ({
  createServerClient: (url: string, key: string, options: Record<string, unknown>) => {
    mocks.created.push({ url, key, options });
    setAll = (options["cookies"] as { setAll: SetAll }).setAll;
    return { auth: mocks.session };
  },
}));

const { supabaseIdentityAuth } = await import("../../../src/lib/account/identity/auth");
const { env } = await import("../../../src/lib/config/env");

const auth = supabaseIdentityAuth();
const USER = { id: "auth-user-1", email: "founder@example.com" };

let written: { name: string; value: string; options: Record<string, unknown> }[] = [];
const io = {
  getAll: () => [{ name: "sb-proj-auth-token", value: "base64-xyz" }],
  setAll: (c: typeof written) => {
    written.push(...c);
  },
};

beforeEach(() => {
  for (const fn of [...Object.values(mocks.admin), ...Object.values(mocks.session)]) fn.mockReset();
  mocks.created.length = 0;
  written = [];
});

function linkAnswer(hash: string) {
  return {
    data: { properties: { hashed_token: hash, action_link: "https://supabase.example/verify" }, user: USER },
    error: null,
  };
}

describe("generateLink — Supabase mints, nobody mails", () => {
  it("a sign-in link is a `magiclink`, redirected to our own /auth/confirm, answered with its hashed_token", async () => {
    mocks.admin.generateLink.mockResolvedValue(linkAnswer("hash-abc"));
    const out = await auth.generateLink({ kind: "sign_in", email: USER.email });

    expect(out).toEqual({ ok: true, userId: USER.id, tokenHash: "hash-abc", type: "magiclink" });
    const [params] = mocks.admin.generateLink.mock.calls[0] as [Record<string, unknown>];
    expect(params["type"]).toBe("magiclink");
    expect(params["email"]).toBe(USER.email);
    const redirectTo = (params["options"] as { redirectTo: string }).redirectTo;
    expect(redirectTo).toBe(new URL("/auth/confirm", env.NEXT_PUBLIC_APP_URL).toString());
  });

  it("an email change is `email_change_new`, from the current address to the new one", async () => {
    mocks.admin.generateLink.mockResolvedValue(linkAnswer("hash-change"));
    const out = await auth.generateLink({
      kind: "email_change",
      email: USER.email,
      newEmail: "next@example.com",
    });

    expect(out).toEqual({ ok: true, userId: USER.id, tokenHash: "hash-change", type: "email_change" });
    const [params] = mocks.admin.generateLink.mock.calls[0] as [Record<string, unknown>];
    expect(params).toMatchObject({ type: "email_change_new", email: USER.email, newEmail: "next@example.com" });
    expect((params["options"] as { redirectTo: string }).redirectTo.endsWith("/auth/confirm")).toBe(true);
  });

  it("the action link is never what comes back — only the hash, for our own route", async () => {
    mocks.admin.generateLink.mockResolvedValue(linkAnswer("hash-abc"));
    expect(JSON.stringify(await auth.generateLink({ kind: "sign_in", email: USER.email }))).not.toContain(
      "supabase.example"
    );
  });

  it("an error, or an answer with no hash, is a refusal and never a throw", async () => {
    mocks.admin.generateLink.mockResolvedValue({ data: { properties: null, user: null }, error: { code: "x" } });
    expect(await auth.generateLink({ kind: "sign_in", email: USER.email })).toEqual({ ok: false });
    mocks.admin.generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "" }, user: USER },
      error: null,
    });
    expect(await auth.generateLink({ kind: "sign_in", email: USER.email })).toEqual({ ok: false });
  });
});

describe("verifyLink — `verifyOtp` redeems and writes the session", () => {
  it("passes { token_hash, type }, and writes the session cookies with this product's three attributes", async () => {
    mocks.session.verifyOtp.mockImplementation(async () => {
      setAll([{ name: "sb-proj-auth-token", value: "base64-session", options: { maxAge: 100 } }]);
      return { data: { user: USER, session: { access_token: "jwt-1" } }, error: null };
    });

    const out = await auth.verifyLink(io, { tokenHash: "hash-abc", type: "magiclink" });

    expect(mocks.session.verifyOtp).toHaveBeenCalledWith({ token_hash: "hash-abc", type: "magiclink" });
    expect(out).toEqual({ ok: true, userId: USER.id, email: USER.email, accessToken: "jwt-1" });
    expect(written).toEqual([
      {
        name: "sb-proj-auth-token",
        value: "base64-session",
        options: { maxAge: 100, httpOnly: true, sameSite: "lax", secure: true, path: "/" },
      },
    ]);
  });

  it("the session client is the anon key on SUPABASE_URL — never the service role", async () => {
    mocks.session.verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: null });
    await auth.verifyLink(io, { tokenHash: "h", type: "magiclink" });
    expect(mocks.created[0]?.url).toBe(env.SUPABASE_URL);
    expect(mocks.created[0]?.key).toBe(env.SUPABASE_ANON_KEY);
  });

  it("`otp_expired` — expired or already used, GoTrue does not say which — is `expired`", async () => {
    mocks.session.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "otp_expired", status: 403 },
    });
    expect(await auth.verifyLink(io, { tokenHash: "h", type: "magiclink" })).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("any other error, or an answer with no session, is `unknown`", async () => {
    mocks.session.verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: { code: "bad" } });
    expect(await auth.verifyLink(io, { tokenHash: "h", type: "email_change" })).toEqual({
      ok: false,
      reason: "unknown",
    });
    mocks.session.verifyOtp.mockResolvedValue({ data: { user: USER, session: null }, error: null });
    expect(await auth.verifyLink(io, { tokenHash: "h", type: "email_change" })).toEqual({
      ok: false,
      reason: "unknown",
    });
  });
});

describe("sessionUser — `getUser()`, never `getSession()` alone", () => {
  it("answers the user Supabase verified", async () => {
    mocks.session.getUser.mockResolvedValue({ data: { user: USER }, error: null });
    mocks.session.getSession.mockResolvedValue({ data: { session: { access_token: "jwt-2" } }, error: null });
    expect(await auth.sessionUser(io)).toEqual({ userId: USER.id, accessToken: "jwt-2" });
    expect(mocks.session.getUser).toHaveBeenCalled();
  });

  it("a session `getUser()` refuses is null, whatever the cookie says — the forgery case", async () => {
    mocks.session.getUser.mockResolvedValue({ data: { user: null }, error: { code: "bad_jwt" } });
    mocks.session.getSession.mockResolvedValue({
      data: { session: { access_token: "forged", user: USER } },
      error: null,
    });
    expect(await auth.sessionUser(io)).toBeNull();
  });
});

describe("the admin half", () => {
  it("signOutEverywhere is `admin.signOut(token, scope)`", async () => {
    mocks.admin.signOut.mockResolvedValue({ data: null, error: null });
    expect(await auth.signOutEverywhere("jwt-3", "global")).toEqual({ ok: true });
    expect(mocks.admin.signOut).toHaveBeenCalledWith("jwt-3", "global");
    mocks.admin.signOut.mockResolvedValue({ data: null, error: { code: "x" } });
    expect(await auth.signOutEverywhere("jwt-3", "others")).toEqual({ ok: false });
    expect(mocks.admin.signOut).toHaveBeenLastCalledWith("jwt-3", "others");
  });

  it("ensureUser creates the user confirmed, so Supabase has no confirmation mail to send", async () => {
    mocks.admin.createUser.mockResolvedValue({ data: { user: USER }, error: null });
    expect(await auth.ensureUser(USER.email)).toEqual({ ok: true, userId: USER.id });
    expect(mocks.admin.createUser).toHaveBeenCalledWith({ email: USER.email, email_confirm: true });
    expect(mocks.admin.generateLink).not.toHaveBeenCalled();
  });

  it("ensureUser on an address Supabase already knows reads its id through `generateLink`", async () => {
    mocks.admin.createUser.mockResolvedValue({ data: { user: null }, error: { code: "email_exists" } });
    mocks.admin.generateLink.mockResolvedValue(linkAnswer("unused"));
    expect(await auth.ensureUser(USER.email)).toEqual({ ok: true, userId: USER.id });
    expect(mocks.admin.generateLink).toHaveBeenCalledWith({ type: "magiclink", email: USER.email });
  });

  it("ensureUser refuses on any other error, and never looks the address up", async () => {
    mocks.admin.createUser.mockResolvedValue({ data: { user: null }, error: { code: "unexpected" } });
    expect(await auth.ensureUser(USER.email)).toEqual({ ok: false });
    expect(mocks.admin.generateLink).not.toHaveBeenCalled();
  });

  it("deleteUser treats a user already gone as done — the purge stays resumable", async () => {
    mocks.admin.deleteUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await auth.deleteUser(USER.id)).toEqual({ ok: true });
    mocks.admin.deleteUser.mockResolvedValue({ data: { user: null }, error: { code: "user_not_found", status: 404 } });
    expect(await auth.deleteUser(USER.id)).toEqual({ ok: true });
    mocks.admin.deleteUser.mockResolvedValue({ data: { user: null }, error: { code: "x", status: 500 } });
    expect(await auth.deleteUser(USER.id)).toEqual({ ok: false });
  });

  it("lastSignInAt reads `auth.users.last_sign_in_at`, and null where there is none", async () => {
    mocks.admin.getUserById.mockResolvedValue({
      data: { user: { ...USER, last_sign_in_at: "2026-09-06T12:00:00.000Z" } },
      error: null,
    });
    expect(await auth.lastSignInAt(USER.id)).toEqual(new Date("2026-09-06T12:00:00.000Z"));
    mocks.admin.getUserById.mockResolvedValue({ data: { user: { ...USER, last_sign_in_at: null } }, error: null });
    expect(await auth.lastSignInAt(USER.id)).toBeNull();
    mocks.admin.getUserById.mockResolvedValue({ data: { user: null }, error: { code: "x" } });
    expect(await auth.lastSignInAt(USER.id)).toBeNull();
  });
});

describe("endSession — this browser only, and its cookies go whatever Supabase says", () => {
  it("signs out with scope local and clears every Supabase session cookie it can see", async () => {
    mocks.session.signOut.mockResolvedValue({ error: { code: "network" } });
    await auth.endSession(io);
    expect(mocks.session.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(written).toEqual([
      { name: "sb-proj-auth-token", value: "", options: expect.objectContaining({ maxAge: 0, path: "/" }) },
    ]);
  });
});
