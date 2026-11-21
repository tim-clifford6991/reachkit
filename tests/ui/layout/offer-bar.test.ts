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
        // Just past the page's own action (the card's Start, or the hero's submit on /), where the bar shows.
        await page.evaluate(() => {
          const action = document.querySelector("main .btn-primary.btn-lg");
          action?.scrollIntoView({ block: "start" });
          window.scrollBy(0, (action?.getBoundingClientRect().bottom ?? 0) + 1);
        });
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

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
  it(`/ at ${viewport.width}×${viewport.height}: the bar is hidden on load and with the field focused, while the hero's Scan My Site is on screen`, async () => {
    const hidden = () => {
      const bar = document.querySelector<HTMLElement>('[data-testid="offer-bar"]');
      return bar !== null && getComputedStyle(bar).display === "none";
    };
    const at = await withPage(viewport.width, async (page) => {
      await page.setViewportSize(viewport);
      await page.goto(`${getBaseURL()}/`);
      // The bar is attached at the observer's first answer, so it is read only once the observer has seen the hero.
      await page.waitForSelector('[data-testid="offer-bar"]', { state: "attached" });
      const load = await page.evaluate(hidden);
      await page.evaluate(() => document.querySelector<HTMLElement>("main input")?.focus());
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      return { load, focused: await page.evaluate(hidden) };
    });
    expect(at).toEqual({ load: true, focused: true });
  }, 60_000);
}
