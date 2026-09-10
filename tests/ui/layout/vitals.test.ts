// tests/ui/layout/vitals.test.ts — issue #332
//
// `## Done when` row 1: "Lighthouse (or Playwright traces) on `/` and
// `/scan/example.com` at mobile and desktop in the layout job; budgets
// pinned in `constants.ts` (LCP ≤ 2.5 s, CLS ≤ 0.1, JS ≤ 200 kB on `/`) and
// the job fails on regression" — and the two measurable halves of row 2:
// "fonts preloaded, images sized".
//
// **In the layout job, and nowhere new.** That job already builds the app
// with `next build` and serves it with `next start` (`browser.ts`'s
// `globalSetup`), and already installs the Chromium these measurements are
// taken in. So this file adds no workflow step, no second build and no
// second toolchain: it is one more suite in the `layout` vitest project,
// reading the same base URL off the same run — which is also what makes a
// regression fail the job, since a red suite is a red `npm run test:layout`.
// `vitals.ts` says why the metrics are Playwright traces rather than
// Lighthouse and what is deliberately not emulated.
//
// **The two routes are the two a stranger sees.** `/` is the landing page
// and `/scan/{domain}` the free report — the surfaces reached before anyone
// has an account. The report's address is filled from the sweep's own
// `SEGMENT_FIXTURES` rather than written out a second time, so the budgeted
// route and the swept route cannot drift apart; that fixture is
// `example.com`, the domain that resolves to the *complete* report (every
// module present, every count measured), which is the heaviest thing the
// route can produce and so the honest thing to budget.
//
// **Warm the server, keep the browser cold.** Every route in this product
// renders per request (`src/app/layout.tsx`'s `force-dynamic`, issue #331),
// so the first hit after `next start` pays for a cold process and a cold
// connection to the substrate — a runner artefact, not a page-speed one.
// One throwaway navigation per route absorbs it. The *browser* is the other
// way round: each measurement launches its own Chromium, because a second
// navigation in a warm cache transfers no script bytes at all and a budget
// that passes because nothing was downloaded is worse than no budget.
// `scriptCount` is asserted beside the weight for the same reason.
import { beforeAll, describe, expect, it } from "vitest";
import { WEB_VITALS_BUDGET } from "@/lib/config/constants";
import { BAND_MIN } from "@/ui/layout/bands";
import { getBaseURL, withPage } from "./browser";
import { SEGMENT_FIXTURES } from "./routes";
import { kb, measureVitals, type RawVitals } from "./vitals";

/** How long each page is watched after `load`, for a late LCP candidate or
 *  a shift hydration causes. Long enough that a real regression lands
 *  inside the window, short enough that four of them do not dominate the
 *  job. */
const SETTLE_MS = 1500;
/** `values.test.ts`'s figures, for the reason it gives: a cold `next start`
 *  under a loaded CI runner answers its first request slowly, and a
 *  navigation timeout that fires there is noise, not a finding. */
const NAVIGATION_MS = 45_000;
const PER_MEASUREMENT_MS = 90_000;

/** ADR-093 decision 2's floor and the top band's lower bound — the two
 *  widths this suite calls "mobile" and "desktop". Read off `BAND_MIN`
 *  rather than written out, so the budget is measured at the same widths
 *  the layout law is (rule 2.4 — one home for the value). */
const VIEWPORTS = [
  { name: "mobile", width: BAND_MIN.compact },
  { name: "desktop", width: BAND_MIN.wide },
] as const;

const LANDING_PATH = "/";
const REPORT_PATH = `/scan/${SEGMENT_FIXTURES["[domain]"]}`;

const ROUTES = [
  { name: "the landing page", path: LANDING_PATH },
  { name: "the free report", path: REPORT_PATH },
] as const;

interface Measurement {
  path: string;
  viewport: string;
  width: number;
  vitals: RawVitals;
}

const measurements: Measurement[] = [];

/** Every (route, viewport) pair, as `it.each` rows. */
const PAIRS = ROUTES.flatMap((route) =>
  VIEWPORTS.map((viewport) => [route.path, viewport.name] as const)
);

function measurementFor(path: string, viewport: string): Measurement {
  const found = measurements.find((m) => m.path === path && m.viewport === viewport);
  if (!found) {
    throw new Error(
      `tests/ui/layout/vitals.test.ts: nothing was measured for ${path} at ${viewport}. ` +
        "The `beforeAll` that takes every measurement either did not run or threw."
    );
  }
  return found;
}

/** A one-line record of what was measured, printed on every run — a green
 *  run that shows its headroom is the only way to notice a budget being
 *  approached before it is crossed. */
function report(m: Measurement): string {
  const { vitals } = m;
  return (
    `${m.path} @ ${m.viewport} (${m.width}px): ` +
    `LCP ${vitals.lcpMs === null ? "none" : `${Math.round(vitals.lcpMs)}ms`} · ` +
    `CLS ${vitals.cls.toFixed(4)} · ` +
    `JS ${kb(vitals.scriptBytes)}kB over ${vitals.scriptCount} script(s) · ` +
    `${vitals.fontPreloads.length} font preload(s)`
  );
}

beforeAll(async () => {
  const baseURL = getBaseURL();
  if (!baseURL) {
    throw new Error(
      "tests/ui/layout/vitals.test.ts: the layout run started no server, so there is nothing " +
        "to measure. `browser.ts`'s `globalSetup` starts one whenever the route sweep finds a " +
        "route — a null base URL here means it found none."
    );
  }

  // One browser, one navigation per route: the cold-process cost, paid
  // where nothing is being measured.
  await withPage(BAND_MIN.wide, async (page) => {
    for (const route of ROUTES) {
      await page.goto(`${baseURL}${route.path}`, { timeout: NAVIGATION_MS });
    }
  });

  for (const route of ROUTES) {
    for (const viewport of VIEWPORTS) {
      const vitals = await withPage(viewport.width, async (page) => {
        await page.goto(`${baseURL}${route.path}`, { timeout: NAVIGATION_MS });
        return page.evaluate(measureVitals, SETTLE_MS);
      });
      measurements.push({
        path: route.path,
        viewport: viewport.name,
        width: viewport.width,
        vitals,
      });
    }
  }

  for (const m of measurements) console.log(`vitals · ${report(m)}`);
}, PER_MEASUREMENT_MS * (ROUTES.length * VIEWPORTS.length + 1));

describe("#332 — both routes are measured at both widths, and the measurement is real", () => {
  it("has one measurement per route per viewport", () => {
    expect(measurements).toHaveLength(ROUTES.length * VIEWPORTS.length);
  });

  it("measures the report address the sweep itself fills in, never a second fixture", () => {
    expect(REPORT_PATH).toBe("/scan/example.com");
  });

  it.each(PAIRS)("%s @ %s produced a Largest Contentful Paint candidate", (path, viewport) => {
    const m = measurementFor(path, viewport);
    expect(
      m.vitals.lcpMs,
      `${path} @ ${viewport} reported no LCP entry at all. Either the page rendered nothing a ` +
        "reader could see or it never finished — both are worse than a slow LCP, and neither " +
        "may pass as a budget met."
    ).not.toBeNull();
  });
});

describe(`#332 — Largest Contentful Paint is within ${WEB_VITALS_BUDGET.LCP_MS}ms`, () => {
  it.each(PAIRS)("%s @ %s", (path, viewport) => {
    const m = measurementFor(path, viewport);
    expect(
      m.vitals.lcpMs ?? Number.POSITIVE_INFINITY,
      `${report(m)} — over the ${WEB_VITALS_BUDGET.LCP_MS}ms budget. This is measured on ` +
        "loopback against the built app with no throttling and a warmed server, so a page that " +
        "misses it here is not slow by a margin: something render-blocking arrived in the diff."
    ).toBeLessThanOrEqual(WEB_VITALS_BUDGET.LCP_MS);
  });
});

describe(`#332 — Cumulative Layout Shift is within ${WEB_VITALS_BUDGET.CLS}`, () => {
  it.each(PAIRS)("%s @ %s", (path, viewport) => {
    const m = measurementFor(path, viewport);
    expect(
      m.vitals.cls,
      `${report(m)} — over the ${WEB_VITALS_BUDGET.CLS} budget. What moved, worst first: ` +
        `${m.vitals.shiftSources.join(" · ") || "(nothing was reported as a source)"}. ` +
        "Something moved under the reader after it was painted: an element that reserves no box " +
        "(an image with no dimensions, a font swapping to different metrics), or a waiting state " +
        "replaced by content taller than the box it stood in."
    ).toBeLessThanOrEqual(WEB_VITALS_BUDGET.CLS);
  });
});

describe(`#332 — the landing page transfers at most ${WEB_VITALS_BUDGET.LANDING_SCRIPT_KB}kB of script`, () => {
  // Only `/`: the issue budgets one route's weight, and the landing page is
  // the one surface a stranger loads cold with nothing warmed. The report's
  // own weight is its data, which is what it is for.
  it.each(VIEWPORTS.map((viewport) => [viewport.name] as const))("%s", (viewport) => {
    const m = measurementFor(LANDING_PATH, viewport);
    expect(
      m.vitals.scriptCount,
      `${report(m)} — no script resource was transferred at all, so the weight below is a ` +
        "measurement of nothing. A warm cache does this; each measurement is meant to run in " +
        "its own browser."
    ).toBeGreaterThan(0);
    expect(
      kb(m.vitals.scriptBytes),
      `${report(m)} — over the ${WEB_VITALS_BUDGET.LANDING_SCRIPT_KB}kB budget. BP-018's NFR ` +
        "budget is what this holds: the charts are hand-sized inline SVG precisely so no runtime " +
        "dependency ships to the browser."
    ).toBeLessThanOrEqual(WEB_VITALS_BUDGET.LANDING_SCRIPT_KB);
  });
});

describe("#332 `## Done when` row 2 — fonts preloaded, images sized", () => {
  it.each(PAIRS)("%s @ %s preloads its self-hosted faces", (path, viewport) => {
    const m = measurementFor(path, viewport);
    expect(
      m.vitals.fontPreloads.length,
      `${report(m)} — the document carries no <link rel="preload" as="font">. ` +
        "`src/ui/fonts.ts` loads both families through `next/font/local`, which emits one per " +
        "preloaded face; none here means the module stopped being imported by the root layout, " +
        "or its latin faces stopped being marked `preload`."
    ).toBeGreaterThan(0);
    // Self-hosted, and from this deployment: `next/font` emits every face
    // into `.next/static/media`. A preload pointing anywhere else is a
    // third-party font request from a customer's own domain, which is what
    // BP-018's NFR budget forbids.
    for (const href of m.vitals.fontPreloads) {
      expect(href, `${path} @ ${viewport} preloads ${href}`).toMatch(/^\/_next\/static\/media\//);
    }
  });

  it.each(PAIRS)("%s @ %s renders no image without a reserved box", (path, viewport) => {
    const m = measurementFor(path, viewport);
    // No route ships a raster image today — the charts are inline SVG
    // (BP-018) and the marks are glyphs — so this passes on an empty set.
    // It is here for the render that adds the first one: an <img> with
    // neither a width/height pair nor an aspect-ratio reserves nothing, and
    // every pixel below it moves when the file decodes.
    expect(
      m.vitals.unsizedImages,
      `${path} @ ${viewport}: ${m.vitals.unsizedImages.join(", ")} — an image with no ` +
        "width/height attributes and no aspect-ratio reserves no box, so the page shifts under " +
        "the reader when it decodes."
    ).toEqual([]);
  });
});
