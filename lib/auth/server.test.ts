import { beforeEach, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared mock factory helpers
// ---------------------------------------------------------------------------

function makeCookieStore() {
  return {
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  };
}

function makeSupabaseClient(getUserResult: {
  data: { user: { id: string } | null };
  error: Error | null;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(getUserResult),
    },
  };
}

/** A client whose getUser() *rejects* (as supabase-js does on a failed token
 * refresh, e.g. refresh_token_not_found) rather than resolving with { error }. */
function makeThrowingSupabaseClient(err: Error) {
  return {
    auth: {
      getUser: vi.fn().mockRejectedValue(err),
    },
  };
}

function makeServerDb(row: Record<string, unknown> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return vi.fn().mockReturnValue({ from });
}

// ---------------------------------------------------------------------------
// requireUser() throws AuthError when getUser returns no user
// ---------------------------------------------------------------------------

test("requireUser() throws AuthError when getUser returns no user", async () => {
  vi.resetModules();

  vi.doMock("next/headers", () => ({
    cookies: vi.fn().mockResolvedValue(makeCookieStore()),
  }));

  vi.doMock("@supabase/ssr", () => ({
    createServerClient: vi
      .fn()
      .mockReturnValue(
        makeSupabaseClient({ data: { user: null }, error: null }),
      ),
  }));

  vi.doMock("@/lib/db/client", () => ({
    serverDb: makeServerDb(null),
  }));

  vi.doMock("@/lib/config/env", () => ({
    env: {
      supabaseUrl: "https://x.supabase.co",
      supabaseAnonKey: "anon-key",
    },
  }));

  const { requireUser, AuthError } = await import("./server");
  await expect(requireUser()).rejects.toThrow(AuthError);
  await expect(requireUser()).rejects.toThrow("authentication required");
});

// ---------------------------------------------------------------------------
// requireUser() throws AuthError when getUser returns an error
// ---------------------------------------------------------------------------

test("requireUser() throws AuthError when getUser returns an auth error", async () => {
  vi.resetModules();

  vi.doMock("next/headers", () => ({
    cookies: vi.fn().mockResolvedValue(makeCookieStore()),
  }));

  vi.doMock("@supabase/ssr", () => ({
    createServerClient: vi
      .fn()
      .mockReturnValue(
        makeSupabaseClient({
          data: { user: null },
          error: new Error("JWT expired"),
        }),
      ),
  }));

  vi.doMock("@/lib/db/client", () => ({
    serverDb: makeServerDb(null),
  }));

  vi.doMock("@/lib/config/env", () => ({
    env: {
      supabaseUrl: "https://x.supabase.co",
      supabaseAnonKey: "anon-key",
    },
  }));

  const { requireUser, AuthError } = await import("./server");
  await expect(requireUser()).rejects.toThrow(AuthError);
});

// ---------------------------------------------------------------------------
// currentUser() returns { authId, user } when getUser succeeds + row exists
// ---------------------------------------------------------------------------

test("currentUser() returns { authId, user } when getUser succeeds and profile row exists", async () => {
  vi.resetModules();

  const userId = "user-uuid-123";
  const profileRow = {
    id: userId,
    email: "test@example.com",
    app_ids: ["app-1"],
    tier: "free",
    created_at: "2024-01-01T00:00:00Z",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_status: null,
    current_period_end: null,
    founder_voice: null,
  };

  vi.doMock("next/headers", () => ({
    cookies: vi.fn().mockResolvedValue(makeCookieStore()),
  }));

  vi.doMock("@supabase/ssr", () => ({
    createServerClient: vi
      .fn()
      .mockReturnValue(
        makeSupabaseClient({ data: { user: { id: userId } }, error: null }),
      ),
  }));

  vi.doMock("@/lib/db/client", () => ({
    serverDb: makeServerDb(profileRow),
  }));

  vi.doMock("@/lib/config/env", () => ({
    env: {
      supabaseUrl: "https://x.supabase.co",
      supabaseAnonKey: "anon-key",
    },
  }));

  const { currentUser } = await import("./server");
  const result = await currentUser();

  expect(result).not.toBeNull();
  expect(result?.authId).toBe(userId);
  expect(result?.user.email).toBe("test@example.com");
  expect(result?.user.tier).toBe("free");
});

// ---------------------------------------------------------------------------
// currentUser() returns null when user has no profile row
// ---------------------------------------------------------------------------

test("currentUser() returns null when user has no profile row", async () => {
  vi.resetModules();

  const userId = "user-uuid-456";

  vi.doMock("next/headers", () => ({
    cookies: vi.fn().mockResolvedValue(makeCookieStore()),
  }));

  vi.doMock("@supabase/ssr", () => ({
    createServerClient: vi
      .fn()
      .mockReturnValue(
        makeSupabaseClient({ data: { user: { id: userId } }, error: null }),
      ),
  }));

  // Row is null — user has no profile
  vi.doMock("@/lib/db/client", () => ({
    serverDb: makeServerDb(null),
  }));

  vi.doMock("@/lib/config/env", () => ({
    env: {
      supabaseUrl: "https://x.supabase.co",
      supabaseAnonKey: "anon-key",
    },
  }));

  const { currentUser } = await import("./server");
  const result = await currentUser();

  expect(result).toBeNull();
});

// ---------------------------------------------------------------------------
// currentUser() returns null (does NOT throw) when getUser() rejects
//
// Regression guard: on an expired session, supabase-js can *reject* from
// getUser() with AuthApiError(refresh_token_not_found) instead of resolving
// with { error }. That must degrade to "unauthenticated" (→ /login), not an
// uncaught error that hits the app error boundary ("We hit an unexpected error").
// ---------------------------------------------------------------------------

test("currentUser() returns null when getUser() rejects (refresh_token_not_found)", async () => {
  vi.resetModules();

  vi.doMock("next/headers", () => ({
    cookies: vi.fn().mockResolvedValue(makeCookieStore()),
  }));

  const refreshErr = Object.assign(new Error("Invalid Refresh Token: Refresh Token Not Found"), {
    __isAuthError: true,
    status: 400,
    code: "refresh_token_not_found",
  });
  vi.doMock("@supabase/ssr", () => ({
    createServerClient: vi.fn().mockReturnValue(makeThrowingSupabaseClient(refreshErr)),
  }));

  vi.doMock("@/lib/db/client", () => ({ serverDb: makeServerDb(null) }));

  vi.doMock("@/lib/config/env", () => ({
    env: { supabaseUrl: "https://x.supabase.co", supabaseAnonKey: "anon-key" },
  }));

  const { currentUser } = await import("./server");
  await expect(currentUser()).resolves.toBeNull();
});

// ---------------------------------------------------------------------------
// AuthError has the correct name property
// ---------------------------------------------------------------------------

test("AuthError has name 'AuthError' and correct default message", async () => {
  vi.resetModules();

  vi.doMock("next/headers", () => ({
    cookies: vi.fn().mockResolvedValue(makeCookieStore()),
  }));
  vi.doMock("@supabase/ssr", () => ({
    createServerClient: vi.fn().mockReturnValue(
      makeSupabaseClient({ data: { user: null }, error: null }),
    ),
  }));
  vi.doMock("@/lib/db/client", () => ({ serverDb: makeServerDb(null) }));
  vi.doMock("@/lib/config/env", () => ({
    env: { supabaseUrl: "https://x.supabase.co", supabaseAnonKey: "anon-key" },
  }));

  const { AuthError } = await import("./server");
  const err = new AuthError();
  expect(err.name).toBe("AuthError");
  expect(err.message).toBe("authentication required");
  expect(err).toBeInstanceOf(Error);
});

// Keep beforeEach isolated (resetModules is per-test above)
beforeEach(() => {});
