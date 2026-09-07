// tests/app/settings/account-actions.test.ts — BUILD §4.7 · §13, issue #134
//
// The three Server Functions behind the account card, against the **real**
// identity seam: the memory store the identity suites drive, the mail seam
// doubled at its own boundary, and a cookie jar standing in for the
// request's. Nothing about what an address change *is* is re-asserted here
// (`tests/account/identity/email-change.test.ts` owns that) — what this
// file holds is that the surface reaches it, hands it the **session's** own
// account and not a stand-in, and reports back exactly what it answered.
//
// The case that discriminates hardest is the last one in the first block: a
// wiring that passed `FIXTURE_USER_ID` — the id every other read on this
// screen still falls back to — would pass every "an address change works"
// assertion here and change the wrong account's address in production.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock, sendOutcome } from "../../account/send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

/** One cookie jar per test, standing in for the request's — the same double
 *  `tests/account/identity/session.test.ts` uses, for the same reason. */
const jar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));

const revalidated: string[] = [];
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    revalidated.push(path);
  },
}));

const { SESSION_COOKIE_NAME } = await import("@/lib/account/identity/addresses");
const { mintSessionCookie } = await import("@/lib/account/identity/cookie");
const { setIdentityStore } = await import("@/lib/account/identity/store");
const { accountCard } = await import("@/lib/account/identity/email-change");
const { addAccount, memoryIdentityStore, newMemoryIdentity } = await import(
  "../../account/identity/memory-store"
);
const { NEW_EMAIL_FIELD, EMAIL_CHANGE_INITIAL } = await import(
  "@/app/(account)/app/settings/account-state"
);
const { beginEmailChangeAction, cancelEmailChangeAction, signOutAction } = await import(
  "@/app/(account)/app/settings/account-actions"
);

let state = newMemoryIdentity();

beforeEach(() => {
  jar.clear();
  revalidated.length = 0;
  state = newMemoryIdentity();
  setIdentityStore(memoryIdentityStore(state));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
});

function signIn(userId: string, siteId: string | null = "site-1"): void {
  jar.set(SESSION_COOKIE_NAME, mintSessionCookie({ userId, siteId, issuedAt: new Date() }));
}

function submit(address: string): FormData {
  const form = new FormData();
  form.set(NEW_EMAIL_FIELD, address);
  return form;
}

// ── REQ-077 c5 — sign out ─────────────────────────────────────────────────

describe('REQ-077 c5 — "that session ends and returning requires a fresh sign-in link"', () => {
  it("ends the session for real and hands the browser to the front page", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    signIn(user.id);

    expect(await signOutAction()).toEqual({ done: "elsewhere", href: "/" });
    // The cookie is gone, which is the whole of ending a session — not a
    // flag, not a list of devices.
    expect(jar.has(SESSION_COOKIE_NAME)).toBe(false);
  });

  it("takes the `elsewhere` arm, because a client-side route change would not do", async () => {
    // `useAction` navigates on `elsewhere` and on nothing else. A `here`
    // answer would leave the deleted cookie unnoticed by every
    // already-rendered piece of the app until something else happened to
    // request a page.
    const user = addAccount(state, { email: "founder@example.com" });
    signIn(user.id);
    const outcome = await signOutAction();
    expect(outcome.done).toBe("elsewhere");
  });

  it("signing out with no session is not an error — there is nothing to end", async () => {
    expect(await signOutAction()).toEqual({ done: "elsewhere", href: "/" });
    expect(jar.has(SESSION_COOKIE_NAME)).toBe(false);
  });
});

// ── REQ-077 c2 — beginning a change ───────────────────────────────────────

describe('REQ-077 c2 — "a sign-in link is sent to it and the old address keeps working"', () => {
  it("sends the link and leaves the address the customer signs in with alone", async () => {
    const user = addAccount(state, { email: "founder@example.com", name: "A Founder" });
    signIn(user.id);

    const answer = await beginEmailChangeAction(EMAIL_CHANGE_INITIAL, submit("new@example.com"));
    expect(answer).toEqual({ answer: "sent" });
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0]?.to).toBe("new@example.com");

    // The change has not happened. This is the assertion an implementation
    // that wrote `users.email` on submission would fail, and it would pass
    // everything else in this file.
    const card = await accountCard(user.id);
    expect(card?.email).toBe("founder@example.com");
    expect(card?.pending?.email).toBe("new@example.com");
  });

  it("re-reads the screen after a change begins, so the card shows what happened", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    signIn(user.id);
    await beginEmailChangeAction(EMAIL_CHANGE_INITIAL, submit("new@example.com"));
    expect(revalidated).toEqual(["/app/settings"]);
  });

  it("changes the account the *session* names, never the screen's fixture stand-in", async () => {
    const mine = addAccount(state, { email: "mine@example.com" });
    const theirs = addAccount(state, { email: "theirs@example.com" });
    signIn(mine.id);

    await beginEmailChangeAction(EMAIL_CHANGE_INITIAL, submit("new@example.com"));

    expect((await accountCard(mine.id))?.pending?.email).toBe("new@example.com");
    expect((await accountCard(theirs.id))?.pending).toBeNull();
  });
});

describe("REQ-077 c2 — three refusals, each with its own line, and nothing sent", () => {
  it("an address that already belongs to an account", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    addAccount(state, { email: "taken@example.com" });
    signIn(user.id);

    const answer = await beginEmailChangeAction(EMAIL_CHANGE_INITIAL, submit("taken@example.com"));
    expect(answer).toEqual({
      answer: "refused",
      lineKey: "settings.account.email-in-use",
      value: "taken@example.com",
    });
    expect(sendCalls).toHaveLength(0);
    expect(revalidated).toEqual([]);
  });

  it("an address that is not one we can send to", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    signIn(user.id);

    const answer = await beginEmailChangeAction(EMAIL_CHANGE_INITIAL, submit("not-an-address"));
    expect(answer).toEqual({
      answer: "refused",
      lineKey: "settings.account.email-invalid",
      value: "not-an-address",
    });
    expect(sendCalls).toHaveLength(0);
  });

  it("a mail that does not leave takes the pending change back out with it", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    signIn(user.id);
    sendOutcome.next = { sent: false, reason: "vendor" };

    const answer = await beginEmailChangeAction(EMAIL_CHANGE_INITIAL, submit("new@example.com"));
    expect(answer.answer).toBe("refused");
    expect(answer.answer === "refused" && answer.lineKey).toBe(
      "settings.account.email-change-unavailable"
    );
    // A customer must never be shown a change awaiting a link that was
    // never sent. The rule is `beginEmailChange`'s; this asserts the
    // surface does not paper over it.
    expect((await accountCard(user.id))?.pending).toBeNull();
  });

  it("a session that ended between the render and the press is `unavailable`, not `invalid`", async () => {
    // Nothing was attempted, so "we could not start the change just now" is
    // what is true. "That is not an address we can send to" would send them
    // to retype an address that was never the problem.
    const answer = await beginEmailChangeAction(EMAIL_CHANGE_INITIAL, submit("new@example.com"));
    expect(answer).toEqual({
      answer: "refused",
      lineKey: "settings.account.email-change-unavailable",
      value: "new@example.com",
    });
    expect(sendCalls).toHaveLength(0);
  });

  it("every refusal keeps what the customer typed", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    addAccount(state, { email: "taken@example.com" });
    signIn(user.id);

    for (const typed of ["taken@example.com", "not-an-address"]) {
      const answer = await beginEmailChangeAction(EMAIL_CHANGE_INITIAL, submit(typed));
      expect(answer.answer === "refused" && answer.value, typed).toBe(typed);
    }
  });

  it("a missing field is a value of its own, and is refused rather than throwing", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    signIn(user.id);
    const answer = await beginEmailChangeAction(EMAIL_CHANGE_INITIAL, new FormData());
    expect(answer).toEqual({
      answer: "refused",
      lineKey: "settings.account.email-invalid",
      value: "",
    });
  });
});

// ── REQ-077 c4 — cancelling, and replacing ────────────────────────────────

describe('REQ-077 c4 — "lets them cancel the pending change or submit a different address"', () => {
  it("cancelling clears the pending change and leaves the account as it was", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    signIn(user.id);
    await beginEmailChangeAction(EMAIL_CHANGE_INITIAL, submit("new@example.com"));
    revalidated.length = 0;

    await cancelEmailChangeAction();

    const card = await accountCard(user.id);
    expect(card?.pending).toBeNull();
    expect(card?.email).toBe("founder@example.com");
    expect(revalidated).toEqual(["/app/settings"]);
  });

  it("a second address replaces the first — there is never more than one in flight", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    signIn(user.id);

    await beginEmailChangeAction(EMAIL_CHANGE_INITIAL, submit("first@example.com"));
    await beginEmailChangeAction(EMAIL_CHANGE_INITIAL, submit("second@example.com"));

    expect((await accountCard(user.id))?.pending?.email).toBe("second@example.com");
    expect(sendCalls.map((c) => c.to)).toEqual(["first@example.com", "second@example.com"]);
  });

  it("cancelling with no session touches nothing", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    signIn(user.id);
    await beginEmailChangeAction(EMAIL_CHANGE_INITIAL, submit("new@example.com"));

    jar.clear();
    revalidated.length = 0;
    await cancelEmailChangeAction();

    // Still pending: a request with no session must not clear somebody's
    // change, and it has no account to clear one for.
    expect((await accountCard(user.id))?.pending?.email).toBe("new@example.com");
    expect(revalidated).toEqual([]);
  });
});
