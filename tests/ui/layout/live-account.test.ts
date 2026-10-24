// tests/ui/layout/live-account.test.ts — BUILD §2, §4.4–§4.7 (issue #206)
//
// The four `/app` addresses, swept at the sweep's widths signed in as an account
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
// a broken screen at every width; the navigation deadline below is what
// tells the two apart, and it is deliberately far tighter than the
// per-test timeout so a slow read fails as a slow read.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getBaseURL, getLiveAccountCookie, getUnconnectedAccountCookie, getWeekZeroAccountCookie, withPage } from "./browser";
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
import {
  LIVE_ACCOUNT,
  LIVE_DRAFT_ID,
  LIVE_PUBLISHING,
  RESERVED_ACCOUNT,
  SETUP_ACCOUNT,
  UNCONNECTED_ACCOUNT,
  UNCONNECTED_HOST,
  WEEK_ZERO_ACCOUNT,
} from "./seed";
import { FIXTURE_SETTINGS_FACTS } from "@/app/(account)/app/settings/fixture";
import { widths } from "./widths";
import { sweepWidths } from "./matrix";

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

/** UI-SPEC S13's `/app` (issue #353) — the same live branch, read for a
 *  customer whose deep pass has run and whose first weekly pass has not.
 *  Overview alone: every other address this account can reach is the screen
 *  the live routes above already sweep. */
const weekZeroRoutes = enumerateRoutes(APP_ROOT, {
  segmentFixtures: LIVE_SEGMENTS,
  accountCookie: getWeekZeroAccountCookie(),
}).filter((route) => route.path === "/app");

/** `/app` for a customer whose hosted address waits for its record: the
 *  connect state in place of the tiles. */
const unconnectedRoutes = enumerateRoutes(APP_ROOT, {
  segmentFixtures: LIVE_SEGMENTS,
  accountCookie: getUnconnectedAccountCookie(),
}).filter((route) => route.path === "/app");

console.log(
  `tests/ui/layout/live-account.test.ts: ${routes.length} live-branch route(s) × ${sweepWidths().length} width(s)`
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

describe(`live-branch sweep — ${routes.length} route(s) × ${sweepWidths().length} width(s)`, () => {
  // 2026-09-21, issue #976: this row is a snapshot of what the enumerator
  // returns, and the redesign (#908) turned four addresses into thirteen —
  // Settings became seven tabbed addresses and the Overview's modules each
  // got one. The list grows with the tree, which is the point of it: the
  // sweep reaching a new screen is something somebody decides, here, rather
  // than something that happens.
  it("every address of the account tree is what is swept, and they are enumerated not listed", () => {
    expect(routes.map((route) => route.path).sort()).toEqual([
      "/app",
      "/app/ai-answers",
      "/app/calendar",
      "/app/costs",
      `/app/draft/${LIVE_DRAFT_ID}`,
      "/app/issues",
      "/app/review",
      "/app/rivals",
      "/app/search",
      "/app/settings",
      "/app/settings/account",
      "/app/settings/billing",
      "/app/settings/mail",
      "/app/settings/market",
      "/app/settings/publishing",
      "/app/settings/voice",
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
    for (const width of sweepWidths()) {
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
                  scrollContainerAllowlist: SCROLL_CONTAINER_ALLOWLIST,
                truncationAllowlist: TRUNCATION_ALLOWLIST,
                  monoFontFamily: MONO_FONT_FAMILY,
                }),
                await page.evaluate(checkTypeFloor),
              ];
              return results.flat();
            },
            headersFor(route)
          );
          expect(offenders).toEqual([]);
        },
        PER_ROUTE_BROWSER_MS
      );
    }
  }

  it(
    "each address answers itself with its own screen — not a redirect, and not an error page",
    async () => {
      // Four screens, four live reads, once each under a browser. An
      // address that redirected would land on `/signin` or `/setup` and
      // this fails naming it; an address whose read hung would fail on the
      // navigation bound instead of quietly measuring a spinner.
      //
      // **And the screen is the app's, not Next's** (issue #295). A page
      // component that throws is answered by Next's own error document,
      // which keeps the address it was asked for — so the path alone said
      // nothing, and `/app/calendar` was that error page on every live
      // request for the whole life of this suite without one assertion here
      // noticing. Two things distinguish the two documents and both are
      // read below: the app's screen root, which every `(account)` layout
      // writes, and the app's stylesheet, which the error document carries
      // none of. Checks 1-4 above are what *caught* it, and only by
      // accident and only sometimes: check 4 reads `--t-eyebrow` and fails
      // where it is undeclared, but only when the throw beat the streamed
      // shell out of the door. That is why a deterministic break arrived as
      // a flake, and why the plain statement of it belongs here.
      for (const route of routes) {
        const answer = await withPage(
          widths()[0],
          async (page) => {
            await page.goto(urlFor(route), { timeout: LIVE_NAVIGATION_MS });
            return {
              landed: new URL(page.url()).pathname,
              screenRoots: await page.evaluate(
                () => document.querySelectorAll("[data-surface]").length
              ),
              typeFloor: await page.evaluate(() =>
                getComputedStyle(document.documentElement).getPropertyValue("--t-eyebrow").trim()
              ),
            };
          },
          headersFor(route)
        );
        expect(answer.landed, `${route.path} did not answer itself`).toBe(route.path);
        expect(
          answer.screenRoots,
          `${route.path} answered with no screen root — Next's error page, not this app's`
        ).toBe(1);
        expect(
          answer.typeFloor,
          `${route.path} answered a document with no app stylesheet on it`
        ).not.toBe("");
      }
    },
    PER_ROUTE_BROWSER_MS * 4
  );

  it(
    "Settings states the settings this account chose, not the fixture's (#228)",
    async () => {
      // The address answering itself is not enough for these screens.
      // Until #228 `readSettings` opened with `{ ...FIXTURE_SETTINGS_FACTS,
      // ...four live overrides }`, so Settings rendered, passed every check
      // above, and told a real customer their pages publish at 09:00 under
      // a mode they never chose. What distinguishes the two is the *values
      // on the page*, so those are what this reads.
      //
      // 2026-09-21, #976: the values are on three addresses now rather than
      // one (#908 tabbed Settings), and each is read where it is written —
      // the publishing pair on Publishing, the domain on Market and rivals,
      // the address we mail on Account. Reading only `/app/settings` after
      // the split found none of them and failed on every run since.
      async function textOf(path: string): Promise<string> {
        return withPage(
          widths()[0],
          async (page) => {
            await page.goto(`${getBaseURL()}${path}`, { timeout: LIVE_NAVIGATION_MS });
            return page.evaluate(() => document.body.innerText);
          },
          headersFor({ path, cookie: getLiveAccountCookie() })
        );
      }

      // Chosen, and seeded as such: the publish time and the veto window.
      const publishing = await textOf("/app/settings/publishing");
      expect(publishing).toContain(LIVE_PUBLISHING.publishTime);
      expect(publishing).toContain(String(LIVE_PUBLISHING.vetoHours));
      // And not the fixture's, which is the same screen's other arm: the
      // fixture's own publish time is what a spread put here for every
      // account.
      expect(publishing).not.toContain(FIXTURE_SETTINGS_FACTS.publishTime);

      // The domain this account owns. It is not the discriminator against
      // the fixture — this account's *address* is at `example.com` by
      // design (the sweep mails nobody, and the domain it is measured under
      // is its own) — so it is asserted as present, not as different.
      expect(await textOf("/app/settings/market")).toContain(LIVE_ACCOUNT.domain);

      // The address we would mail, which is the fixture's other giveaway.
      expect(await textOf("/app/settings/account")).not.toContain(
        FIXTURE_SETTINGS_FACTS.email
      );
    },
    PER_ROUTE_BROWSER_MS * 3
  );
});

describe(`week-0 sweep — S13, ${weekZeroRoutes.length} route(s) × ${sweepWidths().length} width(s)`, () => {
  it("Overview is what is swept, and it is enumerated not listed", () => {
    expect(weekZeroRoutes.map((route) => route.path)).toEqual(["/app"]);
  });

  it("this account is not the reserved one either — the arm is drawn from its own rows", () => {
    expect(WEEK_ZERO_ACCOUNT.domain).not.toBe("example.com");
  });

  it("the seeded accounts are distinct users, sites and domains", () => {
    // Not pedantry: this account first shipped carrying `SETUP_ACCOUNT`'s
    // own user id, site id *and* domain, and the way that surfaced was a
    // duplicate-key error from inside `seedSite` at global setup — a
    // failure that names Postgres rather than the mistake. Three sets of
    // four say which field collided, before any suite runs.
    const accounts = [RESERVED_ACCOUNT, LIVE_ACCOUNT, SETUP_ACCOUNT, WEEK_ZERO_ACCOUNT, UNCONNECTED_ACCOUNT];
    expect(new Set(accounts.map((a) => a.userId)).size).toBe(accounts.length);
    expect(new Set(accounts.map((a) => a.siteId)).size).toBe(accounts.length);
    expect(new Set(accounts.map((a) => a.domain)).size).toBe(accounts.length);
  });

  for (const route of weekZeroRoutes) {
    for (const width of sweepWidths()) {
      it(
        `${route.path} @ ${width}px reports no offender on checks 1-4, in week 0`,
        async () => {
          // The arm this exercises is the one nothing else can: a chart of
          // a single point, three tiles carrying a dash and a sentence
          // instead of a number, and a rivals card with one line and no
          // rows. Each is a different shape in the same box, and ADR-093's
          // law is that the content fits the box or the box changes.
          const offenders = await withPage(
            width,
            async (page) => {
              await page.goto(urlFor(route), { timeout: LIVE_NAVIGATION_MS });
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
            headersFor(route)
          );
          expect(offenders).toEqual([]);
        },
        PER_ROUTE_BROWSER_MS
      );
    }
  }
});

describe(`connect state — ${unconnectedRoutes.length} route(s) × ${sweepWidths().length} width(s)`, () => {
  it("Overview is what is swept, and it is enumerated not listed", () => {
    expect(unconnectedRoutes.map((route) => route.path)).toEqual(["/app"]);
  });

  for (const route of unconnectedRoutes) {
    for (const width of sweepWidths()) {
      it(
        `${route.path} @ ${width}px draws the connect state and reports no offender on checks 1-4`,
        async () => {
          const { drawn, offenders } = await withPage(
            width,
            async (page) => {
              await page.goto(urlFor(route), { timeout: LIVE_NAVIGATION_MS });
              const drawn = {
                connect: await page.locator('[data-testid="overview-connect"]').count(),
                record: await page.locator(`[data-testid="dns-record"][data-host="${UNCONNECTED_HOST}"]`).count(),
                tiles: await page.locator('[data-testid="overview-tiles"]').count(),
                when: await page.locator('[data-testid="shell-waiting-when"]').count(),
              };
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
              return { drawn, offenders: results.flat() };
            },
            headersFor(route)
          );
          expect(drawn).toEqual({ connect: 1, record: 1, tiles: 0, when: 0 });
          expect(offenders).toEqual([]);
        },
        PER_ROUTE_BROWSER_MS
      );
    }
  }
});
