/**
 * Regression guard: clicking "Add product" → /app/add must RENDER the add-mode
 * overlay, not a blank page. The lazy wrapper's surface-exemption is a FIRST-RUN
 * behaviour; it once short-circuited to null on /app/add for EVERY mode, so the
 * unified add-mode overlay never mounted (shipped blank, 2026-07-28).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";

let mockPath = "/app/add";
vi.mock("next/navigation", () => ({ usePathname: () => mockPath }));
// Stub the dynamic import so the test exercises the wrapper's null-vs-render
// logic, not the heavy overlay tree.
vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => function Stub() { return <div data-testid="overlay" />; },
}));

import { SetupOverlayLazy } from "./setup-overlay-lazy";

const props = {
  domain: null,
  icpSignals: [] as string[],
  apps: [] as { id: string; name: string }[],
  activeAppId: null,
};

describe("SetupOverlayLazy surface exemption", () => {
  it("mode=add renders the overlay on /app/add (not a blank page)", () => {
    mockPath = "/app/add";
    expect(renderToStaticMarkup(<SetupOverlayLazy mode="add" {...props} />)).toContain("overlay");
  });

  it("first-run overlay still steps aside on /app/add and /app/settings", () => {
    for (const p of ["/app/add", "/app/settings"]) {
      mockPath = p;
      expect(renderToStaticMarkup(<SetupOverlayLazy mode="first-run" {...props} />)).toBe("");
    }
  });

  it("first-run overlay renders on a normal blocking page", () => {
    mockPath = "/app/dashboard";
    expect(renderToStaticMarkup(<SetupOverlayLazy mode="first-run" {...props} />)).toContain("overlay");
  });
});
