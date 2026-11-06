// tests/ui/layout/thin-market-phone.test.ts — SPEC §6 (owner ruling 2026-09-17, issue 837)
//
// A market too small asks the customer to pick a broader one. The choice is the shell's notice, so it has to be on
// screen at every width that asks: below `lg` under the top bar on every `/app` tab, on a desktop in the side panel.
// The Overview itself offers no chooser of its own (owner R17).
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "playwright";
import { expect, it } from "vitest";
import { copy } from "@/lib/presentation/copy";
import { getBaseURL, getThinMarketAccountCookie, withPage } from "./browser";
import { BLOCKING_AXE_IMPACTS, settleForMeasurement } from "./no-overflow";

const NOTICE = '[data-testid="shell-onboarding-notice"]';

/** WCAG 2.5.5's target, the height a thumb is given below `lg`. */
const TAP_PX = 44;

/** Read in the page. Closure-free: `page.evaluate` serialises its text. */
function read() {
  const shown = (el: Element) => getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0;
  // Displayed, enabled, inside the viewport and hit at its centre: the height it offers a thumb, or 0.
  const usable = (el: Element | null) => {
    if (el === null || !shown(el) || (el as HTMLButtonElement).disabled) return 0;
    el.scrollIntoView({ block: "center" });
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return box.left >= 0 && box.right <= window.innerWidth && hit !== null && el.contains(hit) ? box.height : 0;
  };
  const notice = document.querySelector('[data-testid="shell-onboarding-notice"]');
  const choices = Array.from(document.querySelectorAll('[data-testid="category-choice"]')).filter(shown);
  const choice = choices[0] ?? null;
  return {
    notice: notice !== null && shown(notice) ? (notice.querySelector("span")?.textContent ?? "") : null,
    choicesShown: choices.length,
    inNotice: choice !== null && notice !== null && notice.contains(choice),
    onOverview: document.querySelectorAll('[data-testid="overview"] [data-testid="category-choice"]').length,
    // One live region, the sentence, with no form inside it.
    liveRegions: notice === null ? -1 : notice.querySelectorAll('[role="status"]').length + (notice.matches('[role="status"]') ? 1 : 0),
    formInLiveRegion: notice?.querySelector('[role="status"] form') !== null || notice?.matches('[role="status"]') === true,
    heights: {
      suggestion: usable(choice?.querySelector('[data-testid="category-suggestion"]') ?? null),
      own: usable(choice?.querySelector('input[name="category"]') ?? null),
      submit: usable(choice?.querySelector('form:last-of-type button[type="submit"]') ?? null),
    },
    scrollsSideways: document.documentElement.scrollWidth > window.innerWidth,
  };
}

async function at<T>(width: number, path: string, fn: (page: Page) => Promise<T>, theme: "light" | "dark" = "light"): Promise<T> {
  return withPage(
    width,
    async (page) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto(`${getBaseURL()}${path}`);
      await settleForMeasurement(page);
      return fn(page);
    },
    { extraHTTPHeaders: { Cookie: getThinMarketAccountCookie() } }
  );
}

it.each([
  [320, "/app"],
  [390, "/app"],
  [390, "/app/calendar"],
  [1023, "/app"],
] as const)("below lg, at %i on %s, the market-too-small notice holds one usable choice with 44px targets", async (width, path) => {
  const shown = await at(width, path, (page) => page.evaluate(read));
  expect(shown.notice).toBe(copy("setup.release.market-too-small"));
  expect(shown.choicesShown, "exactly one choice on screen").toBe(1);
  expect(shown.inNotice, "the choice is the shell notice's own").toBe(true);
  expect(shown.onOverview, "R17: the Overview offers no chooser of its own").toBe(0);
  expect({ liveRegions: shown.liveRegions, formInLiveRegion: shown.formInLiveRegion }).toEqual({ liveRegions: 1, formInLiveRegion: false });
  for (const [part, height] of Object.entries(shown.heights)) {
    expect(height, `${part} is not usable, or under ${TAP_PX}px`).toBeGreaterThanOrEqual(TAP_PX);
  }
  expect(shown.scrollsSideways, "the page scrolls sideways").toBe(false);
}, 60_000);

it.each(["light", "dark"] as const)("at 390 in %s, the notice and its choice have no serious or critical axe finding", async (theme) => {
  const found = await at(390, "/app", async (page) => (await new AxeBuilder({ page }).include(NOTICE).analyze()).violations, theme);
  const blocking = found.filter((v) => BLOCKING_AXE_IMPACTS.includes(v.impact ?? ""));
  expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}, 60_000);

it("at 1280 the side panel keeps the one choice, and the Overview still offers none", async () => {
  const desk = await at(1280, "/app", (page) => page.evaluate(read));
  expect(desk.notice).toBe(copy("setup.release.market-too-small"));
  expect(desk.choicesShown).toBe(1);
  expect(desk.inNotice).toBe(true);
  expect(desk.onOverview).toBe(0);
}, 60_000);
