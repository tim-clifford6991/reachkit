// The landing hero's line draws, once it is about to be read (issue #988).
//
// **Why this file exists.** `/` carries a 200 kB script budget
// (`WEB_VITALS_BUDGET.LANDING_SCRIPT_KB`, #332) whose floor — react-dom, the
// app-router runtime, the two React runtimes and Turbopack's — is already
// 131 kB, and Recharts is 119 865 B on its own. So `_landing/HeroLine.tsx`
// holds the chart's box open and fetches its code when the line is about to
// enter the viewport. `vitals.test.ts` is what keeps that honest from the
// budget's side.
//
// From the *drawing's* side it costs this: the hero's line is no longer in
// the page's server render, so `landing-s1.test.tsx`, which reads that
// render, cannot see it any more, and the sweep's own `charts-are-drawn`
// check walks the `.recharts-wrapper` elements a page has — of which an
// unmounted chart has none. A chart nothing asserts is a chart that can
// quietly stop drawing, and the owner's ruling of 2026-09-21 (#935) puts a
// line in that card. This is where it is asserted instead: a real browser,
// the real page, scrolled to the card the way a reader scrolls to it.
//
// One width, not three. What this proves is that the deferral resolves and
// Recharts paints — a fact about the mechanism, not about the layout, and
// the layout of this very chart at all three widths is what the sweep
// already measures the moment it is on screen.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BAND_MIN } from "@/ui/layout/bands";
import { getBaseURL, withPage } from "./browser";
import { RECHARTS_CLASS } from "./no-overflow";
import { enumerateRoutes, headersFor, urlFor as routeUrl } from "./routes";

const APP_ROOT = path.resolve(__dirname, "../../../src/app");
const LANDING_PATH = "/";
/** The hero card, by the test id `InsideReachKit.tsx` binds. */
const HERO = '[data-testid="landing-inside"]';
/** *Your score*, the second of the preview's four tabs (#1067). */
const SCORE_TAB = `${HERO} [role="tab"] >> nth=1`;
/** Chromium starts per call (`browser.ts`); the sweep's own bound. */
const PER_ROUTE_BROWSER_MS = 60_000;
/** Long enough for one same-origin chunk over loopback, short enough that a
 *  chart that never mounts fails rather than hangs. */
const CHART_MS = 20_000;
/** Longer than `SERIES_DRAW`'s 1.4s, so a draw that ran would be caught
 *  mid-way at the first read and finished at the second. */
const DRAW_MS = 1_600;

describe("#988 — the hero's Recharts line draws when the reader opens it", () => {
  it(
    "the card's chart mounts on scroll, with its surface and its readings",
    async () => {
      const baseURL = getBaseURL();
      if (!baseURL) {
        throw new Error(
          "tests/ui/layout/landing-chart.test.ts: the layout run started no server, so there is " +
            "nothing to open."
        );
      }
      const routes = enumerateRoutes(APP_ROOT, {});
      const route = routes.find((r) => r.path === LANDING_PATH && r.host === undefined);
      if (!route) {
        throw new Error("tests/ui/layout/landing-chart.test.ts: / is not in the route tree");
      }

      await withPage(
        BAND_MIN.wide,
        async (page) => {
          await page.goto(routeUrl(baseURL, route));

          // Before the scroll the box is held open and nothing is drawn in
          // it — which is the whole of what the budget buys.
          expect(await page.locator(`${HERO} .${RECHARTS_CLASS.wrapper}`).count()).toBe(0);
          expect(await page.locator(`${HERO} .skeleton`).count()).toBeGreaterThan(0);

          // The reader arrives at the card and opens *Your score* — the
          // tab the line sits in since #1067. The layout run asks for
          // reduced motion, so the preview never turns there by itself.
          await page.locator(HERO).scrollIntoViewIfNeeded();
          await page.locator(SCORE_TAB).click();

          const surface = page.locator(`${HERO} svg.${RECHARTS_CLASS.surface}`).first();
          await surface.waitFor({ state: "attached", timeout: CHART_MS });
          const box = await surface.boundingBox();
          expect(box, "the hero's chart mounted but drew nothing").not.toBeNull();
          expect(box?.width ?? 0).toBeGreaterThan(1);
          expect(box?.height ?? 0).toBeGreaterThan(1);

          // It is the product's own `GrowthLine` and not some other chart:
          // its readings are written out as a list beside the drawing, one
          // per week, which is what a screen reader is given.
          const readings = await page.locator(`${HERO} figure ul.sr-only > li`).allInnerTexts();
          expect(readings.length, "the line drew no readings list").toBeGreaterThan(1);
          expect(readings.at(-1)).toContain("47");

          // Reduced motion draws the final state (#1065). `withPage` opens
          // every page as a reader who asked for no motion; the series then
          // must not reveal itself over the 1.4s draw a moving reader gets —
          // what is on screen the moment it mounts is what is there after.
          const area = page.locator(`${HERO} .recharts-area`).first();
          const atMount = await area.innerHTML();
          expect(atMount, "the line drew no curve").toContain("recharts-area-curve");
          await page.waitForTimeout(DRAW_MS);
          expect(await area.innerHTML(), "the line was still drawing under reduced motion").toBe(atMount);
        },
        headersFor(route)
      );
    },
    PER_ROUTE_BROWSER_MS
  );
});
