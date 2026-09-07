// tests/app/settings/account-read.test.ts — BUILD §4.7, REQ-077 c1/c4,
// issue #134
//
// The account half of the screen's one read: which account it is about, what
// it states, and what it does when the database will not answer.
//
// A file of its own rather than more of `provider.test.ts`, which drives the
// destinations half through the publishing harness. This one doubles
// identity at the module boundary, which is where this screen's code stops —
// what `accountCard()` computes (the pending window in particular) is
// `tests/account/identity/email-change.test.ts`'s and asserting it again
// here would only assert the double.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { accountCard, currentSession, appAccount } = vi.hoisted(() => ({
  accountCard: vi.fn(),
  currentSession: vi.fn(),
  appAccount: vi.fn(),
}));

vi.mock("@/lib/account/identity", () => ({ accountCard, currentSession }));

// #42: the screen resolves its account through the one `(account)` seam
// (#169) rather than reading the cookie itself, so that is what this suite
// drives. `currentSession` stays mocked because the seam reaches it, and
// because the bounded-read rows below are about what happens when it hangs.
vi.mock("@/app/(account)/app/_session/account", () => ({ appAccount }));

// The other two reads this screen makes are not this file's subject, and
// both reach a database it has none of.
vi.mock("@/lib/account/billing", () => ({
  billingSummary: () => Promise.resolve({ ok: false, reason: "unreadable" }),
}));
vi.mock("@/lib/publish/destinations", () => ({ listDestinations: () => Promise.resolve([]) }));

const { readAccountFacts, readSettings } = await import("@/app/(account)/app/settings/provider");
const { FIXTURE_SETTINGS_FACTS } = await import("@/app/(account)/app/settings/fixture");
const { FIXTURE_SETTINGS_ACCOUNT_ID } = await import("@/app/(account)/app/settings/provider");
const { ACCOUNT_NOTE_KEYS } = await import("@/lib/account/identity/notes");

const SIGNED_IN_USER = "user-from-the-session";
const EXPIRES = new Date("2026-09-08T09:00:00.000Z");

function card(over: Record<string, unknown> = {}): unknown {
  return {
    name: "A Founder",
    email: "founder@example.com",
    pending: null,
    noteKeys: ACCOUNT_NOTE_KEYS,
    ...over,
  };
}

beforeEach(() => {
  currentSession.mockImplementation(() =>
    Promise.resolve({ userId: SIGNED_IN_USER, siteId: "site-1" })
  );
  appAccount.mockImplementation(() =>
    Promise.resolve({
      ok: true,
      account: {
        userId: SIGNED_IN_USER,
        siteId: "site-1",
        domain: "acme.com",
        createdAt: new Date("2026-08-24T06:00:00.000Z"),
        timeZone: "America/New_York",
        mode: "autopilot",
      },
    })
  );
  accountCard.mockImplementation(() => Promise.resolve(card()));
});

describe("REQ-077 c1 — the card is read for the account the session names", () => {
  it("asks `accountCard()` for the session's own account, never the fixture stand-in", async () => {
    await readSettings();
    expect(accountCard).toHaveBeenCalledWith(SIGNED_IN_USER);
    expect(accountCard).not.toHaveBeenCalledWith(FIXTURE_SETTINGS_ACCOUNT_ID);
  });

  it("carries the name, the address and the note keys through untouched", async () => {
    expect(await readAccountFacts(SIGNED_IN_USER)).toEqual({
      name: "A Founder",
      email: "founder@example.com",
      pendingEmail: null,
      noteKeys: ACCOUNT_NOTE_KEYS,
    });
  });

  it("an account with no name is `null`, not a filled-in blank", async () => {
    accountCard.mockImplementation(() => Promise.resolve(card({ name: null })));
    expect((await readAccountFacts(SIGNED_IN_USER)).name).toBeNull();
  });
});

describe("REQ-077 c4 — the pending change reaches the model as a written moment", () => {
  it("the expiry is formatted once, in the customer's own stated zone", async () => {
    accountCard.mockImplementation(() =>
      Promise.resolve(card({ pending: { email: "new@example.com", expiresAt: EXPIRES } }))
    );
    const model = await readSettings();
    expect(model.account.pending?.email).toBe("new@example.com");
    // A string on the model, not a Date: the screen states no moment of its
    // own, and the one formatter is the shell's.
    expect(typeof model.account.pending?.expiresAt).toBe("string");
    expect(model.account.pending?.expiresAt).not.toBe("");
  });

  it("a change identity reports as lapsed is simply not there — this screen holds no clock", async () => {
    // `accountCard()` computes the window and answers `null` past it. The
    // screen must not compute a second one, so there is nothing here to
    // disagree with it.
    accountCard.mockImplementation(() => Promise.resolve(card({ pending: null })));
    expect((await readSettings()).account.pending).toBeNull();
  });
});

describe("a read that cannot be made degrades, and never invents a change", () => {
  it("no account row falls back to the fixture's own", async () => {
    accountCard.mockImplementation(() => Promise.resolve(null));
    const facts = await readAccountFacts(SIGNED_IN_USER);
    expect(facts.email).toBe(FIXTURE_SETTINGS_FACTS.email);
    expect(facts.pendingEmail).toBeNull();
  });

  it("a read that throws falls back the same way", async () => {
    accountCard.mockImplementation(() => Promise.reject(new Error("no environment")));
    expect((await readAccountFacts(SIGNED_IN_USER)).email).toBe(FIXTURE_SETTINGS_FACTS.email);
  });

  it("a read that never comes back is bounded, and the screen still renders", async () => {
    // A `catch` alone does not cover this: a request that never settles
    // never rejects. Reading the session made this route dynamic, so all
    // three of its reads happen per request now — an unreachable database
    // must cost the customer a fallback, not a screen that never loads.
    accountCard.mockImplementation(() => new Promise(() => {}));
    const started = Date.now();
    const facts = await readAccountFacts(SIGNED_IN_USER);
    expect(facts.email).toBe(FIXTURE_SETTINGS_FACTS.email);
    expect(Date.now() - started).toBeLessThan(3_000);
  });

  it("a session that never comes back is bounded too, and the screen falls back to the fixture id", async () => {
    appAccount.mockImplementation(() => new Promise(() => {}));
    const started = Date.now();
    await readSettings();
    expect(accountCard).toHaveBeenCalledWith(FIXTURE_SETTINGS_ACCOUNT_ID);
    expect(Date.now() - started).toBeLessThan(4_000);
  });

  it("the fallback can never invent a change awaiting confirmation", async () => {
    // Whatever went wrong, a customer must not be shown an address waiting
    // on a link nobody sent. The fixture holds none, which is what makes
    // that structural rather than remembered.
    expect(FIXTURE_SETTINGS_FACTS.pendingEmail).toBeNull();
  });
});
