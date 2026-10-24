// tests/ui/layout/scans-phone.test.ts — SPEC §2 2026-10-10 (owner, issue 1377)
//
// On a phone `/scans` shows scan cards, on load and while scrolling. The
// sticky toolbar's chips wrapped, so production's fifty categories made it
// 1,550px tall at 390×844 and no card was ever on screen — and the sweep
// passed, since nothing was wider than its box. The filter is now the six
// kinds of business, still one row however many categories `seed.ts` lists.
import { expect, it } from "vitest";
import { BUSINESS_KIND_NAMES } from "@/lib/market/kinds";
import { getBaseURL, withPage } from "./browser";

/** The phone in the owner's report. */
const PHONE = { width: 390, height: 844 } as const;

/** Read in the page. Closure-free: `page.evaluate` serialises its text. */
function measure() {
  const bar = document.querySelector('[data-testid="gallery-toolbar"]');
  const box = bar?.getBoundingClientRect() ?? { top: 0, bottom: 0 };
  const cards = Array.from(document.querySelectorAll('[data-testid="gallery-cards"] > li')).map((card) => card.getBoundingClientRect());
  const words = (selector: string) => Array.from(bar?.querySelectorAll(selector) ?? []).map((el) => el.textContent ?? "");
  return {
    toolbar: { top: box.top, height: box.bottom - box.top },
    /** The cards wholly on screen under the toolbar. */
    cardsShown: cards.filter((card) => card.top >= box.bottom && card.bottom <= window.innerHeight).length,
    chips: words("nav > ul a").length,
  };
}

it("issue 1377 — /scans at 390×844 shows a card on load and while scrolling, under a toolbar of bounded size", async () => {
  const [load, scrolled] = await withPage(PHONE.width, async (page) => {
    await page.setViewportSize(PHONE);
    await page.goto(`${getBaseURL()}/scans`);
    const first = await page.evaluate(measure);
    await page.evaluate(() => window.scrollTo(0, 900));
    return [first, await page.evaluate(measure)];
  });
  expect(load.cardsShown, "no whole card on screen on load").toBeGreaterThanOrEqual(1);
  // Stuck under the 64px header, two rows tall however many categories.
  expect(scrolled.toolbar.top, "the toolbar is not stuck").toBeLessThan(80);
  expect(scrolled.toolbar.height, "the toolbar grew past two rows").toBeLessThanOrEqual(120);
  expect(scrolled.cardsShown, "no whole card on screen while scrolling").toBeGreaterThanOrEqual(1);
  // *All* and one chip per kind of business.
  expect(load.chips).toBe(BUSINESS_KIND_NAMES.length + 1);
}, 60_000);
