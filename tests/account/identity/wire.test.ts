// tests/account/identity/wire.test.ts — BUILD §13, issue #35
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
const { hashToken } = await import("../../../src/lib/account/identity/token");
const { addAccount, memoryIdentityStore, newMemoryIdentity } = await import("./memory-store");

let state = newMemoryIdentity();

beforeEach(() => {
  state = newMemoryIdentity();
  setIdentityStore(memoryIdentityStore(state));
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

  it("once wired, it mints a real token and a URL on this deployment's origin", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    wireSignInLinkIssuer();

    const issued = await issueSignInLink({ userId: user.id, to: user.email });
    expect(issued.issued).toBe(true);
    if (!issued.issued) return;
    expect(issued.url.startsWith("https://reachkit.example/signin/")).toBe(true);
    expect(state.links).toHaveLength(1);
    expect(state.links[0]?.purpose).toBe("sign_in");
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
    const segments = new URL(href).pathname.split("/");
    const token = decodeURIComponent(segments[segments.length - 1] ?? "");
    // The mail carries the plaintext; the row carries only its hash.
    expect(state.links[0]?.token_hash).toBe(hashToken(token));
  });

  it("still refuses to compose a mail when no link can be issued", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    state.failInsertLink = true;

    expect(await sendSignInLink({ userId: user.id, email: user.email })).toEqual({
      sent: false,
      because: "no_link",
    });
    expect(sendCalls).toHaveLength(0);
  });
});
