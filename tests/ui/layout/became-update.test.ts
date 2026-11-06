// SPEC §7 (owner, 2026-11-05) — a day planned as a new page and filled by an update of a live page says so on its row
// and in its panel. Both lines fit at every width and theme, are on screen, and carry no serious or critical axe finding.
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "playwright";
import { expect, it } from "vitest";
import { copy } from "@/lib/presentation/copy";
import { getBaseURL, getBecameUpdateAccountCookie, withPage } from "./browser";
import { checkContainment, checkNoClippingOrTruncation, checkNoHorizontalScroll, MONO_FONT_FAMILY, SCROLL_CONTAINER_ALLOWLIST, TRUNCATION_ALLOWLIST } from "./checks";
import { BLOCKING_AXE_IMPACTS, NO_OVERFLOW_THEMES, NO_OVERFLOW_WIDTHS, settleForMeasurement } from "./no-overflow";
import { BECAME_UPDATE_DAY } from "./seed-became-update";

const ROW = `[data-testid="calendar-cell-${BECAME_UPDATE_DAY}"]`;
const PANEL_LINE = '[data-testid="day-became-update-line"]';

/** Read in the page: each line's text where it is displayed inside the viewport's width, else `null`. */
function read(selectors: { row: string; panel: string }) {
  const shown = (el: Element | null, box = el?.getBoundingClientRect()) =>
    el !== null && box !== undefined && getComputedStyle(el).display !== "none" && box.width > 0 && box.left >= 0 && box.right <= window.innerWidth ? el.textContent : null;
  return {
    state: shown(document.querySelector(`${selectors.row} [data-testid="cell-state-line"]`)),
    panel: shown(document.querySelector(selectors.panel)),
  };
}

const CASES = NO_OVERFLOW_WIDTHS.flatMap((width) => NO_OVERFLOW_THEMES.map((theme) => [width, theme] as const));

it.each(CASES)("at %i in %s, the row says Now an update and the panel says why, both fitting", async (width, theme) => {
  const found = await withPage(width, async (page: Page) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto(`${getBaseURL()}/app/calendar?day=${BECAME_UPDATE_DAY}`);
    await settleForMeasurement(page);
    return {
      lines: await page.evaluate(read, { row: ROW, panel: PANEL_LINE }),
      offenders: [
        await page.evaluate(checkNoHorizontalScroll),
        await page.evaluate(checkContainment, { scrollContainerAllowlist: SCROLL_CONTAINER_ALLOWLIST }),
        await page.evaluate(checkNoClippingOrTruncation, { scrollContainerAllowlist: SCROLL_CONTAINER_ALLOWLIST, truncationAllowlist: TRUNCATION_ALLOWLIST, monoFontFamily: MONO_FONT_FAMILY }),
      ].flat(),
      axe: (await new AxeBuilder({ page }).include(ROW).include(PANEL_LINE).analyze()).violations.filter((v) => BLOCKING_AXE_IMPACTS.includes(v.impact ?? "")),
    };
  }, { extraHTTPHeaders: { Cookie: getBecameUpdateAccountCookie() } });
  expect(found.lines).toEqual({ state: copy("calendar.day.became-update"), panel: copy("calendar.day.became-update.line") });
  expect(found.offenders).toEqual([]);
  expect(found.axe.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}, 60_000);
