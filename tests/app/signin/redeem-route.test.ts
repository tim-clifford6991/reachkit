// tests/app/signin/redeem-route.test.ts — BUILD §13, issues #35, #468
//
// A link lands on `/auth/confirm`, which shows one button and spends
// nothing; the button's post to `/auth/confirm/redeem` is what calls
// `verifyOtp` (`fake-auth.ts`). Every case opens the page, reads the form it
// drew, and posts that form back, as a browser does.
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
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest, type NextResponse } from "next/server";
import { applyEnvFixture } from "../../mail/env-fixture";
import { sendCalls, sendMock, sendOutcome } from "../../account/send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

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
  ])("%s: the dead-link answer, and the link still works", async (_name, headers: Record<string, string>) => {
    const { url } = await liveLink();
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

describe("R15 — a reminder's link may ask for /setup/connect, and nothing else", () => {
  it.each([
    ["/setup/connect", "/setup/connect"],
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
