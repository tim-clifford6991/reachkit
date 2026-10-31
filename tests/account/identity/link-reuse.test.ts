// A sign-in link asked for again within 15 minutes is the same link, so a
// flood of requests cannot keep a customer's link dead (REQ-024 c4, O2).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendMock } from "../send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { issueLink, redeemLink, SIGNIN_LINK_LABEL } = await import("../../../src/lib/account/identity/links");
const { setIdentityStore } = await import("../../../src/lib/account/identity/store");
const { setIdentityAuth } = await import("../../../src/lib/account/identity/auth");
const { completeEmailChange } = await import("../../../src/lib/account/identity/email-change-complete");
const { sealer } = await import("../../../src/lib/crypto/seal");
const { unseal } = await import("../../../src/lib/publish/destinations/config/seal");
const { addAccount, memoryIdentityStore, newMemoryIdentity } = await import("./memory-store");
const { addAuthUser, cookieJarIO, fakeIdentityAuth, newFakeAuth } = await import("./fake-auth");

const NOW = new Date("2026-10-31T12:00:00.000Z");
const minutes = (n: number): Date => new Date(NOW.getTime() + n * 60 * 1000);

let state = newMemoryIdentity();
let auth = newFakeAuth();

beforeEach(() => {
  state = newMemoryIdentity();
  auth = newFakeAuth();
  auth.now = () => NOW;
  setIdentityStore(memoryIdentityStore(state));
  setIdentityAuth(fakeIdentityAuth(auth));
});

function account() {
  const user = addAccount(state, { email: "founder@example.com" });
  addAuthUser(auth, { id: user.id, email: user.email });
  return user;
}

async function ask(userId: string, at: Date): Promise<string> {
  const issued = await issueLink({ userId, to: "founder@example.com", purpose: "sign_in", now: at });
  if (!issued.issued) throw new Error("not issued");
  return issued.url;
}

async function redeem(url: string) {
  const params = new URL(url).searchParams;
  return redeemLink(cookieJarIO(new Map()), { tokenHash: params.get("token_hash") ?? "", type: "magiclink" }, NOW);
}

describe("REQ-024 c4 (O2) — a sign-in link asked for again within 15 minutes is the same link", () => {
  it("re-request within 15 min re-sends the live link", async () => {
    const user = account();
    const first = await ask(user.id, NOW);
    const again = await ask(user.id, minutes(5));
    expect(auth.generated).toHaveLength(1);
    expect(again).toBe(first);
  });

  it("first link survives a flood", async () => {
    const user = account();
    const first = await ask(user.id, NOW);
    for (let i = 1; i <= 10; i++) await ask(user.id, minutes(i));
    expect(await redeem(first)).toMatchObject({ ok: true, userId: user.id });
  });

  it("spent link is never re-sent", async () => {
    const user = account();
    const first = await ask(user.id, NOW);
    await redeem(first);
    const next = await ask(user.id, minutes(1));
    expect(next).not.toBe(first);
    expect(await redeem(next)).toMatchObject({ ok: true });
  });

  it("reuse window is 15 min", async () => {
    const user = account();
    const first = await ask(user.id, NOW);
    expect(await ask(user.id, minutes(14))).toBe(first);
    const late = await ask(user.id, minutes(16));
    expect(late).not.toBe(first);
    expect(auth.generated).toHaveLength(2);
  });

  it("an address change spends the stored link, so the next request mints", async () => {
    const user = account();
    const first = await ask(user.id, NOW);
    const moving = { ...user, pending_email: "next@example.com" };
    await completeEmailChange({ account: moving, verified: { userId: user.id, email: "next@example.com", accessToken: "t" }, now: minutes(1) });
    expect(await ask(user.id, minutes(2))).not.toBe(first);
  });

  it("a store without the columns mints every time, as before the migration", async () => {
    const user = account();
    setIdentityStore({ ...memoryIdentityStore(state), signInLink: async () => ({ ok: false }) });
    const first = await ask(user.id, NOW);
    expect(await ask(user.id, minutes(1))).not.toBe(first);
  });

  it("an email-change link still mints on every request", async () => {
    const user = account();
    for (const at of [NOW, minutes(1)]) {
      await issueLink({ userId: user.id, to: "next@example.com", purpose: "email_change", now: at });
    }
    expect(auth.generated.filter((g) => g.kind === "email_change")).toHaveLength(2);
    expect(state.signInLinks.size).toBe(0);
  });
});

describe("sealed under its own label", () => {
  it("the stored value is not the token hash, and publish's label cannot open it", async () => {
    const user = account();
    await ask(user.id, NOW);
    const stored = state.signInLinks.get(user.id)?.sealed ?? "";
    const hash = auth.tokens[0]?.hash ?? "missing";
    expect(stored).not.toContain(hash);
    expect(sealer(SIGNIN_LINK_LABEL, () => new Error("x")).unseal(stored)).toMatchObject({ tokenHash: hash });
    expect(() => unseal(stored)).toThrow();
  });

  it("a credential sealed before the move still opens under publish's label", () => {
    // Sealed by the pre-move module under `salt-fixture`; byte compatibility is the whole contract.
    const golden = "v1.BwcHBwcHBwcHBwcH.LJDzox7KzicaSlLEGaBiOQ.nLWVt9GHqaz0TF4mauOONlT5cFMh";
    expect(unseal(golden)).toEqual({ password: "golden" });
  });
});
