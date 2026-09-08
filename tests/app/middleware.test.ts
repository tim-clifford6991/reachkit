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

import { readdirSync } from "node:fs";
import path from "node:path";
import { middleware, PUBLIC_PATHS, config } from "@/middleware";

function requestTo(pathname: string, cookie?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (cookie !== undefined) headers.cookie = cookie;
  return new NextRequest(new URL(pathname, "http://localhost"), { headers });
}

async function isDenied(pathname: string, cookie?: string): Promise<boolean> {
  const res = await middleware(requestTo(pathname, cookie));
  return res.status >= 300 && res.status < 400;
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
  const PUBLIC_DIR = path.resolve(import.meta.dirname, "../../src/app/(public)");

  /** One row per dynamic segment under `(public)`, keyed by its bracket
   *  text. A segment with no row here fails, naming it, rather than being
   *  skipped — the work that adds a dynamic public route adds its row. */
  const SEGMENT_FIXTURES: Readonly<Record<string, string>> = {
    "[domain]": "example.com",
    "[token]": "abc123",
  };

  /** Every routable path under `(public)`, as a URL. Route groups are
   *  parenthesised directories and contribute no segment; a `_private`
   *  directory is not a route at all. */
  function publicRoutes(dir: string, prefix = ""): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && /^(page|route)\.tsx?$/.test(entry.name)) {
        found.push(prefix === "" ? "/" : prefix);
        continue;
      }
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith("_")) continue;
      const segment = entry.name.startsWith("(") ? "" : `/${entry.name}`;
      found.push(...publicRoutes(path.join(dir, entry.name), prefix + segment));
    }
    return found;
  }

  const routes = publicRoutes(PUBLIC_DIR);

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

// ── Interfaces — config.matcher is present and covers the app ─────────────

describe("`## Interfaces` — the exported matcher", () => {
  it("config.matcher is a non-empty array of strings", async () => {
    expect(Array.isArray(config.matcher)).toBe(true);
    expect(config.matcher.length).toBeGreaterThan(0);
    for (const entry of config.matcher) expect(typeof entry).toBe("string");
  });
});
