// tests/app/session/account.test.ts — BUILD §4.3, §4.4, §13, issue #169
//
// The one seam every `/app` surface resolves its account through, and the
// two refusals it answers.
//
// The mutation this suite exists to kill is a surface that draws for a
// caller it could not name — which is what every one of these screens did
// until this issue, and what a `null`-tolerant seam would let one do again.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const currentSession = vi.fn();
const readAppSite = vi.fn();

vi.mock("@/lib/account/identity", () => ({
  currentSession: (...a: unknown[]) => currentSession(...a),
}));

vi.mock("@/app/(account)/app/_session/store", () => ({
  readAppSite: (...a: unknown[]) => readAppSite(...a),
}));

const redirected: string[] = [];
vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    redirect: (to: string) => {
      redirected.push(to);
      throw new Error(`NEXT_REDIRECT:${to}`);
    },
  };
});

const account = await import("@/app/(account)/app/_session/account");

const SITE = {
  id: "site-1",
  user_id: "user-1",
  domain: "acme.test",
  timezone: "America/New_York",
  mode: "autopilot",
  created_at: "2026-08-24T06:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  redirected.length = 0;
  account.setAppAccountReader(null);
  currentSession.mockResolvedValue({ userId: "user-1", siteId: "site-1" });
  readAppSite.mockResolvedValue(SITE);
});

afterEach(() => {
  account.setAppAccountReader(null);
});

describe("who is asking, from the signed cookie and one site read", () => {
  it("resolves the account and its site", async () => {
    await expect(account.appAccount()).resolves.toEqual({
      ok: true,
      account: {
        userId: "user-1",
        siteId: "site-1",
        domain: "acme.test",
        createdAt: new Date(SITE.created_at),
        timeZone: "America/New_York",
        mode: "autopilot",
      },
    });
  });

  it("reads the site named by the session and no other", async () => {
    await account.appAccount();
    expect(readAppSite).toHaveBeenCalledWith("site-1");
  });

  it("a mode the row does not name reads as autopilot — §9's default, never a third mode", async () => {
    readAppSite.mockResolvedValue({ ...SITE, mode: "nonsense" });
    const result = await account.appAccount();
    expect(result.ok && result.account.mode).toBe("autopilot");
  });

  it("copilot is carried through as itself", async () => {
    readAppSite.mockResolvedValue({ ...SITE, mode: "copilot" });
    const result = await account.appAccount();
    expect(result.ok && result.account.mode).toBe("copilot");
  });
});

describe("the two refusals are two different facts", () => {
  it("no session at all is `no_session`", async () => {
    currentSession.mockResolvedValue(null);
    await expect(account.appAccount()).resolves.toEqual({ ok: false, because: "no_session" });
  });

  it("a session whose account has no site is `no_site`, not `no_session`", async () => {
    // A customer who has paid and not finished setup is not signed out, and
    // answering `/signin` for them would sign them out of their own account.
    currentSession.mockResolvedValue({ userId: "user-1", siteId: null });
    await expect(account.appAccount()).resolves.toEqual({ ok: false, because: "no_site" });
  });

  it("a site row that does not exist is `no_site`", async () => {
    readAppSite.mockResolvedValue(null);
    await expect(account.appAccount()).resolves.toEqual({ ok: false, because: "no_site" });
  });

  it("a site belonging to another account is refused, never drawn", async () => {
    // The cookie is signed, so the pair arrives together — but a row read
    // by id is still read by id, and this is the row that says so.
    readAppSite.mockResolvedValue({ ...SITE, user_id: "somebody-else" });
    await expect(account.appAccount()).resolves.toEqual({ ok: false, because: "no_site" });
  });
});

describe("§4.3's refusal — where each arm sends the customer", () => {
  it("no session goes to the sign-in prompt", async () => {
    currentSession.mockResolvedValue(null);
    await expect(account.requireAppAccount()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirected).toEqual(["/signin"]);
  });

  it("no site goes to setup, never to sign-in", async () => {
    currentSession.mockResolvedValue({ userId: "user-1", siteId: null });
    await expect(account.requireAppAccount()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirected).toEqual(["/setup"]);
  });

  it("an account with a site is returned, and nothing is redirected", async () => {
    await expect(account.requireAppAccount()).resolves.toMatchObject({ siteId: "site-1" });
    expect(redirected).toEqual([]);
  });

  it("a site with no stated zone goes to setup rather than being drawn in the server's (REQ-073 c1)", async () => {
    readAppSite.mockResolvedValue({ ...SITE, timezone: null });
    await expect(account.requireSetUpAccount()).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirected).toEqual(["/setup"]);
  });

  it("a site with a stated zone comes back with it narrowed to a string", async () => {
    const set = await account.requireSetUpAccount();
    expect(set.timeZone).toBe("America/New_York");
  });
});

describe("the reserved fixture account is decided here and nowhere else", () => {
  it("the reserved name is one no customer can hold", () => {
    // IANA-reserved, which is what makes "the fixture answers only for this
    // account" a fact about the name rather than a flag someone has to
    // remember to unset.
    expect(account.RESERVED_FIXTURE_DOMAIN).toBe("example.com");
  });

  it("a real domain is never the reserved account", async () => {
    const set = await account.requireSetUpAccount();
    expect(account.isReservedFixtureAccount(set)).toBe(false);
  });

  it("the reserved domain is", async () => {
    readAppSite.mockResolvedValue({ ...SITE, domain: "example.com" });
    const set = await account.requireSetUpAccount();
    expect(account.isReservedFixtureAccount(set)).toBe(true);
  });
});

describe("the door", () => {
  it("a registered reader answers instead of the session", async () => {
    account.setAppAccountReader(async () => ({ ok: false, because: "no_session" }));
    await expect(account.appAccount()).resolves.toEqual({ ok: false, because: "no_session" });
    expect(currentSession).not.toHaveBeenCalled();
  });

  it("`null` restores the session-backed reader, so no suite leaks an account into the next", async () => {
    account.setAppAccountReader(async () => ({ ok: false, because: "no_session" }));
    account.setAppAccountReader(null);
    await expect(account.appAccount()).resolves.toMatchObject({ ok: true });
  });
});
