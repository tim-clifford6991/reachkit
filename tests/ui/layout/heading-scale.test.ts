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
import { getBaseURL, withPage } from "./browser";
import { enumerateRoutes, type EnumeratedRoute } from "./routes";

const APP_ROOT = path.resolve(__dirname, "../../../src/app");
const routes = enumerateRoutes(APP_ROOT);

/** `design/tokens.md` §4's ruled scale, frozen in the archived corpus and
 *  transcribed by `src/ui/type.css`. Asserted here as *computed* pixels. */
const SCALE_PX: Readonly<Record<string, number>> = { h1: 31, h2: 25, h3: 20, h4: 16 };

/** `BUILD.md` §2.3, verbatim: "Body 15px/1.55." */
const BODY_PX = 15;

/** Same shape as `layout.test.ts`'s: a `(hosted)` page's `Host`, an
 *  `(account)` page's session `Cookie`, or neither. */
function headersFor(route: EnumeratedRoute): { extraHTTPHeaders?: Record<string, string> } {
  const headers: Record<string, string> = {};
  if (route.host) headers.Host = route.host;
  if (route.cookie) headers.Cookie = route.cookie;
  return Object.keys(headers).length > 0 ? { extraHTTPHeaders: headers } : {};
}

/** Browser startup dominates: one Chromium per route, as `browser.ts`'s
 *  header explains it must be. Same bound, same reason, as
 *  `layout.test.ts`'s `PER_ROUTE_BROWSER_MS`. */
const PER_ROUTE_BROWSER_MS = 60_000;

function urlFor(route: EnumeratedRoute): string {
  const baseURL = getBaseURL();
  if (!baseURL) {
    throw new Error(
      "tests/ui/layout/heading-scale.test.ts: a route was enumerated but no app server is running"
    );
  }
  return baseURL + route.path;
}

interface Measured {
  tag: string;
  px: number;
  text: string;
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
          const where = `${route.path}: <${heading.tag}> "${heading.text}"`;
          // The defect itself, stated as its own assertion: a heading at
          // body size is what preflight leaves behind.
          expect(heading.px, `${where} must be larger than the ${BODY_PX}px body`).toBeGreaterThan(
            BODY_PX
          );
          expect(heading.px, `${where} must compute its own step of the scale`).toBe(
            SCALE_PX[heading.tag]
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
});
