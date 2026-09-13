// tests/ui/layout/settings-field.test.ts — BUILD §2, §4.7 (issue #231)
//
// The width sweep next door measures every route **at rest**. Settings has
// a state no route enumeration can reach: a field open inside a card, put
// there by a press in the browser. That state changes the card's box — a
// value and a small Edit become a labelled input, two buttons and, when a
// save is refused, a line under the field — and it is exactly the kind of
// change §2's layout law exists to catch.
//
// So this file presses Edit and then runs the same four checks the sweep
// runs, at the same widths. It is a browser suite because the state
// only exists in a browser: the field is opened by a client component's own
// state, and no server render produces it.
//
// One route and one field: the domain's. The two fields are the same
// element with a different label and the domain's is the longer of the two
// values, so it is the wider box; a card that fits it fits the category's.
import { describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { getAccountCookie, getBaseURL, withPage } from "./browser";
import {
  checkContainment,
  checkNoClippingOrTruncation,
  checkNoHorizontalScroll,
  checkTypeFloor,
  MONO_FONT_FAMILY,
  SCROLL_CONTAINER_ALLOWLIST,
  TRUNCATION_ALLOWLIST,
} from "./checks";
import { headersFor } from "./routes";
import { sweepWidths as widths } from "./matrix";

/** The route, and the session it is swept under — the same seeded account
 *  `browser.ts` put in the database (#193), through the same header builder
 *  the sweep uses, so a change to how an `(account)` route is reached moves
 *  this file with it. */
const SETTINGS = { path: "/app/settings", cookie: getAccountCookie() };

/** Long enough for the field to appear once the press lands. */
const HYDRATED_MS = 15_000;
/** Chromium starts per call (see `browser.ts`), and this one also waits for
 *  hydration before it can press anything. */
const PER_WIDTH_MS = 60_000;

function url(): string {
  const baseURL = getBaseURL();
  if (!baseURL) {
    throw new Error(
      "tests/ui/layout/settings-field.test.ts: no app server is running — `browser.ts` starts " +
        "one in globalSetup whenever the route sweep finds a route."
    );
  }
  return `${baseURL}${SETTINGS.path}`;
}

/**
 * Presses the domain's Edit and waits for its field.
 *
 * The press is retried rather than made once: Playwright waits for the
 * button to be there and clickable, which is not the same as React having
 * hydrated the card and attached its handler, and a click that lands in
 * between is simply lost. Retrying is the honest wait — the assertion is
 * about the layout of an open field, and a test that measured a closed card
 * and passed would be the failure this file exists to prevent.
 */
async function openDomainField(page: Page): Promise<void> {
  const deadline = Date.now() + HYDRATED_MS;
  for (;;) {
    await page.click('[data-testid="setting-domain"] button');
    try {
      await page.waitForSelector('[data-testid="edit-domain"]', { timeout: 500 });
      return;
    } catch (err) {
      if (Date.now() > deadline) throw err;
    }
  }
}

describe(`layout sweep — ${SETTINGS.path} with a field open × ${widths().length} width(s)`, () => {
  for (const width of widths()) {
    it(
      `${SETTINGS.path} @ ${width}px reports no offender on checks 1-4 with the domain field open`,
      async () => {
        const offenders = await withPage(
          width,
          async (page) => {
            await page.goto(url());
            await openDomainField(page);
            const results = [
              await page.evaluate(checkNoHorizontalScroll),
              await page.evaluate(checkContainment, {
                scrollContainerAllowlist: SCROLL_CONTAINER_ALLOWLIST,
              }),
              await page.evaluate(checkNoClippingOrTruncation, {
                scrollContainerAllowlist: SCROLL_CONTAINER_ALLOWLIST,
                truncationAllowlist: TRUNCATION_ALLOWLIST,
                monoFontFamily: MONO_FONT_FAMILY,
              }),
              await page.evaluate(checkTypeFloor),
            ];
            return results.flat();
          },
          headersFor(SETTINGS)
        );
        expect(offenders).toEqual([]);
      },
      PER_WIDTH_MS
    );
  }
});
