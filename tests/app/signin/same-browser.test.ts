// SPEC §3: a sign-in link opened in the browser that asked for it goes straight in; the jar is that browser's.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock } from "../../account/send-mock";

applyEnvFixture();

const jar = new Map<string, string>();
const sets: { name: string; value: string; options: object }[] = [];
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string, options: object) => void (sets.push({ name, value, options }), jar.set(name, value)),
  }),
}));
vi.mock("@/lib/mail/send", () => sendMock());

const { sendLink } = await import("@/app/(public)/signin/actions");
const { SIGN_IN_INITIAL, EMAIL_FIELD } = await import("@/app/(public)/signin/state");
const { default: ConfirmPage } = await import("@/app/(public)/auth/confirm/page");
const { POST } = await import("@/app/(public)/auth/confirm/redeem/route");
const { PENDING_COOKIE } = await import("@/lib/account/signin-pending");
const { setAccountStore } = await import("@/lib/account/store");
const { setIdentityStore } = await import("@/lib/account/identity/store");
const { setIdentityAuth } = await import("@/lib/account/identity/auth");
const { unwireSignInLinkIssuer } = await import("@/lib/account/identity/wire");
const { memoryAccountStore, newMemoryAccounts } = await import("../../account/memory-store");
const { addAccount, memoryIdentityStore, newMemoryIdentity } = await import("../../account/identity/memory-store");
const { FAKE_AUTH_COOKIE, addAuthUser, fakeIdentityAuth, newFakeAuth } = await import("../../account/identity/fake-auth");

const ORIGIN = "https://reachkit.example";
let auth = newFakeAuth();

beforeEach(() => {
  const state = newMemoryIdentity();
  auth = newFakeAuth();
  setIdentityStore(memoryIdentityStore(state));
  setIdentityAuth(fakeIdentityAuth(auth));
  const user = addAccount(state, { email: "owner@acme.example" });
  addAuthUser(auth, { id: user.id, email: user.email });
  // The action's account read, answered from the same row the identity store holds.
  const row = { ...user, checkout_session_id: null, sign_in_chased_at: null, stripe_customer_id: null, billing_country: null, vat_number: null, created_at: "2026-01-01T00:00:00Z" };
  setAccountStore({ ...memoryAccountStore(newMemoryAccounts()), accountByEmail: async (email) => ({ ok: true, account: email === user.email ? row : null }) });
  vi.stubGlobal("fetch", async () => new Response("true", { headers: { "content-type": "application/json" } }));
  jar.clear();
  sets.length = 0;
  sendCalls.length = 0;
});

afterEach(() => {
  unwireSignInLinkIssuer();
  vi.unstubAllGlobals();
});

async function ask(email: string) {
  const form = new FormData();
  form.set(EMAIL_FIELD, email);
  return sendLink(SIGN_IN_INITIAL, form);
}

async function open(url: string): Promise<string> {
  return renderToStaticMarkup(await ConfirmPage({ searchParams: Promise.resolve(Object.fromEntries(new URL(url).searchParams)) }));
}

describe("a link asked for and opened in one browser", () => {
  it("signs in with no press, and a second opening asks for the press", async () => {
    await ask("owner@acme.example");
    const href = ((sendCalls[0]?.blocks ?? []) as object[]).flatMap((b) => ("href" in b ? [String(b.href)] : []))[0] ?? "";
    const html = await open(href);
    expect(html).toContain("data-auto");

    // What the auto-sent form posts: its hidden fields, this browser's jar, its own page's Origin.
    const fields = Object.fromEntries([...html.matchAll(/<input type="hidden" name="([^"]*)" value="([^"]*)"/g)].map((m) => [m[1], m[2]]));
    const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    const headers = { "content-type": "application/x-www-form-urlencoded", origin: ORIGIN, "sec-fetch-site": "same-origin", cookie };
    const response = await POST(new NextRequest(`${ORIGIN}/auth/confirm/redeem`, { method: "POST", headers, body: new URLSearchParams(fields).toString() }));
    expect([new URL(response.headers.get("location") ?? "").pathname, auth.verifyCalls]).toEqual(["/setup", 1]);
    expect(response.cookies.get(FAKE_AUTH_COOKIE)).toBeDefined();

    for (const c of response.cookies.getAll()) if (c.maxAge === 0) jar.delete(c.name);
    expect(await open(href)).not.toContain("data-auto");
  });
});

describe("one answer for every address", () => {
  it("an address with an account and one without get the same cookie; an invalid one gets none", async () => {
    for (const email of ["owner@acme.example", "nobody@acme.example", "not-an-address"]) await ask(email);
    expect(sendCalls.map((m) => m.to)).toEqual(["owner@acme.example"]);
    const attributes = { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 86_400 };
    expect(sets.map((s) => [s.name, s.value.split(".")[0], s.options])).toEqual([
      [PENDING_COOKIE, "magiclink", attributes],
      [PENDING_COOKIE, "magiclink", attributes],
    ]);
  });
});
