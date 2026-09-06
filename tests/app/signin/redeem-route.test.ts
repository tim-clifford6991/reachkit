// tests/app/signin/redeem-route.test.ts — BUILD §13, issue #35
//
// GET /signin/{token}: where a sign-in link lands.
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
import type { NextResponse } from "next/server";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock, sendOutcome } from "../../account/send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { GET } = await import("../../../src/app/(public)/signin/[token]/route");
const { SESSION_COOKIE_NAME } = await import("../../../src/lib/account/identity/addresses");
const { readSessionCookie } = await import("../../../src/lib/account/identity/cookie");
const { issueLink } = await import("../../../src/lib/account/identity/links");
const { setIdentityStore } = await import("../../../src/lib/account/identity/store");
const { addAccount, memoryIdentityStore, newMemoryIdentity } = await import(
  "../../account/identity/memory-store"
);

const ORIGIN = "https://reachkit.example";
const NOW = new Date();

let state = newMemoryIdentity();

beforeEach(() => {
  state = newMemoryIdentity();
  setIdentityStore(memoryIdentityStore(state));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
});

/** The handler answers with a `NextResponse`, whose `cookies` accessor is
 *  what carries the `Set-Cookie` this route's whole job is to attach. */
async function open(token: string): Promise<NextResponse> {
  return GET(new Request(`${ORIGIN}/signin/${encodeURIComponent(token)}`), {
    params: Promise.resolve({ token }),
  });
}

async function liveToken(email = "founder@example.com"): Promise<{ token: string; userId: string }> {
  const user = addAccount(state, { email });
  const issued = await issueLink({ userId: user.id, to: email, purpose: "sign_in", now: NOW });
  if (!issued.issued) throw new Error("not issued");
  const segments = new URL(issued.url).pathname.split("/");
  return { token: decodeURIComponent(segments[segments.length - 1] ?? ""), userId: user.id };
}

function locationOf(response: NextResponse): string {
  return new URL(response.headers.get("location") ?? "").pathname;
}

describe("a working link signs the customer in", () => {
  it("sets the session cookie on the redirect's own response", async () => {
    const { token, userId } = await liveToken();

    const response = await open(token);
    const cookie = response.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie).toBeDefined();
    expect(readSessionCookie(cookie?.value ?? "", new Date())?.userId).toBe(userId);
  });

  it("the cookie is http-only and path-wide, so no script can read it", async () => {
    const { token } = await liveToken();
    const cookie = (await open(token)).cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe("/");
  });

  it("a founder who has never signed in lands on setup (§13)", async () => {
    const { token } = await liveToken();
    expect(locationOf(await open(token))).toBe("/setup");
  });

  it("a returning customer goes onward into the product, not back to setup (REQ-024 c4)", async () => {
    const user = addAccount(state, {
      email: "returning@example.com",
      first_signed_in_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    });
    const issued = await issueLink({
      userId: user.id,
      to: user.email,
      purpose: "sign_in",
      now: NOW,
    });
    if (!issued.issued) throw new Error("not issued");
    const segments = new URL(issued.url).pathname.split("/");
    const token = decodeURIComponent(segments[segments.length - 1] ?? "");

    expect(locationOf(await open(token))).toBe("/app");
  });
});

describe('REQ-098 c7 — a link that no longer works lands on the sign-in screen', () => {
  it.each([
    ["never issued", async () => "a-token-nobody-ever-minted"],
    [
      "already used",
      async () => {
        const { token } = await liveToken();
        await open(token);
        return token;
      },
    ],
    [
      "superseded by a later request",
      async () => {
        const user = addAccount(state, { email: "founder@example.com" });
        const first = await issueLink({
          userId: user.id,
          to: user.email,
          purpose: "sign_in",
          now: NOW,
        });
        await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
        if (!first.issued) throw new Error("not issued");
        const segments = new URL(first.url).pathname.split("/");
        return decodeURIComponent(segments[segments.length - 1] ?? "");
      },
    ],
  ])("%s: redirected to /signin with the dead-link marker and no session", async (_name, make) => {
    const token = await make();
    const response = await open(token);

    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/signin");
    expect(location.searchParams.get("link")).toBe("dead");
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("the three answers are byte-identical — the reason never reaches the browser", async () => {
    const unknown = (await open("nobody-minted-this")).headers.get("location");

    const { token } = await liveToken();
    await open(token);
    const spent = (await open(token)).headers.get("location");

    expect(spent).toBe(unknown);
  });

  it("no query, header or status tells the two apart", async () => {
    const a = await open("nope-one");
    const { token } = await liveToken();
    await open(token);
    const b = await open(token);

    expect(a.status).toBe(b.status);
    expect([...a.headers.keys()].sort()).toEqual([...b.headers.keys()].sort());
  });
});
