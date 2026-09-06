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
// `middleware()` directly against constructed requests and adds no fixture
// route under `src/app/(account)/`, which keeps holding only WO-002's
// pass-through layout.
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware, PUBLIC_PATHS, config } from "@/middleware";

function requestTo(pathname: string, cookie?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (cookie !== undefined) headers.cookie = cookie;
  return new NextRequest(new URL(pathname, "http://localhost"), { headers });
}

function isDenied(pathname: string, cookie?: string): boolean {
  const res = middleware(requestTo(pathname, cookie));
  return res.status >= 300 && res.status < 400;
}

// ── BP-001 NFR budget row 1 — account requires a session ──────────────────

describe(
  'BP-001 NFR budget: "Authorisation: default-deny. `src/app/(account)/**` requires a session"',
  () => {
    it.each(["/setup", "/app", "/app/overview", "/app/settings"])(
      "%s with no session cookie is denied",
      (pathname) => {
        expect(isDenied(pathname)).toBe(true);
      }
    );

    it("/setup with a session cookie is allowed", () => {
      const res = middleware(requestTo("/setup", "rk_session=a-token"));
      expect(res.status).not.toBeGreaterThanOrEqual(300);
    });
  }
);

// ── BP-001 NFR budget row 2 — the allow-list, not the file, is the boundary ─

describe(
  'BP-001 NFR budget: "`src/app/(public)/**` explicitly declares itself public in one middleware allow-list, so a new account route cannot leak by omission"',
  () => {
    it("a brand-new (account) path named in no allow-list is denied without any edit to this test", () => {
      // No fixture route file exists at this path and none is added by
      // this suite (WO-003 `## Steps` step 3) — middleware matches on the
      // request path alone.
      expect(isDenied("/app/some-route-added-after-this-test-was-written")).toBe(true);
    });

    it("mutation check — every PUBLIC_PATHS entry stays reachable with no session", () => {
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
      };
      expect(Object.keys(instances).sort()).toEqual([...PUBLIC_PATHS].sort());
      for (const pattern of PUBLIC_PATHS) {
        const path = instances[pattern];
        expect(path, `no fixture instance for pattern ${pattern}`).toBeDefined();
        expect(isDenied(path!), `${path} (from ${pattern}) must not be denied`).toBe(false);
      }
    });
  }
);

// ── BP-001 error behaviour — the address prompt reveals nothing ───────────

describe(
  'BP-001 error behaviour: "A signed-out request to `/setup` or `/app` asks for an address and says nothing about whether an account or a payment exists"',
  () => {
    it("both denials redirect to the same address-prompt location", () => {
      const setupRes = middleware(requestTo("/setup"));
      const appRes = middleware(requestTo("/app"));
      expect(setupRes.status).toBe(appRes.status);
      const setupLocation = new URL(setupRes.headers.get("location") ?? "", "http://localhost");
      const appLocation = new URL(appRes.headers.get("location") ?? "", "http://localhost");
      expect(setupLocation.pathname).toBe(appLocation.pathname);
      expect(setupLocation.search).toBe("");
      expect(appLocation.search).toBe("");
    });

    it("carries no distinct status or location for a known-looking versus an unknown-looking address route", () => {
      // This middleware reads no database and holds no notion of "known"
      // versus "unknown" — the assertion is that nothing in the response
      // varies with the requested account path at all.
      const known = middleware(requestTo("/setup?email=founder%40example.com"));
      const unknown = middleware(requestTo("/setup?email=nobody%40example.com"));
      expect(known.status).toBe(unknown.status);
      expect(known.headers.get("location")).toBe(unknown.headers.get("location"));
    });

    it("the redirect body carries no account-existence signal", async () => {
      const res = middleware(requestTo("/app"));
      const text = await res.clone().text();
      expect(text).toBe("");
    });
  }
);

// ── BP-001 decision 1 — every src/app/api/** file is transport-only ───────

describe(
  'BP-001 decision 1 / `structure.md` scope-conflict table: "every `src/app/api/**` file is BP-001\'s and is transport-only"',
  () => {
    it("/api/stripe/webhook is reachable without a session", () => {
      expect(isDenied("/api/stripe/webhook")).toBe(false);
    });

    it.each(["/api/jobs", "/api/jobs/inngest", "/api/jobs/some/nested/slug"])(
      "%s is reachable without a session",
      (pathname) => {
        expect(isDenied(pathname)).toBe(false);
      }
    );

    it("POST /api/scan is reachable without a session — the route this order discharges WO-062's `rests-on` row 1 against", () => {
      const res = middleware(
        new NextRequest(new URL("/api/scan", "http://localhost"), { method: "POST" })
      );
      expect(res.status).not.toBeGreaterThanOrEqual(300);
    });
  }
);

// ── Interfaces — config.matcher is present and covers the app ─────────────

describe("`## Interfaces` — the exported matcher", () => {
  it("config.matcher is a non-empty array of strings", () => {
    expect(Array.isArray(config.matcher)).toBe(true);
    expect(config.matcher.length).toBeGreaterThan(0);
    for (const entry of config.matcher) expect(typeof entry).toBe("string");
  });
});
