import { describe, it, expect } from "vitest";
import { APP_NAV, isNavActive, buildBreadcrumbs } from "./nav";

describe("APP_NAV", () => {
  it("lists the six app routes with primary/utility grouping", () => {
    expect(APP_NAV.map((i) => i.href)).toEqual([
      "/app",
      "/app/channels",
      "/app/plays",
      "/app/feed",
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
    expect(isNavActive("/app", "/app/channels")).toBe(false);
  });

  it("matches non-root items by prefix (so nested pages stay highlighted)", () => {
    expect(isNavActive("/app/channels", "/app/channels")).toBe(true);
    expect(isNavActive("/app/plays", "/app/plays/abc")).toBe(true);
    expect(isNavActive("/app/feed", "/app/channels")).toBe(false);
  });
});

describe("buildBreadcrumbs", () => {
  it("returns a single non-linked Dashboard crumb at the root", () => {
    expect(buildBreadcrumbs("/app")).toEqual([{ label: "Dashboard" }]);
  });

  it("links Dashboard and labels the current known section (no trailing href)", () => {
    expect(buildBreadcrumbs("/app/channels")).toEqual([
      { label: "Dashboard", href: "/app" },
      { label: "Market Report" },
    ]);
    expect(buildBreadcrumbs("/app/plays")).toEqual([
      { label: "Dashboard", href: "/app" },
      { label: "This week's plays" },
    ]);
  });

  it("title-cases an unknown segment as a fallback", () => {
    expect(buildBreadcrumbs("/app/audience")).toEqual([
      { label: "Dashboard", href: "/app" },
      { label: "Audience" },
    ]);
  });
});
