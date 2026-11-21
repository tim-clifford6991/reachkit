// The phone offer bar on the landing, Pricing and the report covers no footer link and no focused link, at 320 and 390, with a refused checkout too; its page names one "Offer".
import AxeBuilder from "@axe-core/playwright";
import { expect, it } from "vitest";
import { getBaseURL, withPage } from "./browser";

const PAGES = ["/", "/pricing", "/pricing?checkout=refused", "/scan/example.com", "/scan/example.com?checkout=refused"] as const;

/** Read in the page. Closure-free: `page.evaluate` serialises its text. */
function measure() {
  const bar = document.querySelector<HTMLElement>('[data-testid="offer-bar"]');
  const root = getComputedStyle(document.documentElement);
  const links = document.querySelectorAll<HTMLElement>('[data-testid="public-footer"] a');
  const last = links[links.length - 1];
  return {
    shown: bar !== null && getComputedStyle(bar).display !== "none",
    bar: bar?.offsetHeight ?? 0,
    reserve: Number.parseFloat(root.paddingBottom),
    scrollPad: Number.parseFloat(root.scrollPaddingBottom),
    lastLinkBottom: last?.getBoundingClientRect().bottom ?? Infinity,
    height: window.innerHeight,
  };
}

for (const width of [320, 390]) {
  for (const path of PAGES) {
    it(`${path} at ${width}: the foot reserve and the scroll padding are never shorter than the bar, and the last footer link sits above it`, async () => {
      const at = await withPage(width, async (page) => {
        await page.setViewportSize({ width, height: 700 });
        await page.goto(`${getBaseURL()}${path}`);
        // Past the card's Start, where the bar shows.
        await page.evaluate(() => document.querySelector("main .btn-primary")?.scrollIntoView({ block: "end" }));
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.5));
        await page.waitForSelector('[data-testid="offer-bar"]:not(.hidden)', { timeout: 10_000 });
        const middle = await page.evaluate(measure);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const foot = await page.evaluate(measure);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('[data-testid="public-footer"] a')).at(-1)?.focus());
        const focused = await page.evaluate(measure);
        const landmarks = (await new AxeBuilder({ page }).withRules(["landmark-unique"]).analyze()).violations;
        return { middle, foot, focused, landmarks };
      });
      expect(at.middle.shown, "the bar did not show past the card").toBe(true);
      expect(at.middle.reserve, "the foot reserve is shorter than the bar").toBeGreaterThanOrEqual(at.middle.bar);
      expect(at.middle.scrollPad, "the scroll padding is shorter than the bar").toBeGreaterThanOrEqual(at.middle.bar);
      for (const read of [at.foot, at.focused]) {
        expect(read.lastLinkBottom, "the bar covers the last footer link").toBeLessThanOrEqual(read.height - at.middle.bar);
      }
      expect(at.landmarks).toEqual([]);
    }, 60_000);
  }
}
