// tests/ui/layout/heading-scale.test.ts — BUILD §2.3, issue #110
//
// The regression guard for the defect this file ships with the fix for:
// `src/ui/tailwind.css` brings Tailwind 4's preflight, preflight resets
// every heading to `font-size: inherit`, and `src/ui/type.css` stated no
// heading size — so every `h1` in the product rendered at the 15px body
// size, in the product and on the layout sweep alike, with nothing red.
//
// **It has to be a rendered assertion.** The size that matters is the one a
// browser computes after preflight, the theme sheet, the Tailwind layer and
// `type.css` have all been applied in the order the root layout imports
// them. A test that parsed `type.css` alone would have passed on the day
// this broke: the file was not wrong, it was outranked. `tests/ui/fonts.test.ts`
// pins the declared values; this file asserts what the browser does with
// them, over the real route tree.
//
// The enumerator is the route tree (ADR-010), so a screen added later is in
// scope by construction. A route with no heading of a level is not an
// offender — the assertion is per heading found, never per route.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BAND_MIN } from "@/ui/layout/bands";
import { getAccountCookie, getBaseURL, withPage } from "./browser";
import {
  enumerateRoutes,
  headersFor,
  urlFor as routeUrl,
  type EnumeratedRoute,
} from "./routes";

const APP_ROOT = path.resolve(__dirname, "../../../src/app");
// The seeded session (#193): every `(account)` route is swept signed in
// as the account `browser.ts` put in the database, not as a fixture
// value the screens now refuse.
const routes = enumerateRoutes(APP_ROOT, { accountCookie: getAccountCookie() });

/** `design/tokens.md` §4's ruled scale, frozen in the archived corpus and
 *  transcribed by `src/ui/type.css`. Asserted here as *computed* pixels. */
const SCALE_PX: Readonly<Record<string, number>> = { h1: 31, h2: 25, h3: 20, h4: 16 };

/** §2b's first breakpoint, and §4's third absolute: below `--breakpoint-sm`
 *  "`--t-h1` takes `--t-h2`'s size". Every other step is the same at every
 *  viewport, so this map has one entry and gains one only if the ruling
 *  does (issue #258). */
const NARROW_PX: Readonly<Record<string, number>> = { ...SCALE_PX, h1: SCALE_PX.h2! };
const BREAKPOINT_SM_PX = 640;

/** The headline the owner's 320px screenshot is of. Four lines at `--t-h1`
 *  is what §4's ruling names as the defect; three is the bound this asserts,
 *  measured from the rendered box rather than from the size, because the
 *  size is the *cause* and the wrap is the thing the reader sees. */
const LANDING_MAX_LINES = 3;

/** `BUILD.md` §2.3, verbatim: "Body 15px/1.55." */
const BODY_PX = 15;

/** Browser startup dominates: one Chromium per route, as `browser.ts`'s
 *  header explains it must be. Same bound, same reason, as
 *  `layout.test.ts`'s `PER_ROUTE_BROWSER_MS`. */
const PER_ROUTE_BROWSER_MS = 60_000;

/** `routes.ts` owns how a route becomes a URL and a header set. This file
 *  had its own copy of both, written from `layout.test.ts`'s older shape,
 *  which sent a `(hosted)` route's `Host` as a header — a forbidden header
 *  name that Chromium refuses the navigation for. One home now (issue
 *  #49); this wrapper adds only this file's own no-server message. */
function urlFor(route: EnumeratedRoute): string {
  const baseURL = getBaseURL();
  if (!baseURL) {
    throw new Error(
      "tests/ui/layout/heading-scale.test.ts: a route was enumerated but no app server is running"
    );
  }
  return routeUrl(baseURL, route);
}

interface Measured {
  tag: string;
  px: number;
  text: string;
}

/** The rendered h1's height in line boxes: its border box over its own
 *  computed `line-height`. Read from the browser, so `text-wrap: balance`
 *  and the real font metrics are in it — a count derived from the string's
 *  length would be a guess about a font. */
function measureLandingHeadlineLines(): number | null {
  const h1 = document.querySelector("h1");
  if (!h1) return null;
  const style = getComputedStyle(h1);
  const lineHeight = Number.parseFloat(style.lineHeight);
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) return null;
  return Math.round(h1.getBoundingClientRect().height / lineHeight);
}

/** Every heading on the page, with the size the browser actually computed. */
function measureHeadings(): Measured[] {
  return [...document.querySelectorAll("h1, h2, h3, h4")].map((el) => ({
    tag: el.tagName.toLowerCase(),
    px: Number.parseFloat(getComputedStyle(el).fontSize),
    text: (el.textContent ?? "").slice(0, 40),
  }));
}

describe(`the heading scale survives preflight — ${routes.length} route(s)`, () => {
  it("states the route count it swept, explicitly, even at zero (rule 5.5)", () => {
    expect(routes.length).toBeGreaterThanOrEqual(0);
  });

  it(
    "every rendered h1 is larger than the body, and every heading computes its own step of the scale",
    async () => {
      const seen = new Set<string>();
      for (const route of routes) {
        const headings = await withPage(
          BAND_MIN.compact,
          async (page) => {
            await page.goto(urlFor(route));
            return page.evaluate(measureHeadings);
          },
          headersFor(route)
        );

        for (const heading of headings) {
          seen.add(heading.tag);
          const where = `${route.path}: <${heading.tag}> "${heading.text}" @ ${BAND_MIN.compact}px`;
          // The defect itself, stated as its own assertion: a heading at
          // body size is what preflight leaves behind.
          expect(heading.px, `${where} must be larger than the ${BODY_PX}px body`).toBeGreaterThan(
            BODY_PX
          );
          // Below `--breakpoint-sm` the h1 step is `--t-h2`'s size; every
          // other heading is its own step at every viewport (issue #258).
          expect(heading.px, `${where} must compute its narrow-viewport step`).toBe(
            NARROW_PX[heading.tag]
          );
        }
      }

      // Rule 5.5: an assertion that ran over no heading at all is a pass
      // that means nothing, so what it covered is reported rather than
      // left to be read off a silent green.
      console.log(
        `tests/ui/layout/heading-scale.test.ts: measured ${[...seen].sort().join(", ") || "no"} heading(s) across ${routes.length} route(s)`
      );
      expect(seen.has("h1"), "no route rendered an h1 — the sweep proved nothing").toBe(true);
    },
    PER_ROUTE_BROWSER_MS
  );

  it(
    `at and above --breakpoint-sm every h1 is the full ${SCALE_PX.h1}px step`,
    async () => {
      // The other half of the ruling: the step is a narrow-viewport rule,
      // not a shrink. Measured at both bands above the boundary, because a
      // `max-width` written by mistake would pass at one of them.
      let seenH1 = false;
      for (const width of [BAND_MIN.medium, BAND_MIN.wide]) {
        for (const route of routes) {
          const headings = await withPage(
            width,
            async (page) => {
              await page.goto(urlFor(route));
              return page.evaluate(measureHeadings);
            },
            headersFor(route)
          );
          for (const heading of headings) {
            const where = `${route.path}: <${heading.tag}> "${heading.text}" @ ${width}px`;
            expect(heading.px, `${where} must compute its own step of the scale`).toBe(
              SCALE_PX[heading.tag]
            );
            if (heading.tag === "h1") seenH1 = true;
          }
        }
      }
      expect(seenH1, "no route rendered an h1 above the boundary").toBe(true);
    },
    PER_ROUTE_BROWSER_MS
  );

  it(
    `the landing headline fits ${LANDING_MAX_LINES} lines at ${BAND_MIN.compact}px`,
    async () => {
      // Issue #258, from the owner's own 320px screenshot: at `--t-h1` the
      // headline wrapped to four lines and pushed the field toward the
      // fold. This asserts what the reader sees, so a future change that
      // restored the size — or lengthened the line — fails here and not
      // only on the token pin.
      const landing = routes.find((route) => route.path === "/" && route.host === undefined);
      expect(landing, "the landing route is not in the tree").toBeDefined();

      const narrow = await withPage(
        BAND_MIN.compact,
        async (page) => {
          await page.goto(urlFor(landing!));
          return page.evaluate(measureLandingHeadlineLines);
        },
        headersFor(landing!)
      );
      expect(narrow, "the landing rendered no h1").not.toBeNull();
      expect(narrow!, `the headline wraps to ${narrow} lines at ${BAND_MIN.compact}px`).toBeLessThanOrEqual(
        LANDING_MAX_LINES
      );
      // Stated, not silent (rule 5.5): what the boundary is and what was
      // measured under it.
      console.log(
        `tests/ui/layout/heading-scale.test.ts: landing headline is ${narrow} line(s) at ${BAND_MIN.compact}px, below --breakpoint-sm ${BREAKPOINT_SM_PX}px`
      );
    },
    PER_ROUTE_BROWSER_MS
  );
});
