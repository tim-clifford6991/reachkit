// tests/ui/layout/setup-sticky.test.ts — SPEC §5 (2026-09-20), board Setup1, Setup2 and Setup at canvas v36
//
// **On a phone, each setup step's action is on screen from the first paint to the end of the page.**
//
// The boards draw one 844px phone and cannot show a bar that stays put while
// the page scrolls under it; the designer's note asks for exactly that. So
// this reads the one claim a founder feels: at 390×844, hydrated, the step's
// primary lies wholly inside the viewport before any scroll and again once
// the page is scrolled to its end. One case per route (#1018).
import { describe, expect, it } from "vitest";
import { getBaseURL, getSetupAccountCookie, withPage } from "./browser";

const PHONE = { width: 390, height: 844 } as const;

/** Chromium starts per call (`browser.ts`). */
const PER_ROUTE_BROWSER_MS = 60_000;

/** Each route and the step's one primary on it. */
const ROUTES = [
  { path: "/setup", action: '[data-testid="setup-onwards"]' },
  { path: "/setup?step=check", action: '[data-testid="setup-onwards"]' },
  { path: "/setup?step=publishing", action: '[data-testid="setup-onwards"]' },
  { path: "/setup/connect", action: '[data-testid="check-connection-press"]' },
] as const;

/** Read in the page. Closure-free — `page.evaluate` serialises this function's own text. */
function placed(selector: string): { found: boolean; top: number; bottom: number; viewport: number } {
  const el = document.querySelector(selector);
  const box = el?.getBoundingClientRect();
  return { found: el !== null, top: box?.top ?? -1, bottom: box?.bottom ?? -1, viewport: window.innerHeight };
}

describe("setup's action stays in view at 390×844 on every step", () => {
  for (const route of ROUTES) {
    it(`${route.path}: the action is inside the viewport before and after scrolling to the end`, async () => {
      const baseURL = getBaseURL();
      if (!baseURL) throw new Error("tests/ui/layout/setup-sticky.test.ts: no app server is running");
      const seen = await withPage(
        PHONE.width,
        async (page) => {
          await page.setViewportSize(PHONE);
          await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
          await page.goto(baseURL + route.path, { waitUntil: "load" });
          await page.waitForSelector(route.action);
          const before = await page.evaluate(placed, route.action);
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await page.waitForFunction(
            () => Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1,
          );
          const after = await page.evaluate(placed, route.action);
          return { before, after, url: page.url() };
        },
        { extraHTTPHeaders: { Cookie: getSetupAccountCookie() } },
      );
      // The step was served, not redirected elsewhere.
      expect(new URL(seen.url).pathname).toBe(route.path.split("?")[0]);
      for (const [when, box] of [["before", seen.before], ["after", seen.after]] as const) {
        expect(box.found, `${route.path} ${when}: no action drawn`).toBe(true);
        expect(box.top, `${route.path} ${when}: the action starts above the viewport`).toBeGreaterThanOrEqual(0);
        expect(box.bottom, `${route.path} ${when}: the action ends below the viewport`).toBeLessThanOrEqual(box.viewport + 0.5);
      }
    }, PER_ROUTE_BROWSER_MS);
  }
});
