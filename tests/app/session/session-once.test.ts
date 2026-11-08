// tests/app/session/session-once.test.ts — SPEC §8, §13
//
// A signed-in `/app` request, at the route boundary: the `(account)` layout,
// the `/app` layout and Overview render side by side, as Next renders them,
// and between them ask who is signing in exactly once — from the signed
// token, never Supabase's user endpoint — and read the account row once.
// "Seen" is written after the response, so the screen never waits on it.
//
// Doubled at the vendor edge only: Supabase Auth (`fake-auth.ts`, counted),
// the identity rows (`memory-store.ts`, counted), Postgres (`fakeDb`), the
// retention write, and `next/headers`/`next/server`'s request scope. React's
// `cache` is given the per-request scope Next gives it in a server render.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { fakeDb } from "../../publish/harness";

applyEnvFixture();

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

/** One request's memo, as React keeps it for a server render. Cleared
 *  between requests. */
const request = new Map<unknown, Map<string, unknown>>();
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const cache = <A extends unknown[], R>(fn: (...args: A) => R) =>
    (...args: A): R => {
      const calls = request.get(fn) ?? new Map<string, unknown>();
      request.set(fn, calls);
      const key = JSON.stringify(args);
      if (!calls.has(key)) calls.set(key, fn(...args));
      return calls.get(key) as R;
    };
  // `ViewTransition` named even where this React lacks it, so the probe in
  // `src/ui/motion.ts` reads `undefined` as it would unmocked.
  const ViewTransition = (actual as Record<string, unknown>)["ViewTransition"];
  return { ...actual, ViewTransition, cache, default: { ...actual, cache } };
});

/** What `after` was handed, run only once the response is out. */
const afterResponse: (() => unknown)[] = [];
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  after: (task: () => unknown) => {
    afterResponse.push(task);
  },
}));

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => {
    const { GATE_PATH_HEADER } = await import("@/app/(account)/setup/gate");
    return new Headers({ [GATE_PATH_HEADER]: "/app" });
  },
  cookies: async () => ({
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: () => {},
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
  useRouter: () => ({ refresh: () => {} }),
}));

// The data behind the screens once their gates let the request through;
// not what this suite counts.
vi.mock("@/app/(account)/app/_shell/store", async () => {
  const { FIXTURE_SHELL_FACTS } = await import("@/app/(account)/app/_shell/fixture");
  return { readShellFacts: async () => FIXTURE_SHELL_FACTS };
});
vi.mock("@/app/(account)/app/_overview/store", async () => {
  const { FIXTURE_OVERVIEW_FACTS } = await import("@/app/(account)/app/_overview/fixture");
  return { readOverviewFacts: async () => FIXTURE_OVERVIEW_FACTS };
});

const { default: AccountLayout } = await import("@/app/(account)/layout");
const { default: AppLayout } = await import("@/app/(account)/app/layout");
const { default: OverviewPage } = await import("@/app/(account)/app/(tabs)/page");
const { appEntry } = await import("@/app/(public)/_chrome/session");
const { setIdentityAuth } = await import("@/lib/account/identity/auth");
const { setIdentityStore } = await import("@/lib/account/identity/store");
const { setRetentionStore } = await import("@/lib/mail/retention");
const { addAccount, memoryIdentityStore, newMemoryIdentity } = await import("../../account/identity/memory-store");
const { FAKE_AUTH_COOKIE, addAuthUser, fakeIdentityAuth, newFakeAuth, signedInCookie } = await import(
  "../../account/identity/fake-auth"
);

const USER = "user-1";
const SITE = "site-1";

const calls = { sessionUser: 0, sessionClaims: 0, account: 0, siteForAccount: 0 };
let seen: (userId: string, at: Date) => Promise<void> = async () => {};
const seenAsked: string[] = [];

beforeEach(() => {
  request.clear();
  afterResponse.length = 0;
  seenAsked.length = 0;
  jar.clear();
  for (const k of Object.keys(calls) as (keyof typeof calls)[]) calls[k] = 0;

  const identity = newMemoryIdentity();
  addAccount(identity, { id: USER, email: "founder@example.com" });
  identity.sites = [{ id: SITE, user_id: USER }];
  const store = memoryIdentityStore(identity);
  setIdentityStore({
    ...store,
    account: (id) => (calls.account++, store.account(id)),
    siteForAccount: (id) => (calls.siteForAccount++, store.siteForAccount(id)),
  });

  const authState = newFakeAuth();
  addAuthUser(authState, { id: USER, email: "founder@example.com" });
  const auth = fakeIdentityAuth(authState);
  setIdentityAuth({
    ...auth,
    sessionUser: (io) => (calls.sessionUser++, auth.sessionUser(io)),
    sessionClaims: (io) => (calls.sessionClaims++, auth.sessionClaims(io)),
  });
  const [, token] = signedInCookie(authState, USER).split("=") as [string, string];
  jar.set(FAKE_AUTH_COOKIE, token);

  seen = async () => {};
  setRetentionStore({
    recordSeen: (userId: string, at: Date) => (seenAsked.push(userId), seen(userId, at)),
  } as unknown as Parameters<typeof setRetentionStore>[0]);

  db.reset();
  db.seed("sites", [
    {
      id: SITE,
      user_id: USER,
      domain: "acme.test",
      mode: "autopilot",
      created_at: "2026-09-16T09:40:00.000Z",
      setup_completed_at: "2026-09-16T09:57:04.000Z",
      timezone: "Europe/London",
    },
  ]);
});

afterEach(() => {
  setIdentityAuth(null);
  setIdentityStore(null);
  setRetentionStore(null);
  db.reset();
});

/** One `/app` request: the three render side by side, as Next renders a
 *  route's layouts and page. Fails rather than hangs on a render that waits. */
async function renderApp(): Promise<void> {
  const render = Promise.all([
    AccountLayout({ children: null }),
    AppLayout({ children: null }),
    OverviewPage(),
  ]);
  const waited = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("the render waited on something")), 10_000)
  );
  await Promise.race([render, waited]);
}

describe("an /app request reads the session once", () => {
  it("both layouts and Overview share one signed-token check and one account read, and never call getUser", async () => {
    await renderApp();
    expect(calls).toEqual({ sessionUser: 0, sessionClaims: 1, account: 1, siteForAccount: 1 });
  });

  it("the read is per request: the next request reads afresh", async () => {
    await renderApp();
    request.clear();
    await renderApp();
    expect(calls.sessionClaims).toBe(2);
  });

  it("the public header's signed-in arm shares the same read", async () => {
    await expect(appEntry()).resolves.toBe("/app");
    await AccountLayout({ children: null });
    expect(calls.sessionClaims).toBe(1);
    expect(calls.sessionUser).toBe(0);
  });
});

describe("'seen' is written after the response (SPEC §8)", () => {
  it("the render resolves while the write would never finish, and the write runs once, afterwards", async () => {
    seen = () => new Promise<void>(() => {});
    await renderApp();
    expect(seenAsked).toEqual([]);

    for (const task of afterResponse) void task();
    await vi.waitFor(() => expect(seenAsked).toEqual([USER]));
  });

  it("a write that fails is logged as retention_seen_unrecorded and never reaches the screen", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    seen = async () => {
      throw new Error("users is unreachable");
    };
    await renderApp();
    await Promise.all(afterResponse.map((task) => task()));
    expect(warn.mock.calls.map(([line]) => JSON.parse(String(line)).event)).toContain("retention_seen_unrecorded");
    warn.mockRestore();
  });
});
