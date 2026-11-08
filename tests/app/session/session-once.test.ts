// tests/app/session/session-once.test.ts — SPEC §3, §8
//
// One signed-in `/app` request: both layouts and Overview ask who is signed
// in once, from the signed token, and record "seen" only after the response.
// React's `cache` gets the per-request memo it keeps in a server render.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { fakeDb } from "../../publish/harness";

applyEnvFixture();

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const request = new Map<unknown, Map<string, unknown>>();
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const cache =
    <A extends unknown[], R>(fn: (...args: A) => R) =>
    (...args: A): R => {
      const calls = request.get(fn) ?? new Map<string, unknown>();
      request.set(fn, calls);
      if (!calls.has(JSON.stringify(args))) calls.set(JSON.stringify(args), fn(...args));
      return calls.get(JSON.stringify(args)) as R;
    };
  // Named even where this React lacks it, so `src/ui/motion.ts`'s probe reads `undefined`.
  const ViewTransition = (actual as Record<string, unknown>)["ViewTransition"];
  return { ...actual, ViewTransition, cache, default: { ...actual, cache } };
});

const afterResponse: (() => Promise<void>)[] = [];
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  after: (task: () => Promise<void>) => void afterResponse.push(task),
}));

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => {
    const { GATE_PATH_HEADER } = await import("@/app/(account)/setup/gate");
    return new Headers({ [GATE_PATH_HEADER]: "/app" });
  },
  cookies: async () => ({ getAll: () => [...jar].map(([name, value]) => ({ name, value })), set: () => {} }),
}));
const redirected = (to: string): never => {
  throw new Error(`NEXT_REDIRECT:${to}`);
};
vi.mock("next/navigation", () => ({ redirect: redirected }));

// The screens' own data, not what this suite counts.
vi.mock("@/app/(account)/app/_shell/store", async () => ({
  readShellFacts: async () => (await import("@/app/(account)/app/_shell/fixture")).FIXTURE_SHELL_FACTS,
}));
vi.mock("@/app/(account)/app/_overview/store", async () => ({
  readOverviewFacts: async () => (await import("@/app/(account)/app/_overview/fixture")).FIXTURE_OVERVIEW_FACTS,
}));

const { default: AccountLayout } = await import("@/app/(account)/layout");
const { default: AppLayout } = await import("@/app/(account)/app/layout");
const { default: OverviewPage } = await import("@/app/(account)/app/(tabs)/page");
const { appEntry } = await import("@/app/(public)/_chrome/session");
const { setIdentityAuth } = await import("@/lib/account/identity/auth");
const { setIdentityStore } = await import("@/lib/account/identity/store");
const { setRetentionStore } = await import("@/lib/mail/retention");
const memory = await import("../../account/identity/memory-store");
const fake = await import("../../account/identity/fake-auth");

const USER = "user-1";
const calls = { sessionUser: 0, sessionClaims: 0, account: 0, siteForAccount: 0 };
let seen: () => Promise<void>;
const seenFor: string[] = [];
beforeEach(() => {
  request.clear();
  afterResponse.length = 0;
  seenFor.length = 0;
  for (const k of Object.keys(calls) as (keyof typeof calls)[]) calls[k] = 0;

  const identity = memory.newMemoryIdentity();
  memory.addAccount(identity, { id: USER, email: "founder@example.com" });
  identity.sites = [{ id: "site-1", user_id: USER }];
  const store = memory.memoryIdentityStore(identity);
  setIdentityStore({
    ...store,
    account: (id) => (calls.account++, store.account(id)),
    siteForAccount: (id) => (calls.siteForAccount++, store.siteForAccount(id)),
  });

  const state = fake.newFakeAuth();
  fake.addAuthUser(state, { id: USER, email: "founder@example.com" });
  const auth = fake.fakeIdentityAuth(state);
  setIdentityAuth({
    ...auth,
    sessionUser: (io) => (calls.sessionUser++, auth.sessionUser(io)),
    sessionClaims: (io) => (calls.sessionClaims++, auth.sessionClaims(io)),
  });
  jar.set(fake.FAKE_AUTH_COOKIE, fake.signedInCookie(state, USER).split("=")[1]!);

  seen = async () => {};
  setRetentionStore({ recordSeen: (userId: string) => (seenFor.push(userId), seen()) } as never);
  const at = "2026-09-16T09:40:00.000Z";
  db.seed("sites", [{ id: "site-1", user_id: USER, domain: "acme.test", created_at: at, setup_completed_at: at, timezone: "Europe/London" }]);
});

afterEach(() => {
  setIdentityAuth(null);
  setIdentityStore(null);
  setRetentionStore(null);
  db.reset();
});

/** One `/app` request; fails rather than hangs on a render that waits. */
async function renderApp(): Promise<void> {
  const waited = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("the render waited")), 10_000));
  await Promise.race([Promise.all([AccountLayout({ children: null }), AppLayout({ children: null }), OverviewPage()]), waited]);
}

describe("an /app request reads the session once", () => {
  it("both layouts, Overview and the public header share one signed-token check and one account read, never getUser", async () => {
    await renderApp();
    await expect(appEntry()).resolves.toBe("/app");
    expect(calls).toEqual({ sessionUser: 0, sessionClaims: 1, account: 1, siteForAccount: 1 });
    request.clear();
    await renderApp();
    expect(calls.sessionClaims).toBe(2);
  });
});

describe("'seen' is written after the response (SPEC §8)", () => {
  it("the render starts no write; the write runs once afterwards, and its failure is only logged", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    seen = async () => Promise.reject(new Error("users is unreachable"));
    await renderApp();
    expect(seenFor).toEqual([]);
    await Promise.all(afterResponse.map((task) => task()));
    expect(seenFor).toEqual([USER]);
    expect(warn.mock.calls.map(([line]) => JSON.parse(String(line)).event)).toContain("retention_seen_unrecorded");
    warn.mockRestore();
  });
});
