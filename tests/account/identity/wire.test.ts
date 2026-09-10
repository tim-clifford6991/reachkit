// tests/account/identity/wire.test.ts — BUILD §13, issues #35, #468
//
// Issue #33 shipped `issueSignInLink` as a port with a fail-closed default:
// "With nothing registered, `issueSignInLink` answers `{ issued: false,
// reason: 'not_wired' }`. It does not invent a URL, and no mail is composed
// around one." This suite is the proof that the port is filled — that a
// completed payment now produces a link a founder can actually click, which
// is the whole of what §13's "send magic link → `/setup`" was missing.
//
// The mutation it catches: deleting the `wireSignInLinkIssuer()` call from
// `sendSignInLink`. Nothing else in the corpus fails if it goes — the mail
// simply stops being sent, silently, for every paying customer.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock, sendOutcome } from "../send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { sendSignInLink } = await import("../../../src/lib/account/provisioning/sign-in-mail");
const { issueSignInLink, registerSignInLinkIssuer } = await import(
  "../../../src/lib/account/provisioning/sign-in-link"
);
const { unwireSignInLinkIssuer, wireSignInLinkIssuer } = await import(
  "../../../src/lib/account/identity/wire"
);
const { setIdentityStore } = await import("../../../src/lib/account/identity/store");
const { setIdentityAuth } = await import("../../../src/lib/account/identity/auth");
const { addAccount: addRow, memoryIdentityStore, newMemoryIdentity } = await import("./memory-store");
const { addAuthUser, fakeIdentityAuth, newFakeAuth } = await import("./fake-auth");

let state = newMemoryIdentity();
let auth = newFakeAuth();

/** An account and the `auth.users` row whose id it carries (#468). */
function addAccount(s: typeof state, patch: { email: string }): ReturnType<typeof addRow> {
  const user = addRow(s, patch);
  addAuthUser(auth, { id: user.id, email: user.email });
  return user;
}

beforeEach(() => {
  state = newMemoryIdentity();
  auth = newFakeAuth();
  setIdentityStore(memoryIdentityStore(state));
  setIdentityAuth(fakeIdentityAuth(auth));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
  registerSignInLinkIssuer(null);
  unwireSignInLinkIssuer();
});

describe("the port issue #33 declared", () => {
  it("fails closed with nothing registered — the state this issue removes", async () => {
    expect(await issueSignInLink({ userId: "user-1", to: "a@example.com" })).toEqual({
      issued: false,
      reason: "not_wired",
    });
  });

  it("once wired, it asks Supabase for a link and builds it on this deployment's origin", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    wireSignInLinkIssuer();

    const issued = await issueSignInLink({ userId: user.id, to: user.email });
    expect(issued.issued).toBe(true);
    if (!issued.issued) return;
    expect(issued.url.startsWith("https://reachkit.example/auth/confirm?")).toBe(true);
    expect(auth.generated).toEqual([{ kind: "sign_in", email: "founder@example.com" }]);
  });

  it("wiring twice registers once — it is idempotent", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    wireSignInLinkIssuer();
    wireSignInLinkIssuer();
    expect((await issueSignInLink({ userId: user.id, to: user.email })).issued).toBe(true);
  });
});

describe('§13 — "send magic link → `/setup`", end to end', () => {
  it("`sendSignInLink` wires itself, so a paid customer gets a mail carrying a working link", async () => {
    const user = addAccount(state, { email: "founder@example.com" });

    expect(await sendSignInLink({ userId: user.id, email: user.email })).toEqual({ sent: true });
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0]?.kind).toBe("magic-link");
    expect(sendCalls[0]?.to).toBe("founder@example.com");

    const href = String(
      (sendCalls[0]?.blocks ?? []).find(
        (b): b is { href: string } => typeof b === "object" && b !== null && "href" in b
      )?.href ?? ""
    );
    // The mail carries Supabase's hash on our own confirm route — the one
    // link Supabase minted, and no link of Supabase's own mailer.
    const url = new URL(href);
    expect(url.pathname).toBe("/auth/confirm");
    expect(url.searchParams.get("token_hash")).toBe(auth.tokens[0]?.hash);
    expect(url.searchParams.get("type")).toBe("magiclink");
  });

  it("still refuses to compose a mail when no link can be issued", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    auth.failGenerate = true;

    expect(await sendSignInLink({ userId: user.id, email: user.email })).toEqual({
      sent: false,
      because: "no_link",
    });
    expect(sendCalls).toHaveLength(0);
  });
});
