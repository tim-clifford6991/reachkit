// tests/account/identity/email-change-complete.test.ts — BUILD §4.7, issue #35
//
// REQ-077 criterion 3, quoted: "Given the link sent to the new address is
// used, when it succeeds, then only the new address can sign in, every mail
// ReachKit itself sends goes to it, and one `account` mail (REQ-064) goes
// to the old address saying the account now signs in at a different address
// and this one no longer can."
//
// The case that discriminates c3 is "the old address cannot sign in
// afterwards" — an implementation that adds the new address rather than
// moving the account onto it passes everything else here.
//
// The mutation these guard against: deleting the other-sessions
// termination, which only `› every session issued before the change is
// ended` fails.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock, sendOutcome } from "../send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { beginEmailChange } = await import("../../../src/lib/account/identity/email-change");
const { redeemLink } = await import("../../../src/lib/account/identity/links");
const { setIdentityStore } = await import("../../../src/lib/account/identity/store");
const { addAccount, memoryIdentityStore, newMemoryIdentity } = await import("./memory-store");

const NOW = new Date("2026-09-06T12:00:00.000Z");
const LATER = new Date("2026-09-06T13:00:00.000Z");

let state = newMemoryIdentity();

beforeEach(() => {
  state = newMemoryIdentity();
  setIdentityStore(memoryIdentityStore(state));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
});

function changeToken(): string {
  // The plaintext never leaves `issueLink`, so the suite drives the
  // redemption the way the route does — through the URL the mail carried.
  const url = String(sendCalls[0]?.blocks?.find(isAction)?.href ?? "");
  const segments = new URL(url).pathname.split("/");
  return decodeURIComponent(segments[segments.length - 1] ?? "");
}

function isAction(block: unknown): block is { block: string; href: string } {
  return typeof block === "object" && block !== null && "href" in block;
}

async function pendingChange(): Promise<{ userId: string; token: string }> {
  const user = addAccount(state, { email: "old@example.com" });
  await beginEmailChange(user.id, "new@example.com", NOW);
  const token = changeToken();
  sendCalls.length = 0;
  return { userId: user.id, token };
}

describe('REQ-077 c3 — "only the new address can sign in"', () => {
  it("redemption moves users.email onto the new address", async () => {
    const { userId, token } = await pendingChange();
    const redeemed = await redeemLink(token, LATER);

    expect(redeemed.ok).toBe(true);
    if (!redeemed.ok) return;
    expect(redeemed.purpose).toBe("email_change");
    expect(redeemed.userId).toBe(userId);
    expect(state.users[0]?.email).toBe("new@example.com");
  });

  it("the old address is gone from the account — it cannot sign in, because it is nobody's", async () => {
    const { token } = await pendingChange();
    await redeemLink(token, LATER);
    expect(state.users.some((u) => u.email === "old@example.com")).toBe(false);
  });

  it("the three pending columns clear in the same move", async () => {
    const { token } = await pendingChange();
    await redeemLink(token, LATER);
    expect(state.users[0]).toMatchObject({
      pending_email: null,
      pending_email_token_hash: null,
      pending_email_sent_at: null,
    });
  });

  it("the customer is left signed in at the new address — never a second checkout or a dead end", async () => {
    const { userId, token } = await pendingChange();
    const redeemed = await redeemLink(token, LATER);
    expect(redeemed.ok && redeemed.session).toEqual({
      userId,
      siteId: state.sites[0]?.id,
      issuedAt: LATER,
    });
    expect(redeemed.ok && redeemed.firstSignIn).toBe(false);
  });
});

describe('REQ-077 c3 — one `account` mail goes to the old address', () => {
  it("exactly one, to the old address, of kind account", async () => {
    const { token } = await pendingChange();
    await redeemLink(token, LATER);

    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0]?.kind).toBe("account");
    expect(sendCalls[0]?.to).toBe("old@example.com");
  });

  it("it names neither address — the mail arrives at one and must not carry the other", async () => {
    const { token } = await pendingChange();
    await redeemLink(token, LATER);
    const body = JSON.stringify(sendCalls[0]);
    expect(body).not.toContain("new@example.com");
    expect(body.match(/old@example\.com/g)).toEqual(["old@example.com"]); // the recipient only
  });

  it("a failing mail leaves the change standing and says so, rather than reverting it", async () => {
    const { token } = await pendingChange();
    sendOutcome.next = { sent: false, reason: "vendor" };

    const redeemed = await redeemLink(token, LATER);
    expect(redeemed.ok).toBe(true);
    if (!redeemed.ok) return;
    expect(redeemed.noticeToOldAddress).toBe("failed");
    expect(state.users[0]?.email).toBe("new@example.com");
  });
});

describe('BP-061 decision 4 — a completed change ends the account\'s other sessions', () => {
  it("every session issued before the change is ended", async () => {
    const { token } = await pendingChange();
    await redeemLink(token, LATER);
    expect(state.users[0]?.sessions_valid_from).toBe(LATER.toISOString());
  });
});

describe("every other link the account was holding is spent", () => {
  it("a live sign-in link does not survive the move", async () => {
    const { userId, token } = await pendingChange();
    const { issueLink } = await import("../../../src/lib/account/identity/links");
    await issueLink({ userId, to: "old@example.com", purpose: "sign_in", now: NOW });

    await redeemLink(token, LATER);
    expect(state.links.every((l) => l.spent_at !== null)).toBe(true);
  });

  it("the change link itself is single use", async () => {
    const { token } = await pendingChange();
    await redeemLink(token, LATER);
    expect(await redeemLink(token, LATER)).toMatchObject({ ok: false, reason: "spent" });
  });
});

describe("what happens when the move itself cannot be made", () => {
  it("a store that refuses the write answers as a dead link and changes nothing", async () => {
    const { token } = await pendingChange();
    state.failCompleteChange = true;

    expect(await redeemLink(token, LATER)).toMatchObject({ ok: false, reason: "unknown" });
    expect(state.users[0]?.email).toBe("old@example.com");
    expect(sendCalls).toHaveLength(0);
  });

  it("an address taken by somebody else since the request refuses the move", async () => {
    const { token } = await pendingChange();
    addAccount(state, { email: "new@example.com" });

    expect(await redeemLink(token, LATER)).toMatchObject({ ok: false });
    expect(state.users[0]?.email).toBe("old@example.com");
  });
});
