import { describe, it, expect } from "vitest";
import { APP_NAV, isNavActive, buildBreadcrumbs } from "./nav";

describe("APP_NAV", () => {
  it("lists the six app routes with primary/utility grouping", () => {
    expect(APP_NAV.map((i) => i.href)).toEqual([
      "/app/supply",
      "/app/demand",
      "/app/synthesis",
      "/app/plan",
      "/app/settings",
      "/app/billing",
    ]);
    expect(APP_NAV.filter((i) => i.group === "primary")).toHaveLength(4);
    expect(APP_NAV.filter((i) => i.group === "utility")).toHaveLength(2);
  });
});

describe("isNavActive", () => {
  it("matches the dashboard root only exactly", () => {
    expect(isNavActive("/app", "/app")).toBe(true);
    expect(isNavActive("/app", "/app/supply")).toBe(false);
  });

  it("matches non-root items by prefix (so nested pages stay highlighted)", () => {
    expect(isNavActive("/app/supply", "/app/supply")).toBe(true);
    expect(isNavActive("/app/plan", "/app/plan/content")).toBe(true);
    expect(isNavActive("/app/demand", "/app/supply")).toBe(false);
  });
});

describe("buildBreadcrumbs", () => {
  it("returns a single non-linked Dashboard crumb at the root", () => {
    expect(buildBreadcrumbs("/app")).toEqual([{ label: "Dashboard" }]);
  });

  it("links Dashboard and labels the current known section (no trailing href)", () => {
    expect(buildBreadcrumbs("/app/supply")).toEqual([
      { label: "Dashboard", href: "/app" },
      { label: "Supply" },
    ]);
    expect(buildBreadcrumbs("/app/plan")).toEqual([
      { label: "Dashboard", href: "/app" },
      { label: "Plan" },
    ]);
  });

  it("title-cases an unknown segment as a fallback", () => {
    expect(buildBreadcrumbs("/app/audience")).toEqual([
      { label: "Dashboard", href: "/app" },
      { label: "Audience" },
    ]);
  });
});
