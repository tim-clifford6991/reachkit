// tests/ui/layout/shell-frame.test.ts — docs/DESIGN.md (owner, 2026-09-25, #1100)
//
// **The `/app` shell is full width.** From `lg` the side is fixed at the
// viewport's left edge, top to bottom; only the content beside it scrolls;
// and nothing in the side ever scrolls sideways.
//
// Every check the gate already ran passed on the shell this replaced: a
// 1280px box centred in the screen, a side that scrolled away with the
// document, and a side panel whose collapse tooltip hung 69px past its edge
// and gave it a sideways scrollbar. Nothing overflowed the *document*,
// nothing was clipped, no axe rule fired — so the frame's geometry is
// asserted here, in the browser, where it lives.
//
// One `it` per width and state, never a loop inside one (#1018). The rail
// is the collapsed state the gate's default sweep never renders, so it is
// set here through the same `localStorage` choice `RAIL_SCRIPT` restores.
import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { BAND_MIN } from "@/ui/layout/bands";
import { RAIL_STORAGE_KEY } from "@/app/(account)/app/_shell/drawer";
import { getAccountCookie, getBaseURL, withPage } from "./browser";
import { BREAKPOINT_MD_PX } from "./widths";

/** The widest screen the owner measured the centred box on (#1100): at
 *  1920 the side started at x=352 and `main` stayed 936px wide. */
const WIDE_SCREEN_PX = 1920;

const WIDTHS = [BAND_MIN.medium, BAND_MIN.wide, WIDE_SCREEN_PX] as const;
const STATES = ["panel", "rail"] as const;

/** One Chromium launch, a hydrated `/app` and a menu opened — the bound
 *  its neighbours give one route at one band. */
const PER_CASE_MS = 60_000;

interface Frame {
  readonly side: { left: number; top: number; height: number; right: number } | null;
  readonly viewport: { width: number; height: number };
  readonly content: { left: number; right: number } | null;
  /** The document's own scroll range: 0 means it cannot scroll. */
  readonly documentScrollPx: number;
  /** The content region's scroll range: more than 0 on a long screen. */
  readonly contentScrollPx: number;
  /** Every box in the side that scrolls sideways, named. */
  readonly sidewaysScrollers: readonly string[];
}

/** Closure-free — `page.evaluate` serialises this function's own text. */
function measureFrame(): Frame {
  const side = document.querySelector('[data-testid="shell-sidebar"]');
  const content = document.querySelector(".drawer-content");
  const se = document.scrollingElement ?? document.documentElement;
  const sidewaysScrollers: string[] = [];
  if (side !== null) {
    for (const el of [side, ...Array.from(side.querySelectorAll("*"))]) {
      if (el.getClientRects().length === 0) continue;
      // "Scrolls sideways" is a box the reader can scroll on x. A `truncate`
      // is `overflow: hidden` and cuts its text on purpose; it is not one.
      const x = getComputedStyle(el).overflowX;
      if ((x === "auto" || x === "scroll") && el.scrollWidth > el.clientWidth + 1) {
        sidewaysScrollers.push(
          `${el.tagName.toLowerCase()}.${(el.getAttribute("class") ?? "").trim().split(/\s+/).join(".")} scrollWidth ${el.scrollWidth} in ${el.clientWidth}`
        );
      }
    }
  }
  const s = side?.getBoundingClientRect();
  const c = content?.getBoundingClientRect();
  return {
    side: s ? { left: s.left, top: s.top, height: s.height, right: s.right } : null,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    content: c ? { left: c.left, right: c.right } : null,
    documentScrollPx: se.scrollHeight - se.clientHeight,
    contentScrollPx: content ? content.scrollHeight - content.clientHeight : 0,
    sidewaysScrollers,
  };
}

/** Opens the visible theme menu and answers whether its middle is the menu
 *  itself — the menu is on screen and no scroll container cut it off. */
async function themeMenuUnclipped(page: Page): Promise<boolean> {
  const toggle = page.locator('[data-testid="shell-sidebar"] [data-testid="theme-toggle"]:visible');
  await toggle.locator('[role="button"]').focus();
  const menu = toggle.locator("ul.dropdown-content");
  await menu.waitFor({ state: "visible" });
  return menu.evaluate((ul) => {
    const r = ul.getBoundingClientRect();
    if (r.left < 0 || r.right > window.innerWidth || r.top < 0) return false;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit !== null && ul.contains(hit);
  });
}

function urlFor(path: string): string {
  const baseURL = getBaseURL();
  if (!baseURL) throw new Error("tests/ui/layout/shell-frame.test.ts: no app server is running");
  return `${baseURL}${path}`;
}

describe("the /app shell is full width: the side is fixed at the left edge and only the content scrolls (#1100)", () => {
  for (const width of WIDTHS) {
    for (const state of STATES) {
      it(
        `${width}px, ${state}`,
        async () => {
          const seen = await withPage(
            width,
            async (page) => {
              await page.addInitScript(
                ([key, value]) => {
                  try {
                    localStorage.setItem(key, value);
                  } catch {
                    // A storage that refuses is the panel, which is fine.
                  }
                },
                [RAIL_STORAGE_KEY, state === "rail" ? "1" : "0"] as const
              );
              await page.goto(urlFor("/app"));
              const before = await page.evaluate(measureFrame);
              // Scroll the content and read the side again: it must not move.
              await page.evaluate(() => {
                const content = document.querySelector(".drawer-content");
                if (content) content.scrollTop = content.scrollHeight;
              });
              const after = await page.evaluate(measureFrame);
              const railShown = await page
                .locator('[data-testid="shell-rail"]')
                .isVisible();
              const menu = await themeMenuUnclipped(page);
              return { before, after, railShown, menu };
            },
            { extraHTTPHeaders: { Cookie: getAccountCookie() } }
          );
          const { before, after } = seen;

          expect(seen.railShown, "the state under test is the one on screen").toBe(state === "rail");
          expect(before.side, "no [data-testid=shell-sidebar] on /app").not.toBeNull();
          expect(before.side?.left, "the side starts at the left edge").toBeCloseTo(0, 0);
          expect(before.side?.top, "the side starts at the top").toBeCloseTo(0, 0);
          expect(before.side?.height, "the side is the viewport tall").toBeCloseTo(before.viewport.height, 0);
          // The content fills the width beside the side, not a centred box.
          expect(before.content?.left).toBeCloseTo(before.side?.right ?? -1, 0);
          expect(before.content?.right).toBeCloseTo(before.viewport.width, 0);

          expect(before.documentScrollPx, "the document does not scroll").toBeLessThanOrEqual(0);
          expect(before.contentScrollPx, "the overview is taller than the viewport, so the content scrolls").toBeGreaterThan(0);
          expect(after.side, "scrolling the content does not move the side").toEqual(before.side);
          expect(before.sidewaysScrollers, "nothing in the side scrolls sideways").toEqual([]);
          expect(seen.menu, "the theme menu opens on screen, unclipped").toBe(true);
        },
        PER_CASE_MS
      );
    }
  }
});

/** Closure-free, as `measureFrame` is. What a phone's shell is, read off
 *  the screen: where the bar and the tab bar stand, and what can be pressed. */
function measurePhone(): {
  bar: { top: number; bottom: number } | null;
  tabs: { top: number } | null;
  publishing: string | null;
  dock: boolean;
  panelControls: number;
  panelLinks: number;
  status: { top: number; bottom: number }[];
  main: { top: number } | null;
  scrolled: number;
} {
  const shown = (el: Element): boolean => {
    if (el.getClientRects().length === 0) return false;
    const style = getComputedStyle(el);
    return style.visibility !== "hidden" && style.opacity !== "0";
  };
  const box = (selector: string): DOMRect | null => {
    const el = Array.from(document.querySelectorAll(selector)).find(shown);
    return el ? el.getBoundingClientRect() : null;
  };
  const bar = box('[data-testid="shell-top"]');
  const tabs = box('[data-testid="overview-tabs"], [data-testid="settings-tabs"]');
  const main = box("main");
  const line = Array.from(document.querySelectorAll('[data-testid="shell-top-publishing"]')).find(shown);
  return {
    bar: bar ? { top: bar.top, bottom: bar.bottom } : null,
    tabs: tabs ? { top: tabs.top } : null,
    publishing: line ? (line.textContent ?? "").trim() : null,
    dock: box('[data-testid="shell-dock"]') !== null,
    // Anything on screen that drives the panel's toggle, and the toggle.
    panelControls: Array.from(document.querySelectorAll('.drawer-toggle, label[for="app-drawer"]')).filter(shown).length,
    panelLinks: Array.from(document.querySelectorAll('[data-testid="shell-sidebar"] a')).filter(shown).length,
    status: Array.from(document.querySelectorAll('[data-testid="shell-onboarding"]'))
      .filter(shown)
      .map((el) => el.getBoundingClientRect())
      .map((r) => ({ top: r.top, bottom: r.bottom })),
    main: main ? { top: main.top } : null,
    scrolled: window.scrollY,
  };
}

describe("on a phone the bottom bar is the navigation, and the top bar sticks (owner, 2026-10-08, issue 1339)", () => {
  for (const width of [BAND_MIN.compact, BREAKPOINT_MD_PX]) {
    for (const path of ["/app", "/app/settings"]) {
      it(
        `${width}px, ${path}: no panel, and the bar and the tab bar stay put while the page scrolls`,
        async () => {
          const seen = await withPage(
            width,
            async (page) => {
              // A remembered rail must not come back as a panel on a phone.
              await page.addInitScript((key) => {
                try {
                  localStorage.setItem(key, "1");
                } catch {
                  // A storage that refuses remembers nothing, which is fine.
                }
              }, RAIL_STORAGE_KEY);
              await page.goto(urlFor(path));
              const before = await page.evaluate(measurePhone);
              await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
              const after = await page.evaluate(measurePhone);
              return { before, after };
            },
            { extraHTTPHeaders: { Cookie: getAccountCookie() } }
          );
          const { before, after } = seen;

          expect(before.panelControls, "nothing on screen opens a panel").toBe(0);
          expect(before.panelLinks, "the panel's menu is not drawn").toBe(0);
          expect(before.dock, "the dock is the navigation").toBe(true);
          expect(before.bar?.top, "the bar starts at the top").toBeCloseTo(0, 0);
          expect(before.publishing, "the publishing line is on the bar").toBeTruthy();
          expect(before.status, "no pass is running, so no status line").toEqual([]);

          expect(after.scrolled, "the screen is taller than the viewport, so it scrolled").toBeGreaterThan(0);
          expect(after.bar, "the bar does not move").toEqual(before.bar);
          expect(after.publishing).toBe(before.publishing);
          expect(after.tabs?.top, "the tab bar is directly under the bar").toBeCloseTo(after.bar?.bottom ?? -1, 0);
        },
        PER_CASE_MS
      );
    }
  }
});
