// tests/account/identity/cookie.test.ts — BUILD §13, issues #35, #468
//
// The session cookie is Supabase Auth's, not a cookie of ours (#468). What
// this product still decides about it is two things: which cookie names
// *are* a session — `src/middleware.ts` asks Supabase only when one is
// present — and the three attributes it pins on it. Both are asserted here.
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { isAuthCookieName } = await import("../../../src/lib/account/identity/addresses");
const { sessionCookieOptions } = await import("../../../src/lib/account/identity/auth");
const { env } = await import("../../../src/lib/config/env");

describe("which cookies are a Supabase Auth session", () => {
  it.each(["sb-abcdefghijklmnop-auth-token", "sb-127-auth-token", "sb-fake-auth-token"])(
    "%s is one",
    (name) => {
      expect(isAuthCookieName(name)).toBe(true);
    }
  );

  it("its chunks are too — `@supabase/ssr` splits a large session across `.0`, `.1`, …", () => {
    expect(isAuthCookieName("sb-abc-auth-token.0")).toBe(true);
    expect(isAuthCookieName("sb-abc-auth-token.1")).toBe(true);
  });

  it.each([
    "rk_session",
    "sb-abc-auth-token-code-verifier",
    "sb--auth-token",
    "sb-abc-auth-token.x",
    "xsb-abc-auth-token",
    "rk_danger_ticket",
  ])("%s is not", (name) => {
    expect(isAuthCookieName(name)).toBe(false);
  });
});

describe("the attributes this product pins on it", () => {
  it("is http-only — there is no browser-side Supabase client to need it (#468 Not in scope)", () => {
    expect(sessionCookieOptions().httpOnly).toBe(true);
  });

  it("is lax, because the link arrives from a mail client and a strict cookie would land signed out", () => {
    expect(sessionCookieOptions().sameSite).toBe("lax");
  });

  it("is path-wide", () => {
    expect(sessionCookieOptions().path).toBe("/");
  });

  it("is secure exactly when the deployment's own origin is https — which the fixture's is", () => {
    expect(env.NEXT_PUBLIC_APP_URL.startsWith("https://")).toBe(true);
    expect(sessionCookieOptions().secure).toBe(true);
  });
});
