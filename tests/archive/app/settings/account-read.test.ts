// tests/app/settings/account-read.test.ts — BUILD §4.7, REQ-077 c1/c4,
// issues #134 and #228
//
// The account half of the screen's read: which account it is about, what it
// states, and what it does when the database will not answer.
//
// A file of its own rather than more of `provider.test.ts`, which drives the
// other eight reads through the publishing harness. This one doubles
// identity at the module boundary, which is where this screen's code stops —
// what `accountCard()` computes (the pending window in particular) is
// `tests/account/identity/email-change.test.ts`'s, and asserting it again
// here would only assert the double.
//
// **What #228 changed here.** Every row below used to end in
// `FIXTURE_SETTINGS_FACTS.email`: a card that could not be read fell back to
// the fixture's founder, so a customer whose row was missing read somebody
// else's name and address as their own. There is no honest arm for "we do
// not know your address", so the read propagates now and the screen's own
// failure states it. The rows assert the propagation, and that the fixture
// is not what comes back.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { accountCard } = vi.hoisted(() => ({ accountCard: vi.fn() }));

vi.mock("@/lib/account/identity", () => ({ accountCard }));

const { readAccountFacts } = await import("@/app/(account)/app/settings/store");
const { assembleSettings } = await import("@/app/(account)/app/settings/model");
const { FIXTURE_SETTINGS_FACTS } = await import("@/app/(account)/app/settings/fixture");
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
  accountCard.mockReset();
  accountCard.mockImplementation(() => Promise.resolve(card()));
});

describe("REQ-077 c1 — the card is read for the account it was given", () => {
  it("asks `accountCard()` for that account and no other", async () => {
    await readAccountFacts(SIGNED_IN_USER);
    expect(accountCard).toHaveBeenCalledTimes(1);
    expect(accountCard).toHaveBeenCalledWith(SIGNED_IN_USER);
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
    const facts = await readAccountFacts(SIGNED_IN_USER);
    // The read carries the moment; the shell's one formatter writes it.
    // REQ-073 c1: in the zone the customer stated, never the server's.
    const model = assembleSettings({
      ...FIXTURE_SETTINGS_FACTS,
      ...facts,
      timeZone: "America/New_York",
    });
    expect(model.account.pending?.email).toBe("new@example.com");
    expect(typeof model.account.pending?.expiresAt).toBe("string");
    expect(model.account.pending?.expiresAt).not.toBe("");
  });

  it("a change identity reports as lapsed is simply not there — this screen holds no clock", async () => {
    // `accountCard()` computes the window and answers `null` past it. The
    // screen must not compute a second one, so there is nothing here to
    // disagree with it.
    accountCard.mockImplementation(() => Promise.resolve(card({ pending: null })));
    expect((await readAccountFacts(SIGNED_IN_USER)).pendingEmail).toBeNull();
  });
});

describe("a read that cannot be made propagates, and never the fixture's founder (#228)", () => {
  it("no account row is a failure, not a stand-in customer", async () => {
    accountCard.mockImplementation(() => Promise.resolve(null));
    await expect(readAccountFacts(SIGNED_IN_USER)).rejects.toThrow(/no account row/);
  });

  it("a read that throws propagates the same way", async () => {
    accountCard.mockImplementation(() => Promise.reject(new Error("no environment")));
    await expect(readAccountFacts(SIGNED_IN_USER)).rejects.toThrow("no environment");
  });

  it("a read that never comes back is bounded, so the screen fails rather than hanging", async () => {
    // A `catch` alone does not cover this: a request that never settles
    // never rejects. Every `(account)` screen is dynamic, so this read
    // happens per request — an unreachable database must cost the customer
    // a stated failure, not a page that never loads (DECISIONS 2026-09-07,
    // #186: every settings read is bounded at 800 ms).
    accountCard.mockImplementation(() => new Promise(() => {}));
    const started = Date.now();
    await expect(readAccountFacts(SIGNED_IN_USER)).rejects.toThrow(/timed out/);
    expect(Date.now() - started).toBeLessThan(3_000);
  });

  it("no arm of this read can answer with the fixture's address", async () => {
    // The three rows above are the whole of what this function can do when
    // the read fails, and none of them returns a value. Stated once, so a
    // future fallback has to delete this row to be added.
    for (const answer of [null, Promise.reject(new Error("down"))]) {
      accountCard.mockImplementation(() => Promise.resolve(answer));
      await expect(readAccountFacts(SIGNED_IN_USER)).rejects.toThrow();
    }
    // And the fixture is a different person from the card above, which is
    // what lets every row in this file tell a read from a fallback.
    expect(FIXTURE_SETTINGS_FACTS.email).not.toBe("founder@example.com");
  });
});
