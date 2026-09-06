// tests/account/provisioning/chase.test.ts — BUILD §13, issue #33
//
// REQ-024 criterion 5's mail: the payment succeeded, a working link where
// the account is open or a written statement that it is not open yet, one
// way to reach a person, and never a request for payment again.
//
// The discriminating case is the last clause. A founder who has paid and is
// waiting must never be shown a buy button; that is the moment a person
// concludes they were charged for nothing.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock, sendOutcome } from "../send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { chaseSignIn } = await import("@/lib/account/provisioning/chase");
const { registerSignInLinkIssuer } = await import("@/lib/account/provisioning/sign-in-link");
const { setAccountStore } = await import("@/lib/account/store");
const { memoryAccountStore, newMemoryAccounts } = await import("../memory-store");

const NOW = new Date("2026-09-06T12:15:00.000Z");

let accounts = newMemoryAccounts();

function account(patch: Record<string, unknown> = {}) {
  accounts.users.push({
    id: "user-1",
    email: "founder@acme.example",
    checkout_session_id: "cs_one",
    first_signed_in_at: null,
    sign_in_chased_at: null,
    stripe_customer_id: "cus_one",
    billing_country: "IE",
    vat_number: null,
    created_at: "2026-09-06T12:00:00.000Z",
    ...patch,
  });
}

function withLink() {
  registerSignInLinkIssuer(async () => ({
    issued: true,
    url: "https://reachkit.example/signin?t=tok",
    expiresAt: NOW,
  }));
}

beforeEach(() => {
  accounts = newMemoryAccounts();
  setAccountStore(memoryAccountStore(accounts));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
  registerSignInLinkIssuer(null);
});

afterEach(() => registerSignInLinkIssuer(null));

describe("an open account's chase carries a working link", () => {
  it("sends one account mail to the address that paid, with an action carrying the link", async () => {
    account();
    withLink();
    const outcome = await chaseSignIn("cs_one", NOW);
    expect(outcome).toEqual({ chased: true, carriedLink: true });
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0]).toMatchObject({ kind: "account", to: "founder@acme.example" });
    const action = (sendCalls[0]?.blocks ?? []).find(
      (block) => (block as { block: string }).block === "action"
    );
    expect(action).toMatchObject({ href: "https://reachkit.example/signin?t=tok" });
  });
});

describe("an unopened account's chase says so and carries none", () => {
  it("with no link issuable, the mail goes and carries no action at all", async () => {
    account();
    // No issuer registered: the identity half (#35) is not there yet.
    const outcome = await chaseSignIn("cs_one", NOW);
    expect(outcome).toEqual({ chased: true, carriedLink: false });
    const blocks = (sendCalls[0]?.blocks ?? []) as { block: string }[];
    expect(blocks.some((block) => block.block === "action")).toBe(false);
  });

  it("the two arms are different mails, not one mail with a conditional line", async () => {
    account();
    withLink();
    await chaseSignIn("cs_one", NOW);
    const withLinkBlocks = sendCalls[0]?.blocks;

    accounts = newMemoryAccounts();
    setAccountStore(memoryAccountStore(accounts));
    account();
    registerSignInLinkIssuer(null);
    sendCalls.length = 0;
    await chaseSignIn("cs_one", NOW);
    expect(sendCalls[0]?.blocks).not.toEqual(withLinkBlocks);
  });
});

describe('REQ-024 c5 — "names one way to reach a person, and never asks for payment again"', () => {
  it.each([true, false])("with a link: %s — the mail names a way to reach a person", async (linked) => {
    account();
    if (linked) withLink();
    await chaseSignIn("cs_one", NOW);
    const blocks = (sendCalls[0]?.blocks ?? []) as { block: string; text?: string }[];
    expect(blocks.some((block) => block.text === "mail.account.reach_a_person")).toBe(true);
  });

  it.each([true, false])("with a link: %s — no block carries a price key or a checkout URL", async (linked) => {
    account();
    if (linked) withLink();
    await chaseSignIn("cs_one", NOW);
    const serialised = JSON.stringify(sendCalls[0]);
    expect(serialised).not.toMatch(/price\./);
    expect(serialised).not.toContain("checkout.stripe.com");
  });
});

describe("running the tick twice sends one mail", () => {
  it("the second run is refused as already chased", async () => {
    account();
    withLink();
    await chaseSignIn("cs_one", NOW);
    const second = await chaseSignIn("cs_one", NOW);
    expect(second).toEqual({ chased: false, because: "already_chased" });
    expect(sendCalls).toHaveLength(1);
  });

  it("the stamp is written only after the mail actually went", async () => {
    account();
    withLink();
    sendOutcome.next = { sent: false, reason: "vendor" };
    const outcome = await chaseSignIn("cs_one", NOW);
    expect(outcome).toEqual({ chased: false, because: "mail" });
    // Not stamped: a mail stamped and not sent is a founder who is never
    // written to at all.
    expect(accounts.users[0]?.sign_in_chased_at).toBeNull();
  });
});

describe("the state is re-read at send time, not trusted from the query", () => {
  it("a founder who signed in during the fifteen minutes is not chased", async () => {
    account({ first_signed_in_at: "2026-09-06T12:10:00.000Z" });
    withLink();
    const outcome = await chaseSignIn("cs_one", NOW);
    expect(outcome).toEqual({ chased: false, because: "signed_in" });
    expect(sendCalls).toEqual([]);
  });

  it("a session with no account is the backstop's subject, not this one's", async () => {
    withLink();
    const outcome = await chaseSignIn("cs_nowhere", NOW);
    expect(outcome).toEqual({ chased: false, because: "no_account" });
    expect(sendCalls).toEqual([]);
  });

  it("an unreadable store sends nothing", async () => {
    account();
    accounts.failAccountRead = true;
    const outcome = await chaseSignIn("cs_one", NOW);
    expect(outcome).toEqual({ chased: false, because: "store" });
    expect(sendCalls).toEqual([]);
  });
});
