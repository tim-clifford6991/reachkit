/** @vitest-environment jsdom */
// tests/app/overview/tabs.test.tsx — SPEC §4 (2026-09-20): Overview has four
// tabs, and every part of the Overview tab opens the tab behind it.
//
// What a customer can do, decided here: land on Overview after sign-in, see
// the four tabs with the one they are on marked, and reach the screen behind
// any of the three numbers by clicking the number. The three tabs this issue
// only opens an address for say, in words, that they are not built — a
// skeleton with no sentence beside it would be a screen pretending to load.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import OverviewPage from "@/app/(account)/app/(tabs)/page";
import OverviewTabsLayout from "@/app/(account)/app/(tabs)/layout";
import { OVERVIEW_TABS, TAB_HREF } from "@/app/(account)/app/_overview/tabs";
import { resetAccount, signedInAs } from "../account-door";

// The tab bar reads the pathname to mark the tab the customer is on; it is a
// client component for that one reason, exactly as `SidebarNav` is.
const pathname = vi.hoisted(() => ({ value: "/app" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

beforeEach(() => {
  pathname.value = "/app";
  signedInAs();
});
afterEach(() => resetAccount());

const SRC = path.resolve(import.meta.dirname, "../../../src");
const TABS_DIR = path.join(SRC, "app/(account)/app/(tabs)");

function frame(children: React.ReactNode): string {
  return renderToStaticMarkup(OverviewTabsLayout({ children }));
}

describe("SPEC §4 — four tabs, each its own address", () => {
  it("the bar carries all four, in order, as links", () => {
    const html = frame(null);
    for (const tab of OVERVIEW_TABS) {
      expect(html, `missing the ${tab} tab`).toContain(`href="${TAB_HREF[tab]}"`);
    }
    const order = OVERVIEW_TABS.map((tab) => html.indexOf(`data-testid="overview-tab-${tab}"`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((at) => at >= 0)).toBe(true);
  });

  it("the tab the customer is on is the current one, and only it", () => {
    pathname.value = TAB_HREF.rivals;
    const html = frame(null);
    expect(html.split('aria-current="page"').length - 1).toBe(1);
    expect(html).toMatch(/data-testid="overview-tab-rivals"[^>]*aria-current="page"/);
  });

  it("Overview is matched exactly — its address is the prefix of the other three", () => {
    pathname.value = TAB_HREF.search;
    const html = frame(null);
    expect(html).not.toMatch(/data-testid="overview-tab-overview"[^>]*aria-current="page"/);
  });

  it("every tab route sits under the group, so all four share the one bar", () => {
    for (const tab of OVERVIEW_TABS) {
      const file =
        tab === "overview"
          ? path.join(TABS_DIR, "page.tsx")
          : path.join(TABS_DIR, TAB_HREF[tab].replace("/app/", ""), "page.tsx");
      expect(() => readFileSync(file, "utf8"), `${tab} has no page under (tabs)`).not.toThrow();
    }
  });
});

describe("SPEC §4 — every part of the Overview tab opens the tab behind it", () => {
  it("each counting tile is a link into the screen that holds its items (issue 1457)", async () => {
    const html = renderToStaticMarkup(await OverviewPage());
    for (const [testId, tab] of [
      ["overview-tile-google", "search"],
      ["overview-tile-ai", "ai_answers"],
    ] as const) {
      // Either attribute order: `next/link` writes `href` last (issue 1484).
      const tile = new RegExp(`<a(?=[^>]*href="${TAB_HREF[tab]}[?#][^"]*")(?=[^>]*data-testid="${testId}")[^>]*>`);
      expect(html, `${testId} does not open ${TAB_HREF[tab]}`).toMatch(tile);
    }
  });

  it("this week opens the plan", async () => {
    const html = renderToStaticMarkup(await OverviewPage());
    expect(html).toContain('href="/app/calendar"');
  });
});

// There is no "a tab with an address and not yet a screen" describe here
// any more: #916 built Search, #918 AI answers and #917 Rivals, and the
// placeholder, its copy key and its type went with the last of them. The
// bar's four links are asserted above, and what each tab states is its own
// suite's (`search-*`, `answers-*`, `rivals-*`).
