// tests/ui/layout/in-app-navigation.test.ts — SPEC §4 (2026-10-08), issue 1341
//
// **A tap inside the app does not reload the app.** Every in-app link was a
// plain `<a href>`, so a Settings tab change was a full document load: the
// shell, the tab bar and the panel were fetched and painted again. They are
// `next/link` now, and what that buys is only visible in a browser — the
// served HTML is the same anchor either way.
//
// So this asks the built, hydrated app the two things the customer would
// notice:
//
//   - a Settings tab change keeps `settings/layout.tsx` mounted. The tab
//     bar is that layout's own element; the same DOM node, in the same
//     document, is still on screen after the change.
//   - on a phone, a tap in the side panel still closes it. A full load used
//     to do that by itself; a transition keeps the shell — and its open
//     drawer — mounted, so the menu closes it.
import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { BAND_MIN } from "@/ui/layout/bands";
import { DESTINATION_HREF } from "@/app/(account)/app/_shell/destinations";
import { DRAWER_TOGGLE_ID } from "@/app/(account)/app/_shell/drawer";
import { SETTINGS_TABS, SETTINGS_TAB_HREF } from "@/app/(account)/app/settings/tabs";
import { getAccountCookie, getBaseURL, withPage } from "./browser";

const PHONE_PX = 390;

/** One Chromium launch, one hydrated screen and one transition. */
const PER_CASE_MS = 60_000;

function urlFor(href: string): string {
  const baseURL = getBaseURL();
  if (!baseURL) {
    throw new Error("tests/ui/layout/in-app-navigation.test.ts: no app server is running");
  }
  return `${baseURL}${href}`;
}

/** Mark this document, and one element of it. A full load loses both. */
function mark(selector: string): boolean {
  const el = document.querySelector(selector);
  if (el === null) return false;
  (window as unknown as { rkDocument?: boolean }).rkDocument = true;
  (el as unknown as { rkMounted?: boolean }).rkMounted = true;
  return true;
}

interface After {
  /** The document the tap was made in is the one now on screen. */
  readonly sameDocument: boolean;
  /** The marked element is the one now on screen — it was not remounted. */
  readonly sameElement: boolean;
  /** The marked tab or destination, by `data-testid`. */
  readonly current: string | null;
  /** The drawer's box: checked is open, below `lg`. */
  readonly drawerOpen: boolean;
}

function read(args: { selector: string; toggleId: string }): After {
  const el = document.querySelector(args.selector);
  const toggle = document.getElementById(args.toggleId);
  return {
    sameDocument: (window as unknown as { rkDocument?: boolean }).rkDocument === true,
    sameElement: (el as unknown as { rkMounted?: boolean } | null)?.rkMounted === true,
    current: el?.querySelector('[aria-current="page"]')?.getAttribute("data-testid") ?? null,
    drawerOpen: toggle instanceof HTMLInputElement && toggle.checked,
  };
}

async function arrive(page: Page, href: string): Promise<void> {
  await page.waitForURL((url) => url.pathname === href);
}

describe("SPEC §4 (2026-10-08) — in-app navigation is a client transition", () => {
  const [from, to] = SETTINGS_TABS;
  const bar = '[data-testid="settings-tabs"]';

  it(
    `${SETTINGS_TAB_HREF[from]} → ${SETTINGS_TAB_HREF[to]}: the settings layout stays mounted`,
    async () => {
      const after = await withPage(
        BAND_MIN.wide,
        async (page) => {
          await page.goto(urlFor(SETTINGS_TAB_HREF[from]));
          expect(await page.evaluate(mark, bar), "the tab bar was not drawn").toBe(true);
          await page.click(`[data-testid="settings-tab-${to}"]`);
          await arrive(page, SETTINGS_TAB_HREF[to]);
          await page.waitForSelector(`[data-testid="settings-tab-${to}"][aria-current="page"]`);
          return page.evaluate(read, { selector: bar, toggleId: DRAWER_TOGGLE_ID });
        },
        { extraHTTPHeaders: { Cookie: getAccountCookie() } }
      );

      expect(after.current).toBe(`settings-tab-${to}`);
      expect(after.sameDocument, "the tab change loaded a new document").toBe(true);
      expect(after.sameElement, "the tab change remounted the settings layout").toBe(true);
    },
    PER_CASE_MS
  );

  it(
    `at ${PHONE_PX}px a tap in the side panel goes to ${DESTINATION_HREF.calendar} and closes the panel`,
    async () => {
      const nav = '[data-testid="shell-sidebar-nav"]';
      const after = await withPage(
        PHONE_PX,
        async (page) => {
          await page.goto(urlFor(DESTINATION_HREF.overview));
          expect(await page.evaluate(mark, nav), "the panel's menu was not drawn").toBe(true);
          await page.click('[data-testid="shell-menu-button"]');
          await page.click(`${nav} [data-testid="shell-navlink-calendar"]`);
          await arrive(page, DESTINATION_HREF.calendar);
          await page.waitForSelector(`${nav} [data-testid="shell-navlink-calendar"][aria-current="page"]`);
          return page.evaluate(read, { selector: nav, toggleId: DRAWER_TOGGLE_ID });
        },
        { extraHTTPHeaders: { Cookie: getAccountCookie() } }
      );

      expect(after.sameDocument, "the tap loaded a new document").toBe(true);
      expect(after.sameElement, "the tap remounted the shell").toBe(true);
      expect(after.drawerOpen, "the panel stayed open over the screen").toBe(false);
    },
    PER_CASE_MS
  );
});
