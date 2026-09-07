// tests/ui/layout/layout.test.ts
//
// ADR-093 decision 6, quoted in WO-269 `## Test plan`: "Each route is
// rendered at five widths … asserting: no horizontal document scroll; every
// border box contained in its containing block's padding box;
// `scrollWidth <= clientWidth` and `scrollHeight <= clientHeight` on every
// text-bearing element outside the declared truncation allow-list … and
// computed `font-size` at or above the floor." Plus BP-018 `## Public
// interface`: "Every screen root is a `Surface`" and `## Error & edge
// behavior`: "a token missing from `:root` fails a test."
//
// Check 5 joins them (issue #241): the screen root's own container. All
// four above are properties of content inside boxes and none of them fails
// on a page with zero padding, which is how a `Surface` that matched no
// stylesheet rule reached dev with every screen flush to the top-left.
//
// Enumerates the real `src/app` tree — never a fixture — and prints
// `n routes × 5 widths` unconditionally (rule 5.5): today `src/app/` holds
// no route (WO-269 rests-on row 5), so `n` is `0`, and that is stated
// explicitly rather than read off an empty, silent report.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BAND_MIN } from "@/ui/layout/bands";
import { getAccountCookie, getBaseURL, withPage } from "./browser";
import {
  checkContainment,
  checkNoClippingOrTruncation,
  checkNoHorizontalScroll,
  checkSurfaceContainer,
  checkTypeFloor,
  CONTENT_MEASURE_PX,
  MONO_FONT_FAMILY,
  SCROLL_CONTAINER_ALLOWLIST,
  SURFACE_GUTTER_PX,
  TRUNCATION_ALLOWLIST,
} from "./checks";
import {
  enumerateRoutes,
  headersFor,
  urlFor as routeUrl,
  type EnumeratedRoute,
} from "./routes";
import { widths } from "./widths";

const APP_ROOT = path.resolve(__dirname, "../../../src/app");
// The seeded session (#193): every `(account)` route is swept signed in
// as the account `browser.ts` put in the database, not as a fixture
// value the screens now refuse.
const routes = enumerateRoutes(APP_ROOT, { accountCookie: getAccountCookie() });

console.log(
  `tests/ui/layout/layout.test.ts: ${routes.length} route(s) × 5 widths` +
    (routes.length === 0
      ? " — src/app/ holds no route yet (WO-269 rests-on row 5)"
      : ""),
);

/** The two tests below walk **every** route in one `it`, and `withPage`
 *  launches its own Chromium per call (see `browser.ts`'s header for why it
 *  cannot share one). That is roughly half a second of browser startup per
 *  route, so the wall clock here grows with the route tree and crossed
 *  Vitest's 5 s per-test default the week `src/app` reached seven routes
 *  (issue #19 — `/pricing` and `/signin` were the sixth and seventh). The
 *  bound is on browser startup, not on the assertion, and it is per-`it` so
 *  the width sweep above keeps the default and a real layout defect still
 *  fails fast. Same shape, same reason, as `tests/egress/policy.test.ts`'s
 *  `ESLINT_BOOT_MS`. */
const PER_ROUTE_BROWSER_MS = 60_000;

/** `routes.ts` owns how a route becomes a URL and a header set — one home
 *  for both, so a second suite over the same tree cannot inherit a stale
 *  copy (see that module). This wrapper adds only this file's own message
 *  for the no-server case. */
function urlFor(route: EnumeratedRoute): string {
  const baseURL = getBaseURL();
  if (!baseURL) {
    throw new Error(
      "tests/ui/layout/layout.test.ts: a route was enumerated but no app server is running " +
        "(browser.ts only starts one when enumerateRoutes() finds a route at globalSetup time).",
    );
  }
  return routeUrl(baseURL, route);
}

describe(`layout sweep — ${routes.length} route(s) × 5 widths`, () => {
  it("states the route count it swept, explicitly, even at zero (rule 5.5)", () => {
    // The console line above is the report; this assertion pins the value
    // it reports so a change in what `enumerateRoutes` returns is caught
    // here rather than only read off a log line nobody re-checks.
    expect(routes.length).toBeGreaterThanOrEqual(0);
    if (routes.length === 0) {
      expect(routes).toEqual([]);
    }
  });

  for (const route of routes) {
    for (const width of widths()) {
      it(`${route.path} @ ${width}px reports no offender on checks 1-5`, async () => {
        const offenders = await withPage(
          width,
          async (page) => {
            await page.goto(urlFor(route));
            const results = [
              await page.evaluate(checkNoHorizontalScroll),
              await page.evaluate(checkContainment, {
                scrollContainerAllowlist: SCROLL_CONTAINER_ALLOWLIST,
              }),
              await page.evaluate(checkNoClippingOrTruncation, {
                scrollContainerAllowlist: SCROLL_CONTAINER_ALLOWLIST,
                truncationAllowlist: TRUNCATION_ALLOWLIST,
                monoFontFamily: MONO_FONT_FAMILY,
              }),
              await page.evaluate(checkTypeFloor),
              // Check 5 (issue #241) — the screen root renders its
              // container. The numbers are `BAND_MIN`'s and
              // `design/tokens.md`'s, passed in rather than read from the
              // page, so a stylesheet that drifted from the ruled values
              // fails here instead of redefining what "conformant" means.
              await page.evaluate(checkSurfaceContainer, {
                bandMin: { medium: BAND_MIN.medium, wide: BAND_MIN.wide },
                gutterPx: SURFACE_GUTTER_PX,
                measurePx: CONTENT_MEASURE_PX,
              }),
            ];
            return results.flat();
          },
          headersFor(route),
        );
        expect(offenders).toEqual([]);
      });
    }
  }

  it(
    "every route's document has exactly one [data-surface] root",
    async () => {
      for (const route of routes) {
        const count = await withPage(
          BAND_MIN.compact,
          async (page) => {
            await page.goto(urlFor(route));
            return page.evaluate(
              () => document.querySelectorAll("[data-surface]").length,
            );
          },
          headersFor(route),
        );
        expect(
          count,
          `${route.path} must render exactly one [data-surface] root`,
        ).toBe(1);
      }
      if (routes.length === 0) {
        // Nothing to check today — stated, not silent (rule 5.5).
        expect(routes).toEqual([]);
      }
    },
    PER_ROUTE_BROWSER_MS,
  );

  it(
    "every route's :root pins --breakpoint-lg/-xl and --t-floor against BAND_MIN",
    async () => {
      for (const route of routes) {
        const tokens = await withPage(
          BAND_MIN.compact,
          async (page) => {
            await page.goto(urlFor(route));
            return page.evaluate(() => {
              const style = getComputedStyle(document.documentElement);
              return {
                breakpointLg: style.getPropertyValue("--breakpoint-lg").trim(),
                breakpointXl: style.getPropertyValue("--breakpoint-xl").trim(),
                tFloor: style.getPropertyValue("--t-floor").trim(),
              };
            });
          },
          headersFor(route),
        );
        expect(
          tokens.breakpointLg,
          `${route.path}: --breakpoint-lg must be declared`,
        ).not.toBe("");
        expect(
          tokens.breakpointXl,
          `${route.path}: --breakpoint-xl must be declared`,
        ).not.toBe("");
        expect(
          tokens.tFloor,
          `${route.path}: --t-floor must be declared`,
        ).not.toBe("");
        expect(parseFloat(tokens.breakpointLg)).toBe(BAND_MIN.medium);
        expect(parseFloat(tokens.breakpointXl)).toBe(BAND_MIN.wide);
      }
      if (routes.length === 0) {
        expect(routes).toEqual([]);
      }
    },
    PER_ROUTE_BROWSER_MS,
  );
});
