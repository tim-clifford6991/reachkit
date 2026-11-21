// SPEC *Site fixes and Costs* (WCAG 2.4.3, 4.1.3): at 1280×800 Site Fixes fits with no page scroll, a chosen fix is
// announced and marked current; on a phone a row's fix takes the list's place, takes the focus, and Back returns it.
import type { Page } from "playwright";
import { expect, it } from "vitest";
import { getAccountCookie, getBaseURL, withPage } from "./browser";
import { settleForMeasurement } from "./no-overflow";

const ROWS = '[data-testid="fix-rows"] a';
const DETAIL = '[data-testid="fix-detail"]';
const shown = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el !== null && getComputedStyle(el).display !== "none";
  }, selector);

it("/app/issues at 1280×800: one screen, and the chosen fix is current and announced", async () => {
  const found = await withPage(1280, async (page) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${getBaseURL()}/app/issues`);
    await settleForMeasurement(page);
    const scrolls = await page.evaluate(() => document.scrollingElement!.scrollHeight > window.innerHeight);
    const second = page.locator(ROWS).nth(1);
    const name = (await second.locator(".font-semibold").textContent()) ?? "";
    await second.click();
    await page.waitForFunction((n) => document.querySelector('[aria-live="polite"] h2')?.textContent === n, name);
    return { scrolls, name, current: await second.getAttribute("aria-current"), currents: await page.locator(`${ROWS}[aria-current]`).count(), url: page.url() };
  }, { extraHTTPHeaders: { Cookie: getAccountCookie() } });
  expect(found.scrolls).toBe(false);
  expect(found.current).toBe("true");
  expect(found.currents).toBe(1);
  expect(new URL(found.url).searchParams.get("fix")).not.toBeNull();
}, 60_000);

it.each(["light", "dark"] as const)("/app/issues at 390 in %s: a row opens its fix in the list's place, and Back returns focus", async (theme) => {
  const found = await withPage(390, async (page) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto(`${getBaseURL()}/app/issues`);
    await settleForMeasurement(page);
    const before = { list: await shown(page, '[data-testid="fix-list"]'), detail: await shown(page, DETAIL) };
    const row = page.locator('[data-testid^="fix-row-"]').nth(1);
    const id = await row.getAttribute("data-testid");
    await row.locator("a").click();
    await page.waitForFunction(() => document.activeElement?.id === "fix-name");
    const open = { list: await shown(page, '[data-testid="fix-list"]'), detail: await shown(page, DETAIL) };
    await page.locator('[data-testid="fix-back"]').click();
    await page.waitForFunction((li) => document.activeElement?.closest("li")?.getAttribute("data-testid") === li, id);
    return { before, open, after: await shown(page, DETAIL) };
  }, { extraHTTPHeaders: { Cookie: getAccountCookie() } });
  expect(found.before).toEqual({ list: true, detail: false });
  expect(found.open).toEqual({ list: false, detail: true });
  expect(found.after).toBe(false);
}, 60_000);
