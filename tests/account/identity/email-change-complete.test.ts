// tests/account/identity/email-change-complete.test.ts — BUILD §4.7, issues #35, #468
//
// REQ-077 criterion 3, quoted: "Given the link sent to the new address is
// used, when it succeeds, then only the new address can sign in, every mail
// ReachKit itself sends goes to it, and one `account` mail (REQ-064) goes
// to the old address saying the account now signs in at a different address
// and this one no longer can."
//
// Since #468 Supabase moves `auth.users.email` when it verifies the link;
// this product mirrors it into `users.email`, ends the account's other
// sessions (`signOut(…, "others")`) and spends any sign-in link still live
// from before the move. The Supabase half runs through `./fake-auth.ts`.
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

const { beginEmailChange, cancelEmailChange } = await import(
  "../../../src/lib/account/identity/email-change"
);
const { issueLink, redeemLink } = await import("../../../src/lib/account/identity/links");
const { setIdentityStore } = await import("../../../src/lib/account/identity/store");
const { setIdentityAuth } = await import("../../../src/lib/account/identity/auth");
const { EMAIL_CHANGE_TTL_H } = await import("../../../src/lib/config/constants");
const { addAccount, memoryIdentityStore, newMemoryIdentity } = await import("./memory-store");
const {
  FAKE_AUTH_COOKIE,
  addAuthUser,
  cookieJarIO,
  fakeIdentityAuth,
  newFakeAuth,
  signedInCookie,
} = await import("./fake-auth");

const NOW = new Date("2026-09-06T12:00:00.000Z");
const LATER = new Date("2026-09-06T13:00:00.000Z");

let state = newMemoryIdentity();
let auth = newFakeAuth();
let jar = new Map<string, string>();

beforeEach(() => {
  state = newMemoryIdentity();
  auth = newFakeAuth();
  auth.now = () => NOW;
  jar = new Map();
  setIdentityStore(memoryIdentityStore(state));
  setIdentityAuth(fakeIdentityAuth(auth));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
});

function isAction(block: unknown): block is { block: string; href: string } {
  return typeof block === "object" && block !== null && "href" in block;
}

/** The link the mail carried — the one way the suite, like the customer,
 *  gets hold of it. */
function changeLink(): { tokenHash: string; type: "email_change" } {
  const url = new URL(String(sendCalls[0]?.blocks?.find(isAction)?.href ?? ""));
  expect(url.pathname).toBe("/auth/confirm");
  expect(url.searchParams.get("type")).toBe("email_change");
  return { tokenHash: url.searchParams.get("token_hash") ?? "", type: "email_change" };
}

async function pendingChange(): Promise<{ userId: string; link: { tokenHash: string; type: "email_change" } }> {
  const user = addAccount(state, { email: "old@example.com" });
  addAuthUser(auth, { id: user.id, email: user.email });
  await beginEmailChange(user.id, "new@example.com", NOW);
  const link = changeLink();
  sendCalls.length = 0;
  return { userId: user.id, link };
}

async function redeem(link: { tokenHash: string; type: "email_change" }, at = LATER) {
  return redeemLink(cookieJarIO(jar), link, at);
}

describe('REQ-077 c3 — "only the new address can sign in"', () => {
  it("redemption moves users.email onto the new address, mirroring Supabase", async () => {
    const { userId, link } = await pendingChange();
    const redeemed = await redeem(link);

    expect(redeemed.ok).toBe(true);
    if (!redeemed.ok) return;
    expect(redeemed.purpose).toBe("email_change");
    expect(redeemed.userId).toBe(userId);
    expect(state.users[0]?.email).toBe("new@example.com");
    expect(auth.users[0]?.email).toBe("new@example.com");
  });

  it("the old address is gone from the account — it cannot sign in, because it is nobody's", async () => {
    const { link } = await pendingChange();
    await redeem(link);
    expect(state.users.some((u) => u.email === "old@example.com")).toBe(false);
    expect(auth.users.some((u) => u.email === "old@example.com")).toBe(false);
  });

  it("the three pending columns clear in the same move", async () => {
    const { link } = await pendingChange();
    await redeem(link);
    expect(state.users[0]).toMatchObject({
      pending_email: null,
      pending_email_token_hash: null,
      pending_email_sent_at: null,
    });
  });

  it("the customer is left signed in at the new address — never a second checkout or a dead end", async () => {
    const { userId, link } = await pendingChange();
    const redeemed = await redeem(link);
    expect(redeemed.ok && redeemed.firstSignIn).toBe(false);
    const session = auth.sessions.find((s) => s.accessToken === jar.get(FAKE_AUTH_COOKIE));
    expect(session).toMatchObject({ userId, revoked: false });
  });
});

describe('REQ-077 c3 — one `account` mail goes to the old address', () => {
  it("exactly one, to the old address, of kind account", async () => {
    const { link } = await pendingChange();
    await redeem(link);

    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0]?.kind).toBe("account");
    expect(sendCalls[0]?.to).toBe("old@example.com");
  });

  it("it names neither address — the mail arrives at one and must not carry the other", async () => {
    const { link } = await pendingChange();
    await redeem(link);
    const body = JSON.stringify(sendCalls[0]);
    expect(body).not.toContain("new@example.com");
    expect(body.match(/old@example\.com/g)).toEqual(["old@example.com"]); // the recipient only
  });

  it("a failing mail leaves the change standing and says so, rather than reverting it", async () => {
    const { link } = await pendingChange();
    sendOutcome.next = { sent: false, reason: "vendor" };

    const redeemed = await redeem(link);
    expect(redeemed.ok).toBe(true);
    if (!redeemed.ok) return;
    expect(redeemed.noticeToOldAddress).toBe("failed");
    expect(state.users[0]?.email).toBe("new@example.com");
  });
});

describe('BP-061 decision 4 — a completed change ends the account\'s other sessions', () => {
  it("every session issued before the change is ended", async () => {
    const { userId, link } = await pendingChange();
    const phone = signedInCookie(auth, userId).split("=")[1];

    await redeem(link);

    expect(auth.sessions.find((s) => s.accessToken === phone)?.revoked).toBe(true);
    expect(auth.signOuts).toEqual([{ accessToken: jar.get(FAKE_AUTH_COOKIE), scope: "others" }]);
  });

  it("the session that did the changing is the one that stands", async () => {
    const { link } = await pendingChange();
    await redeem(link);
    const mine = auth.sessions.find((s) => s.accessToken === jar.get(FAKE_AUTH_COOKIE));
    expect(mine?.revoked).toBe(false);
  });
});

describe("every other link the account was holding stops working", () => {
  it("a live sign-in link to the old address does not survive the move", async () => {
    const { userId, link } = await pendingChange();
    const old = await issueLink({ userId, to: "old@example.com", purpose: "sign_in", now: NOW });
    if (!old.issued) throw new Error("not issued");

    await redeem(link);

    const url = new URL(old.url);
    const answer = await redeemLink(
      cookieJarIO(new Map()),
      { tokenHash: url.searchParams.get("token_hash") ?? "", type: "magiclink" },
      LATER
    );
    expect(answer).toMatchObject({ ok: false });
  });

  it("the change link itself is single use", async () => {
    const { link } = await pendingChange();
    await redeem(link);
    expect(await redeem(link)).toMatchObject({ ok: false });
  });

  it("a cancelled change's link is refused before Supabase is asked — nothing moves", async () => {
    const { userId, link } = await pendingChange();
    await cancelEmailChange(userId);

    expect(await redeem(link)).toMatchObject({ ok: false, reason: "unknown" });
    expect(auth.tokens.find((t) => t.hash === link.tokenHash)?.used).toBe(false);
    expect(auth.users[0]?.email).toBe("old@example.com");
  });

  it("a change past its 24 hours is refused as expired, and nothing moves (REQ-077 c4)", async () => {
    const { link } = await pendingChange();
    const after = new Date(NOW.getTime() + EMAIL_CHANGE_TTL_H * 60 * 60 * 1000);
    expect(await redeem(link, after)).toMatchObject({ ok: false, reason: "expired" });
    expect(state.users[0]?.email).toBe("old@example.com");
    expect(auth.users[0]?.email).toBe("old@example.com");
  });
});

describe("what happens when the move itself cannot be made", () => {
  it("a store that refuses the write answers as a dead link and sends no mail", async () => {
    const { link } = await pendingChange();
    state.failCompleteChange = true;

    expect(await redeem(link)).toMatchObject({ ok: false, reason: "unknown" });
    expect(state.users[0]?.email).toBe("old@example.com");
    expect(sendCalls).toHaveLength(0);
  });

  it("an address taken by somebody else since the request refuses the move", async () => {
    const { link } = await pendingChange();
    addAccount(state, { email: "new@example.com" });

    expect(await redeem(link)).toMatchObject({ ok: false });
    expect(state.users[0]?.email).toBe("old@example.com");
  });
});
