// tests/ui/layout/live-account.test.ts — BUILD §2, §4.4–§4.7 (issue #206)
//
// The four `/app` addresses, swept at five widths signed in as an account
// **no fixture answers for** — so every provider takes its database read
// and the layout law is applied to what a real customer's screen actually
// draws.
//
// **Why a second pass and not a different account for the one pass.**
// `RESERVED_ACCOUNT`'s screens (#203) and this one's are two different
// documents through the same boxes: the fixture arm is the densest content
// each screen can hold, and the live arm is whatever the database has.
// Both have to fit. Dropping either would leave a real arm unmeasured, so
// the four addresses are swept twice and the rest of the route tree once —
// `layout.test.ts` still owns that.
//
// **Every read here is bounded, and that is asserted rather than assumed**
// (DECISIONS 2026-09-07). A provider that hangs is indistinguishable from
// a broken screen at five widths; the navigation deadline below is what
// tells the two apart, and it is deliberately far tighter than the
// per-test timeout so a slow read fails as a slow read.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getBaseURL, getLiveAccountCookie, withPage } from "./browser";
import {
  checkContainment,
  checkNoClippingOrTruncation,
  checkNoHorizontalScroll,
  checkTypeFloor,
  MONO_FONT_FAMILY,
  SCROLL_CONTAINER_ALLOWLIST,
  TRUNCATION_ALLOWLIST,
} from "./checks";
import { enumerateRoutes, headersFor, SEGMENT_FIXTURES, urlFor as routeUrl } from "./routes";
import { LIVE_ACCOUNT, LIVE_DRAFT_ID } from "./seed";
import { widths } from "./widths";

const APP_ROOT = path.resolve(__dirname, "../../../src/app");

/**
 * The live account's own draft, in place of the fixture one.
 *
 * `readDraft` answers `RESERVED_ACCOUNT` from `FIXTURE_DRAFTS` and everyone
 * else from the database, so this address is the one route whose *URL*
 * differs between the two passes. Spread over the shared map rather than
 * written out, so a segment added to `routes.ts` is filled here too.
 */
const LIVE_SEGMENTS = { ...SEGMENT_FIXTURES, "[draftId]": LIVE_DRAFT_ID };

/** The four §4.4–§4.7 addresses, taken from the same enumeration
 *  `layout.test.ts` sweeps rather than listed a second time here. */
const routes = enumerateRoutes(APP_ROOT, {
  segmentFixtures: LIVE_SEGMENTS,
  accountCookie: getLiveAccountCookie(),
}).filter((route) => route.path === "/app" || route.path.startsWith("/app/"));

console.log(
  `tests/ui/layout/live-account.test.ts: ${routes.length} live-branch route(s) × 5 widths`
);

/**
 * How long a live `/app` screen may take to answer before this suite calls
 * it a hang.
 *
 * A parameter, chosen here rather than pinned in `constants.ts` on the
 * grounds `gate-state.ts` states for its own: it bounds one suite's
 * navigation, is read by nothing else, and lives in one file. Generous
 * against a local Postgres and a cold Next server, short against a read
 * that will never answer.
 */
const LIVE_NAVIGATION_MS = 15_000;

/**
 * The offenders `/app` reports today, pinned rather than allowed.
 *
 * **This sweep found a real defect on its first run** (#211). Overview's
 * two measurement tiles render their unmeasured arm for every live
 * account — `readOverviewFacts` returns `points: []` and `aiPresence: []`
 * until the weekly-report reader lands (#41, #27) — and that arm's
 * `stat-desc` ("… wasn't measured — the scan stopped early, before it got
 * there.") is long enough that `div.stat` grows past its containing block:
 * 534px and 463px inside a 320px viewport, at every one of the five
 * widths.
 *
 * It is a `src/` fix and this issue's fourth box forbids one, so the two
 * are recorded here as the exact set `/app` is known to report. This is
 * **not** an allowlist: the assertion is equality, so the day either one is
 * fixed — or a third appears — this fails and says so. #211 carries the
 * fix, and deleting these two lines is what closes it.
 */
const OVERVIEW_KNOWN_OFFENDERS = [
  { check: "containment", element: "div.stat" },
  { check: "containment", element: "div.stat" },
];

/** `/app` is swept like every other address; only its expected offender
 *  set differs. */
function expectedOffenders(routePath: string): unknown[] {
  return routePath === "/app" ? OVERVIEW_KNOWN_OFFENDERS : [];
}

/** The whole `it`, including a Chromium launch. `layout.test.ts` states
 *  why this is far wider than the navigation bound above. */
const PER_ROUTE_BROWSER_MS = 60_000;

function urlFor(route: { path: string; host?: string }): string {
  const baseURL = getBaseURL();
  if (!baseURL) {
    throw new Error(
      "tests/ui/layout/live-account.test.ts: a route was enumerated but no app server is running."
    );
  }
  return routeUrl(baseURL, route);
}

describe(`live-branch sweep — ${routes.length} route(s) × 5 widths`, () => {
  it("the four §4.4–§4.7 addresses are what is swept, and they are enumerated not listed", () => {
    expect(routes.map((route) => route.path).sort()).toEqual([
      "/app",
      "/app/calendar",
      `/app/draft/${LIVE_DRAFT_ID}`,
      "/app/settings",
    ]);
  });

  it("this account is not the reserved one — every provider takes its database read", () => {
    // The premise the whole file rests on, asserted rather than assumed:
    // `isReservedFixtureAccount` keys on the domain, so a change to either
    // constant that made these equal would silently turn this suite into a
    // second copy of `layout.test.ts`.
    expect(LIVE_ACCOUNT.domain).not.toBe("example.com");
  });

  for (const route of routes) {
    for (const width of widths()) {
      it(
        `${route.path} @ ${width}px reports no offender on checks 1-4, signed in live`,
        async () => {
          const offenders = await withPage(
            width,
            async (page) => {
              // The bound. A live read that never answers fails here,
              // naming the address, instead of timing the whole `it` out
              // with nothing to say about which screen it was.
              await page.goto(urlFor(route), { timeout: LIVE_NAVIGATION_MS });
              const results = [
                await page.evaluate(checkNoHorizontalScroll),
                await page.evaluate(checkContainment, {
                  scrollContainerAllowlist: SCROLL_CONTAINER_ALLOWLIST,
                }),
                await page.evaluate(checkNoClippingOrTruncation, {
                  truncationAllowlist: TRUNCATION_ALLOWLIST,
                  monoFontFamily: MONO_FONT_FAMILY,
                }),
                await page.evaluate(checkTypeFloor),
              ];
              return results.flat();
            },
            headersFor(route)
          );
          expect(offenders).toEqual(expectedOffenders(route.path));
        },
        PER_ROUTE_BROWSER_MS
      );
    }
  }

  it(
    "each address answers itself, within the bound — the live read is exercised, not redirected past",
    async () => {
      // Four screens, four live reads, once each under a browser. An
      // address that redirected would land on `/signin` or `/setup` and
      // this fails naming it; an address whose read hung would fail on the
      // navigation bound instead of quietly measuring a spinner.
      for (const route of routes) {
        const landed = await withPage(
          widths()[0],
          async (page) => {
            await page.goto(urlFor(route), { timeout: LIVE_NAVIGATION_MS });
            return new URL(page.url()).pathname;
          },
          headersFor(route)
        );
        expect(landed, `${route.path} did not answer itself`).toBe(route.path);
      }
    },
    PER_ROUTE_BROWSER_MS * 4
  );
});
