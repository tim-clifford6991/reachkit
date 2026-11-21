// tests/ui/layout/settings-field.test.ts — Settings › Your Business with a dialog open (plates F1a, F9)
//
// The width sweep measures every route at rest. A setting's dialog is a state only a press in the browser
// reaches, so this file presses the website's *Change* and runs the same four checks at the same widths. It also
// holds what the dialog promises a keyboard and a phone: focus goes in and comes back, Escape discards, a refusal
// is announced with the dialog still open, the dialog is the whole screen at 390, and the tab fits 1280×800.
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

const SETTINGS = { path: "/app/settings", cookie: getAccountCookie() };
const CHANGE = '[data-testid="setting-domain-dialog-change"]';
const DIALOG = '[data-testid="setting-domain-dialog"]';

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

/** Presses the website's *Change* until its dialog opens: a click before hydration is lost, so it is retried. */
async function openDomainField(page: Page): Promise<void> {
  const deadline = Date.now() + HYDRATED_MS;
  for (;;) {
    await page.click(CHANGE);
    try {
      await page.waitForSelector(`${DIALOG}[open] [data-testid="edit-domain"] input`, { timeout: 500 });
      return;
    } catch (err) {
      if (Date.now() > deadline) throw err;
    }
  }
}

describe(`layout sweep — ${SETTINGS.path} with a field open × ${widths().length} width(s)`, () => {
  for (const width of widths()) {
    it(
      `${SETTINGS.path} @ ${width}px reports no offender on checks 1-4 with the website dialog open`,
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

describe(`${SETTINGS.path}: the edit dialog`, () => {
  it(
    "takes focus, announces a refusal and stays open, and Escape returns focus to its Change",
    async () => {
      const seen = await withPage(
        1280,
        async (page) => {
          await page.goto(url());
          await openDomainField(page);
          const focusedInside = await page.evaluate((d) => document.querySelector(d)?.contains(document.activeElement) === true && document.activeElement?.tagName === "INPUT", DIALOG);
          await page.fill(`${DIALOG} input`, "no-such-site.invalid");
          await page.click(`${DIALOG} button[type="submit"]`);
          const alert = await page.waitForSelector(`${DIALOG}[open] [role="alert"]`, { timeout: HYDRATED_MS });
          const said = (await alert.textContent())?.trim() ?? "";
          await page.keyboard.press("Escape");
          await page.waitForSelector(`${DIALOG}:not([open])`, { state: "attached" });
          const back = await page.evaluate((c) => document.activeElement === document.querySelector(c), CHANGE);
          return { focusedInside, said, back };
        },
        headersFor(SETTINGS)
      );
      expect(seen.focusedInside).toBe(true);
      expect(seen.said).not.toBe("");
      expect(seen.back).toBe(true);
    },
    PER_WIDTH_MS
  );

  it(
    "is the whole screen at 390px",
    async () => {
      const box = await withPage(
        390,
        async (page) => {
          await page.goto(url());
          await openDomainField(page);
          return page.evaluate((d) => {
            const r = document.querySelector(`${d} .modal-box`)!.getBoundingClientRect();
            return { width: Math.round(r.width), height: Math.round(r.height), vw: window.innerWidth, vh: window.innerHeight };
          }, DIALOG);
        },
        headersFor(SETTINGS)
      );
      expect(box.width).toBe(box.vw);
      expect(box.height).toBe(box.vh);
    },
    PER_WIDTH_MS
  );

  it(
    "leaves the tab fitting 1280×800 with no page scroll and no column scroll, with the fixture's competitors and with 5",
    async () => {
      const seen = await withPage(
        1280,
        async (page) => {
          await page.setViewportSize({ width: 1280, height: 800 });
          await page.goto(url());
          // Closure-free: each evaluate serialises its own text.
          const measure = () =>
            page.evaluate(() => {
              const content = document.querySelector(".drawer-content")!;
              const doc = document.scrollingElement ?? document.documentElement;
              const columns = Array.from(document.querySelectorAll('[data-testid="settings-tab-panel-business"] > *'));
              return {
                content: content.scrollHeight - content.clientHeight,
                document: doc.scrollHeight - doc.clientHeight,
                columns: columns.map((column) => column.scrollHeight - column.clientHeight),
              };
            });
          const fixture = await measure();
          // Five competitors, the most a site follows: copies of the table's first competitor row.
          await page.evaluate(() => {
            const body = document.querySelector('[data-testid="setting-competitors"] tbody')!;
            const first = body.querySelector('tr[data-testid^="competitor-"]');
            const you = body.querySelector('[data-testid="competitors-you"]');
            while (first && body.querySelectorAll('tr[data-testid^="competitor-"]').length < 5) body.insertBefore(first.cloneNode(true), you);
          });
          return { fixture, five: await measure() };
        },
        headersFor(SETTINGS)
      );
      for (const [name, over] of Object.entries(seen)) {
        expect(over.columns.length, name).toBe(2);
        expect(over, name).toEqual({ content: 0, document: 0, columns: [0, 0] });
      }
    },
    PER_WIDTH_MS
  );
});
