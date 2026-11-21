// SPEC §7 *This week* (WCAG 2.4.3, 2.4.11): on a phone the open pane holds the focus. Tab and Shift+Tab never leave it
// for the dock, the top bar or the cards behind it, every live region (the answers to Stop) stays announced (WCAG 4.1.3),
// and Back returns focus to the card that opened it.
import type { Page } from "playwright";
import { expect, it } from "vitest";
import { getAccountCookie, getBaseURL, withPage } from "./browser";
import { settleForMeasurement } from "./no-overflow";

const PANE = '[data-testid="day-panel"]';

const inPane = (page: Page) => page.evaluate((pane) => document.activeElement?.closest(pane) !== null, PANE);

it.each(["light", "dark"] as const)("/app/calendar at 390 in %s: the open pane holds the focus, and Back returns it", async (theme) => {
  const found = await withPage(390, async (page) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto(`${getBaseURL()}/app/calendar`);
    await settleForMeasurement(page);
    const card = page.locator('[data-testid="calendar-week"] > li').first();
    const day = await card.getAttribute("data-testid");
    await card.locator("button").first().click();
    await page.locator(PANE).waitFor();
    await page.waitForFunction((pane) => document.activeElement?.closest(pane) !== null, PANE);
    const live = await page.evaluate((pane) => {
      const regions = Array.from(document.querySelectorAll("[aria-live], [data-sonner-toaster], next-route-announcer")).filter((el) => el.closest(pane) === null);
      return { outside: regions.length, held: regions.filter((el) => el.closest("[inert]") !== null).length };
    }, PANE);
    const stays: boolean[] = [];
    for (const key of ["Tab", "Shift+Tab"]) {
      for (let press = 0; press < 20; press += 1) {
        await page.keyboard.press(key);
        stays.push(await inPane(page));
      }
    }
    await page.locator('[data-testid="day-panel-close"]').click();
    await page.waitForFunction((pane) => document.querySelector(pane) === null, PANE);
    await page.waitForFunction((li) => document.activeElement?.closest("li")?.getAttribute("data-testid") === li, day);
    return { live, left: stays.filter((inside) => !inside).length, back: await page.evaluate(() => document.activeElement?.closest("li")?.getAttribute("data-testid") ?? null), day };
  }, { extraHTTPHeaders: { Cookie: getAccountCookie() } });
  expect(found.live.outside).toBeGreaterThan(0);
  expect(found.live.held).toBe(0);
  expect(found.left).toBe(0);
  expect(found.back).toBe(found.day);
}, 60_000);
