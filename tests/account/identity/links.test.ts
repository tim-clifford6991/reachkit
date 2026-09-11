// tests/account/identity/links.test.ts — BUILD §13, issues #35, #468
//
// Issue a link through Supabase Auth; redeem it exactly once; and answer a
// link that no longer works the same way whichever way it died.
//
// Since #468 the token is Supabase's: `generateLink` mints it and
// `verifyOtp` spends it. Single use, the newest-link rule and the expiry are
// GoTrue's to keep — this suite drives them through `./fake-auth.ts`, which
// keeps GoTrue's observable rules, and holds what is still this product's:
// the link is on our own host, nothing we store carries a token, the issuer
// refuses a link minted for somebody else, and every dead link is one
// answer.
//
// The two mutations these cases exist to catch:
//   · a link built on Supabase's `action_link` rather than on our origin —
//     caught by "the URL is on this deployment's own origin";
//   · dropping the user check in `issueLink` — caught by "a link minted for
//     a different auth user is refused".
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendMock } from "../send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { issueLink, redeemLink } = await import("../../../src/lib/account/identity/links");
const { DEAD_LINK_KEY } = await import("../../../src/lib/account/identity/outcomes");
const { setIdentityStore } = await import("../../../src/lib/account/identity/store");
const { setIdentityAuth } = await import("../../../src/lib/account/identity/auth");
const { SIGNIN_LINK_TTL_H } = await import("../../../src/lib/config/constants");
const { addAccount, memoryIdentityStore, newMemoryIdentity } = await import("./memory-store");
const { FAKE_AUTH_COOKIE, addAuthUser, cookieJarIO, fakeIdentityAuth, newFakeAuth } = await import(
  "./fake-auth"
);

/** Comments stripped, on the footing `tests/account/provisioning/magic-link.test.ts`
 *  uses for its own: the module's header *names* the rules it keeps, and a
 *  promise stated in prose must not fail the test that checks it is kept. */
const SOURCE = readFileSync(
  path.resolve(import.meta.dirname, "../../../src/lib/account/identity/links.ts"),
  "utf8"
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

const NOW = new Date("2026-09-06T12:00:00.000Z");
const TTL_MS = SIGNIN_LINK_TTL_H * 60 * 60 * 1000;

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
});

/** An account and the `auth.users` row whose id it carries (#468). */
function account(email = "founder@example.com", patch: { first_signed_in_at?: string } = {}) {
  const user = addAccount(state, { email, ...patch });
  addAuthUser(auth, { id: user.id, email });
  return user;
}

function linkOf(url: string): { tokenHash: string; type: "magiclink" | "email_change" } {
  const params = new URL(url).searchParams;
  return {
    tokenHash: params.get("token_hash") ?? "",
    type: params.get("type") === "email_change" ? "email_change" : "magiclink",
  };
}

async function redeem(url: string, at = NOW) {
  return redeemLink(cookieJarIO(jar), linkOf(url), at);
}

describe("#468 — Supabase mints the token; this product stores none", () => {
  it("issue asks Supabase for a magic link to the lowercased address and writes nothing of ours", async () => {
    const user = account();
    const before = JSON.stringify(state);
    const issued = await issueLink({ userId: user.id, to: "Founder@Example.com", purpose: "sign_in", now: NOW });
    expect(issued.issued).toBe(true);
    expect(auth.generated).toEqual([{ kind: "sign_in", email: "founder@example.com" }]);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("the link carries Supabase's hash, and the expiry is the pinned TTL", async () => {
    const user = account();
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!issued.issued) throw new Error("not issued");
    expect(linkOf(issued.url)).toEqual({ tokenHash: auth.tokens[0]?.hash, type: "magiclink" });
    expect(issued.tokenHash).toBe(auth.tokens[0]?.hash);
    expect(issued.expiresAt.getTime() - NOW.getTime()).toBe(TTL_MS);
  });

  it("the URL is on this deployment's own origin, at /auth/confirm — never Supabase's action link", async () => {
    const user = account();
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!issued.issued) throw new Error("not issued");
    const url = new URL(issued.url);
    expect(url.origin).toBe("https://reachkit.example");
    expect(url.pathname).toBe("/auth/confirm");
  });

  it("a vendor that cannot mint answers `vendor` and composes no URL", async () => {
    const user = account();
    auth.failGenerate = true;
    expect(await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW })).toEqual({
      issued: false,
      reason: "vendor",
    });
  });

  it("a link minted for a different auth user is refused — the two tables disagree about who owns the address", async () => {
    // No `auth.users` row carries this account's id: GoTrue's `magiclink`
    // would create one under an id of its own.
    const user = addAccount(state, { email: "orphan@example.com" });
    expect(await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW })).toEqual({
      issued: false,
      reason: "vendor",
    });
  });
});

describe('REQ-024 c4 — "never to a dead end": the newest link is the one that works (GoTrue keeps it)', () => {
  it("issuing a second link supersedes the first, and only the second redeems", async () => {
    const user = account();
    const first = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    const second = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!first.issued || !second.issued) throw new Error("not issued");

    expect(await redeem(second.url)).toMatchObject({ ok: true });
    expect(await redeem(first.url)).toMatchObject({ ok: false, lineKey: DEAD_LINK_KEY });
  });

  it("three requests leave exactly one live link", async () => {
    const user = account();
    for (let i = 0; i < 3; i++) {
      await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    }
    expect(auth.tokens).toHaveLength(3);
    expect(auth.tokens.filter((t) => !t.superseded && !t.used)).toHaveLength(1);
  });

  it("a sign-in link and an email-change link live side by side — one live token per type", async () => {
    const user = account();
    await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    const change = await issueLink({
      userId: user.id,
      to: "next@example.com",
      purpose: "email_change",
      now: NOW,
    });
    expect(change.issued).toBe(true);
    expect(auth.tokens.filter((t) => !t.superseded)).toHaveLength(2);
    expect(auth.generated[1]).toEqual({
      kind: "email_change",
      email: "founder@example.com",
      newEmail: "next@example.com",
    });
  });
});

describe("redeeming is single use (GoTrue spends the token in the check)", () => {
  it("the first use signs the customer in and writes the session through the jar", async () => {
    const user = account();
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!issued.issued) throw new Error("not issued");

    const redeemed = await redeem(issued.url);
    expect(redeemed).toEqual({ ok: true, purpose: "sign_in", userId: user.id, firstSignIn: true });
    expect(jar.get(FAKE_AUTH_COOKIE)).toBeDefined();
  });

  it("the second use is refused with the dead-link line", async () => {
    const user = account();
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!issued.issued) throw new Error("not issued");

    await redeem(issued.url);
    jar.clear();
    const again = await redeem(issued.url);
    expect(again).toMatchObject({ ok: false, lineKey: DEAD_LINK_KEY });
    expect(jar.size).toBe(0);
  });
});

describe('REQ-098 c7 — expired, spent and never-issued get one line and one shape', () => {
  it("a link past its TTL is dead", async () => {
    const user = account();
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!issued.issued) throw new Error("not issued");

    auth.now = () => new Date(NOW.getTime() + TTL_MS);
    expect(await redeem(issued.url)).toEqual({ ok: false, reason: "expired", lineKey: DEAD_LINK_KEY });
  });

  it("a token this product never issued is dead", async () => {
    expect(await redeemLink(cookieJarIO(jar), { tokenHash: "never-issued", type: "magiclink" }, NOW)).toEqual({
      ok: false,
      reason: "unknown",
      lineKey: DEAD_LINK_KEY,
    });
  });

  it("a vendor that cannot verify answers exactly as an unknown token does — no oracle", async () => {
    auth.failVerify = true;
    expect(await redeemLink(cookieJarIO(jar), { tokenHash: "anything", type: "magiclink" }, NOW)).toEqual({
      ok: false,
      reason: "unknown",
      lineKey: DEAD_LINK_KEY,
    });
  });

  it("all three carry the same key and the same shape, so the screen cannot tell them apart", async () => {
    const user = account();
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!issued.issued) throw new Error("not issued");
    await redeem(issued.url);

    const spent = await redeem(issued.url);
    const unknown = await redeemLink(cookieJarIO(jar), { tokenHash: "nope", type: "magiclink" }, NOW);
    const second = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!second.issued) throw new Error("not issued");
    auth.now = () => new Date(NOW.getTime() + TTL_MS + 1);
    const expired = await redeem(second.url);

    for (const answer of [spent, unknown, expired]) {
      expect(answer.ok).toBe(false);
      if (answer.ok) continue;
      expect(answer.lineKey).toBe(DEAD_LINK_KEY);
      expect(Object.keys(answer).sort()).toEqual(["lineKey", "ok", "reason"]);
    }
  });
});

describe('REQ-024 c5 — `users.first_signed_in_at` is stamped once', () => {
  it("the first redemption stamps it and says so", async () => {
    const user = account();
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!issued.issued) throw new Error("not issued");

    const redeemed = await redeem(issued.url);
    expect(redeemed.ok && redeemed.firstSignIn).toBe(true);
    expect(state.users[0]?.first_signed_in_at).toBe(NOW.toISOString());
  });

  it("a later sign-in does not move it, and is not a first sign-in", async () => {
    const user = account();
    const first = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!first.issued) throw new Error("not issued");
    await redeem(first.url);

    const later = new Date(NOW.getTime() + 60 * 60 * 1000);
    const second = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: later });
    if (!second.issued) throw new Error("not issued");
    const redeemed = await redeem(second.url, later);

    expect(redeemed.ok && redeemed.firstSignIn).toBe(false);
    expect(state.users[0]?.first_signed_in_at).toBe(NOW.toISOString());
  });
});

describe('BP-061 decision 1 — "this node issues, it does not decide"', () => {
  it("applies no eligibility policy: no billing or provisioning import", () => {
    expect(SOURCE).not.toMatch(/from\s+["'][^"']*account\/billing/);
    expect(SOURCE).not.toMatch(/hasActiveAccess/);
    expect(SOURCE).not.toMatch(/paid_through|plan_status/);
  });

  it("issues for an account whose plan lapsed long ago — there is no gate to fail", async () => {
    const user = account("lapsed@example.com");
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    expect(issued.issued).toBe(true);
  });

  it("sends no mail of its own — that order is `sendSignInLink`'s", () => {
    expect(SOURCE).not.toMatch(/sendEmail/);
  });
});
