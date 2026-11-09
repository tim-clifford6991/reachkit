// `/auth/confirm` spends a link only for a person's page load. Supabase is faked at its port, mail at the vendor transport.
import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest, type NextResponse } from "next/server";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { GET, HEAD } = await import("../../../src/app/(public)/auth/confirm/route");
const { setIdentityStore } = await import("../../../src/lib/account/identity/store");
const { setIdentityAuth } = await import("../../../src/lib/account/identity/auth");
const { __setVendorTransportForTesting } = await import("../../../src/lib/mail/vendor/resend");
const { PENDING_COOKIE, pendingCookieFor } = await import("../../../src/lib/account/signin-pending");
const { addAccount, memoryIdentityStore, newMemoryIdentity } = await import("../../account/identity/memory-store");
const { FAKE_AUTH_COOKIE, addAuthUser, fakeIdentityAuth, newFakeAuth } = await import("../../account/identity/fake-auth");

type Type = "magiclink" | "email_change";
const ORIGIN = "https://reachkit.example";
const NAVIGATE = { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" };
const PERSON = { ...NAVIGATE, "sec-fetch-user": "?1" };
const [OPEN, DEAD] = ["/signin?link=open", "/signin?link=dead"];

let [state, auth, accounts] = [newMemoryIdentity(), newFakeAuth(), 0];

beforeEach(() => {
  [state, auth] = [newMemoryIdentity(), newFakeAuth()];
  setIdentityStore(memoryIdentityStore(state));
  setIdentityAuth(fakeIdentityAuth(auth));
  __setVendorTransportForTesting(async () => ({ status: 200, headers: {}, body: '{"id":"resend-1"}' }));
});

/** A live link of `type` for a fresh account; an email change is one the account is waiting on. */
async function liveLink(type: Type, signedInBefore = false): Promise<string> {
  const user = addAccount(state, { email: `founder-${++accounts}@example.com`, first_signed_in_at: signedInBefore ? new Date().toISOString() : null });
  addAuthUser(auth, { id: user.id, email: user.email });
  const made = await fakeIdentityAuth(auth).generateLink(
    type === "magiclink" ? { kind: "sign_in", email: user.email } : { kind: "email_change", email: user.email, newEmail: "new@example.com" }
  );
  if (!made.ok) throw new Error("no link");
  if (type === "email_change") {
    Object.assign(user, { pending_email: "new@example.com", pending_email_token_hash: made.tokenHash, pending_email_sent_at: new Date().toISOString() });
  }
  return made.tokenHash;
}

function open(tokenHash: string, headers: Record<string, string>, a: { type?: Type; next?: string; cookie?: string } = {}) {
  const query = new URLSearchParams({ token_hash: tokenHash, type: a.type ?? "magiclink", ...(a.next === undefined ? {} : { next: a.next }) });
  const cookie: Record<string, string> = a.cookie === undefined ? {} : { cookie: `${PENDING_COOKIE}=${a.cookie}` };
  return GET(new NextRequest(`${ORIGIN}/auth/confirm?${query.toString()}`, { headers: { ...headers, ...cookie } }));
}

const landed = (r: NextResponse) => [r.status, r.headers.get("location")?.replace(ORIGIN, "")];
const signedIn = (r: NextResponse) => (r.cookies.get(FAKE_AUTH_COOKIE)?.value ?? "").length > 0;

describe("/auth/confirm", () => {
  it.each<[Type, boolean, string]>([
    ["magiclink", false, "/setup"],
    ["magiclink", true, "/app"],
    ["email_change", true, "/app"],
  ])("person, no pending cookie: a %s link (signed in before: %s) goes straight to %s", async (type, before, to) => {
    const response = await open(await liveLink(type, before), PERSON, { type });
    expect([landed(response), signedIn(response), response.body]).toEqual([[303, to], true, null]);
    expect([response.headers.get("cache-control"), response.headers.get("referrer-policy")]).toEqual(["no-store", "no-referrer"]);
  });

  it.each<Type>(["magiclink", "email_change"])("prefetch spends nothing: HEAD, a bare GET and an image load leave a %s link for the person", async (type) => {
    const hash = await liveLink(type, type === "email_change");
    const head = HEAD();
    const bare = await open(hash, {}, { type });
    const image = await open(hash, { ...NAVIGATE, "sec-fetch-dest": "image", "sec-fetch-user": "?1" }, { type });
    expect([head.status, landed(bare), landed(image), signedIn(bare) || signedIn(image)]).toEqual([204, [303, OPEN], [303, OPEN], false]);
    expect(auth.verifyCalls).toBe(0);
    const person = await open(hash, PERSON, { type });
    expect([landed(person)[0], signedIn(person), auth.verifyCalls]).toEqual([303, true, 1]);
  });

  it("pending cookie: the browser that asked goes in without user activation, and the cookie is cleared", async () => {
    const response = await open(await liveLink("magiclink"), NAVIGATE, { cookie: pendingCookieFor("magiclink").value });
    expect([landed(response), signedIn(response), response.cookies.get(PENDING_COOKIE)?.value]).toEqual([[303, "/setup"], true, ""]);

    const other = await open(await liveLink("magiclink"), NAVIGATE, { cookie: pendingCookieFor("email_change").value });
    expect([landed(other), signedIn(other), auth.verifyCalls]).toEqual([[303, OPEN], false, 1]);
  });

  it("dead link: wrong-type, spent, unknown and expired links land on the dead-link screen with no session", async () => {
    const hash = await liveLink("magiclink");
    const wrongType = await open(hash, PERSON, { type: "email_change" });
    await open(hash, PERSON);
    const [spent, unknown] = [await open(hash, PERSON), await open("never-issued", PERSON)];
    const late = await liveLink("magiclink");
    auth.now = () => new Date(Date.now() + 25 * 3_600_000);
    for (const response of [wrongType, spent, unknown, await open(late, PERSON)]) {
      expect([landed(response), signedIn(response)]).toEqual([[303, DEAD], false]);
    }
  });

  it.each(["https://evil.example", "//evil.example", "/setup/connect"])("foreign next: %s lands only on an allowed landing", async (next) => {
    const response = await open(await liveLink("magiclink"), PERSON, { next });
    expect(landed(response)).toEqual([303, next === "/setup/connect" ? next : "/setup"]);
  });
});
