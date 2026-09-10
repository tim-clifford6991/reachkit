// tests/app/middleware.test.ts
//
// WO-003 `## Test plan` — four rows, all quoted verbatim from BP-001, since
// this node carries no requirement of its own and cites, never inherits
// (`## Test plan`'s header note). `src/middleware.ts` is one matcher: it
// denies by default and permits only `PUBLIC_PATHS`, `/api/jobs/*`,
// `/api/stripe/webhook` and Next.js internals (`## File plan`).
//
// The by-omission case (row 2, WO-003 `## Steps` step 3) is a path under
// `(account)` that the allow-list does not name. Next.js matches on the
// request path, not on a route file on disk, so this suite calls
// `await middleware()` directly against constructed requests and adds no fixture
// route under `src/app/(account)/`, which keeps holding only WO-002's
// pass-through layout.
//
// **Issue #405 turned that property from a default into a checked
// invariant.** An address under no segment this product serves now falls
// through to Next's root `not-found.tsx` instead of being denied, so
// "denied unless named" no longer covers a route nobody wrote a row for.
// `GUARDED_SEGMENTS` is the list that draws the line, and the walk of
// `src/app/**` below fails — naming the route — the day a route arrives
// under a segment neither that list nor `PUBLIC_PATHS` covers.
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
// #104 gave this function one narrow database read — the removal rewrite
// for `GET /scan/{domain}` — so importing it now loads `@/lib/db` and
// through it `env.ts`, which parses the environment at module load. The
// fixture is imported above the module under test for that reason; every
// assertion below is still about the allow-list and the cookie.
import "../scan/run/harness";

// The removal rewrite's own read is doubled here: this suite is about the
// allow-list and the cookie, and a database answer is not part of either.
// `tests/app/scan-address/removed-route.test.ts` is where the rewrite's
// behaviour is decided.
vi.mock("@/lib/scan/removal", () => ({ isDomainRemoved: async () => false }));

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { middleware, PUBLIC_PATHS, GUARDED_SEGMENTS, config, isMetadataAsset } from "@/middleware";

function requestTo(pathname: string, cookie?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (cookie !== undefined) headers.cookie = cookie;
  return new NextRequest(new URL(pathname, "http://localhost"), { headers });
}

async function isDenied(pathname: string, cookie?: string): Promise<boolean> {
  const res = await middleware(requestTo(pathname, cookie));
  return res.status >= 300 && res.status < 400;
}

const APP_DIR = path.resolve(import.meta.dirname, "../../src/app");

/** Every routable path under `dir`, as a URL. Route groups are
 *  parenthesised directories and contribute no segment; a `_private`
 *  directory is not a route at all. ADR-010's idiom: the enumerator is the
 *  route tree, so a surface added later is in scope by construction. */
function routesUnder(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && /^(page|route)\.tsx?$/.test(entry.name)) {
      found.push(prefix === "" ? "/" : prefix);
      continue;
    }
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_")) continue;
    const segment = entry.name.startsWith("(") ? "" : `/${entry.name}`;
    found.push(...routesUnder(path.join(dir, entry.name), prefix + segment));
  }
  return found;
}

// ── BP-001 NFR budget row 1 — account requires a session ──────────────────

describe(
  'BP-001 NFR budget: "Authorisation: default-deny. `src/app/(account)/**` requires a session"',
  () => {
    it.each(["/setup", "/app", "/app/overview", "/app/settings"])(
      "%s with no session cookie is denied",
      async (pathname) => {
        expect(await isDenied(pathname)).toBe(true);
      }
    );

    it("/setup with a session cookie is allowed", async () => {
      const res = await middleware(requestTo("/setup", "rk_session=a-token"));
      expect(res.status).not.toBeGreaterThanOrEqual(300);
    });
  }
);

// ── BP-001 NFR budget row 2 — the allow-list, not the file, is the boundary ─

describe(
  'BP-001 NFR budget: "`src/app/(public)/**` explicitly declares itself public in one middleware allow-list, so a new account route cannot leak by omission"',
  () => {
    it("a brand-new (account) path named in no allow-list is denied without any edit to this test", async () => {
      // No fixture route file exists at this path and none is added by
      // this suite (WO-003 `## Steps` step 3) — middleware matches on the
      // request path alone.
      expect(await isDenied("/app/some-route-added-after-this-test-was-written")).toBe(true);
    });

    it("mutation check — every PUBLIC_PATHS entry stays reachable with no session", async () => {
      // Concrete instances of each pattern in `PUBLIC_PATHS`; deleting the
      // deny branch cannot be told apart from this passing, which is why
      // row 1's denial assertions are the discriminating half of the pair.
      const instances: Record<string, string> = {
        "/": "/",
        "/scan/:domain": "/scan/example.com",
        "/api/scan": "/api/scan",
        "/api/scan/:scanId/progress": "/api/scan/abc123/progress",
        "/api/report/:domain/correct": "/api/report/example.com/correct",
        "/api/lead": "/api/lead",
        "/opt-out/:token": "/opt-out/abc123",
        "/pricing": "/pricing",
        "/signin": "/signin",
        // Issue #35 — the route that redeems a sign-in link. It has to be
        // reachable with no session, because having no session is the whole
        // reason its holder is following it.
        "/signin/:token": "/signin/abc123",
        // Issue #144 — the address the `draft-ready` mail's one veto link
        // lands on. Reachable with no session for the same reason: its
        // holder is reading a mail, not the app.
        "/veto/:token": "/veto/abc123",
        // BUILD §9, issue #49 — the hosted edge's two documents. Public on
        // every host: each route resolves the Host itself and answers 404
        // on one it does not serve.
        "/robots.txt": "/robots.txt",
        "/sitemap.xml": "/sitemap.xml",
        // Issue #350 — the three legal pages the footer links to. Public
        // by their own nature: a privacy notice nobody may read is not a
        // notice, and each reaches no store.
        "/privacy": "/privacy",
        "/terms": "/terms",
        "/imprint": "/imprint",
        // Issue #326: the web app manifest, a Next metadata route at the
        // one address the convention allows.
        "/manifest.webmanifest": "/manifest.webmanifest",
      };
      expect(Object.keys(instances).sort()).toEqual([...PUBLIC_PATHS].sort());
      for (const pattern of PUBLIC_PATHS) {
        const path = instances[pattern];
        expect(path, `no fixture instance for pattern ${pattern}`).toBeDefined();
        expect(await isDenied(path!), `${path} (from ${pattern}) must not be denied`).toBe(false);
      }
    });
  }
);

// ── The other direction: a (public) page middleware denies (#350) ─────────

describe('BP-001 NFR budget, the other way round — "`src/app/(public)/**` explicitly declares itself public"', () => {
  // The allow-list stops an *account* route leaking by omission, and the
  // mutation check above holds every row on it reachable. Neither notices
  // the opposite omission: a page that lives under `(public)`, is linked
  // from the public chrome, and is denied because nobody added its row.
  //
  // That is what happened to `/privacy`, `/terms` and `/imprint` — three
  // pages on disk, three footer links, and a 307 to `/signin` for each.
  // So this walks the group rather than naming its members: a new
  // `(public)` page is in scope the day it is written, which is ADR-010's
  // idiom applied to the one list that must never fall behind the tree.
  const PUBLIC_DIR = path.join(APP_DIR, "(public)");

  /** One row per dynamic segment under `(public)`, keyed by its bracket
   *  text. A segment with no row here fails, naming it, rather than being
   *  skipped — the work that adds a dynamic public route adds its row. */
  const SEGMENT_FIXTURES: Readonly<Record<string, string>> = {
    "[domain]": "example.com",
    "[token]": "abc123",
  };

  const routes = routesUnder(PUBLIC_DIR);

  it("the group is actually walked — a rule over nothing is not a rule", () => {
    // The three legal pages, the landing page, pricing, sign-in and its
    // link, the report, opt-out and veto: the count is not pinned, but an
    // empty walk would pass every row below it.
    expect(routes.length).toBeGreaterThan(6);
    expect(routes).toContain("/privacy");
  });

  it("every dynamic segment under (public) has a fixture, named rather than skipped", () => {
    const missing = routes
      .flatMap((route) => route.split("/").filter((s) => s.startsWith("[")))
      .filter((segment) => !(segment in SEGMENT_FIXTURES));
    expect([...new Set(missing)]).toEqual([]);
  });

  it("no (public) route is denied with no session", async () => {
    const denied: string[] = [];
    for (const route of routes) {
      const url = route
        .split("/")
        .map((segment) =>
          segment.startsWith("[") ? (SEGMENT_FIXTURES[segment] ?? segment) : segment
        )
        .join("/");
      if (await isDenied(url === "" ? "/" : url)) denied.push(`${url} (from ${route})`);
    }
    expect(denied).toEqual([]);
  });
});

// ── BP-001 error behaviour — the address prompt reveals nothing ───────────

describe(
  'BP-001 error behaviour: "A signed-out request to `/setup` or `/app` asks for an address and says nothing about whether an account or a payment exists"',
  () => {
    it("both denials redirect to the same address-prompt location", async () => {
      const setupRes = await middleware(requestTo("/setup"));
      const appRes = await middleware(requestTo("/app"));
      expect(setupRes.status).toBe(appRes.status);
      const setupLocation = new URL(setupRes.headers.get("location") ?? "", "http://localhost");
      const appLocation = new URL(appRes.headers.get("location") ?? "", "http://localhost");
      expect(setupLocation.pathname).toBe(appLocation.pathname);
      expect(setupLocation.search).toBe("");
      expect(appLocation.search).toBe("");
    });

    it("carries no distinct status or location for a known-looking versus an unknown-looking address route", async () => {
      // This middleware reads no database and holds no notion of "known"
      // versus "unknown" — the assertion is that nothing in the response
      // varies with the requested account path at all.
      const known = await middleware(requestTo("/setup?email=founder%40example.com"));
      const unknown = await middleware(requestTo("/setup?email=nobody%40example.com"));
      expect(known.status).toBe(unknown.status);
      expect(known.headers.get("location")).toBe(unknown.headers.get("location"));
    });

    it("the redirect body carries no account-existence signal", async () => {
      const res = await middleware(requestTo("/app"));
      const text = await res.clone().text();
      expect(text).toBe("");
    });
  }
);

// ── BP-001 decision 1 — every src/app/api/** file is transport-only ───────

describe(
  'BP-001 decision 1 / `structure.md` scope-conflict table: "every `src/app/api/**` file is BP-001\'s and is transport-only"',
  () => {
    it("/api/stripe/webhook is reachable without a session", async () => {
      expect(await isDenied("/api/stripe/webhook")).toBe(false);
    });

    it.each(["/api/jobs", "/api/jobs/inngest", "/api/jobs/some/nested/slug"])(
      "%s is reachable without a session",
      async (pathname) => {
        expect(await isDenied(pathname)).toBe(false);
      }
    );

    it("POST /api/scan is reachable without a session — the route this order discharges WO-062's `rests-on` row 1 against", async () => {
      const res = await middleware(
        new NextRequest(new URL("/api/scan", "http://localhost"), { method: "POST" })
      );
      expect(res.status).not.toBeGreaterThanOrEqual(300);
    });
  }
);

// ── #405 — an address this product does not have is a 404, not a prompt ──

describe("#405 — an unmatched address falls through to the root 404, signed out and signed in", () => {
  // UI-SPEC S8 and ruling 3a: a stranger who mistypes a ReachKit address is
  // told there is no page there, inside the public header and footer. Before
  // this, every such address was denied along with the guarded ones and
  // answered `307 /signin` — so S8's screen, which issue #372 built, could
  // not be reached by any URL at all.
  const UNMATCHED = [
    "/nonsense",
    // The report *prefix* with no domain after it, and one segment too many
    // after it: neither is a route, and `/scan` is not on `GUARDED_SEGMENTS`.
    "/scan",
    "/scan/example.com/extra",
    // Whole segments, never prefixes: `/appointments` is not `/app`, and
    // `/setuphelp` is not `/setup`.
    "/appointments",
    "/setuphelp",
    "/pricing/plans",
  ];

  it.each(UNMATCHED)("%s is not denied with no session — Next renders the root 404", async (pathname) => {
    expect(await isDenied(pathname)).toBe(false);
  });

  it.each(UNMATCHED)("%s answers a signed-in customer identically", async (pathname) => {
    // The fall-through is decided before the session check, so the screen a
    // stranger and a customer are shown at the same address is the same
    // screen. Anything else would make a 404 a statement about the reader.
    const out = await middleware(requestTo(pathname));
    const inn = await middleware(requestTo(pathname, "rk_session=a-token"));
    expect(out.status).toBe(inn.status);
    expect(out.status).toBeLessThan(300);
    expect(out.headers.get("location")).toBe(null);
    expect(inn.headers.get("location")).toBe(null);
  });

  it("every guarded segment is still denied with no session — the fall-through guards nothing away", async () => {
    const reachable: string[] = [];
    for (const pathname of [
      "/app",
      "/app/nothing-here",
      "/setup",
      "/setup/waiting",
      // Nothing under `/api` is a screen, so an unmatched one is denied like
      // any other: a 404 there would map which endpoints exist.
      "/api/nonsense",
      "/api/drafts",
      // The hosted edge's rewrite targets, requested by path on a ReachKit
      // host. A page of a customer's, served from `reachkit.app`, would be
      // this product speaking on someone else's site.
      "/hosted-page/best-onboarding-tools",
      "/hosted-gone",
    ]) {
      if (!(await isDenied(pathname))) reachable.push(pathname);
    }
    expect(reachable).toEqual([]);
  });

  it("no route on disk falls through — a new account route cannot leak by omission", () => {
    // The by-omission property, restated as a check now that "denied unless
    // named" no longer covers a route nobody named. Every route in the tree
    // must stand under a top-level segment that `GUARDED_SEGMENTS` guards or
    // `PUBLIC_PATHS` declares public; one that stands under neither would be
    // served to a signed-out stranger the day it was written.
    const covered = new Set<string>([
      ...GUARDED_SEGMENTS,
      ...PUBLIC_PATHS.map((pattern) => pattern.split("/")[1] ?? ""),
    ]);
    const routes = routesUnder(APP_DIR);

    // A rule over nothing is not a rule: the whole container is walked, not
    // one group of it.
    expect(routes.length).toBeGreaterThan(15);
    expect(routes).toContain("/app");
    expect(routes).toContain("/privacy");
    expect(routes).toContain("/hosted-gone");

    const uncovered = routes.filter((route) => !covered.has(route.split("/")[1] ?? ""));
    expect(
      [...new Set(uncovered)].sort(),
      "on GUARDED_SEGMENTS in src/middleware.ts, or a PUBLIC_PATHS row"
    ).toEqual([]);
  });

  it("every GUARDED_SEGMENTS row is a segment the container actually serves", () => {
    // The list's other failure mode: a row for a segment that no longer
    // exists guards nothing and reads as though it did. (`api` is
    // deliberately on both lists — `PUBLIC_PATHS` names four whole paths
    // under it, never the segment, so everything else there stays denied.)
    const served = new Set(routesUnder(APP_DIR).map((route) => route.split("/")[1] ?? ""));
    expect(GUARDED_SEGMENTS.filter((segment) => !served.has(segment))).toEqual([]);
  });

  it("the root not-found screen an unmatched address lands on is on disk", () => {
    // A fall-through with no root `not-found.tsx` is Next's own built-in
    // page, which is what #405 found: neither `rk-fallback` nor S8's
    // heading. `tests/app/fallback/screens.test.tsx` is where the screen
    // itself is asserted.
    expect(existsSync(path.join(APP_DIR, "not-found.tsx"))).toBe(true);
  });
});

// ── Interfaces — config.matcher is present and covers the app ─────────────

describe("issue #326 — Next's generated metadata assets under (public) are reachable, and nothing else is", () => {
  // The addresses carry a six-character build-time hash because the files
  // sit inside a route group, so the allow-list matches them by shape. The
  // shape is anchored to the two segments that own an image; the point of
  // the anchor is the last case below.
  const REACHABLE = [
    "/icon",
    "/icon-a1b2c3",
    "/apple-icon-a1b2c3",
    "/opengraph-image-a1b2c3",
    "/opengraph-image-a1b2c3.png",
    "/scan/example.com/opengraph-image-a1b2c3",
  ];

  for (const pathname of REACHABLE) {
    it(`${pathname} is not denied with no session`, async () => {
      expect(isMetadataAsset(pathname)).toBe(true);
      expect(await isDenied(pathname)).toBe(false);
    });
  }

  // A bare "last segment looks like an asset" rule would make the first of
  // these public, and it is not a missing asset: it is the draft screen
  // with a `draftId` that happens to look like one. Under a guarded
  // segment, so the denial is this rule's to lose.
  const DENIED = ["/app/draft/opengraph-image-a1b2c3", "/app/settings/icon", "/setup/apple-icon"];

  for (const pathname of DENIED) {
    it(`${pathname} is still denied with no session`, async () => {
      expect(isMetadataAsset(pathname)).toBe(false);
      expect(await isDenied(pathname)).toBe(true);
    });
  }

  it("the shape is anchored to the two segments that own an image, not to any last segment", () => {
    // Under an unguarded segment #405 lets a path this product does not
    // serve fall through to the 404 rather than to `/signin`, so the
    // discriminating assertion for those is the predicate itself.
    expect(isMetadataAsset("/scan/example.com/deeper/opengraph-image-a1b2c3")).toBe(false);
    expect(isMetadataAsset("/pricing/icon")).toBe(false);
    expect(isMetadataAsset("/opengraph-image-a1b2c3d4")).toBe(false);
    expect(isMetadataAsset("/iconoclast")).toBe(false);
  });
});

describe("`## Interfaces` — the exported matcher", () => {
  it("config.matcher is a non-empty array of strings", async () => {
    expect(Array.isArray(config.matcher)).toBe(true);
    expect(config.matcher.length).toBeGreaterThan(0);
    for (const entry of config.matcher) expect(typeof entry).toBe("string");
  });
});
