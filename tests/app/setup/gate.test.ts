// tests/app/setup/gate.test.ts — BUILD §4.3, issues #36 and #133
//
// The incomplete-setup gate: the redirect matrix over
// complete/incomplete × allow-listed/not, the way out staying reachable
// with setup unfinished, and the same matrix again through the two files
// that enforce it — `src/app/(account)/layout.tsx`, which decides, and
// `src/middleware.ts`, which hands it the path — so the wiring is
// asserted rather than assumed.
//
// **#133 moved the decision off the Edge.** It used to be made in
// `src/middleware.ts`, which cannot name the asking account: the session
// read needs `next/headers`, a `node:crypto` HMAC and a database round
// trip, and that file is bundled for the Edge runtime. So the matrix below
// runs against the layout, and what is asserted of the middleware is that
// it forwards the path, overwrites a client's claim about it, and holds no
// setup knowledge of its own.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// #104: importing `@/middleware` loads the removal reader, and through it
// the database client and the environment bindings it parses at module
// load. The harness applies them, the same way `routes.test.ts` does.
import "../../scan/run/harness";
import { NextRequest } from "next/server";
import {
  APP_PATH,
  GATE_PATH_HEADER,
  SETUP_INCOMPLETE_ALLOWLIST,
  SETUP_PATH,
  isAllowedWhileIncomplete,
  setupRedirectFor,
} from "@/app/(account)/setup/gate";
import type { SetupProgressState } from "@/app/(account)/setup/submit";
import { middleware } from "@/middleware";
import { setIdentityAuth } from "@/lib/account/identity/auth";
import { addAuthUser, fakeIdentityAuth, newFakeAuth, signedInCookie } from "../../account/identity/fake-auth";

/** #468: the middleware asks Supabase (`getUser()`) who a session cookie
 *  belongs to; this is the in-memory double, with one live session. */
const AUTH = newFakeAuth();
addAuthUser(AUTH, { id: "user-1", email: "founder@example.com" });
const SIGNED_IN = signedInCookie(AUTH, "user-1");
beforeEach(() => setIdentityAuth(fakeIdentityAuth(AUTH)));
afterEach(() => setIdentityAuth(null));

/** The request headers the layout reads its path out of. */
const requestHeaders = new Map<string, string>();

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => requestHeaders.get(name) ?? null }),
}));

/** `redirect()` throws in Next, and mirroring that is what proves the
 *  layout renders no children on the way past. */
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

const { resetSetupGateReader, setSetupGateReader } = await import(
  "@/app/(account)/setup/gate-state"
);
const { default: AccountLayout } = await import("@/app/(account)/layout");

const PAID_AT = new Date(Date.UTC(2026, 8, 5, 9, 30, 0));

const INCOMPLETE: SetupProgressState = { complete: false, siteId: "site-1", paidAt: PAID_AT };
const COMPLETE: SetupProgressState = { complete: true, siteId: "site-1", completedAt: PAID_AT };

/** Every app path this product has on disk that is **not** a way out. */
const GATED_PATHS = ["/app", "/app/calendar", "/app/draft/abc", "/api/report/x"] as const;

/** REQ-025 c5's exception, as concrete paths. */
const WAY_OUT = [
  "/app/settings",
  "/api/settings",
  "/api/export",
  "/api/account/session",
  "/api/account/delete",
  "/api/stripe/portal",
] as const;

afterEach(() => {
  resetSetupGateReader();
});

describe("REQ-025 c5 — an incomplete founder is returned to /setup from every app path except the allow-list", () => {
  it.each(GATED_PATHS)("%s redirects to /setup", (path) => {
    expect(setupRedirectFor({ setup: INCOMPLETE, path })).toBe(SETUP_PATH);
  });

  it("a brand-new account route nobody added to the list is gated, not let through", () => {
    expect(
      setupRedirectFor({ setup: INCOMPLETE, path: "/app/some-route-added-after-this-test" })
    ).toBe(SETUP_PATH);
  });

  it("setup's own screens and endpoints are never gated — a gate on the submit would be a loop", () => {
    for (const path of ["/setup", "/setup/waiting", "/api/setup", "/api/setup/domain", "/api/setup/progress"]) {
      expect(setupRedirectFor({ setup: INCOMPLETE, path })).toBeNull();
    }
  });
});

describe('REQ-025 c5 — "no customer who has paid is ever required to complete setup in order to leave"', () => {
  it.each(WAY_OUT)("%s stays reachable with setup unfinished", (path) => {
    expect(isAllowedWhileIncomplete(path)).toBe(true);
    expect(setupRedirectFor({ setup: INCOMPLETE, path })).toBeNull();
  });

  it("cancelling runs the identical path a finished customer's does — the gate never sees it, so there is no setup-aware branch to add later", () => {
    // The discriminating assertion: the gate's answer for the cancel path
    // is the *same value* in both states, so nothing downstream of it can
    // branch on setup at all.
    const path = "/api/stripe/portal";
    expect(setupRedirectFor({ setup: INCOMPLETE, path })).toBe(
      setupRedirectFor({ setup: COMPLETE, path })
    );
    expect(setupRedirectFor({ setup: COMPLETE, path })).toBeNull();
  });

  it("mutation check — dropping /app/settings from the allow-list gates Settings", () => {
    const without = SETUP_INCOMPLETE_ALLOWLIST.filter((entry) => entry !== "/app/settings");
    const stillAllowed = without.some(
      (entry) => entry === "/app/settings" || (entry.endsWith("/*") && "/app/settings".startsWith(entry.slice(0, -1)))
    );
    expect(stillAllowed).toBe(false);
    expect(isAllowedWhileIncomplete("/app/settings")).toBe(true);
  });
});

describe("REQ-025 c4 — a complete founder is taken onward and never re-asked the three", () => {
  it("/setup redirects to /app", () => {
    expect(setupRedirectFor({ setup: COMPLETE, path: SETUP_PATH })).toBe(APP_PATH);
  });

  it("every app path is left alone", () => {
    for (const path of [...GATED_PATHS, ...WAY_OUT]) {
      expect(setupRedirectFor({ setup: COMPLETE, path })).toBeNull();
    }
  });

  it("/setup/waiting is not redirected — the release decision there is the waiting screen's, not the gate's", () => {
    expect(setupRedirectFor({ setup: COMPLETE, path: "/setup/waiting" })).toBeNull();
  });
});

describe("an account the process cannot name is let through, never guessed at", () => {
  it.each([...GATED_PATHS, SETUP_PATH])("%s is not redirected when setup state is unknown", (path) => {
    expect(setupRedirectFor({ setup: null, path })).toBeNull();
  });
});

describe("the allow-list is data, not an `if` repeated per route", () => {
  it("a `/*` entry matches beneath its prefix and never the sibling that merely starts with the same letters", () => {
    expect(isAllowedWhileIncomplete("/api/account/anything/deeper")).toBe(true);
    expect(isAllowedWhileIncomplete("/api/accounts-elsewhere")).toBe(false);
  });

  it("every entry is an absolute path and none carries a query or a wildcard in the middle", () => {
    for (const entry of SETUP_INCOMPLETE_ALLOWLIST) {
      expect(entry.startsWith("/")).toBe(true);
      expect(entry).not.toContain("?");
      expect(entry.replace(/\/\*$/, "")).not.toContain("*");
    }
  });
});

// ── The enforcement point ────────────────────────────────────────────────

/** Renders the `(account)` layout for `path`, and answers where it sent
 *  the request — `null` when it served the screen. */
async function layoutFor(path: string | null): Promise<string | null> {
  requestHeaders.clear();
  if (path !== null) requestHeaders.set(GATE_PATH_HEADER, path);
  try {
    await AccountLayout({ children: null });
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const redirect = /^NEXT_REDIRECT:(.*)$/.exec(message);
    if (redirect === null) throw err;
    return redirect[1] ?? null;
  }
}

describe("src/app/(account)/layout.tsx applies the gate, and holds no setup knowledge of its own", () => {
  beforeEach(() => {
    requestHeaders.clear();
  });

  it("an incomplete founder asking for /app is redirected to /setup", async () => {
    setSetupGateReader(async () => INCOMPLETE);
    expect(await layoutFor("/app")).toBe(SETUP_PATH);
  });

  it.each(GATED_PATHS)("%s is redirected while setup is unfinished", async (path) => {
    setSetupGateReader(async () => INCOMPLETE);
    expect(await layoutFor(path)).toBe(SETUP_PATH);
  });

  it("the same founder asking for Settings is served", async () => {
    setSetupGateReader(async () => INCOMPLETE);
    expect(await layoutFor("/app/settings")).toBeNull();
  });

  it("setup's own screens are served, so the gate is never a loop", async () => {
    setSetupGateReader(async () => INCOMPLETE);
    expect(await layoutFor(SETUP_PATH)).toBeNull();
    expect(await layoutFor("/setup/waiting")).toBeNull();
  });

  it("a complete founder asking for /setup is taken onward to /app", async () => {
    setSetupGateReader(async () => COMPLETE);
    expect(await layoutFor(SETUP_PATH)).toBe(APP_PATH);
  });

  it("a complete founder is never sent back to /setup from anywhere", async () => {
    setSetupGateReader(async () => COMPLETE);
    for (const path of [...GATED_PATHS, ...WAY_OUT, "/setup/waiting"]) {
      expect(await layoutFor(path), path).toBeNull();
    }
  });

  it("an account the process cannot name is let through, never guessed at", async () => {
    setSetupGateReader(async () => null);
    for (const path of [...GATED_PATHS, SETUP_PATH]) {
      expect(await layoutFor(path), path).toBeNull();
    }
  });

  it("a request with no forwarded path is let through, and costs no read at all", async () => {
    const reader = vi.fn(async () => INCOMPLETE);
    setSetupGateReader(reader);
    expect(await layoutFor(null)).toBeNull();
    expect(reader).not.toHaveBeenCalled();
  });
});

function requestTo(path: string, extra?: Record<string, string>): NextRequest {
  const headers = new Headers({ cookie: SIGNED_IN, ...extra });
  return new NextRequest(new Request(`https://reachkit.example${path}`, { headers }));
}

/** What `NextResponse.next({ request: { headers } })` encodes an
 *  overridden request header as, on the way back to Next. */
function forwardedPath(res: Response): string | null {
  return res.headers.get(`x-middleware-request-${GATE_PATH_HEADER}`);
}

describe("src/middleware.ts forwards the path the layout cannot ask for", () => {
  it("an authorised request is served, carrying its own path", async () => {
    const res = await middleware(requestTo("/app"));
    expect(res.status).toBe(200);
    expect(forwardedPath(res)).toBe("/app");
  });

  it.each([...GATED_PATHS, ...WAY_OUT, SETUP_PATH, "/setup/waiting"])(
    "%s is forwarded as itself",
    async (path) => {
      expect(forwardedPath(await middleware(requestTo(path)))).toBe(path);
    }
  );

  it("a client's own claim about the path is overwritten, never trusted", async () => {
    // Without the overwrite this would be the whole gate: send
    // `x-rk-path: /app/settings` with a request for `/app` and the
    // allow-list would wave it through.
    const res = await middleware(requestTo("/app", { [GATE_PATH_HEADER]: "/app/settings" }));
    expect(forwardedPath(res)).toBe("/app");
  });

  it("holds no setup knowledge of its own: it redirects nobody on account of setup", async () => {
    setSetupGateReader(async () => {
      throw new Error("the middleware must not read the gate's state");
    });
    for (const path of [...GATED_PATHS, SETUP_PATH]) {
      expect((await middleware(requestTo(path))).status, path).toBe(200);
    }
  });

  it("a signed-out request is still refused, and carries no forwarded path", async () => {
    const res = await middleware(new NextRequest(new Request("https://reachkit.example/app")));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") ?? "", "https://reachkit.example").pathname).toBe(
      "/signin"
    );
    expect(forwardedPath(res)).toBeNull();
  });

  it("a public route is never gated, however incomplete the founder", async () => {
    setSetupGateReader(async () => INCOMPLETE);
    expect((await middleware(requestTo("/pricing"))).status).toBe(200);
    expect((await middleware(requestTo("/scan/example.com"))).status).toBe(200);
  });
});
