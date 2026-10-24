// tests/ui/layout/public-header.test.ts — owner 2026-09-26 (#1125)
//
// Signed in, the public header offers one button into the app in place of
// *Sign in* and *Start free*; signed out, it is the header it was. A browser
// suite because the claim is the request's: the session is read from the
// cookie on the server, and no React render sees a cookie.
//
// Owner 2026-10-20 (Q1): the header has three links on every public route,
// in the bar and in the phone menu.
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/presentation/copy";
import { getBaseURL, getLiveAccountCookie, withPage } from "./browser";
import { widths } from "./widths";

/** The narrowest width: the one button has to stay in the bar there too. */
const WIDTH = widths()[0];

const PUBLIC_PATHS = ["/", "/pricing", "/scans", "/scan/example.com"] as const;

interface HeaderFacts {
  appHrefs: string[];
  signin: number;
  start: number;
}

async function headerAt(path: string, cookie?: string): Promise<HeaderFacts> {
  const baseURL = getBaseURL();
  if (!baseURL) throw new Error("tests/ui/layout/public-header.test.ts: no app server is running.");
  return withPage(
    WIDTH,
    async (page) => {
      await page.goto(baseURL + path, { waitUntil: "domcontentloaded" });
      return page.evaluate(
        ({ signin, start }) => {
          const header = document.querySelector('[data-testid="public-header"]');
          const text = (needle: string) =>
            [...(header?.querySelectorAll("a, button") ?? [])].filter((el) => el.textContent?.trim() === needle).length;
          return {
            appHrefs: [...(header?.querySelectorAll('[data-testid="public-header-app"]') ?? [])].map(
              (el) => el.getAttribute("href") ?? ""
            ),
            signin: text(signin),
            start: text(start),
          };
        },
        { signin: COPY["chrome.nav.signin"], start: COPY["chrome.cta.start"] }
      );
    },
    cookie === undefined ? {} : { extraHTTPHeaders: { Cookie: cookie } }
  );
}

describe("#1125 — the public header, signed in and signed out", () => {
  it.each(PUBLIC_PATHS)("signed in, %s shows one button to /app and neither Sign in nor Start free", async (path) => {
    expect(await headerAt(path, getLiveAccountCookie())).toEqual({ appHrefs: ["/app"], signin: 0, start: 0 });
  }, 60_000);

  it.each(PUBLIC_PATHS)("signed out, %s keeps Sign in and Start free and has no button into the app", async (path) => {
    const facts = await headerAt(path);
    expect(facts.appHrefs).toEqual([]);
    expect(facts.signin).toBeGreaterThan(0);
    expect(facts.start).toBe(1);
  }, 60_000);
});

const LINKS = [
  ["/how-it-works", COPY["chrome.nav.works"]],
  ["/pricing", COPY["chrome.nav.pricing"]],
  ["/scans", COPY["chrome.nav.scans"]],
];

describe("owner 2026-10-20 (Q1) — three header links on every public route", () => {
  it.each(PUBLIC_PATHS)("%s has How it works · Pricing · Free scans in the bar and in the menu at the narrowest width", async (path) => {
    const baseURL = getBaseURL();
    if (!baseURL) throw new Error("tests/ui/layout/public-header.test.ts: no app server is running.");
    const found = await withPage(WIDTH, async (page) => {
      await page.goto(baseURL + path, { waitUntil: "domcontentloaded" });
      await page.locator('[data-testid="public-header-menu"] label.btn').click();
      await page.locator('[data-testid="public-header-menu"] .menu a').first().waitFor({ state: "visible" });
      return page.evaluate(() => {
        const pairs = (selector: string) =>
          [...document.querySelectorAll<HTMLAnchorElement>(selector)].map((a) => [a.getAttribute("href"), a.textContent?.trim()]);
        return {
          bar: pairs('[data-testid="public-header"] nav > div > ul a'),
          menu: pairs('[data-testid="public-header-menu"] .menu a'),
        };
      });
    });
    expect(found).toEqual({ bar: LINKS, menu: LINKS });
  }, 60_000);
});
