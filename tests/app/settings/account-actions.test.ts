// tests/app/settings/account-actions.test.ts — BUILD §4.7 · §13, issues #134, #468
//
// The three Server Functions behind the account card, against the **real**
// identity seam: the memory store and the Supabase Auth double the identity
// suites drive, the mail seam doubled at its own boundary, and a cookie jar
// standing in for the request's. Nothing about what an address change *is* is re-asserted here
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
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    get: (name: string) => {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    // A cookie written empty or with `maxAge: 0` is a cleared one, as a
    // browser treats it.
    set: (name: string, value: string, options?: { maxAge?: number }) => {
      if (value === "" || options?.maxAge === 0) jar.delete(name);
      else jar.set(name, value);
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

/** `redirect()` throws by design — that is how it interrupts a Server
 *  Function — so the double throws too, carrying the destination. A test
 *  that let it return would assert nothing about a function whose whole
 *  behaviour is not to continue. */
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect:${to}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
}));

const { SIGNIN_PATH } = await import("@/lib/account/identity/addresses");
const { setIdentityStore } = await import("@/lib/account/identity/store");
const { setIdentityAuth } = await import("@/lib/account/identity/auth");
const {
  FAKE_AUTH_COOKIE: SESSION_COOKIE_NAME,
  addAuthUser,
  fakeIdentityAuth,
  newFakeAuth,
  signedInCookie,
} = await import("../../account/identity/fake-auth");
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
let auth = newFakeAuth();

beforeEach(() => {
  jar.clear();
  revalidated.length = 0;
  state = newMemoryIdentity();
  auth = newFakeAuth();
  setIdentityStore(memoryIdentityStore(state));
  setIdentityAuth(fakeIdentityAuth(auth));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
});

/** This browser signed in as `userId`: a Supabase session in the jar, for
 *  an `auth.users` row whose id the account carries (#468). */
function signIn(userId: string): void {
  const row = state.users.find((u) => u.id === userId);
  if (row !== undefined && !auth.users.some((u) => u.id === userId)) {
    addAuthUser(auth, { id: userId, email: row.email });
  }
  const [, token] = signedInCookie(auth, userId).split("=") as [string, string];
  jar.set(SESSION_COOKIE_NAME, token);
}

function submit(address: string): FormData {
  const form = new FormData();
  form.set(NEW_EMAIL_FIELD, address);
  return form;
}

// ── REQ-077 c5 — sign out ─────────────────────────────────────────────────

describe('REQ-077 c5 — "that session ends and returning requires a fresh sign-in link"', () => {
  it("ends the session for real and hands the browser to the sign-in screen", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    signIn(user.id);

    expect(await signOutAction()).toEqual({ done: "elsewhere", href: SIGNIN_PATH });
    // The cookie is gone and Supabase has revoked the session behind it —
    // this one, and no other device's.
    expect(jar.has(SESSION_COOKIE_NAME)).toBe(false);
    expect(auth.sessions.every((s) => s.revoked)).toBe(true);
    expect(auth.signOuts).toEqual([]);
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

  it("signing out with no session is not an error, and lands in the same place", async () => {
    // Sign-out needs no account: it deletes *this browser's* cookie. One
    // press, one destination, whether the session was there to end or had
    // already gone — the same screen §4.3's gate sends every other
    // session-less press on this surface to.
    expect(await signOutAction()).toEqual({ done: "elsewhere", href: SIGNIN_PATH });
    expect(jar.has(SESSION_COOKIE_NAME)).toBe(false);
  });

  it("it is the one destination the whole screen refuses to, so no press means two things", async () => {
    // The three billing controls answer `{ elsewhere, /signin }` with no
    // session and the two form actions redirect there; this asserts
    // sign-out agrees, rather than each control choosing its own way out.
    const user = addAccount(state, { email: "founder@example.com" });
    signIn(user.id);
    const withSession = await signOutAction();
    const without = await signOutAction();
    expect(withSession).toEqual(without);
    expect(withSession).toEqual({ done: "elsewhere", href: SIGNIN_PATH });
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

  it("a session that ended between the render and the press goes to the sign-in screen, and attempts nothing", async () => {
    // BUILD §4.3's gate, reached from the action. Nothing is attempted for
    // an account nobody can name, and the customer is not shown a line
    // about an address that was never the problem.
    await expect(
      beginEmailChangeAction(EMAIL_CHANGE_INITIAL, submit("new@example.com"))
    ).rejects.toThrow(`redirect:${SIGNIN_PATH}`);
    expect(sendCalls).toHaveLength(0);
    expect(revalidated).toEqual([]);
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

  it("cancelling with no session touches nothing and goes to the sign-in screen", async () => {
    const user = addAccount(state, { email: "founder@example.com" });
    signIn(user.id);
    await beginEmailChangeAction(EMAIL_CHANGE_INITIAL, submit("new@example.com"));

    jar.clear();
    revalidated.length = 0;
    await expect(cancelEmailChangeAction()).rejects.toThrow(`redirect:${SIGNIN_PATH}`);

    // Still pending: a request with no session must not clear somebody's
    // change, and it has no account to clear one for.
    expect((await accountCard(user.id))?.pending?.email).toBe("new@example.com");
    expect(revalidated).toEqual([]);
  });
});
