// tests/app/scan-address/report-route.test.ts
//
// BUILD §4.1 (issue #13) — the route's own promises, the ones that carry no
// pixel: the 308 to the one canonical address, `noindex` as both a meta tag
// and an `X-Robots-Tag` header, no session read, no cookie set, and no CDN
// cache.
//
// Two of these are asserted by source rather than by execution, the
// convention `tests/app/scan-address/api-scan.test.ts` already uses for
// route wiring a unit test cannot drive end to end: the redirect is thrown
// by Next's own `permanentRedirect`, and the header is declared in
// `next.config.ts`, which only a running server applies. What *is* executed
// here is the resolution the route delegates to — `canonicalRedirect` and
// `parseDomain` — so the decision the route makes is proved, and only the
// framework call it makes with that decision is read.
// #104: importing `@/middleware` now loads `@/lib/db` (the removal
// rewrite), and through it the environment binding. The fixture goes
// above it.
import "../../scan/run/harness";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalRedirect } from "../../../src/app/(public)/scan/[domain]/_address/canonical.ts";
import { parseDomain } from "../../../src/lib/scan/domain.ts";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const PAGE = readFileSync(
  path.join(ROOT, "src/app/(public)/scan/[domain]/page.tsx"),
  "utf8"
);
const NEXT_CONFIG = readFileSync(path.join(ROOT, "next.config.ts"), "utf8");

describe("REQ-001 c2 — one address per domain, reached by a 308", () => {
  it("the route redirects with `permanentRedirect`, never the 307 default", () => {
    expect(PAGE).toContain("permanentRedirect");
    expect(PAGE).not.toMatch(/\bredirect\(/);
  });

  it("it redirects before any arm resolves, so no arm is ever served at two URLs", () => {
    const redirectAt = PAGE.indexOf("permanentRedirect(");
    const resolveAt = PAGE.indexOf("resolve(raw)");
    expect(redirectAt).toBeGreaterThan(-1);
    expect(resolveAt).toBeGreaterThan(redirectAt);
  });

  it("every written form of one domain reaches one target", () => {
    const forms = ["EXAMPLE.COM", "www.example.com", "example.com.", "example.com:8443"];
    for (const form of forms) {
      expect(canonicalRedirect(form)).toEqual({ redirectTo: "/scan/example.com" });
    }
    expect(canonicalRedirect("example.com")).toBeNull();
  });
});

describe("ADR-002 / REQ-001 c8 — noindex twice over, and in no sitemap", () => {
  it("the route's resolved metadata turns indexing and following off", async () => {
    // Issue #326 moved the directive off this page and onto the route's
    // row in `_seo/routes.ts` — the same row the app host's sitemap reads,
    // so the page and the sitemap can no longer disagree about it. The
    // assertion follows it: the promise is what the route *resolves to*,
    // which is stronger than the spelling it used to be written in.
    const { generateMetadata } = await import(
      "../../../src/app/(public)/scan/[domain]/page.tsx"
    );
    const metadata = await generateMetadata({
      params: Promise.resolve({ domain: "example.com" }),
    });
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(PAGE).not.toMatch(/robots:\s*\{/);
  });

  it("`next.config.ts` declares the X-Robots-Tag header for this path", () => {
    expect(NEXT_CONFIG).toContain('source: "/scan/:domain"');
    expect(NEXT_CONFIG).toContain('key: "X-Robots-Tag"');
    expect(NEXT_CONFIG).toContain("noindex, nofollow");
  });

  it("no sitemap the product publishes can name a report address", async () => {
    // The hosted edge's `/sitemap.xml` (issue #49) is the one route that
    // serves this path, and since issue #326 it answers ReachKit's own
    // host as well as a customer's. Neither arm can name a report: the
    // hosted arm emits only live hosted publications, and the app arm only
    // the `indexable` rows of `_seo/routes.ts`, where the report's is not.
    // The Next file conventions that would create a *second* sitemap at
    // the same address are still absent, which is what keeps that true.
    expect(existsSync(path.join(ROOT, "src/app/sitemap.ts"))).toBe(false);
    expect(existsSync(path.join(ROOT, "src/app/(public)/sitemap.ts"))).toBe(false);
    const { sitemapPaths } = await import("../../../src/app/(public)/_seo/routes.ts");
    expect(sitemapPaths().some((route) => route.startsWith("/scan"))).toBe(false);
  });
});

describe("REQ-001 c6/c10 — no session, no cookie, no gate", () => {
  it("the route reads no session and sets no cookie", () => {
    for (const forbidden of ["cookies(", "hasActiveAccess", "currentSession"]) {
      expect(PAGE).not.toContain(forbidden);
    }
  });

  it("the one request header it reads is `x-forwarded-for`, and it reads it to hash a network key — never to identify a visitor", () => {
    // #104 wired this route to the store, and admission counts a free
    // scan's bounds per network. `networkKeyOf` is BP-023's HMAC and never
    // returns a raw address, so nothing identifying enters this file. The
    // assertion is written as "exactly one header, and it is that one"
    // rather than "no headers at all", which was the shape before the
    // route had anything to resolve.
    const reads = [...PAGE.matchAll(/\.get\("([^"]+)"\)/g)].map((m) => m[1]);
    expect(reads).toEqual(["x-forwarded-for"]);
    expect(PAGE).toContain("networkKeyOf");
  });

  it("`/scan/:domain` is on the middleware's public allow-list, so it is reachable with none", async () => {
    const { PUBLIC_PATHS } = await import("../../../src/middleware.ts");
    expect(PUBLIC_PATHS).toContain("/scan/:domain");
  });
});

describe("WO-282 step 22 — the render is not shared, so it is not cached", () => {
  it("the route declares itself dynamic and un-revalidated", () => {
    expect(PAGE).toMatch(/export const dynamic = "force-dynamic";/);
    expect(PAGE).toMatch(/export const revalidate = 0;/);
  });
});

describe("REQ-001 c4/c5 — a segment that does not parse is an arm, not a 404", () => {
  it("the route calls no `notFound()` on any path", () => {
    expect(PAGE).not.toContain("notFound");
  });

  it("every DomainProblem `parseDomain` can return has a malformed arm to land in", () => {
    const problems = ["", "203.0.113.5", "example", "not a hostname", "a".repeat(300)];
    for (const raw of problems) {
      const parsed = parseDomain(raw);
      expect(parsed.ok).toBe(false);
    }
  });
});

describe("ARCHITECTURE rule 1 — the route is a thin adapter", () => {
  it("it renders no module itself: the only view it names is the state switch", () => {
    expect(PAGE).toContain("AddressView");
    for (const view of ["AiAnswersCard", "ProblemCards", "PricingCard", "VerdictStrip"]) {
      expect(PAGE).not.toContain(view);
    }
  });

  it("it holds no engine logic: no fetch, no SQL, no vendor and no cost seam", () => {
    for (const forbidden of ["fetch(", "dbAdmin", "safeFetch", "withCostContext", "select("]) {
      expect(PAGE).not.toContain(forbidden);
    }
  });
});
