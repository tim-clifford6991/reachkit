// tests/account/identity/email-change.test.ts — BUILD §4.7, issue #35
//
// REQ-077 criterion 2, quoted: "Given the customer submits a new email
// address, when that address is not already a ReachKit account and is a
// valid address, then a sign-in link is sent to it and the old address
// keeps working until that link is used; when it is already an account or
// is not a valid address, then no link is sent, nothing changes, and one
// written line says why."
//
// And criterion 4: "Given a change is pending, when the customer opens the
// account card, then it shows the address awaiting confirmation and lets
// them cancel the pending change or submit a different address; and the
// link expires 24 hours after it is sent, after which the pending change
// lapses and the account is unchanged."
//
// The case that discriminates hardest is "the old address keeps working":
// an implementation that writes `users.email` on submission passes every
// other case here and fails that one.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock, sendOutcome } from "../send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { ACCOUNT_NOTE_KEYS, accountCard, beginEmailChange, cancelEmailChange } = await import(
  "../../../src/lib/account/identity/email-change"
);
const { setIdentityStore } = await import("../../../src/lib/account/identity/store");
const { EMAIL_CHANGE_TTL_H } = await import("../../../src/lib/config/constants");
const { COPY } = await import("../../../src/lib/presentation/copy/registry");
const { addAccount, memoryIdentityStore, newMemoryIdentity } = await import("./memory-store");

const SOURCE = readFileSync(
  path.resolve(import.meta.dirname, "../../../src/lib/account/identity/email-change.ts"),
  "utf8"
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

/** The import-free leaf the two note keys moved to (#134), read the same
 *  way and for the same claim. */
const NOTES_SOURCE = readFileSync(
  path.resolve(import.meta.dirname, "../../../src/lib/account/identity/notes.ts"),
  "utf8"
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

const NOW = new Date("2026-09-06T12:00:00.000Z");
const TTL_MS = EMAIL_CHANGE_TTL_H * 60 * 60 * 1000;

let state = newMemoryIdentity();

beforeEach(() => {
  state = newMemoryIdentity();
  setIdentityStore(memoryIdentityStore(state));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
});

describe('REQ-077 c1 — what the account card shows', () => {
  it("returns the name and the address the customer signs in with", async () => {
    const user = addAccount(state, { email: "founder@example.com", name: "A Founder" });
    expect(await accountCard(user.id, NOW)).toEqual({
      name: "A Founder",
      email: "founder@example.com",
      pending: null,
      noteKeys: ACCOUNT_NOTE_KEYS,
    });
  });

  it("a name nobody has written is null, never a fabricated one", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    expect((await accountCard(user.id, NOW))?.name).toBeNull();
  });

  it("names the two written lines the criterion owes, and both are keys in the registry", () => {
    expect(ACCOUNT_NOTE_KEYS).toEqual([
      "settings.account.magic-link",
      "settings.account.invoices-elsewhere",
    ]);
    for (const key of ACCOUNT_NOTE_KEYS) expect(key in COPY).toBe(true);
  });

  it("returns no invoice address on any path (REQ-076 c2), and holds no billing import", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    const card = await accountCard(user.id, NOW);
    expect(Object.keys(card ?? {}).sort()).toEqual(["email", "name", "noteKeys", "pending"]);
    expect(SOURCE).not.toMatch(/account\/billing/);
    // No mention of an invoice anywhere in this module or in the leaf that
    // holds its two note keys: no value, no read, no field. The *key* of
    // the line that says invoices are changed somewhere else is the one
    // occurrence across the pair, and it moved to `notes.ts` with the list
    // (#134) — so both files are read, and the claim is unchanged.
    expect(SOURCE.match(/invoice[a-z-]*/gi)).toBeNull();
    expect(NOTES_SOURCE.match(/invoice[a-z-]*/gi)).toEqual(["invoices-elsewhere"]);
    expect(NOTES_SOURCE).not.toMatch(/account\/billing/);
  });

  it("an account nobody can read is null, never an empty card", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    state.failAccountRead = true;
    expect(await accountCard(user.id, NOW)).toBeNull();
  });
});

describe('REQ-077 c2 — a valid, free address is sent a link and the old one keeps working', () => {
  it("writes only the pending columns; users.email is untouched", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    const begun = await beginEmailChange(user.id, "next@example.com", NOW);

    expect(begun).toEqual({ ok: true, expiresAt: new Date(NOW.getTime() + TTL_MS) });
    expect(state.users[0]?.email).toBe("founder@example.com");
    expect(state.users[0]?.pending_email).toBe("next@example.com");
    expect(state.users[0]?.pending_email_sent_at).toBe(NOW.toISOString());
    expect(state.users[0]?.pending_email_token_hash).toBe(
      state.links.find((l) => l.purpose === "email_change")?.token_hash
    );
  });

  it("sends the link to the new address, and to no other", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    await beginEmailChange(user.id, "next@example.com", NOW);
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0]?.to).toBe("next@example.com");
    expect(sendCalls[0]?.kind).toBe("magic-link");
  });

  it("normalises the address it holds and mails", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    await beginEmailChange(user.id, "  Next@Example.COM ", NOW);
    expect(state.users[0]?.pending_email).toBe("next@example.com");
    expect(sendCalls[0]?.to).toBe("next@example.com");
  });
});

describe('REQ-077 c2 — the two refusals send no link and change nothing', () => {
  it("an address that is already an account refuses with the in-use key", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    addAccount(state, { email: "taken@example.com" });

    expect(await beginEmailChange(user.id, "taken@example.com", NOW)).toEqual({
      ok: false,
      reason: "in_use",
      lineKey: "settings.account.email-in-use",
    });
    expect(sendCalls).toHaveLength(0);
    expect(state.users[0]?.pending_email).toBeNull();
    expect(state.links).toHaveLength(0);
  });

  it("an address another customer is already waiting on refuses too", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    const other = addAccount(state, { email: "other@example.com" });
    await beginEmailChange(other.id, "wanted@example.com", NOW);
    sendCalls.length = 0;

    expect(await beginEmailChange(user.id, "wanted@example.com", NOW)).toMatchObject({
      reason: "in_use",
    });
    expect(sendCalls).toHaveLength(0);
  });

  it("a soft-deleted account's address refuses — the row is present but hidden (ADR-051 point 5)", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    addAccount(state, { email: "gone@example.com", deleted_at: NOW.toISOString() });

    expect(await beginEmailChange(user.id, "gone@example.com", NOW)).toMatchObject({
      reason: "in_use",
    });
  });

  it("their own current address refuses — a change to the address you have is a change to nothing", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    expect(await beginEmailChange(user.id, "Founder@Example.com", NOW)).toMatchObject({
      reason: "in_use",
    });
  });

  it.each(["", "   ", "not-an-address", "a@", "@b.com", "a b@example.com"])(
    "%j refuses as invalid, sends nothing and writes nothing",
    async (bad) => {
      const user = addAccount(state, { email: "founder@example.com" });
      expect(await beginEmailChange(user.id, bad, NOW)).toEqual({
        ok: false,
        reason: "invalid",
        lineKey: "settings.account.email-invalid",
      });
      expect(sendCalls).toHaveLength(0);
      expect(state.users[0]?.pending_email).toBeNull();
    }
  );

  it("no MX probe and no disposable-domain list — validity is syntax plus the send itself", () => {
    expect(SOURCE).not.toMatch(/\bMX\b|resolveMx|disposable/i);
  });
});

describe("a third answer, for what is neither the address's fault nor a refusal", () => {
  it("a store that cannot be read says so rather than calling the address invalid", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    state.failAccountRead = true;
    expect(await beginEmailChange(user.id, "next@example.com", NOW)).toEqual({
      ok: false,
      reason: "unavailable",
      lineKey: "settings.account.email-change-unavailable",
    });
  });

  it("a mail that does not leave takes the pending change back out with it", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    sendOutcome.next = { sent: false, reason: "vendor" };

    expect(await beginEmailChange(user.id, "next@example.com", NOW)).toMatchObject({
      reason: "unavailable",
    });
    expect(state.users[0]?.pending_email).toBeNull();
    expect(state.users[0]?.pending_email_token_hash).toBeNull();
    expect(state.links.every((l) => l.spent_at !== null)).toBe(true);
    expect(state.users[0]?.email).toBe("founder@example.com");
  });
});

describe('REQ-077 c4 — a pending change is visible, replaceable, cancellable, and lapses', () => {
  it("the card shows the address awaiting confirmation and when it expires", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    await beginEmailChange(user.id, "next@example.com", NOW);

    expect((await accountCard(user.id, NOW))?.pending).toEqual({
      email: "next@example.com",
      expiresAt: new Date(NOW.getTime() + TTL_MS),
    });
  });

  it("a second submission replaces the pending address and spends the first link", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    await beginEmailChange(user.id, "first@example.com", NOW);
    await beginEmailChange(user.id, "second@example.com", NOW);

    expect((await accountCard(user.id, NOW))?.pending?.email).toBe("second@example.com");
    expect(state.links.filter((l) => l.spent_at === null)).toHaveLength(1);
    expect(state.users[0]?.email).toBe("founder@example.com");
  });

  it("cancel clears the pending state, spends the live link and leaves the account unchanged", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    await beginEmailChange(user.id, "next@example.com", NOW);

    await cancelEmailChange(user.id, NOW);

    expect(state.users[0]).toMatchObject({
      email: "founder@example.com",
      pending_email: null,
      pending_email_token_hash: null,
      pending_email_sent_at: null,
    });
    expect(state.links.every((l) => l.spent_at !== null)).toBe(true);
    expect((await accountCard(user.id, NOW))?.pending).toBeNull();
  });

  it("cancelling with nothing pending is harmless", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    await cancelEmailChange(user.id, NOW);
    expect(state.users[0]?.email).toBe("founder@example.com");
  });

  it("a change unredeemed at 24 hours lapses, and the account is unchanged", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    await beginEmailChange(user.id, "next@example.com", NOW);

    const after = new Date(NOW.getTime() + TTL_MS);
    expect((await accountCard(user.id, after))?.pending).toBeNull();
    expect(state.users[0]?.email).toBe("founder@example.com");
  });

  it("it is still pending one minute before it lapses — the boundary, not a rounding", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    await beginEmailChange(user.id, "next@example.com", NOW);
    const just = new Date(NOW.getTime() + TTL_MS - 60 * 1000);
    expect((await accountCard(user.id, just))?.pending?.email).toBe("next@example.com");
  });

  it("a lapse writes nothing — there is nothing to write, because users.email never moved", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    await beginEmailChange(user.id, "next@example.com", NOW);
    const before = JSON.stringify(state.users);
    await accountCard(user.id, new Date(NOW.getTime() + TTL_MS + 1));
    expect(JSON.stringify(state.users)).toBe(before);
  });
});
