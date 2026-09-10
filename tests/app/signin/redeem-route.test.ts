// tests/app/signin/redeem-route.test.ts — BUILD §13, issues #35, #468
//
// GET /auth/confirm?token_hash=…&type=…: where a sign-in link lands (it was
// `/signin/{token}` until #468 moved the token into Supabase Auth). The
// route hands the hash to `verifyOtp` and puts the session Supabase writes
// on its own redirect; Supabase's half runs through the identity suites'
// `fake-auth.ts`.
//
// REQ-098 criterion 7, quoted: "Given a person who opens a sign-in link
// that no longer works — expired; spent, because it was used once already
// or because a later link they asked for replaced it; or never issued by
// this product — when they open it, then they land on this screen and one
// written line tells them the link can no longer be used ... that line and
// the time it takes are the same whatever the reason".
//
// REQ-024 criterion 4, quoted: "then they are returned to where they left
// off — setup if it is unfinished, otherwise onward into the product ...
// never to a dead end or a second checkout."
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, type NextResponse } from "next/server";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock, sendOutcome } from "../../account/send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { GET } = await import("../../../src/app/(public)/auth/confirm/route");
const { issueLink } = await import("../../../src/lib/account/identity/links");
const { setIdentityStore } = await import("../../../src/lib/account/identity/store");
const { setIdentityAuth } = await import("../../../src/lib/account/identity/auth");
const { addAccount, memoryIdentityStore, newMemoryIdentity } = await import(
  "../../account/identity/memory-store"
);
const { FAKE_AUTH_COOKIE, addAuthUser, fakeIdentityAuth, newFakeAuth } = await import(
  "../../account/identity/fake-auth"
);

const ORIGIN = "https://reachkit.example";
const NOW = new Date();

let state = newMemoryIdentity();
let auth = newFakeAuth();

beforeEach(() => {
  state = newMemoryIdentity();
  auth = newFakeAuth();
  setIdentityStore(memoryIdentityStore(state));
  setIdentityAuth(fakeIdentityAuth(auth));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
});

/** An account and the `auth.users` row whose id it carries (#468). */
function account(email: string, patch: { first_signed_in_at?: string } = {}) {
  const user = addAccount(state, { email, ...patch });
  addAuthUser(auth, { id: user.id, email });
  return user;
}

/** Follows a link the way a browser does: a GET to the URL the mail
 *  carried. The handler answers with a `NextResponse`, whose `cookies`
 *  accessor is what carries the `Set-Cookie` this route exists to attach. */
async function open(url: string): Promise<NextResponse> {
  return GET(new NextRequest(url));
}

async function liveLink(email = "founder@example.com"): Promise<{ url: string; userId: string }> {
  const user = account(email);
  const issued = await issueLink({ userId: user.id, to: email, purpose: "sign_in", now: NOW });
  if (!issued.issued) throw new Error("not issued");
  return { url: issued.url, userId: user.id };
}

function confirmUrl(tokenHash: string, type = "magiclink"): string {
  return `${ORIGIN}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${type}`;
}

function locationOf(response: NextResponse): string {
  return new URL(response.headers.get("location") ?? "").pathname;
}

describe("a working link signs the customer in", () => {
  it("puts the session Supabase wrote on the redirect's own response", async () => {
    const { url, userId } = await liveLink();

    const response = await open(url);
    const cookie = response.cookies.get(FAKE_AUTH_COOKIE);
    expect(cookie).toBeDefined();
    expect(auth.sessions.find((s) => s.accessToken === cookie?.value)?.userId).toBe(userId);
  });

  it("carries the cookie with the attributes the session client gave it, untouched", async () => {
    const { url } = await liveLink();
    const cookie = (await open(url)).cookies.get(FAKE_AUTH_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe("/");
  });

  it("a founder who has never signed in lands on setup (§13)", async () => {
    const { url } = await liveLink();
    expect(locationOf(await open(url))).toBe("/setup");
  });

  it("a returning customer goes onward into the product, not back to setup (REQ-024 c4)", async () => {
    const user = account("returning@example.com", {
      first_signed_in_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    });
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!issued.issued) throw new Error("not issued");

    expect(locationOf(await open(issued.url))).toBe("/app");
  });
});

describe('REQ-098 c7 — a link that no longer works lands on the sign-in screen', () => {
  it.each([
    ["never issued", async () => confirmUrl("a-hash-nobody-ever-minted")],
    [
      "already used",
      async () => {
        const { url } = await liveLink();
        await open(url);
        return url;
      },
    ],
    [
      "superseded by a later request",
      async () => {
        const user = account("founder@example.com");
        const first = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
        await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
        if (!first.issued) throw new Error("not issued");
        return first.url;
      },
    ],
    ["with no token hash at all", async () => `${ORIGIN}/auth/confirm?type=magiclink`],
    ["with a type this product never issues", async () => confirmUrl("anything", "recovery")],
  ])("%s: redirected to /signin with the dead-link marker and no session", async (_name, make) => {
    const url = await make();
    const response = await open(url);

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/signin");
    expect(location.searchParams.get("link")).toBe("dead");
    expect(response.cookies.get(FAKE_AUTH_COOKIE)).toBeUndefined();
  });

  it("the answers are byte-identical — the reason never reaches the browser", async () => {
    const unknown = (await open(confirmUrl("nobody-minted-this"))).headers.get("location");

    const { url } = await liveLink();
    await open(url);
    const spent = (await open(url)).headers.get("location");
    const malformed = (await open(`${ORIGIN}/auth/confirm`)).headers.get("location");

    expect(spent).toBe(unknown);
    expect(malformed).toBe(unknown);
  });

  it("no query, header or status tells them apart", async () => {
    const a = await open(confirmUrl("nope-one"));
    const { url } = await liveLink();
    await open(url);
    const b = await open(url);

    expect(a.status).toBe(b.status);
    expect([...a.headers.keys()].sort()).toEqual([...b.headers.keys()].sort());
  });
});
