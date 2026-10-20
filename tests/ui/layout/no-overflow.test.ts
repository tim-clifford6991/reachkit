// tests/ui/layout/no-overflow.test.ts — the merge gate issue #910 asks for
//
// `docs/DESIGN.md`, "Layout that cannot overflow" (owner, 2026-09-20, #908):
// "No element is wider than its container and no text is clipped by its card
// at 390, 768 and 1280 pixels, in light and dark. CI renders every route at
// those widths and fails on either; `@axe-core/playwright` runs in the same
// pass."
//
// **What this is, next to the sweep beside it.** `layout.test.ts` walks the
// same route tree and runs checks 1-5 at one width in one theme; that is a
// property sweep of the band ladder and it stays what it is. This file is
// the customer's three screens in both themes, with axe on the same page.
// The difference is not pedantry: every defect design review found on
// 2026-09-20 — step labels running out of their column, charts cut off by
// their card — was invisible to the sweep that was already green, because
// the labels only overflow at 390 and the charts do not exist until React
// has measured their boxes.
//
// Both of them block merge now (owner, 2026-09-21, closing #910 and #976),
// and both measure a hydrated page: `settleForMeasurement` below was this
// file's own and is `browser.ts`'s since #976, so every navigation in this
// project waits for the client runtime, the webfont and the charts.
//
// **No screenshot, no baseline, no PNG.** `docs/DESIGN.md` forbids a pixel
// baseline as a merge gate and this does not add one. Every failure here is
// a sentence naming an element.
//
// **What it excuses, and why that is not a skip list.** Going up against a
// product nobody had measured this way, this pass found twenty findings
// across five defects on `main`. Each is named in `no-overflow.ts`'s
// `KNOWN_ON_MAIN` with the issue that owns it (#943-#947), so the gate can
// block the *next* defect from today rather than waiting a month for five
// unrelated fixes. The last test in this file is what keeps that honest: a
// row that matched nothing during a run is a defect somebody has fixed, and
// the run fails until the row is deleted. The list can only shrink.
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import {
  checkContainment,
  checkNoClippingOrTruncation,
  checkNoHorizontalScroll,
  MONO_FONT_FAMILY,
  type Offender,
} from "./checks";
import { getAccountCookie, getBaseURL, getSetupAccountCookie, withPage } from "./browser";
import {
  APP_SHELL_MD_LG_WIDTH,
  axeOffenders,
  checkChartsResponsive,
  checkFixedBoxesFitViewport,
  EDGE_EPSILON_PX,
  ENVIRONMENT_OF_RECORD,
  HYDRATION_MARKER,
  KNOWN_ON_MAIN,
  STILL,
  knownDefectFor,
  NO_OVERFLOW_CLAMPED_TEXT,
  NO_OVERFLOW_SCROLL_CONTAINERS,
  NO_OVERFLOW_THEMES,
  NO_OVERFLOW_WIDTHS,
  noOverflowCasesFor,
  noOverflowRoutes,
  PR_SWEEP,
  RECHARTS_CLASS,
  settleForMeasurement,
} from "./no-overflow";
import { headersFor, urlFor as routeUrl, type EnumeratedRoute } from "./routes";

/** A pull request sweeps one theme per width; the nightly run sweeps both. */
const SWEPT_THEMES = PR_SWEEP ? "one theme per width (pull request)" : `${NO_OVERFLOW_THEMES.length} theme(s)`;

const APP_ROOT = path.resolve(__dirname, "../../../src/app");

const routes = noOverflowRoutes(APP_ROOT, {
  reserved: getAccountCookie(),
  setup: getSetupAccountCookie(),
});

console.log(
  `tests/ui/layout/no-overflow.test.ts: ${routes.length} route(s) × ` +
    `${NO_OVERFLOW_WIDTHS.length} width(s) (and /app at ${APP_SHELL_MD_LG_WIDTH}px) × ${SWEPT_THEMES}`,
);

/** One browser launch, two navigations, two axe runs and three checks on
 *  each. `withPage` launches its own Chromium per call — `browser.ts`'s
 *  header says why it cannot share one — so the wall clock here is browser
 *  startup plus two cold route compiles, not the assertions. Per-`it` and
 *  generous, the same shape `layout.test.ts`'s `PER_ROUTE_BROWSER_MS` has. */
const PER_ROUTE_BROWSER_MS = 180_000;

function urlFor(route: EnumeratedRoute): string {
  const baseURL = getBaseURL();
  if (!baseURL) {
    throw new Error(
      "tests/ui/layout/no-overflow.test.ts: a route was enumerated but no app server is running " +
        "(browser.ts only starts one when enumerateRoutes() finds a route at globalSetup time).",
    );
  }
  return routeUrl(baseURL, route);
}

/**
 * The three measurements and the chart rule, on whatever document the page
 * is currently showing.
 *
 * Checks 1-3 are `checks.ts`'s, unchanged and un-re-decided — including the
 * out-of-flow rule PR #942 corrects there, which this pass reads rather than
 * restates. The two beside them are this pass's own and neither overlaps a
 * check: `checkChartsResponsive` is `docs/DESIGN.md`'s chart rule, and
 * `checkFixedBoxesFitViewport` is the screen a fixed box is held to once
 * #942 has excused it from its parent.
 *
 * Checks 4 and 5 — the type floor and the screen root's container — are
 * deliberately *not* here: they are the band ladder's properties,
 * `layout.test.ts` runs them at the widths that ladder is defined at, and a
 * merge gate that also re-ran them would make every type-scale question a
 * blocking one. This gate is the two sentences the ruling wrote: nothing
 * wider than its container, no text clipped by its card.
 */
async function layoutOffenders(page: Page): Promise<Offender[]> {
  const results = [
    await page.evaluate(checkNoHorizontalScroll),
    await page.evaluate(checkContainment, {
      scrollContainerAllowlist: NO_OVERFLOW_SCROLL_CONTAINERS,
    }),
    await page.evaluate(checkNoClippingOrTruncation, {
      scrollContainerAllowlist: NO_OVERFLOW_SCROLL_CONTAINERS,
      truncationAllowlist: NO_OVERFLOW_CLAMPED_TEXT,
      monoFontFamily: MONO_FONT_FAMILY,
    }),
    await page.evaluate(checkChartsResponsive, {
      wrapperClass: RECHARTS_CLASS.wrapper,
      surfaceClass: RECHARTS_CLASS.surface,
    }),
    // The other half of the out-of-flow rule #942 corrects in `checks.ts`:
    // a fixed box is held to the screen rather than to its parent, so the
    // screen is where it has to fit.
    await page.evaluate(checkFixedBoxesFitViewport, { epsilon: EDGE_EPSILON_PX }),
  ];
  return results.flat();
}

/**
 * One screen, at one width, in one theme, measured and audited.
 *
 * **The colour scheme is emulated before the navigation, never after.** A
 * theme switched on a loaded page repaints through the token transitions and
 * whatever is read then is whichever frame it landed on — `visual.test.ts`
 * found that with a shutter and the reasoning is the same with a ruler.
 */
async function reportOn(
  page: Page,
  route: EnumeratedRoute,
  url: string,
  theme: "light" | "dark",
): Promise<string[]> {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.goto(url);
  await page.addStyleTag({ content: STILL });
  await settleForMeasurement(page);
  const offenders = [...(await layoutOffenders(page)), ...(await axeOffenders(page))];
  const failing: string[] = [];
  for (const offender of offenders) {
    const known = knownDefectFor(route.path, offender);
    if (known) {
      // Excused, and recorded as still being there. The last test in this
      // file is what makes the record matter: a row nothing matched is a
      // defect somebody fixed, and it has to leave the list.
      stillThere.add(KNOWN_ON_MAIN.indexOf(known));
      continue;
    }
    failing.push(`${theme}: ${offender.check} — ${offender.element}`);
  }
  return failing;
}

/** Which rows of `KNOWN_ON_MAIN` this run actually met. Accumulated across
 *  the tests below, which vitest runs in order within a file, and read by
 *  the last one. */
const stillThere = new Set<number>();

describe(`no overflow, no clipping, axe clean — ${routes.length} route(s) × ${NO_OVERFLOW_WIDTHS.length} width(s) (and /app at ${APP_SHELL_MD_LG_WIDTH}px) × ${SWEPT_THEMES}`, () => {
  it("states what it swept, explicitly, and sweeps the tree rather than a list of its own (rule 5.5)", () => {
    // The premise, as an assertion: this gate is in scope for a screen added
    // later because it asks `routes.ts`, exactly as the two sweeps beside it
    // do. A hand-kept list here would silently stop covering the newest
    // screen, which is the whole failure this issue exists to close.
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.map((r) => r.path)).toEqual([...new Set(routes.map((r) => r.path))]);
    // And the two setup addresses are swept as the founder who can reach
    // them — stated here, because an account route swept through the wrong
    // door measures a redirect and reports it as a clean screen.
    const setup = routes.filter((r) => r.path.startsWith("/setup"));
    expect(setup.length).toBeGreaterThan(0);
    expect(setup.every((r) => r.cookie === getSetupAccountCookie())).toBe(true);
  });

  it(
    `a hydrated document carries <${HYDRATION_MARKER}>, so the waits above are not no-ops`,
    async () => {
      // `settleForMeasurement` waits for this element and moves on if it
      // never comes, because a timeout says less than the checks do. That
      // tolerance is only safe while the signal is real: a Next.js upgrade
      // that stopped emitting it would turn every wait in this pass into a
      // no-op and every chart into an empty frame, silently. This is the
      // test that would go red instead.
      const found = await withPage(NO_OVERFLOW_WIDTHS[2], async (page) => {
        await page.goto(urlFor({ path: "/" }));
        await settleForMeasurement(page);
        return page.evaluate((name) => document.querySelector(name) !== null, HYDRATION_MARKER);
      });
      expect(found).toBe(true);
    },
    PER_ROUTE_BROWSER_MS,
  );

  for (const route of routes) {
    // An `/app` screen is swept once more between `md` and `lg`, where it
    // wears the phone shell (issue 1484, `noOverflowWidthsFor`).
    for (const { width, themes } of noOverflowCasesFor(route.path)) {
      it(
        `${route.path} @ ${width}px, ${themes.join(" and ")}`,
        async () => {
          const found = await withPage(
            width,
            async (page) => {
              const lines: string[] = [];
              for (const theme of themes) {
                lines.push(...(await reportOn(page, route, urlFor(route), theme)));
              }
              return lines;
            },
            headersFor(route),
          );
          expect(found, `${route.path} at ${width}px:\n${found.join("\n")}`).toEqual([]);
        },
        PER_ROUTE_BROWSER_MS,
      );
    }
  }

  it("every defect it still excuses is still there — a row nothing matched is one to delete", () => {
    // What keeps `KNOWN_ON_MAIN` from becoming a skip list. Each row names a
    // defect on `main` and an open issue; when that issue is done the defect
    // stops being found, and this test is what says so rather than letting
    // the row sit there excusing nothing for ever. The list can only shrink.
    const orphaned = KNOWN_ON_MAIN.map((known, i) => ({ known, i }))
      .filter(({ i }) => !stillThere.has(i))
      .map(
        ({ known }) =>
          `  ${known.route} — ${known.check} / ${known.match} (#${known.issue})`,
      );
    const message =
      "These rows of KNOWN_ON_MAIN (tests/ui/layout/no-overflow.ts) matched nothing in this run.\n" +
      "That is good news: the defect is fixed. Delete the row — and close the issue if it was\n" +
      "the last row naming it.\n" +
      orphaned.join("\n");
    // An empty list is stated, on either arm, rather than passing silently
    // (rule 5.5): nothing is excused, and that is worth a line in the log.
    if (KNOWN_ON_MAIN.length === 0) {
      console.log("tests/ui/layout/no-overflow.test.ts: KNOWN_ON_MAIN is empty — this run excused nothing.");
    }
    if (!ENVIRONMENT_OF_RECORD) {
      // Not CI, so a row that matched nothing may only mean this machine
      // draws text a pixel narrower — `ENVIRONMENT_OF_RECORD` says which
      // rows that reaches and why. Reported, never asserted, and never
      // silent (rule 5.5).
      if (KNOWN_ON_MAIN.length > 0) {
        console.log(
          orphaned.length === 0
            ? "tests/ui/layout/no-overflow.test.ts: every KNOWN_ON_MAIN row was met on this machine."
            : `tests/ui/layout/no-overflow.test.ts: not CI, so this is a report, not a verdict.\n${message}`,
        );
      }
      return;
    }
    expect(orphaned, message).toEqual([]);
  });
});
