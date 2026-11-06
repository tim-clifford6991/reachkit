// tests/ui/layout/thin-market-phone.test.ts — SPEC §6 (owner ruling 2026-09-17, issue 837)
//
// A market too small asks the customer to pick a broader one. The choice is the shell's notice, so it has to be on
// screen at every width that asks: on a phone under the top bar on every `/app` tab, on a desktop in the side panel.
// The Overview itself offers no chooser of its own (owner R17).
import { expect, it } from "vitest";
import { copy } from "@/lib/presentation/copy";
import { getBaseURL, getThinMarketAccountCookie, withPage } from "./browser";

const PHONE = { width: 390, height: 844 } as const;

/** Read in the page. Closure-free: `page.evaluate` serialises its text. */
function read() {
  const shown = (el: Element) => getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0;
  const usable = (el: Element | null) => {
    if (el === null || !shown(el) || (el as HTMLButtonElement).disabled) return false;
    el.scrollIntoView({ block: "center" });
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return box.left >= 0 && box.right <= window.innerWidth && hit !== null && el.contains(hit);
  };
  const notice = document.querySelector('[data-testid="shell-onboarding-notice"]');
  const choices = Array.from(document.querySelectorAll('[data-testid="category-choice"]')).filter(shown);
  const choice = choices[0] ?? null;
  return {
    notice: notice !== null && shown(notice) ? (notice.querySelector("span")?.textContent ?? "") : null,
    choicesShown: choices.length,
    inNotice: choice !== null && notice !== null && notice.contains(choice),
    onOverview: document.querySelectorAll('[data-testid="overview"] [data-testid="category-choice"]').length,
    suggestion: usable(choice?.querySelector('[data-testid="category-suggestion"]') ?? null),
    own: usable(choice?.querySelector('input[name="category"]') ?? null),
    submit: usable(choice?.querySelector('form:last-of-type button[type="submit"]') ?? null),
    scrollsSideways: document.documentElement.scrollWidth > window.innerWidth,
  };
}

async function at(width: number, path: string) {
  return withPage(
    width,
    async (page) => {
      if (width === PHONE.width) await page.setViewportSize(PHONE);
      await page.goto(`${getBaseURL()}${path}`);
      return page.evaluate(read);
    },
    { extraHTTPHeaders: { Cookie: getThinMarketAccountCookie() } }
  );
}

it.each(["/app", "/app/calendar"])("at 390, %s shows the market-too-small notice with one usable broader-market choice", async (path) => {
  const phone = await at(PHONE.width, path);
  expect(phone.notice).toBe(copy("setup.release.market-too-small"));
  expect(phone.choicesShown, "exactly one choice on screen").toBe(1);
  expect(phone.inNotice, "the choice is the shell notice's own").toBe(true);
  expect(phone.onOverview, "R17: the Overview offers no chooser of its own").toBe(0);
  expect({ suggestion: phone.suggestion, own: phone.own, submit: phone.submit }).toEqual({ suggestion: true, own: true, submit: true });
  expect(phone.scrollsSideways, "the page scrolls sideways").toBe(false);
}, 60_000);

it("at 1280 the side panel keeps the one choice, and the Overview still offers none", async () => {
  const desk = await at(1280, "/app");
  expect(desk.notice).toBe(copy("setup.release.market-too-small"));
  expect(desk.choicesShown).toBe(1);
  expect(desk.inNotice).toBe(true);
  expect(desk.onOverview).toBe(0);
}, 60_000);
