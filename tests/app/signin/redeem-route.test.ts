// tests/app/signin/redeem-route.test.ts — BUILD §13, issues #35, #468
//
// A link lands on `/auth/confirm`, which shows one button and spends
// nothing; the button's post to `/auth/confirm/redeem` is what calls
// `verifyOtp` (`fake-auth.ts`). Every case opens the page, reads the form it
// drew, and posts that form back, as a browser does.
//
// REQ-098 criterion 7: an expired, spent or never-issued link gets one answer
// whatever the reason. REQ-024 criterion 4: a good one returns them to setup
// if it is unfinished, otherwise onward into the product.
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest, type NextResponse } from "next/server";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock, sendOutcome } from "../../account/send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

/** The request's cookies, as the page reads them. */
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));

const { default: ConfirmPage, metadata } = await import("../../../src/app/(public)/auth/confirm/page");
const { POST } = await import("../../../src/app/(public)/auth/confirm/redeem/route");
const { issueLink } = await import("../../../src/lib/account/identity/links");
const { beginEmailChange } = await import("../../../src/lib/account/identity/email-change");
const { setIdentityStore } = await import("../../../src/lib/account/identity/store");
const { setIdentityAuth } = await import("../../../src/lib/account/identity/auth");
const { addAccount, memoryIdentityStore, newMemoryIdentity } = await import(
  "../../account/identity/memory-store"
);
const { FAKE_AUTH_COOKIE, addAuthUser, fakeIdentityAuth, newFakeAuth } = await import(
  "../../account/identity/fake-auth"
);
const { COPY } = await import("../../../src/lib/presentation/copy/registry");
const { PENDING_COOKIE, pendingCookieFor } = await import("../../../src/lib/account/signin-pending");

const ORIGIN = "https://reachkit.example";
const NOW = new Date();

/** What Chromium 151 sent when it posted this page's form under its
 *  `strict-origin` policy: the real `Origin`, from the page's own origin. */
const OWN_PAGE = { origin: ORIGIN, "sec-fetch-site": "same-origin" } as const;

let state = newMemoryIdentity();
let auth = newFakeAuth();

beforeEach(() => {
  state = newMemoryIdentity();
  auth = newFakeAuth();
  setIdentityStore(memoryIdentityStore(state));
  setIdentityAuth(fakeIdentityAuth(auth));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
  jar.clear();
});

/** An account and the `auth.users` row whose id it carries (#468). */
function account(email: string, patch: { first_signed_in_at?: string } = {}) {
  const user = addAccount(state, { email, ...patch });
  addAuthUser(auth, { id: user.id, email });
  return user;
}

type Form = { method: string; action: string; fields: Record<string, string> };
type Landed = { kind: "page"; html: string; form: Form } | { kind: "redirect"; to: string };

/** The form the page drew: its target and its hidden fields. */
function formOf(html: string): Form {
  const tag = /<form\b[^>]*>/.exec(html)?.[0] ?? "";
  const attr = (source: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(source)?.[1] ?? "";
  const fields: Record<string, string> = {};
  for (const input of html.match(/<input\b[^>]*>/g) ?? []) fields[attr(input, "name")] = attr(input, "value");
  return { method: attr(tag, "method"), action: attr(tag, "action"), fields };
}

/** A GET of the address the mail carried. */
async function land(url: string): Promise<Landed> {
  const params = Object.fromEntries(new URL(url).searchParams);
  try {
    const html = renderToStaticMarkup(await ConfirmPage({ searchParams: Promise.resolve(params) }));
    return { kind: "page", html, form: formOf(html) };
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? "";
    if (!digest.startsWith("NEXT_REDIRECT")) throw error;
    return { kind: "redirect", to: digest.split(";")[2] ?? "" };
  }
}

function page(landed: Landed): { html: string; form: Form } {
  if (landed.kind === "page") return landed;
  throw new Error(`the link redirected to ${landed.to}`);
}

/** The press: the form posted back, with the headers a browser sends. */
async function press(form: Form, headers: Record<string, string> = OWN_PAGE): Promise<NextResponse> {
  return POST(
    new NextRequest(new URL(form.action, ORIGIN), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
      body: new URLSearchParams(form.fields).toString(),
    })
  );
}

/** Open the link, then press the one button. */
async function follow(url: string): Promise<NextResponse> {
  return press(page(await land(url)).form);
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

/** This browser asked for a link: the page reads `value` and the post carries it. */
function asked(value: string = pendingCookieFor("magiclink").value, headers: Record<string, string> = OWN_PAGE): Record<string, string> {
  jar.set(PENDING_COOKIE, value);
  return { ...headers, cookie: `${PENDING_COOKIE}=${value}` };
}

async function emailChangeLink(): Promise<string> {
  const user = account("old@example.com");
  await beginEmailChange(user.id, "new@example.com", NOW);
  const blocks = (sendCalls[0]?.blocks ?? []) as readonly object[];
  return blocks.flatMap((b) => ("href" in b ? [String(b.href)] : []))[0] ?? "";
}

function locationOf(response: NextResponse): string {
  return new URL(response.headers.get("location") ?? "").pathname;
}

function expectDead(response: NextResponse): void {
  const location = new URL(response.headers.get("location") ?? "");
  expect(response.status).toBe(303);
  expect(location.pathname).toBe("/signin");
  expect(location.searchParams.get("link")).toBe("dead");
  expect(response.cookies.get(FAKE_AUTH_COOKIE)).toBeUndefined();
}

describe("opening the link spends nothing; the press signs in", () => {
  it("GET does not spend the token", async () => {
    const { url, userId } = await liveLink();

    await land(url);
    const second = page(await land(url));
    expect(auth.verifyCalls).toBe(0);

    const cookie = (await press(second.form)).cookies.get(FAKE_AUTH_COOKIE);
    expect(auth.verifyCalls).toBe(1);
    expect(auth.sessions.find((s) => s.accessToken === cookie?.value)?.userId).toBe(userId);
    // The session client's attributes ride on the redirect untouched.
    expect([cookie?.httpOnly, cookie?.path]).toEqual([true, "/"]);
  });

  it("the page is one plain form that posts to the redeem route, with one button and no link", async () => {
    const { url } = await liveLink();
    const { html, form } = page(await land(url));
    expect(form.method).toBe("post");
    expect(form.action).toBe("/auth/confirm/redeem");
    expect(form.fields).toEqual({ token_hash: new URL(url).searchParams.get("token_hash"), type: "magiclink" });
    expect(html.match(/<button\b/g)).toHaveLength(1);
    expect(html).not.toMatch(/<a\b/);
    expect(html).not.toMatch(/\bdisabled\b/);
    expect(html).toContain(COPY["signin.confirm.head"]);
    expect(html).toContain(COPY["signin.confirm.line"]);
    expect(html).toContain(COPY["signin.confirm.submit"]);
  });

  it("a browser without Sec-Fetch-Site (Safari < 16.4) that sends the real Origin signs in", async () => {
    const { url } = await liveLink();
    const response = await press(page(await land(url)).form, { origin: ORIGIN });
    expect(response.cookies.get(FAKE_AUTH_COOKIE)).toBeDefined();
    expect(auth.verifyCalls).toBe(1);
  });

  it("a post from a browser that blanked the Origin on its own page is ours as well", async () => {
    const { url } = await liveLink();
    const response = await press(page(await land(url)).form, { origin: "null", "sec-fetch-site": "same-origin" });
    expect(response.cookies.get(FAKE_AUTH_COOKIE)).toBeDefined();
  });

  it("a founder who has never signed in lands on setup (§13)", async () => {
    const { url } = await liveLink();
    expect(locationOf(await follow(url))).toBe("/setup");
  });

  it("a returning customer goes onward into the product, not back to setup (REQ-024 c4)", async () => {
    const user = account("returning@example.com", {
      first_signed_in_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    });
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!issued.issued) throw new Error("not issued");

    expect(locationOf(await follow(issued.url))).toBe("/app");
  });
});

describe("cross-origin POST refused", () => {
  it.each([
    ["a foreign Origin", { origin: "https://evil.example" }],
    ["a foreign Origin that claims same-origin", { origin: "https://evil.example", "sec-fetch-site": "same-origin" }],
    ["no Origin at all", {}],
    ["a null Origin from another site", { origin: "null", "sec-fetch-site": "cross-site" }],
    ["a null Origin with no fetch site", { origin: "null" }],
    ["a foreign Origin with a valid pending cookie", { origin: "https://evil.example", cookie: "pending" }],
    ["no Origin with a valid pending cookie", { cookie: "pending" }],
  ])("%s: the dead-link answer, and the link still works", async (_name, given: Record<string, string>) => {
    const { url } = await liveLink();
    const { cookie, ...headers } = given;
    if (cookie !== undefined) Object.assign(headers, asked(undefined, headers));
    const { form } = page(await land(url));

    expectDead(await press(form, headers));
    expect(auth.verifyCalls).toBe(0);

    expect((await press(form)).cookies.get(FAKE_AUTH_COOKIE)).toBeDefined();
  });
});

describe("token leaves the URL", () => {
  it("every answer is a 303 whose Location carries no token_hash", async () => {
    const { url } = await liveLink();
    const hash = new URL(url).searchParams.get("token_hash") ?? "";
    const { form } = page(await land(url));
    const answers = [await press(form, {}), await press(form), await press(form)];

    for (const response of answers) {
      const location = response.headers.get("location") ?? "";
      expect(response.status).toBe(303);
      expect(location).not.toContain("token_hash");
      expect(location).not.toContain(hash);
    }
  });
});

describe("a link opened in the browser that asked for it", () => {
  it("draws the same form marked to send itself; without the cookie the page is byte-identical to before", async () => {
    const before = readFileSync(new URL("./fixtures/confirm-no-cookie.html", import.meta.url), "utf8");
    expect(page(await land(confirmUrl("fixed-hash"))).html).toBe(before);
    asked();
    const { html, form } = page(await land(confirmUrl("fixed-hash")));
    expect(html).toMatch(/<form\b[^>]*\bdata-auto=""/);
    expect(form).toEqual(formOf(before));
    expect(auth.verifyCalls).toBe(0);
  });

  it.each([
    ["/setup", {}, ""],
    ["/app", { first_signed_in_at: NOW.toISOString() }, ""],
    ["/setup/connect", {}, "/setup/connect"],
  ])("the auto-sent post signs in, lands on %s and clears the cookie", async (landing, patch, next) => {
    const user = account("founder@example.com", patch);
    const issued = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
    if (!issued.issued) throw new Error("not issued");
    const url = new URL(issued.url);
    if (next !== "") url.searchParams.set("next", next);
    const response = await press(page(await land(url.toString())).form, asked());
    expect([response.status, locationOf(response), auth.verifyCalls]).toEqual([303, landing, 1]);
    expect(response.cookies.get(FAKE_AUTH_COOKIE)).toBeDefined();
    expect(response.headers.get("set-cookie")).toMatch(/__Host-rk_signin_pending=; Path=\/; Max-Age=0; Secure; HttpOnly; SameSite=lax/);
  });

  it("refused, spent and unknown answer as without the cookie, with no token in a Location, and keep the cookie", async () => {
    const bare = (await follow(confirmUrl("nobody-minted-this"))).headers.get("location");
    const { url } = await liveLink();
    const cookie = asked();
    const { form } = page(await land(url));
    const refused = await press(form, { cookie: cookie.cookie ?? "" });
    expect((await press(form, cookie)).cookies.get(PENDING_COOKIE)?.maxAge).toBe(0);
    const dead = [refused, await press(form, cookie), await press(page(await land(confirmUrl("nobody-minted-this"))).form, cookie)];
    for (const response of dead) {
      expectDead(response);
      expect(response.headers.get("location")).toBe(bare);
      expect(response.headers.get("location")).not.toContain(new URL(url).searchParams.get("token_hash"));
      expect(response.cookies.get(PENDING_COOKIE)).toBeUndefined();
    }
  });

  const flipped = (value: string): string => {
    const [kind, expires, mac] = value.split(".");
    const bytes = Buffer.from(mac ?? "", "base64url");
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    return `${kind}.${expires}.${bytes.toString("base64url")}`;
  };
  const exp = Date.now() + 3_600_000;
  const otherKey = `magiclink.${exp}.${createHmac("sha256", "another-key").update(`signin-pending:magiclink:${exp}`).digest("base64url")}`;

  it.each([
    ["one changed MAC byte", "magiclink", () => flipped(pendingCookieFor("magiclink").value)],
    ["a valid MAC that has expired", "magiclink", () => pendingCookieFor("magiclink", Date.now() - 25 * 3_600_000).value],
    ["an email-change cookie on a sign-in link", "magiclink", () => pendingCookieFor("email_change").value],
    ["a sign-in cookie on an email-change link", "email_change", () => pendingCookieFor("magiclink").value],
    ["another key", "magiclink", () => otherKey],
    ["an unparseable value", "magiclink", () => "not.a-cookie"],
  ])("%s: the button page and no verify call", async (_name, type, value) => {
    const url = type === "email_change" ? await emailChangeLink() : (await liveLink()).url;
    asked(value());
    expect(page(await land(url)).html).not.toContain("data-auto");
    expect(auth.verifyCalls).toBe(0);
  });

  it("an email-change link asked for in this browser sends itself and moves the address", async () => {
    const href = await emailChangeLink();
    const cookie = asked(pendingCookieFor("email_change").value);
    const { html, form } = page(await land(href));
    expect(html).toContain("data-auto");
    await press(form, cookie);
    expect(state.users[0]?.email).toBe("new@example.com");
  });
});

describe("interstitial leaks no referrer and is noindex", () => {
  it("the page's head sends no path in a referrer (strict-origin) and says noindex", () => {
    expect(metadata.referrer).toBe("strict-origin");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

describe("an email-change link completes through the same two steps", () => {
  it("GET then POST moves the account onto the new address and signs it in", async () => {
    const user = account("old@example.com");
    await beginEmailChange(user.id, "new@example.com", NOW);
    const blocks = (sendCalls[0]?.blocks ?? []) as readonly object[];
    const href = blocks.flatMap((b) => ("href" in b ? [String(b.href)] : []))[0] ?? "";

    const { html, form } = page(await land(href));
    expect(form.fields.type).toBe("email_change");
    expect(html).toContain(COPY["signin.confirm.change.head"]);
    expect(html).toContain(COPY["signin.confirm.change.submit"]);
    expect(auth.verifyCalls).toBe(0);
    expect(state.users[0]?.email).toBe("old@example.com");

    const response = await press(form);
    expect(state.users[0]?.email).toBe("new@example.com");
    expect(response.cookies.get(FAKE_AUTH_COOKIE)).toBeDefined();
  });
});

describe("a link may ask for /setup/connect or Settings › Pages, exactly, and nothing else", () => {
  it.each([
    ["/setup/connect", "/setup/connect"],
    ["/app/settings/pages", "/app/settings/pages"],
    ["/app/settings/pages/../account", "/setup"],
    ["https://evil.example/", "/setup"],
    ["/app/settings", "/setup"],
  ])("next=%s lands on %s", async (next, landing) => {
    const { url } = await liveLink();
    const asked = new URL(url);
    asked.searchParams.set("next", next);
    const response = await follow(asked.toString());
    expect(new URL(response.headers.get("location") ?? "").origin).toBe(asked.origin);
    expect(locationOf(response)).toBe(landing);
  });
});

describe("REQ-098 c7 — a link that no longer works lands on the sign-in screen", () => {
  it.each([
    ["never issued", async () => confirmUrl("a-hash-nobody-ever-minted")],
    [
      "already used",
      async () => {
        const { url } = await liveLink();
        await follow(url);
        return url;
      },
    ],
    [
      "superseded by a later request",
      async () => {
        const user = account("founder@example.com");
        const first = await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: NOW });
        const later = new Date(NOW.getTime() + 16 * 60 * 1000);
        await issueLink({ userId: user.id, to: user.email, purpose: "sign_in", now: later });
        if (!first.issued) throw new Error("not issued");
        return first.url;
      },
    ],
  ])("%s: the press is redirected to /signin with the dead-link marker and no session", async (_name, make) => {
    expectDead(await follow(await make()));
  });

  it.each([
    ["with no token hash at all", `${ORIGIN}/auth/confirm?type=magiclink`],
    ["with a type this product never issues", confirmUrl("anything", "recovery")],
    ["with nothing at all", `${ORIGIN}/auth/confirm`],
  ])("%s: the GET goes straight to the dead-link screen", async (_name, url) => {
    expect(await land(url)).toEqual({ kind: "redirect", to: "/signin?link=dead" });
    expect(auth.verifyCalls).toBe(0);
  });

  it("a post missing its fields gets the same answer", async () => {
    expectDead(await press({ method: "post", action: "/auth/confirm/redeem", fields: {} }));
    expectDead(await press({ method: "post", action: "/auth/confirm/redeem", fields: { token_hash: "x", type: "recovery" } }));
  });

  it("the answers are byte-identical — the reason never reaches the browser", async () => {
    const unknown = (await follow(confirmUrl("nobody-minted-this"))).headers.get("location");

    const { url } = await liveLink();
    await follow(url);
    const spent = (await follow(url)).headers.get("location");
    const refused = (await press(page(await land(confirmUrl("x"))).form, {})).headers.get("location");

    expect(spent).toBe(unknown);
    expect(refused).toBe(unknown);
    expect(new URL(unknown ?? "").pathname + new URL(unknown ?? "").search).toBe("/signin?link=dead");
  });

  it("no query, header or status tells them apart", async () => {
    const a = await follow(confirmUrl("nope-one"));
    const { url } = await liveLink();
    await follow(url);
    const b = await follow(url);

    expect(a.status).toBe(b.status);
    expect([...a.headers.keys()].sort()).toEqual([...b.headers.keys()].sort());
  });
});
