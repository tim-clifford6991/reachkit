// tests/app/security-headers.test.ts
//
// Issue #331 — the security pass, asserted where each half of it lives.
//
// Three promises, three sections below:
//
//  1. The four fixed headers are declared in `next.config.ts` for **every**
//     path, and the nonce-bearing CSP is on every answer `src/middleware.ts`
//     can give — the renders, the two rewrites and the sign-in redirect
//     alike. The layout job (`tests/ui/layout/security-headers.test.ts`)
//     asserts the same set on a real response from a real browser; this
//     asserts the declarations, which is what fails fast and names the file.
//  2. The session cookie and the danger ticket are `HttpOnly`, `Secure` and
//     `SameSite`-scoped, and Server Functions are left on Next's own
//     same-origin CSRF check — `allowedOrigins` is a widening, and this
//     product wants none.
//  3. `npm audit --omit=dev --audit-level=high` is the `audit` job's, not a
//     test's, and is asserted in `.github/workflows/drift-audit.yml`.
//
// Importing `@/middleware` loads `@/lib/db` (the removal rewrite, #104) and
// through it `env.ts`, which parses the environment at module load — so the
// fixture is imported above the module under test, exactly as
// `tests/app/middleware.test.ts` does, and the removal read is doubled
// because a database answer is no part of any promise here.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import "../scan/run/harness";

vi.mock("@/lib/scan/removal", () => ({ isDomainRemoved: async () => false }));

import nextConfig, { SECURITY_HEADERS } from "../../next.config";
import { contentSecurityPolicy, middleware } from "@/middleware";
import { sessionCookieOptions, setIdentityAuth } from "@/lib/account/identity/auth";
import { addAuthUser, fakeIdentityAuth, newFakeAuth, signedInCookie } from "../account/identity/fake-auth";

/** #468: a signed-in request is one whose Supabase session `getUser()`
 *  verifies — here the in-memory double, with one live session. */
const AUTH = newFakeAuth();
addAuthUser(AUTH, { id: "user-1", email: "founder@example.com" });
const SIGNED_IN = signedInCookie(AUTH, "user-1");
beforeEach(() => setIdentityAuth(fakeIdentityAuth(AUTH)));
afterEach(() => setIdentityAuth(null));
import { dangerTicketCookieOptions } from "@/app/(account)/app/settings/danger-ticket";

const CSP = "content-security-policy";
/** How a `NextResponse.next({ request: { headers } })` carries a forwarded
 *  request header — the transport Next's renderer reads the nonce back off
 *  (`parseRequestHeaders`). Asserted rather than assumed, because the
 *  nonce reaching the *render* is what makes Next stamp it on a script tag,
 *  and the response header alone would only make the browser refuse one. */
const FORWARDED_CSP = "x-middleware-request-content-security-policy";

function requestTo(pathname: string, init: { cookie?: string; host?: string } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (init.cookie !== undefined) headers.cookie = init.cookie;
  if (init.host !== undefined) headers.host = init.host;
  return new NextRequest(new URL(pathname, "http://localhost"), { headers });
}

function headerNames(): string[] {
  return SECURITY_HEADERS.map((h) => h.key);
}

function valueOf(key: string): string {
  const found = SECURITY_HEADERS.find((h) => h.key === key);
  if (!found) throw new Error(`tests/app/security-headers.test.ts: no ${key} in SECURITY_HEADERS`);
  return found.value;
}

// ── 1a. The fixed headers, declared for every path ────────────────────────

describe("issue #331 — HSTS, Referrer-Policy and Permissions-Policy on every path", () => {
  it("`next.config.ts` declares a catch-all rule carrying the whole set", async () => {
    const rules = await nextConfig.headers!();
    const catchAll = rules.find((r) => r.source === "/(.*)");
    expect(catchAll, "next.config.ts declares no catch-all header rule").toBeDefined();
    expect(catchAll!.headers.map((h) => h.key)).toEqual(headerNames());
  });

  it("the set is the five this issue names — the three headers, and the two `frame-ancestors` twins", () => {
    expect(headerNames()).toEqual([
      "Strict-Transport-Security",
      "Referrer-Policy",
      "Permissions-Policy",
      "X-Frame-Options",
      "X-Content-Type-Options",
    ]);
  });

  it("HSTS covers subdomains and lasts at least a year, and does not claim the preload list", () => {
    const hsts = valueOf("Strict-Transport-Security");
    const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1]);
    expect(maxAge).toBeGreaterThanOrEqual(31_536_000);
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).not.toContain("preload");
  });

  it("the referrer never crosses a scheme and never carries a path", () => {
    expect(valueOf("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("every Permissions-Policy entry denies its feature outright, and every name is one a browser knows", () => {
    const entries = valueOf("Permissions-Policy").split(", ");
    for (const entry of entries) expect(entry).toMatch(/^[a-z-]+=\(\)$/);
    for (const feature of ["camera", "microphone", "geolocation", "payment", "usb"]) {
      expect(entries).toContain(`${feature}=()`);
    }
  });

  it("a page cannot be framed, and no response is content-sniffed", () => {
    expect(valueOf("X-Frame-Options")).toBe("DENY");
    expect(valueOf("X-Content-Type-Options")).toBe("nosniff");
  });
});

// ── 1b. The CSP, and the nonce that makes it worth having ─────────────────

describe("issue #331 — the policy itself", () => {
  const policy = contentSecurityPolicy("TESTNONCE", false);
  const directive = (name: string): string => {
    const found = policy.split("; ").find((d) => d.startsWith(`${name} `) || d === name);
    if (!found) throw new Error(`tests/app/security-headers.test.ts: no ${name} in the policy`);
    return found;
  };

  it("script-src carries the request's nonce and no `'unsafe-inline'` at all", () => {
    expect(directive("script-src")).toContain("'nonce-TESTNONCE'");
    expect(directive("script-src")).not.toContain("'unsafe-inline'");
  });

  it("`'strict-dynamic'` is absent, so `'self'` and the platform's own origin still mean something", () => {
    expect(policy).not.toContain("'strict-dynamic'");
  });

  it("nothing may frame a ReachKit page, embed a plugin, or rewrite the document's base", () => {
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("base-uri")).toBe("base-uri 'self'");
    expect(directive("default-src")).toBe("default-src 'self'");
  });

  it("the two families are self-hosted, so the policy names no font CDN", () => {
    expect(directive("font-src")).toContain("'self'");
    expect(policy).not.toContain("fonts.googleapis.com");
    expect(policy).not.toContain("fonts.gstatic.com");
  });

  it("Vercel's preview toolbar is allowed the four things it needs", () => {
    expect(directive("script-src")).toContain("https://vercel.live");
    expect(directive("connect-src")).toContain("https://vercel.live");
    expect(directive("frame-src")).toContain("https://vercel.live");
    expect(directive("style-src")).toContain("https://vercel.live");
  });

  it("a form may still reach checkout — `form-action` is enforced across the redirect a POST gets", () => {
    expect(directive("form-action")).toContain("'self'");
    expect(directive("form-action")).toContain("https://checkout.stripe.com");
  });

  it("`upgrade-insecure-requests` is absent — HSTS does that job and this would break every http render", () => {
    expect(policy).not.toContain("upgrade-insecure-requests");
  });

  it("`'unsafe-eval'` exists in development and in no other build", () => {
    expect(contentSecurityPolicy("N", true)).toContain("'unsafe-eval'");
    expect(contentSecurityPolicy("N", false)).not.toContain("'unsafe-eval'");
  });
});

// ── 1c. Every answer the middleware can give carries it ───────────────────

describe("issue #331 — no path out of `src/middleware.ts` answers without the policy", () => {
  it.each([
    ["a public page", "/pricing", {}],
    ["an api adapter", "/api/jobs", {}],
    ["a signed-in account screen", "/app", { cookie: SIGNED_IN }],
    ["the report address, whose rewrite is a render", "/scan/example.com", {}],
    ["a hosted customer's own domain", "/best-onboarding-tools", { host: "content.example.com" }],
    // #405's fallthrough: an address under no segment this product serves,
    // which Next answers with `src/app/not-found.tsx`. A rendered screen
    // like any other, and it leaves through the same seal.
    ["an address this product does not have", "/nothing-here", {}],
  ])("%s", async (_label, pathname, init) => {
    const res = await middleware(requestTo(pathname, init));
    expect(res.headers.get(CSP)).toContain("frame-ancestors 'none'");
  });

  it("the sign-in redirect a denied request gets carries it too", async () => {
    const res = await middleware(requestTo("/app/settings"));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get(CSP)).toContain("'nonce-");
  });

  it("the render sees the same policy the browser will enforce, which is what makes Next stamp the nonce", async () => {
    const res = await middleware(requestTo("/pricing"));
    expect(res.headers.get(FORWARDED_CSP)).toBe(res.headers.get(CSP));
  });

  it("two requests never share a nonce", async () => {
    const [a, b] = await Promise.all([
      middleware(requestTo("/pricing")),
      middleware(requestTo("/pricing")),
    ]);
    const nonceOf = (value: string | null): string => {
      const found = /'nonce-([^']+)'/.exec(value ?? "")?.[1];
      if (!found) throw new Error("tests/app/security-headers.test.ts: the policy carried no nonce");
      return found;
    };
    expect(nonceOf(a.headers.get(CSP))).not.toBe(nonceOf(b.headers.get(CSP)));
  });
});

// ── 2. The two cookies, and the Server Functions' origin check ────────────

describe("issue #331 — the session cookie's flags (Supabase Auth's cookie since #468)", () => {
  const options = sessionCookieOptions();

  it("no script can read it", () => {
    expect(options.httpOnly).toBe(true);
  });

  it("it is `SameSite=Lax` — a sign-in link arrives from a mail client, so `strict` would not be sent", () => {
    expect(options.sameSite).toBe("lax");
  });

  it("on an https deployment it is `Secure`", () => {
    // `NEXT_PUBLIC_APP_URL` in the fixture environment is `https://…`, which
    // is the condition the mint reads — never `NODE_ENV`, so a preview gets
    // a secure cookie and a local http dev server gets one a browser stores.
    expect(options.secure).toBe(true);
  });
});

describe("issue #331 — the danger ticket is the strictest cookie this product sets", () => {
  const fragment = dangerTicketCookieOptions();

  it("HttpOnly, Secure, and `SameSite=Strict` — nothing arrives at it across a site boundary", () => {
    expect(fragment).toContain("HttpOnly");
    expect(fragment).toContain("Secure");
    expect(fragment).toContain("SameSite=Strict");
  });

  it("it is scoped to the app, not to the whole origin", () => {
    expect(fragment).toContain("Path=/app");
  });

  it("`Secure` is the default and comes off only when a caller says so", () => {
    expect(dangerTicketCookieOptions(false)).not.toContain("Secure");
  });
});

describe("issue #331 — Server Functions reject a mismatched Origin", () => {
  it("`allowedOrigins` is unset, which is Next's strictest setting rather than its loosest", () => {
    // Next compares a Server Action request's `Origin` against the host and
    // aborts on a mismatch; `serverActions.allowedOrigins` is the list of
    // *extra* origins to forgive. Unset means same-origin and nothing else
    // — so the promise here is that nobody has widened it, and this is what
    // fails if somebody does.
    // (`tests/ui/layout/security-headers.test.ts` proves the refusal itself
    // against the running server.)
    const serverActions = nextConfig.experimental?.serverActions;
    expect(serverActions?.allowedOrigins).toBeUndefined();
  });
});
