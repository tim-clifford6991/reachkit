// tests/ui/layout/values.test.ts — BUILD §2.3 (issue #256)
//
// **A value is never rewritten to fit its box.**
//
// §2.3 puts every numeral, date, URL, search query and code-like string in
// the mono face, and the reason is that a value is read *as a string* — a
// customer compares the domain on the screen with the one they typed. A
// mid-word break makes those two different strings. `rival-three.example.org`
// in a 164px track came out as two lines split at no boundary the string
// has, which is exactly the failure the mono face exists to make visible.
//
// DECISIONS 2026-09-07 rules it for #244: "a domain is a value and is never
// wrapped mid-word." This is that rule asserted, once, over every route the
// sweep enumerates rather than over the one card it was found on.
//
// **What is checked is the computed style, not the pixels.** A screenshot
// diff would catch one broken domain on one screen at one width; this
// catches the *property that permits* breaking, on every `.num` element on
// every route, so a component that adds `break-words` beside `.num`
// tomorrow fails here rather than the day someone looks at a narrow screen.
// Four elements carried it when this was written — `Num` itself, the
// calendar's `WhyThisPage`, the draft view's claim entry and the page
// record's address — and every one of them was rendering a value.
//
// **Wrapping at spaces is not what this bans.** `overflow-wrap: break-word`
// only ever breaks *within* a word, and only when the word alone will not
// fit; a provenance line or a search phrase still wraps at its spaces
// exactly as before. `word-break: break-all` is banned for the same reason
// and is stricter still.
//
// The fix a failure asks for is the one `Num` carries: let the box take the
// strain (`overflow-x-auto` on an `inline-block`, already the sweep's
// declared scroll container) rather than rewriting the value.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bands } from "./matrix";
import { getBaseURL, getLiveAccountCookie, withPage } from "./browser";
import {
  enumerateRoutes,
  headersFor,
  SEGMENT_FIXTURES,
  urlFor as routeUrl,
  type EnumeratedRoute,
} from "./routes";
import { LIVE_DRAFT_ID } from "./seed";

const APP_ROOT = path.resolve(__dirname, "../../../src/app");

/** The bands this sweep asks at — one by default, three under the full
 *  matrix (`matrix.ts`). Whether a value may be broken is not an
 *  off-by-one question, so it is asked once per band, never per width. */
const BANDS = bands();

/** The whole `it`, including a Chromium launch and three navigations. */
const PER_ROUTE_BROWSER_MS = 90_000;
const NAVIGATION_MS = 45_000;

const ROUTES: readonly EnumeratedRoute[] = [
  ...enumerateRoutes(APP_ROOT),
  ...enumerateRoutes(APP_ROOT, {
    segmentFixtures: { ...SEGMENT_FIXTURES, "[draftId]": LIVE_DRAFT_ID },
    accountCookie: getLiveAccountCookie(),
  }).filter((route) => route.path === "/app" || route.path.startsWith("/app/")),
];

console.log(`tests/ui/layout/values.test.ts: ${ROUTES.length} route(s) × ${BANDS.length} bands`);

/**
 * Every `.num` element whose computed style would let a value be broken
 * mid-word, described well enough to find.
 *
 * Runs in the page. `overflow-wrap` is read under both its own name and the
 * legacy `word-wrap` alias, because a browser may report either.
 */
function checkValuesUnbroken(): { where: string; property: string; value: string }[] {
  const offenders: { where: string; property: string; value: string }[] = [];
  const BREAKING = new Set(["break-word", "anywhere", "break-all"]);

  for (const el of Array.from(document.querySelectorAll(".num"))) {
    const style = window.getComputedStyle(el);
    const text = (el.textContent ?? "").trim().slice(0, 40);
    const where = `${el.tagName.toLowerCase()}.${el.getAttribute("class")?.trim().split(/\s+/).join(".") ?? ""}${
      text ? ` "${text}"` : ""
    }`;
    for (const property of ["overflow-wrap", "word-wrap", "word-break"]) {
      const value = style.getPropertyValue(property).trim();
      if (BREAKING.has(value)) offenders.push({ where, property, value });
    }
  }
  return offenders;
}

function urlFor(route: EnumeratedRoute): string {
  const baseURL = getBaseURL();
  if (!baseURL) {
    throw new Error("tests/ui/layout/values.test.ts: a route was enumerated but no app server is running.");
  }
  return routeUrl(baseURL, route);
}

describe(`values are never broken mid-word — ${ROUTES.length} route(s) × ${BANDS.length} bands`, () => {
  it("asks every route the sweep enumerates, not a list of its own", () => {
    // The premise: a screen added later is in scope by construction. A
    // hand-kept list here would stop covering the newest surface, which is
    // how the free-page card went unnoticed until #244 looked at a
    // different card.
    expect(ROUTES.length).toBeGreaterThan(0);
  });

  for (const route of ROUTES) {
    it(
      `${route.path} renders no value that may break mid-word`,
      async () => {
        const offenders = await withPage(
          BANDS[0],
          async (page) => {
            const found: { width: number; where: string; property: string; value: string }[] = [];
            for (const width of BANDS) {
              await page.setViewportSize({ width, height: 480 });
              await page.goto(urlFor(route), { timeout: NAVIGATION_MS });
              for (const offender of await page.evaluate(checkValuesUnbroken)) {
                found.push({ width, ...offender });
              }
            }
            return found;
          },
          headersFor(route)
        );

        expect(
          offenders,
          offenders.length === 0
            ? ""
            : `${route.path}: a value may be broken mid-word. Let the box take the strain — ` +
              `\`inline-block max-w-full min-w-0 overflow-x-auto\`, the classes \`Num\` carries — ` +
              `rather than rewriting the value.\n` +
              offenders.map((o) => `  @${o.width}px  ${o.property}: ${o.value}  ${o.where}`).join("\n")
        ).toEqual([]);
      },
      PER_ROUTE_BROWSER_MS
    );
  }
});
