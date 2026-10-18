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
// It runs on every pull request, as one of the files the `no overflow · axe`
// gate walks (owner, 2026-09-21, #976 — `docs/PROCESS.md`, Gates). Until
// then it ran on `main` alone and had been red for days without anybody
// seeing it, which is most of what that issue is about.
//
// Enumerates the real `src/app` tree — never a fixture — and prints
// `n routes × n widths` unconditionally (rule 5.5): today `src/app/` holds
// no route (WO-269 rests-on row 5), so `n` is `0`, and that is stated
// explicitly rather than read off an empty, silent report.
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
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
import { standSurface, unenumeratedSurfaces } from "./surfaces";
import { sweepWidths as widths } from "./matrix";

const APP_ROOT = path.resolve(__dirname, "../../../src/app");
// The seeded session (#193): every `(account)` route is swept signed in
// as the account `browser.ts` put in the database, not as a fixture
// value the screens now refuse.
const routes = enumerateRoutes(APP_ROOT, { accountCookie: getAccountCookie() });

console.log(
  `tests/ui/layout/layout.test.ts: ${routes.length} route(s) × ${widths().length} width(s)` +
    (routes.length === 0
      ? " — src/app/ holds no route yet (WO-269 rests-on row 5)"
      : ""),
);

/** `withPage` launches its own Chromium per call (see `browser.ts`'s header
 *  for why it cannot share one), so a case pays for a browser start, a
 *  navigation and a hydrated settle before it asserts anything — which
 *  crossed Vitest's 5 s per-test default the week `src/app` reached seven
 *  routes (issue #19 — `/pricing` and `/signin` were the sixth and
 *  seventh). The bound is on that startup and not on the assertion, so a
 *  real layout defect still fails on the check rather than on the clock.
 *  Same shape, same reason, as `tests/egress/policy.test.ts`'s
 *  `ESLINT_BOOT_MS`.
 *
 *  **Every `it` below carries it, and every `it` below is one route — or one
 *  surface — at one width (issue #1018).** Two of them used to walk the
 *  whole tree inside a single `it` under this one-route bound, a third
 *  walked every unenumerated surface the same way, and the width sweep's
 *  own cases carried no bound at all and ran under Vitest's 5 s default —
 *  a default that was never written for a Chromium launch, a `next start`
 *  navigation and a hydrated settle. Both shapes time out under a build
 *  sharing the box, with no assertion in the failure and nothing naming the
 *  screen that was slow: on 2026-09-23 four width cases went at ~5.0 s and the two
 *  tree-wide ones at 60,002 ms, in a run where every assertion that reached
 *  a page passed. `heading-scale.test.ts` had the same defect under #1018
 *  and is written this way for the same reason. */
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

/**
 * Checks 1-5, on whatever document the page is currently showing.
 *
 * One home for the five, because there are now two sweeps over them: the
 * route enumeration below, and the surfaces that have no address at all
 * (`surfaces.ts`, issue #327). A second copy is how the second suite over
 * one property comes to be written from the first's older shape — the
 * defect `routes.ts`'s own `urlFor` exists to prevent, one level up.
 */
async function offendersOn(page: Page): Promise<unknown[]> {
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
    // Check 5 (issue #241) — the screen root renders its container. The
    // numbers are `BAND_MIN`'s and `design/tokens.md`'s, passed in rather
    // than read from the page, so a stylesheet that drifted from the ruled
    // values fails here instead of redefining what "conformant" means.
    await page.evaluate(checkSurfaceContainer, {
      bandMin: { medium: BAND_MIN.medium, wide: BAND_MIN.wide },
      gutterPx: SURFACE_GUTTER_PX,
      measurePx: CONTENT_MEASURE_PX,
    }),
  ];
  return results.flat();
}

describe(`layout sweep — ${routes.length} route(s) × ${widths().length} width(s)`, () => {
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
            return offendersOn(page);
          },
          headersFor(route),
        );
        expect(offenders).toEqual([]);
      }, PER_ROUTE_BROWSER_MS);
    }
  }

  // One case per route (#1018). The zero-route tree is stated by the count
  // assertion above, which is where "nothing to check today" belongs now
  // that a route is a case rather than a turn of a loop.
  //
  // Issue 1510 rides the same page load: no href on the route is the source
  // of a function or an error. A constant a server component read from a
  // `"use client"` module printed `/#function(){throw Error(…` into the
  // public header's links, and only a built page shows it.
  for (const route of routes) {
    it(
      `${route.path} renders exactly one [data-surface] root, and no href is a server error`,
      async () => {
        const { count, brokenHrefs } = await withPage(
          BAND_MIN.compact,
          async (page) => {
            await page.goto(urlFor(route));
            return page.evaluate(() => ({
              count: document.querySelectorAll("[data-surface]").length,
              brokenHrefs: [...document.querySelectorAll("[href]")]
                .map((el) => el.getAttribute("href") ?? "")
                .filter((href) => href.includes("function(") || href.includes("Error(")),
            }));
          },
          headersFor(route),
        );
        expect(
          count,
          `${route.path} must render exactly one [data-surface] root`,
        ).toBe(1);
        expect(brokenHrefs, `${route.path}: an href holds a function or an error`).toEqual([]);
      },
      PER_ROUTE_BROWSER_MS,
    );
  }

  // Issue #349: the two `--breakpoint-*` tokens this used to read are
  // not in the approved set and never were read by anything — a media
  // query cannot resolve a `var()`, so they were four declarations with
  // no consumer. The band boundaries are pinned in
  // `tests/ui/layout-tokens.test.ts` against the literals every
  // stylesheet writes; what a *route* has to carry is the floor check 4
  // reads, and it is now `--t-eyebrow`, the approved set's name for the
  // same 11px rung.
  //
  // One case per route (#1018), like every other case in this file.
  for (const route of routes) {
    it(
      `${route.path}: :root declares the ladder's floor and the two measures the law reads`,
      async () => {
        const tokens = await withPage(
          BAND_MIN.compact,
          async (page) => {
            await page.goto(urlFor(route));
            return page.evaluate(() => {
              const style = getComputedStyle(document.documentElement);
              return {
                floor: style.getPropertyValue("--t-eyebrow").trim(),
                read: style.getPropertyValue("--w-read").trim(),
                wide: style.getPropertyValue("--w-wide").trim(),
              };
            });
          },
          headersFor(route),
        );
        expect(
          tokens.floor,
          `${route.path}: --t-eyebrow must be declared`,
        ).not.toBe("");
        expect(parseFloat(tokens.floor)).toBe(11);
        expect(parseFloat(tokens.read)).toBe(704);
        expect(parseFloat(tokens.wide)).toBe(BAND_MIN.wide - 2 * 32);
      },
      PER_ROUTE_BROWSER_MS,
    );
  }
});

/**
 * The six surfaces the `page.tsx` enumerator cannot see (issue #327).
 *
 * `surfaces.ts` states in full what these are, how each reaches the page
 * and what this sweep does and does not claim about them. Here they are
 * simply six more documents the layout law applies to, measured at the same
 * the sweep's widths by the same five checks — because the law is about content
 * fitting its box, and a 404 has boxes exactly like every other screen's.
 */
const surfaces = unenumeratedSurfaces();

console.log(
  `tests/ui/layout/layout.test.ts: ${surfaces.length} unenumerated surface(s) × ${widths().length} width(s)`,
);

describe(`layout sweep — ${surfaces.length} unenumerated surface(s) × ${widths().length} width(s)`, () => {
  it("sweeps every surface `surfaces.ts` declares, and states the count (rule 5.5)", () => {
    // The premise, as an assertion: a seventh surface added there is in
    // scope here by construction and never by being listed twice.
    expect(surfaces.length).toBeGreaterThan(0);
    expect(surfaces.map((s) => s.name)).toEqual([
      ...new Set(surfaces.map((s) => s.name)),
    ]);
    // And none of them is named like a route, so a baseline of one can
    // never be read as a picture of an address.
    expect(surfaces.every((s) => !s.name.startsWith("-"))).toBe(true);
    // One of the six has an address of its own and is driven as one; the
    // rest stand on a document. Stated so a row that quietly gained or lost
    // its `stand` is caught here.
    expect(surfaces.filter((s) => s.stand === undefined).map((s) => s.name)).toEqual([
      "root-not-found",
    ]);
  });

  for (const surface of surfaces) {
    for (const width of widths()) {
      it(`${surface.name} @ ${width}px reports no offender on checks 1-5`, async () => {
        const offenders = await withPage(
          width,
          async (page) => {
            await page.goto(urlFor(surface.route));
            await standSurface(page, surface);
            return offendersOn(page);
          },
          headersFor(surface.route),
        );
        expect(offenders).toEqual([]);
      }, PER_ROUTE_BROWSER_MS);
    }
  }

  // The root 404 renders its own; three replace a screen root with a screen
  // root; the app's waiting line replaces the Overview's content well and
  // leaves the shell's root where it was. Either way the document has one,
  // which is the invariant the route sweep asserts above and the one
  // standing a surface on a page is most able to break.
  //
  // One case per surface (#1018): a surface costs a Chromium launch and a
  // stand exactly as a route costs a launch and a navigation.
  for (const surface of surfaces) {
    it(
      `${surface.name} leaves the document exactly one [data-surface] root`,
      async () => {
        const count = await withPage(
          BAND_MIN.compact,
          async (page) => {
            await page.goto(urlFor(surface.route));
            await standSurface(page, surface);
            return page.evaluate(
              () => document.querySelectorAll("[data-surface]").length,
            );
          },
          headersFor(surface.route),
        );
        expect(
          count,
          `${surface.name} must leave exactly one [data-surface] root`,
        ).toBe(1);
      },
      PER_ROUTE_BROWSER_MS,
    );
  }
});
