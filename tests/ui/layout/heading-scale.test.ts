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
//
// **Retargeted by #941.** Until #941 the scale was stated *unlayered*, so it
// out-ranked `@layer utilities` and every heading on every screen computed
// its step whatever its class said — which is exactly what this file
// asserted, and so the defect was invisible here. The scale is a `@layer
// base` default now, and a heading that carries a size-bearing class draws
// what that class says. So the scale assertion holds where the scale is what
// speaks — a heading with no size-bearing class — and a heading that carries
// one is asserted against **the class's own size, measured in the same
// document**: a probe element in the heading's own parent, wearing the same
// classes. That is the invariant that broke, stated without a second copy of
// Tailwind's ladder anywhere in this repository.
//
// **The published page is not the app, and its headings are not on this
// scale (issue 976, after #991).** The draft viewer shows the customer's
// page exactly as readers receive it, inside the same `prose` frame the
// hosted route serves — that is the screen's whole point (SPEC §7,
// 2026-09-20). A heading in there is the customer's own markdown rendered
// by the article typography, so holding it to `SCALE_PX` asserts that our
// app's ladder governs someone else's page, which it does not and must
// not. #991 made this visible: the seeded page's `<h2> "Start from the
// limit you will hit first"` computes 30px — the `prose` step — and was
// read here as an app heading that had lost its own.
//
// So every heading inside the page frame is out of scope, and the frame is
// named by what makes it one: `.prose`, the article typography
// `docs/DESIGN.md` admits for exactly this, plus `draft-body` for the
// viewer's own container. Those are the only two places generated prose is
// rendered, and nothing else in the product wears either. **Everything
// outside the frame stays asserted**, including the hosted route's own
// `<h1>`: that one is ours, it carries `text-4xl`, and it is measured
// against its class probe like any other class-sized heading.
//
// Which arm a heading takes is measured, not read off its class list, because
// a size-bearing class does not carry a size at every viewport: `.t-hero`
// declares its 46px only above `--breakpoint-sm`, and below it the landing
// headline draws at the element's own narrow step (#258). So a second,
// class-less probe stands in the same box, and a heading whose two probes
// agree is one the scale still speaks for.
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

/** S1's hero headline, and the one h1 above `--breakpoint-sm` that is not
 *  `SCALE_PX.h1`. The owner's ruling of 2026-09-11 on #534: "The hero `h1`
 *  follows the approved set at 46 px. Ruling 10a is struck for S1 on this
 *  point, and the heading-scale test is retargeted in the same PR" —
 *  retargeted for the landing's h1 alone, so every other route's h1 is
 *  still asserted at 31. Below the boundary the landing's h1 keeps the
 *  narrow step like every other (`NARROW_PX`), and `LANDING_MAX_LINES`
 *  still bounds its wrap at 320. */
const LANDING_HERO_PX = 46;

/** The landing route: `/` on the app host. */
function isLanding(route: EnumeratedRoute): boolean {
  return route.path === "/" && route.host === undefined;
}

/** `BUILD.md` §2.3, verbatim: "Body 15px/1.55." */
const BODY_PX = 15;

/** Browser startup dominates: one Chromium per route, as `browser.ts`'s
 *  header explains it must be. Same bound, same reason, as
 *  `layout.test.ts`'s `PER_ROUTE_BROWSER_MS`.
 *
 *  **It bounds one route at one band, and every `it` below is one of those
 *  (issue #1018).** The two sweeps used to walk the whole tree inside a
 *  single `it` — twenty-six routes at the compact band, and fifty-two
 *  route-and-band pairs above the boundary — while carrying this one-route
 *  bound, so a budget written for one Chromium launch was being asked to
 *  cover all of them. It held on a quiet box and ran out twice on
 *  2026-09-22 under a build sharing the machine, both times as a 60,012 ms
 *  timeout with no assertion in it and as the only red of 246. The cases
 *  are enumerated now, one `it` per route and band the way `layout.test.ts`
 *  enumerates its own, so each carries the bound it was written for and a
 *  screen that is genuinely slow is named by the test that timed out
 *  instead of hiding in a sweep. Not a multiplier: a number chosen by hand
 *  against today's route count has to be re-chosen every time the tree
 *  grows, which is the thing this file's enumerator exists to make
 *  unnecessary. Nothing about what is asserted changed. */
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
  /** The classes on this heading that carry a size of their own — a Tailwind
   *  `text-*` rung, `.eyebrow`, `.t-hero`, or daisyUI's `card-title`. Empty
   *  when the scale is the only thing that speaks. */
  sizeBearing: string[];
  /** What the same classes compute to on a plain element in this heading's
   *  own parent, or `null` when there are none to probe. `card-title` reads
   *  the card's own size modifier, so the probe has to sit in the same box. */
  probePx: number | null;
  /** Whether those classes actually *size* the element here.
   *
   *  A size-bearing class is not one at every viewport: `.t-hero` declares
   *  its 46px only above `--breakpoint-sm`, and below it the element's own
   *  narrow step is what draws the landing headline (#258). So the probe is
   *  compared against a second, class-less probe in the same box — if the
   *  two agree, the classes say nothing about size here and the scale is
   *  still what speaks. */
  classSized: boolean;
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

/** Every heading on the page, with the size the browser actually computed —
 *  and, where the heading carries a size-bearing class, what that same class
 *  computes to on a plain element beside it.
 *
 *  Closure-free, like everything `page.evaluate` runs: the pattern and the
 *  probe are declared inside. `text-base-content/70` and `text-error` are
 *  colours and must not match, which is what the trailing boundary is for. */
function measureHeadings(): Measured[] {
  const SIZE_BEARING =
    /^(?:text-(?:xs|sm|base|lg|[2-9]?xl)!?|eyebrow|t-hero|card-title)$/;
  const sizeOfProbe = (parent: Element, className: string): number => {
    // A `<p>`, not a heading: it is the class's own size that is wanted,
    // with no element default of its own underneath it.
    const probe = document.createElement("p");
    probe.className = className;
    parent.appendChild(probe);
    const px = Number.parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    return px;
  };
  // The published page's own frame (see the header). `.prose` is written in
  // exactly two places — the hosted route's body and the draft viewer's
  // `draft-body` — and both hold the customer's page as readers receive it.
  // `max-w-prose` is a width utility and a different class token, so it
  // does not match here.
  const PAGE_FRAME = '.prose, [data-testid="draft-body"]';
  const outsideFrame = [...document.querySelectorAll("h1, h2, h3, h4")].filter(
    (el) => el.closest(PAGE_FRAME) === null
  );
  return outsideFrame.map((el) => {
    const sizeBearing = [...el.classList].filter((name) => SIZE_BEARING.test(name));
    let probePx: number | null = null;
    let classSized = false;
    if (sizeBearing.length > 0 && el.parentElement) {
      probePx = sizeOfProbe(el.parentElement, el.className);
      classSized = probePx !== sizeOfProbe(el.parentElement, "");
    }
    return {
      tag: el.tagName.toLowerCase(),
      px: Number.parseFloat(getComputedStyle(el).fontSize),
      text: (el.textContent ?? "").slice(0, 40),
      sizeBearing,
      probePx,
      classSized,
    };
  });
}

/** The two bands above `--breakpoint-sm`, where the h1 draws its full step.
 *  Both are swept, because a `max-width` written by mistake would pass at
 *  one of them. */
const WIDE_BANDS: readonly number[] = [BAND_MIN.medium, BAND_MIN.wide];

/** One route, one band, one Chromium: what every case below does before it
 *  asserts anything. */
async function headingsOn(route: EnumeratedRoute, width: number): Promise<Measured[]> {
  return withPage(
    width,
    async (page) => {
      await page.goto(urlFor(route));
      return page.evaluate(measureHeadings);
    },
    headersFor(route)
  );
}

/** What the cases below measured, totalled over the tree.
 *
 *  Rule 5.5's arms are claims about the sweep as a whole — that *some*
 *  heading fell through to the scale, that *some* heading carried a
 *  size-bearing class, that an h1 was measured at all — and none of them can
 *  be asserted inside a case that measures one screen, because a route with
 *  no classed heading is not an offender. So each case adds what it saw
 *  here and the case declared after the last of them states the totals.
 *  Vitest runs a file's `it`s in declaration order, one at a time — nothing
 *  in this project is `.concurrent` — so the totals are complete when that
 *  one runs. */
const compactSweep = { seen: new Set<string>(), defaulted: 0, classed: 0 };
const wideSweep = { seenH1: false, heroSeenAt: [] as number[] };

describe(`the heading scale survives preflight — ${routes.length} route(s)`, () => {
  it("states the route count it swept, explicitly, even at zero (rule 5.5)", () => {
    expect(routes.length).toBeGreaterThanOrEqual(0);
  });

  for (const route of routes) {
    it(
      `${route.path} @ ${BAND_MIN.compact}px: a heading with no size-bearing class is larger than the body and computes its own step; one that carries a class computes what the class says`,
      async () => {
        const headings = await headingsOn(route, BAND_MIN.compact);

        for (const heading of headings) {
          compactSweep.seen.add(heading.tag);
          const where = `${route.path}: <${heading.tag}> "${heading.text}" @ ${BAND_MIN.compact}px`;

          if (heading.classSized) {
            // The #941 half. The heading must compute exactly what its own
            // classes compute on a plain element in the same box — so an
            // element rule that out-ranks them again fails here, with the
            // two numbers in the message.
            compactSweep.classed += 1;
            expect(
              heading.px,
              `${where} carries ${heading.sizeBearing.join(" ")} and must compute what it says, not the element's step`
            ).toBe(heading.probePx);
            continue;
          }

          compactSweep.defaulted += 1;
          // The #110 half, unchanged: with nothing else speaking, the scale
          // speaks. A heading at body size is what preflight leaves behind.
          expect(heading.px, `${where} must be larger than the ${BODY_PX}px body`).toBeGreaterThan(
            BODY_PX
          );
          // Below `--breakpoint-sm` the h1 step is `--t-h2`'s size; every
          // other heading is its own step at every viewport (issue #258).
          expect(heading.px, `${where} must compute its narrow-viewport step`).toBe(
            NARROW_PX[heading.tag]
          );
        }
      },
      PER_ROUTE_BROWSER_MS
    );
  }

  it(`both arms of the scale were measured at ${BAND_MIN.compact}px (rule 5.5)`, () => {
    // Rule 5.5: an assertion that ran over no heading at all is a pass that
    // means nothing, so what the cases above covered is reported rather
    // than left to be read off a silent green. Both arms are counted,
    // because a sweep that found only one of them proved only half of this.
    console.log(
      `tests/ui/layout/heading-scale.test.ts: measured ${[...compactSweep.seen].sort().join(", ") || "no"} heading(s) across ${routes.length} route(s) — ${compactSweep.defaulted} on the scale, ${compactSweep.classed} on their own class`
    );
    expect(compactSweep.seen.has("h1"), "no route rendered an h1 — the sweep proved nothing").toBe(true);
    expect(compactSweep.defaulted, "no heading anywhere fell through to the scale").toBeGreaterThan(0);
    expect(compactSweep.classed, "no heading anywhere carried a size-bearing class — #941 is unguarded").toBeGreaterThan(0);
  });

  // The other half of the ruling: the step is a narrow-viewport rule, not a
  // shrink. Measured at both bands above the boundary, because a
  // `max-width` written by mistake would pass at one of them.
  //
  // The landing's h1 is the one exception, and it is asserted rather than
  // skipped (#534): at each band it must compute the set's 46, so a hero
  // that fell back to 31 fails here as surely as any other h1 that left 31.
  for (const width of WIDE_BANDS) {
    for (const route of routes) {
      it(
        `${route.path} @ ${width}px: every h1 is the full ${SCALE_PX.h1}px step, and S1's hero is ${LANDING_HERO_PX}px`,
        async () => {
          const headings = await headingsOn(route, width);
          for (const heading of headings) {
            const where = `${route.path}: <${heading.tag}> "${heading.text}" @ ${width}px`;
            const hero = heading.tag === "h1" && isLanding(route);
            // S1's hero is `.t-hero`, which is size-bearing, so it takes
            // the probe arm like every other classed heading — and the set's
            // 46 is asserted on top of it, because that number is the
            // owner's (#534) and not Tailwind's.
            if (hero) {
              // Both bands here are above `--breakpoint-sm`, which is the
              // only place `.t-hero` declares a size at all — so the class
              // must be what sizes it, and to the owner's own 46.
              expect(
                heading.px,
                `${where} is S1's hero and must compute the set's ${LANDING_HERO_PX}px (#534)`
              ).toBe(LANDING_HERO_PX);
              expect(heading.px, `${where}: the hero class must be what sizes it`).toBe(
                heading.probePx
              );
              wideSweep.heroSeenAt.push(width);
            } else if (heading.classSized) {
              expect(
                heading.px,
                `${where} carries ${heading.sizeBearing.join(" ")} and must compute what it says (#941)`
              ).toBe(heading.probePx);
            } else {
              expect(heading.px, `${where} must compute its own step of the scale`).toBe(
                SCALE_PX[heading.tag]
              );
            }
            if (heading.tag === "h1") wideSweep.seenH1 = true;
          }
        },
        PER_ROUTE_BROWSER_MS
      );
    }
  }

  it("an h1 was measured above the boundary, and S1's hero at both bands (rule 5.5)", () => {
    expect(wideSweep.seenH1, "no route rendered an h1 above the boundary").toBe(true);
    expect(wideSweep.heroSeenAt, "the landing's hero h1 was not measured at both bands").toEqual([
      BAND_MIN.medium,
      BAND_MIN.wide,
    ]);
  });

  it(
    `the landing headline fits ${LANDING_MAX_LINES} lines at ${BAND_MIN.compact}px`,
    async () => {
      // Issue #258, from the owner's own 320px screenshot: at `--t-h1` the
      // headline wrapped to four lines and pushed the field toward the
      // fold. This asserts what the reader sees, so a future change that
      // restored the size — or lengthened the line — fails here and not
      // only on the token pin.
      const landing = routes.find(isLanding);
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
