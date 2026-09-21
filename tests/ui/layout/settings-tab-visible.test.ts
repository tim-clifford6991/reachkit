// tests/ui/layout/settings-tab-visible.test.ts — SPEC §4 (2026-09-20), #925
//
// **The tab you are on is on screen when the screen opens.**
//
// Settings' bar is seven words and a 390px phone holds about four, so the row
// is a scroll container (`docs/DESIGN.md`'s no-overflow rule: a nav word
// cannot be clamped to an ellipsis and stay a nav word). A scroll container
// opens at its start — so on Mail, Billing and Account the marked tab was
// past the right edge, and the one thing the bar exists to say was the one
// thing a phone could not see. `aria-current` was set and `tab-active` was
// painted the whole time; neither is visible if it is not on screen. The
// owner found it on this issue's own 390 renders, 2026-09-21.
//
// `SettingsTabs` scrolls the current link into view on mount. This is the
// assertion that it worked, and it is worth its own file for the reason the
// defect existed at all: every check the layout suite already runs passed.
// Nothing overflowed, nothing was clipped, no axe rule fired — the row
// contained its content perfectly and simply showed the wrong part of it.
// "No offender" and "the customer can see where they are" are two different
// claims, and only one of them was being made.
//
// **It has to be a rendered assertion, and a hydrated one.** The effect runs
// in the browser after mount, so a static render proves nothing: this suite
// is the only place in the repository that gets both. `no-overflow.test.ts`
// waits for `<next-route-announcer>` before it measures; this file waits for
// the same thing through `withPage`'s own settling, then reads two boxes.
//
// The enumerator is `tabs.ts` — the tuple the bar is built from — so an
// eighth tab is in scope by construction rather than by being listed here.
import { describe, expect, it } from "vitest";
import {
  SETTINGS_TABS,
  SETTINGS_TAB_HREF,
} from "@/app/(account)/app/settings/tabs";
import { getAccountCookie, getBaseURL, withPage } from "./browser";

/** The band the defect is about. Above it all seven words fit, so there is
 *  nothing to scroll and nothing to bring into view — which is why this
 *  file measures one width and gains a second only if the bar grows. */
const PHONE_PX = 390;

/** Chromium starts per call (`browser.ts`); the same bound its neighbours
 *  use, times the seven addresses this walks. */
const SWEEP_MS = 180_000;

interface Seen {
  /** The marked tab's own `data-testid`, so a failure names the tab. */
  readonly tab: string | null;
  /** Whether the marked tab's box lies inside the scrolling row's box. */
  readonly inside: boolean;
  /** How far outside it is, in px, for the message. */
  readonly overhangPx: number;
  /** The row's own scroll offset, so a pass at zero on a wide row reads as
   *  what it is rather than as the effect having run. */
  readonly scrollLeft: number;
  readonly scrollable: boolean;
}

/** Read in the page: the marked tab against the row that scrolls it.
 *  Closure-free — `page.evaluate` serialises this function's own text. */
function measureCurrentTab(): Seen {
  const row = document.querySelector('[data-testid="settings-tabs"]');
  const tab = document.querySelector('[data-testid="settings-tabs"] [aria-current="page"]');
  if (row === null || tab === null) {
    return { tab: null, inside: false, overhangPx: 0, scrollLeft: 0, scrollable: false };
  }
  const rowBox = row.getBoundingClientRect();
  const tabBox = tab.getBoundingClientRect();
  // A pixel of tolerance: a fractional layout can put a border box a
  // hair outside a padding box with nothing wrong, and the defect this
  // guards against was a whole tab's width, not a hair.
  const left = tabBox.left - rowBox.left;
  const right = rowBox.right - tabBox.right;
  const overhangPx = Math.max(0, -Math.min(left, right));
  return {
    tab: tab.getAttribute("data-testid"),
    inside: overhangPx <= 1,
    overhangPx,
    scrollLeft: row.scrollLeft,
    scrollable: row.scrollWidth > row.clientWidth + 1,
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

describe(`the current Settings tab is on screen at ${PHONE_PX}px — ${SETTINGS_TABS.length} address(es)`, () => {
  it(
    "every one of the seven addresses opens with its own tab inside the scrolling row",
    async () => {
      const cookie = getAccountCookie();
      const scrolled: string[] = [];

      for (const tab of SETTINGS_TABS) {
        const href = SETTINGS_TAB_HREF[tab];
        const seen = await withPage(
          PHONE_PX,
          async (page) => {
            await page.goto(urlFor(href));
            return page.evaluate(measureCurrentTab);
          },
          { extraHTTPHeaders: { Cookie: cookie } }
        );

        // Rule 5.5: the sweep found the thing it is about. A row with no
        // marked tab is the older defect — `settingsTabOf` matching nothing
        // — and it fails here saying that rather than passing vacuously.
        expect(seen.tab, `${href} rendered no tab marked aria-current`).toBe(
          `settings-tab-${tab}`
        );
        expect(
          seen.inside,
          `${href}: the ${tab} tab stands ${seen.overhangPx}px outside the row (scrollLeft ${seen.scrollLeft})`
        ).toBe(true);
        if (seen.scrollLeft > 0) scrolled.push(`${tab}@${seen.scrollLeft}`);
      }

      // The half that says the effect ran rather than that the row happened
      // to be wide enough: at least one of the seven had to be scrolled to
      // be visible, which is the defect the owner saw (Mail, Billing and
      // Account were past the right edge).
      console.log(
        `tests/ui/layout/settings-tab-visible.test.ts: ${SETTINGS_TABS.length} address(es) at ${PHONE_PX}px; row scrolled for ${scrolled.join(", ") || "none"}`
      );
      expect(
        scrolled.length,
        "no address needed the row scrolled — either the bar no longer overflows a phone, in which case this file has nothing to guard, or the effect did not run"
      ).toBeGreaterThan(0);
    },
    SWEEP_MS
  );
});
