// tests/account/identity/links.test.ts — BUILD §13, issue #35
//
// Issue a single-use hashed token; redeem it exactly once; and answer a
// link that no longer works the same way whichever way it died.
//
// The two mutations these cases exist to catch:
//   · deleting the spend inside `redeemLink` — caught by "a second use is
//     refused", and by nothing else;
//   · deleting the supersede inside `issueLink` — caught by "issuing a
//     second link spends the first", which is REQ-024 criterion 4's "never
//     to a dead end".
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
const { hashToken } = await import("../../../src/lib/account/identity/token");
const { SIGNIN_LINK_TTL_H } = await import("../../../src/lib/config/constants");
const { addAccount, memoryIdentityStore, newMemoryIdentity } = await import("./memory-store");

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

let state = newMemoryIdentity();

beforeEach(() => {
  state = newMemoryIdentity();
  setIdentityStore(memoryIdentityStore(state));
});

function tokenOf(url: string): string {
  const segments = new URL(url).pathname.split("/");
  return decodeURIComponent(segments[segments.length - 1] ?? "");
}

describe('BP-061 decision 3 — "the plaintext exists only in the mail"', () => {
  it("issue writes a hash and never a plaintext", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    expect(issued.issued).toBe(true);
    if (!issued.issued) return;

    const token = tokenOf(issued.url);
    expect(state.links).toHaveLength(1);
    expect(state.links[0]?.token_hash).toBe(hashToken(token));
    expect(JSON.stringify(state.links)).not.toContain(token);
  });

  it("the row carries the address it was sent to, lowercased, and an expiry at the pinned TTL", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    const issued = await issueLink({
      userId: user.id,
      to: "Founder@Example.com",
      purpose: "sign_in",
      now: NOW,
    });
    expect(issued.issued).toBe(true);
    if (!issued.issued) return;

    expect(state.links[0]?.sent_to).toBe("founder@example.com");
    expect(issued.expiresAt.getTime() - NOW.getTime()).toBe(SIGNIN_LINK_TTL_H * 60 * 60 * 1000);
    expect(state.links[0]?.expires_at).toBe(issued.expiresAt.toISOString());
  });

  it("the URL is on this deployment's own origin, with the token in the path", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    expect(issued.issued).toBe(true);
    if (!issued.issued) return;
    expect(issued.url.startsWith("https://reachkit.example/signin/")).toBe(true);
  });

  it("a store that cannot write answers `vendor` and composes no URL", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    state.failInsertLink = true;
    expect(await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW })).toEqual(
      { issued: false, reason: "vendor" }
    );
  });
});

describe('REQ-024 c4 — "never to a dead end": the newest link is the one that works', () => {
  it("issuing a second link spends the first, and only the second redeems", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    const first = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    const second = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    expect(first.issued && second.issued).toBe(true);
    if (!first.issued || !second.issued) return;

    expect(await redeemLink(tokenOf(second.url), NOW)).toMatchObject({ ok: true });
    expect(await redeemLink(tokenOf(first.url), NOW)).toMatchObject({
      ok: false,
      reason: "spent",
    });
  });

  it("three requests leave exactly one live link", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    for (let i = 0; i < 3; i++) {
      await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    }
    expect(state.links.filter((l) => l.spent_at === null)).toHaveLength(1);
    expect(state.links).toHaveLength(3);
  });

  it("a sign-in link and an email-change link live side by side — the index is per purpose", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    const change = await issueLink({
      userId: user.id,
      to: "next@example.com",
      purpose: "email_change",
      now: NOW,
    });
    expect(change.issued).toBe(true);
    expect(state.links.filter((l) => l.spent_at === null)).toHaveLength(2);
  });
});

describe("redeeming is single use", () => {
  it("the first use signs the customer in", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!issued.issued) throw new Error("not issued");

    const redeemed = await redeemLink(tokenOf(issued.url), NOW);
    expect(redeemed.ok).toBe(true);
    if (!redeemed.ok) return;
    expect(redeemed.userId).toBe(user.id);
    expect(redeemed.purpose).toBe("sign_in");
    expect(redeemed.session).toEqual({ userId: user.id, siteId: state.sites[0]?.id, issuedAt: NOW });
  });

  it("the second use is refused — deleting the spend is the mutation this catches", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!issued.issued) throw new Error("not issued");

    await redeemLink(tokenOf(issued.url), NOW);
    expect(await redeemLink(tokenOf(issued.url), NOW)).toEqual({
      ok: false,
      reason: "spent",
      lineKey: DEAD_LINK_KEY,
    });
  });

  it("the row is marked spent at the moment it was used", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!issued.issued) throw new Error("not issued");
    await redeemLink(tokenOf(issued.url), NOW);
    expect(state.links[0]?.spent_at).toBe(NOW.toISOString());
  });
});

describe('REQ-098 c7 — expired, spent and never-issued get one line and one shape', () => {
  it("a link past its TTL is dead", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!issued.issued) throw new Error("not issued");

    const after = new Date(NOW.getTime() + SIGNIN_LINK_TTL_H * 60 * 60 * 1000);
    expect(await redeemLink(tokenOf(issued.url), after)).toEqual({
      ok: false,
      reason: "expired",
      lineKey: DEAD_LINK_KEY,
    });
  });

  it("an expired link is not spent by the attempt — it was already dead", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!issued.issued) throw new Error("not issued");
    const after = new Date(NOW.getTime() + (SIGNIN_LINK_TTL_H + 1) * 60 * 60 * 1000);
    await redeemLink(tokenOf(issued.url), after);
    expect(state.links[0]?.spent_at).toBeNull();
  });

  it("a token this product never issued is dead", async () => {
    expect(await redeemLink("never-issued-at-all", NOW)).toEqual({
      ok: false,
      reason: "unknown",
      lineKey: DEAD_LINK_KEY,
    });
  });

  it("an unreadable store answers exactly as an unknown token does — no oracle", async () => {
    state.failLinkRead = true;
    expect(await redeemLink("anything", NOW)).toEqual({
      ok: false,
      reason: "unknown",
      lineKey: DEAD_LINK_KEY,
    });
  });

  it("all three carry the same key and the same shape, so the screen cannot tell them apart", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!issued.issued) throw new Error("not issued");
    await redeemLink(tokenOf(issued.url), NOW);

    const spent = await redeemLink(tokenOf(issued.url), NOW);
    const unknown = await redeemLink("nope", NOW);
    const second = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!second.issued) throw new Error("not issued");
    const expired = await redeemLink(
      tokenOf(second.url),
      new Date(NOW.getTime() + (SIGNIN_LINK_TTL_H + 1) * 60 * 60 * 1000)
    );

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
    const user = addAccount(state, { email: "founder@example.com" });
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!issued.issued) throw new Error("not issued");

    const redeemed = await redeemLink(tokenOf(issued.url), NOW);
    expect(redeemed.ok && redeemed.firstSignIn).toBe(true);
    expect(state.users[0]?.first_signed_in_at).toBe(NOW.toISOString());
  });

  it("a later sign-in does not move it, and is not a first sign-in", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    const first = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!first.issued) throw new Error("not issued");
    await redeemLink(tokenOf(first.url), NOW);

    const later = new Date(NOW.getTime() + 60 * 60 * 1000);
    const second = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: later });
    if (!second.issued) throw new Error("not issued");
    const redeemed = await redeemLink(tokenOf(second.url), later);

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
    const user = addAccount(state, { email: "lapsed@example.com" });
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    expect(issued.issued).toBe(true);
  });

  it("sends no mail of its own — that order is `sendSignInLink`'s", () => {
    expect(SOURCE).not.toMatch(/sendEmail/);
  });
});
