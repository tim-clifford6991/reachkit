// tests/ui/layout/skeletons.test.ts — a skeleton is the shape of the screen
// that arrives (issue 1484).
//
// SPEC §4 (2026-09-20, #908) and §5 (2026-10-07, #1327): "A skeleton is the
// shape of the screen that arrives, on a phone and on a desktop." Issues
// 1320 and 1340 found Plan's skeleton was a different screen from Plan, and
// the Overview's hand-copied its tile grid. Each of the three screens below
// now draws its wait with its own layout constants (`frame.ts` beside the
// screen), and this file is the check that they agree in a browser.
//
// **How a wait is measured.** The screen is opened twice at each width.
// Once with no client runtime (`withPage`'s `firstPaint`): React streams the
// `loading.tsx` fallback first and swaps it with an inline script, so with
// scripts off the document keeps the skeleton the customer sees first, and
// the screen that came after it sits in a `hidden` element that draws
// nothing. Once as every other suite opens a page — hydrated and settled.
//
// **What is compared.** Every region named `data-frame` in either document
// (`REGION` in each `frame.ts`): its left edge and width, and the left edge
// and width of each child it draws. That is the shape — how many columns,
// how many rows, where each sits — and not the heights, which the content
// decides. A region one document draws and the other does not is a
// mismatch too.
//
// Plan's list counts this week from today. The skeleton cannot read the
// site's zone, so it counts from UTC's today (`calendar/loading.tsx`); a run
// in the hours either side of midnight in the seeded site's zone can see one
// row more or less, and says so by name.
import { describe, expect, it } from "vitest";
import { getAccountCookie, getBaseURL, getSetupAccountCookie, withPage } from "./browser";
import { NO_OVERFLOW_WIDTHS } from "./no-overflow";
import { headersFor, urlFor, type EnumeratedRoute } from "./routes";

/** The phone and the laptop of the ruling's three widths. */
const WIDTHS = [NO_OVERFLOW_WIDTHS[0], NO_OVERFLOW_WIDTHS[2]] as const;

/** A sub-pixel difference is rounding, not a box that moved. */
const EDGE_PX = 1;

/** Two browser launches, two cold route compiles. */
const PER_CASE_MS = 180_000;

interface Box {
  x: number;
  width: number;
}

interface Region extends Box {
  children: Box[];
}

/** Runs in the page: every drawn `[data-frame]` region and its drawn
 *  children. A region inside the screen's `hidden` stream holder, or under
 *  a breakpoint's `hidden`, draws nothing and is not read. */
function drawnRegions(): Record<string, Region> {
  const drawn = (el: Element): boolean => {
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.position !== "fixed";
  };
  const boxOf = (el: Element): Box => {
    const box = el.getBoundingClientRect();
    return { x: box.left, width: box.width };
  };
  const out: Record<string, Region> = {};
  for (const el of Array.from(document.querySelectorAll("[data-frame]"))) {
    const name = el.getAttribute("data-frame");
    if (name === null || !drawn(el)) continue;
    out[name] = { ...boxOf(el), children: Array.from(el.children).filter(drawn).map(boxOf) };
  }
  return out;
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= EDGE_PX;
}

function px(box: Box): string {
  return `x ${Math.round(box.x)}, width ${Math.round(box.width)}`;
}

/** Each way the waiting shape differs from the arrived one, as a sentence. */
function mismatches(waiting: Record<string, Region>, loaded: Record<string, Region>): string[] {
  const out: string[] = [];
  const names = [...new Set([...Object.keys(waiting), ...Object.keys(loaded)])].sort();
  for (const name of names) {
    const before = waiting[name];
    const after = loaded[name];
    if (before === undefined) {
      out.push(`${name}: drawn by the screen, not by its skeleton`);
      continue;
    }
    if (after === undefined) {
      out.push(`${name}: drawn by the skeleton, not by the screen`);
      continue;
    }
    if (!near(before.x, after.x) || !near(before.width, after.width)) {
      out.push(`${name}: skeleton ${px(before)}, screen ${px(after)}`);
    }
    if (before.children.length !== after.children.length) {
      out.push(`${name}: skeleton draws ${before.children.length} children, screen ${after.children.length}`);
      continue;
    }
    before.children.forEach((child, at) => {
      const other = after.children[at];
      if (other !== undefined && (!near(child.x, other.x) || !near(child.width, other.width))) {
        out.push(`${name} child ${at + 1}: skeleton ${px(child)}, screen ${px(other)}`);
      }
    });
  }
  return out;
}

const SCREENS: readonly { route: () => EnumeratedRoute }[] = [
  { route: () => ({ path: "/app", cookie: getAccountCookie() }) },
  { route: () => ({ path: "/app/calendar", cookie: getAccountCookie() }) },
  { route: () => ({ path: "/setup", cookie: getSetupAccountCookie() }) },
];

describe("a skeleton is the shape of the screen that arrives (issue 1484)", () => {
  for (const screen of SCREENS) {
    for (const width of WIDTHS) {
      it(
        `${screen.route().path} @ ${width}px`,
        async () => {
          const baseURL = getBaseURL();
          if (baseURL === null) throw new Error("tests/ui/layout/skeletons.test.ts: no app server is running");
          const route = screen.route();
          const url = urlFor(baseURL, route);
          const waiting = await withPage(
            width,
            async (page) => {
              await page.goto(url);
              return page.evaluate(drawnRegions);
            },
            { ...headersFor(route), firstPaint: true },
          );
          // A first paint with no region is a screen whose skeleton never
          // showed — the check would compare nothing and pass.
          expect(Object.keys(waiting), `${route.path} at ${width}px painted no skeleton region first`).not.toEqual([]);
          const loaded = await withPage(
            width,
            async (page) => {
              await page.goto(url);
              return page.evaluate(drawnRegions);
            },
            headersFor(route),
          );
          const found = mismatches(waiting, loaded);
          expect(found, `${route.path} at ${width}px:\n${found.join("\n")}`).toEqual([]);
        },
        PER_CASE_MS,
      );
    }
  }
});
