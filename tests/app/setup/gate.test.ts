// tests/app/setup/gate.test.ts — BUILD §4.3, issue #36
//
// The incomplete-setup gate: the redirect matrix over
// complete/incomplete × allow-listed/not, the way out staying reachable
// with setup unfinished, and the same matrix again through
// `src/middleware.ts` — the enforcement point — so the wiring is asserted
// rather than assumed.
import { afterEach, describe, expect, it } from "vitest";
// #104: importing `@/middleware` loads the removal reader, and through it
// the database client and the environment bindings it parses at module
// load. The harness applies them, the same way `routes.test.ts` does.
import "../../scan/run/harness";
import { NextRequest } from "next/server";
import {
  APP_PATH,
  SETUP_INCOMPLETE_ALLOWLIST,
  SETUP_PATH,
  isAllowedWhileIncomplete,
  resetSetupGateReader,
  setSetupGateReader,
  setupRedirectFor,
} from "@/app/(account)/setup/gate";
import type { SetupProgressState } from "@/app/(account)/setup/submit";
import { middleware } from "@/middleware";

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

function requestTo(path: string): NextRequest {
  const headers = new Headers({ cookie: "rk_session=a-token" });
  return new NextRequest(new Request(`https://reachkit.example${path}`, { headers }));
}

describe("src/middleware.ts applies the gate, and holds no setup knowledge of its own", () => {
  it("an incomplete founder asking for /app is redirected to /setup", async () => {
    setSetupGateReader(async () => INCOMPLETE);
    const res = await middleware(requestTo("/app"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") ?? "", "https://reachkit.example").pathname).toBe(
      SETUP_PATH
    );
  });

  it("the same founder asking for Settings is served", async () => {
    setSetupGateReader(async () => INCOMPLETE);
    expect((await middleware(requestTo("/app/settings"))).status).toBe(200);
  });

  it("a complete founder asking for /setup is taken onward to /app", async () => {
    setSetupGateReader(async () => COMPLETE);
    const res = await middleware(requestTo(SETUP_PATH));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") ?? "", "https://reachkit.example").pathname).toBe(
      APP_PATH
    );
  });

  it("with no readable account — today's answer — nothing is gated at all", async () => {
    for (const path of ["/app", "/app/calendar", SETUP_PATH]) {
      expect((await middleware(requestTo(path))).status).toBe(200);
    }
  });

  it("a signed-out request is still refused before the gate is ever consulted", async () => {
    setSetupGateReader(async () => {
      throw new Error("the gate must not be consulted for a request with no session");
    });
    const res = await middleware(
      new NextRequest(new Request("https://reachkit.example/app"))
    );
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") ?? "", "https://reachkit.example").pathname).toBe(
      "/signin"
    );
  });

  it("a public route is never gated, however incomplete the founder", async () => {
    setSetupGateReader(async () => INCOMPLETE);
    expect((await middleware(requestTo("/pricing"))).status).toBe(200);
    expect((await middleware(requestTo("/scan/example.com"))).status).toBe(200);
  });
});
