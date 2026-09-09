// tests/ui/layout/routes.test.ts
//
// WO-269 `## Test plan`, quoting BP-018 `## NFR budget` and ADR-093
// decision 2: "`tests/ui/layout/**` enumerates routes from the App Router
// tree and renders each at five widths — 320, the three bands, and each
// boundary minus one pixel" and "**320 CSS px and above**." Exercises
// `enumerateRoutes` and `widths()` against a fixture tree, never the real
// `src/app` (which holds no route today).
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BAND_MIN } from "@/ui/layout/bands";
import { SESSION_COOKIE_NAME } from "@/lib/account/identity/addresses";
import {
  ACCOUNT_SESSION_COOKIE,
  enumerateRoutes,
  MissingRouteFixtureError,
  urlFor,
  visitorPath,
} from "./routes";
import { widths } from "./widths";

let tmpRoot: string | undefined;

function makePage(...segments: string[]): string {
  const dir = path.join(tmpRoot!, ...segments);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "page.tsx");
  writeFileSync(file, "export default function Page() { return null; }\n");
  return file;
}

afterEach(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
  tmpRoot = undefined;
});

describe("enumerateRoutes — a route group is stripped", () => {
  it("(marketing)/about/page.tsx enumerates as /about", () => {
    tmpRoot = mkdtempSync(path.join(os.tmpdir(), "wo-269-routes-"));
    makePage("(marketing)", "about");

    const routes = enumerateRoutes(tmpRoot);
    expect(routes).toEqual([{ path: "/about" }]);
  });
});

describe("enumerateRoutes — a dynamic segment with a fixture row resolves", () => {
  it("blog/[slug]/page.tsx resolves to the fixture value", () => {
    tmpRoot = mkdtempSync(path.join(os.tmpdir(), "wo-269-routes-"));
    makePage("blog", "[slug]");

    const routes = enumerateRoutes(tmpRoot, {
      segmentFixtures: { "[slug]": "hello-world" },
    });
    expect(routes).toEqual([{ path: "/blog/hello-world" }]);
  });
});

describe("enumerateRoutes — a dynamic segment with no fixture row fails, naming the route", () => {
  it("things/[id]/page.tsx throws MissingRouteFixtureError naming the file", () => {
    tmpRoot = mkdtempSync(path.join(os.tmpdir(), "wo-269-routes-"));
    const file = makePage("things", "[id]");
    const expectedName = path.relative(process.cwd(), file).split(path.sep).join("/");

    expect(() => enumerateRoutes(tmpRoot!)).toThrow(MissingRouteFixtureError);
    try {
      enumerateRoutes(tmpRoot!);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(MissingRouteFixtureError);
      expect((err as Error).message).toContain(expectedName);
    }
  });
});

describe("enumerateRoutes — an (account) page carries its session cookie", () => {
  it("(account)/app/page.tsx carries ACCOUNT_SESSION_COOKIE and strips the group", () => {
    tmpRoot = mkdtempSync(path.join(os.tmpdir(), "wo-269-routes-"));
    makePage("(account)", "app");

    expect(enumerateRoutes(tmpRoot)).toEqual([
      { path: "/app", cookie: ACCOUNT_SESSION_COOKIE },
    ]);
  });

  it("a public route carries no cookie at all — the header is sent to nobody else", () => {
    tmpRoot = mkdtempSync(path.join(os.tmpdir(), "wo-269-routes-"));
    makePage("(public)", "pricing");

    expect(enumerateRoutes(tmpRoot)).toEqual([{ path: "/pricing" }]);
  });

  it("the cookie names the one cookie src/middleware.ts reads", () => {
    // The middleware checks presence only, so the value is a fixture; the
    // *name* is the contract, and a rename there without one here would
    // silently sweep the sign-in redirect instead of the account screen.
    //
    // Since issue #35 that name has exactly one home — the zero-import
    // module both this file and `src/middleware.ts` read it from — so the
    // assertion is that they are the same value, and that the middleware
    // still takes it from there rather than re-spelling it.
    const [name] = ACCOUNT_SESSION_COOKIE.split("=");
    expect(name).toBe(SESSION_COOKIE_NAME);

    const middleware = readFileSync(
      path.resolve(__dirname, "../../../src/middleware.ts"),
      "utf8"
    );
    expect(middleware).toContain("SESSION_COOKIE_NAME");
    expect(middleware).toContain("@/lib/account/identity/addresses");
  });
});

describe("enumerateRoutes — a (hosted) page carries its Host", () => {
  it("(hosted)/page.tsx carries the Host fixture and strips the group from the URL", () => {
    tmpRoot = mkdtempSync(path.join(os.tmpdir(), "wo-269-routes-"));
    const file = makePage("(hosted)");
    const key = path.relative(process.cwd(), file).split(path.sep).join("/");

    const routes = enumerateRoutes(tmpRoot, {
      hostFixtures: { [key]: "content.example.com" },
    });
    expect(routes).toEqual([{ path: "/", host: "content.example.com" }]);
  });

  it("fails naming the route when a (hosted) page has no Host fixture row", () => {
    tmpRoot = mkdtempSync(path.join(os.tmpdir(), "wo-269-routes-"));
    makePage("(hosted)");

    expect(() => enumerateRoutes(tmpRoot!)).toThrow(MissingRouteFixtureError);
  });
});

describe("visitorPath — a (hosted) route is swept at the address a visitor types (#418)", () => {
  it("drops the prefix the middleware rewrites into, and leaves every other path alone", () => {
    expect(visitorPath("/hosted-page/best-onboarding-tools")).toBe("/best-onboarding-tools");
    expect(visitorPath("/app/settings")).toBe("/app/settings");
    // Not a prefix match on the bare segment: `/hosted-pages/x` is somebody
    // else's route and keeps its whole path.
    expect(visitorPath("/hosted-pages/x")).toBe("/hosted-pages/x");
  });

  it("urlFor sends a (hosted) route to the customer's own address on the customer's own Host", () => {
    expect(
      urlFor("http://localhost:4321", {
        path: "/hosted-page/best-onboarding-tools",
        host: "content.publisher.test",
      })
    ).toBe("http://content.publisher.test:4321/best-onboarding-tools");
    // Every other route is untouched: no host, no rewriting.
    expect(urlFor("http://localhost:4321", { path: "/pricing" })).toBe(
      "http://localhost:4321/pricing"
    );
  });

  it("the prefix it drops is the one src/middleware.ts prepends", () => {
    // `routes.ts` restates the middleware's module-private constant rather
    // than importing an Edge-bundled module into a test. Restated is fine;
    // drifted is a sweep that photographs 404s again and says nothing —
    // which is exactly what #418 found, eleven issues after it started.
    const middleware = readFileSync(path.resolve(__dirname, "../../../src/middleware.ts"), "utf8");
    expect(middleware).toContain('const HOSTED_PAGE_PREFIX = "/hosted-page";');
    expect(middleware).toContain("`${HOSTED_PAGE_PREFIX}${pathname}`");
    const routes = readFileSync(path.resolve(__dirname, "routes.ts"), "utf8");
    expect(routes).toContain('const HOSTED_REWRITE_PREFIX = "/hosted-page";');
  });
});

describe("widths() — ADR-093 decision 6's five widths", () => {
  it("returns exactly [320, medium-1, medium, wide-1, wide]", () => {
    expect(widths()).toEqual([
      320,
      BAND_MIN.medium - 1,
      BAND_MIN.medium,
      BAND_MIN.wide - 1,
      BAND_MIN.wide,
    ]);
  });

  it("BAND_MIN.compact is 320 (ADR-093 decision 2)", () => {
    expect(BAND_MIN.compact).toBe(320);
  });
});
