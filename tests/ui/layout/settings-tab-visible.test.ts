// tests/ui/layout/settings-tab-visible.test.ts — SPEC §4 (2026-09-20), #925, #1101
//
// **On a phone, every Settings tab is on screen and the current one is marked.**
//
// Settings' bar is seven words, 626px of tabs, and a 390px phone's row is
// 358px. First the row was a scroll container that opened at its start, so
// the marked tab could sit past the right edge (#925). Scrolling it into
// view fixed that, but four of the seven tabs were still off-screen with
// nothing to say they existed (#1101, the 2026-09-25 shell review). Below
// `sm` the bar now wraps, so there is nothing to scroll and nothing hidden.
//
// Every check the layout suite already ran passed on both defects: nothing
// overflowed the screen, the row contained its content perfectly and simply
// showed the wrong part of it. So this file makes the claim the customer
// cares about — each tab's box lies inside the bar, the bar scrolls nothing,
// and each tab is a 44px target — rendered and hydrated, at 390 and at 320.
//
// The enumerator is `tabs.ts` — the tuple the bar is built from — so an
// eighth tab is in scope by construction rather than by being listed here.
import { describe, expect, it } from "vitest";
import {
  SETTINGS_TABS,
  SETTINGS_TAB_HREF,
} from "@/app/(account)/app/settings/tabs";
import { getAccountCookie, getBaseURL, withPage } from "./browser";

/** The phone bands the defect is about. From `sm` up the strip is one
 *  scrolling row, unchanged. */
const PHONE_BANDS_PX = [390, 320] as const;

/** WCAG 2.5.5's target, which the phone bar's links are sized to. */
const TARGET_PX = 44;

/** Chromium starts per call (`browser.ts`). */
const PER_ROUTE_BROWSER_MS = 60_000;

interface Seen {
  /** The marked tab's own `data-testid`, or null when none is marked. */
  readonly current: string | null;
  /** How many tabs the bar drew. */
  readonly tabs: number;
  /** Tabs whose box lies outside the bar's box, with the overhang in px. */
  readonly outside: readonly string[];
  /** Elements in the bar that scroll sideways (`scrollWidth > clientWidth`). */
  readonly scrolling: readonly string[];
  /** Tabs shorter than the target, with their height. */
  readonly short: readonly string[];
}

/** Read in the page. Closure-free — `page.evaluate` serialises this
 *  function's own text, so the target is passed in. */
function measureBar(targetPx: number): Seen {
  const bar = document.querySelector('[data-testid="settings-tabs"]');
  if (bar === null) {
    return { current: null, tabs: 0, outside: [], scrolling: [], short: [] };
  }
  const barBox = bar.getBoundingClientRect();
  const tabs = Array.from(bar.querySelectorAll("a"));
  const outside: string[] = [];
  const short: string[] = [];
  for (const tab of tabs) {
    const box = tab.getBoundingClientRect();
    const name = tab.getAttribute("data-testid") ?? tab.textContent ?? "?";
    // A pixel of tolerance: a fractional layout can put a border box a hair
    // outside a padding box with nothing wrong.
    const overhang = Math.max(
      0,
      barBox.left - box.left,
      box.right - barBox.right,
      barBox.top - box.top,
      box.bottom - barBox.bottom
    );
    if (overhang > 1) outside.push(`${name} by ${Math.round(overhang)}px`);
    if (box.height < targetPx - 0.5) short.push(`${name} at ${box.height}px`);
  }
  const scrolling = [bar, ...Array.from(bar.querySelectorAll("*"))]
    .filter((el) => el.scrollWidth > el.clientWidth + 1)
    .map((el) => `${el.tagName.toLowerCase()}.${el.className} ${el.scrollWidth}>${el.clientWidth}`);
  return {
    current: bar.querySelector('[aria-current="page"]')?.getAttribute("data-testid") ?? null,
    tabs: tabs.length,
    outside,
    scrolling,
    short,
  };
}

function urlFor(href: string): string {
  const baseURL = getBaseURL();
  if (!baseURL) {
    throw new Error(
      "tests/ui/layout/settings-tab-visible.test.ts: no app server is running"
    );
  }
  return `${baseURL}${href}`;
}

for (const width of PHONE_BANDS_PX) {
  describe(`every Settings tab is on screen at ${width}px — ${SETTINGS_TABS.length} address(es)`, () => {
    for (const tab of SETTINGS_TABS) {
      const href = SETTINGS_TAB_HREF[tab];
      it(
        `${href}: all ${SETTINGS_TABS.length} tabs inside the bar, none scrolled, its own tab marked, each ${TARGET_PX}px tall`,
        async () => {
          const seen = await withPage(
            width,
            async (page) => {
              await page.goto(urlFor(href));
              return page.evaluate(measureBar, TARGET_PX);
            },
            { extraHTTPHeaders: { Cookie: getAccountCookie() } }
          );

          // Rule 5.5: the sweep found the thing it is about.
          expect(seen.tabs, `${href} drew ${seen.tabs} tab(s)`).toBe(SETTINGS_TABS.length);
          expect(seen.current, `${href} marked the wrong tab`).toBe(`settings-tab-${tab}`);
          expect(seen.outside, `${href} at ${width}px: tabs outside the bar`).toEqual([]);
          expect(seen.scrolling, `${href} at ${width}px: the bar scrolls sideways`).toEqual([]);
          expect(seen.short, `${href} at ${width}px: tabs under ${TARGET_PX}px`).toEqual([]);
        },
        PER_ROUTE_BROWSER_MS
      );
    }
  });
}
