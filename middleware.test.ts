import { expect, test } from "vitest";
import { isDevOnlyPath } from "./middleware";

/**
 * Guard for the prod dev-scaffolding gate (P6): `app/design/*` fixture galleries
 * and `app/test-*` pipeline previews render fabricated numbers with no auth and
 * must 404 in production. The middleware chokepoint decides this via
 * isDevOnlyPath — pin exactly which paths it matches so a rename can't silently
 * expose a scaffolding page, and a real route can't get accidentally 404'd.
 */
test("dev-only paths (design galleries + test previews) are matched", () => {
  for (const p of ["/design", "/design/", "/design/reachkit", "/design/app-dashboard", "/test-funnel", "/test-plan-timeline"]) {
    expect(isDevOnlyPath(p)).toBe(true);
  }
});

test("real routes are NOT matched (no false-positive 404s)", () => {
  for (const p of ["/", "/app", "/app/dashboard", "/scan/abc", "/pricing", "/designer", "/tests", "/testimonials", "/api/health"]) {
    expect(isDevOnlyPath(p)).toBe(false);
  }
});
