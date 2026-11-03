// Boards PubToolMeta, PubToolOnPage and Legal at 390: each tool's breadcrumb link and each
// Privacy · Terms · Imprint tab is a 44px target, measured in a real browser.
import { describe, expect, it } from "vitest";
import { getBaseURL, withPage } from "./browser";
import { settleForMeasurement, STILL } from "./no-overflow";

const ROUTES = [
  { path: "/tools/meta-preview", targets: "main nav.breadcrumbs a", count: 1 },
  { path: "/tools/on-page-check", targets: "main nav.breadcrumbs a", count: 1 },
  { path: "/privacy", targets: "main nav .tabs a", count: 3 },
  { path: "/terms", targets: "main nav .tabs a", count: 3 },
  { path: "/imprint", targets: "main nav .tabs a", count: 3 },
] as const;

describe("the tools' breadcrumbs and the legal switch at 390", () => {
  it.each(ROUTES)("$path: every target is at least 44px tall", async ({ path, targets, count }) => {
    const baseURL = getBaseURL();
    if (!baseURL) throw new Error("tests/ui/layout/tools-legal-targets.test.ts: no app server is running");
    const heights = await withPage(390, async (page) => {
      await page.goto(`${baseURL}${path}`);
      await page.addStyleTag({ content: STILL });
      await settleForMeasurement(page);
      return page.$$eval(targets, (els) => els.map((el) => el.getBoundingClientRect().height));
    });
    expect(heights).toHaveLength(count);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  }, 120_000);
});
