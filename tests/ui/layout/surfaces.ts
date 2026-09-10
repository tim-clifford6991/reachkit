// tests/ui/layout/surfaces.ts — issue #327
//
// **The screens the route enumerator cannot see, and how this suite
// measures and photographs them anyway.**
//
// `routes.ts` walks `src/app/**/page.tsx`. That is the right enumerator for
// routes and it reaches nothing else, so six of this product's surfaces
// have never been measured at a width or photographed at a band:
//
//   * `src/app/not-found.tsx` — the screen an unmatched address reaches.
//     It **has** an address (any address this product does not serve, since
//     #405 gave the fall-through and this file the shell) and it is not a
//     `page.tsx`, so the enumerator has no row for it. This one is driven
//     as what it is: a real navigation to an address that matches no route,
//     through the middleware that lets it fall through, rendering the root
//     file, the public chrome it draws and `(public)/not-found.tsx` inside
//     it. Nothing here reconstructs it.
//   * `(public)` and `(account)`'s `error.tsx`, and `(account)`'s
//     `not-found.tsx` — reached by a throw and by a `notFound()` call, and
//     no address produces either on demand. (`(public)/not-found.tsx` needs
//     no row of its own: the root screen above renders it, so the picture
//     of that address is a picture of this component.)
//   * the two `loading.tsx` files this issue adds — reached by a render
//     that has not returned yet, which no address produces on demand
//     either.
//
// **What a surface with no address does here, and what it does not claim.**
// It is server-rendered to markup — the same `renderToStaticMarkup` call
// `tests/app/fallback/screens.test.tsx` and `loading.test.tsx` already make
// of the same components — and stood on the **real document of the group it
// mounts in**, fetched from the running app server: `(public)`'s error goes
// into a public page, so ruling 3a's header and footer are the ones
// actually around it; `(account)`'s pair goes into a `(account)` page below
// the setup gate, which draws no chrome, which is what those two screens
// inherit; the app's waiting line replaces the Overview's own content well
// **inside** the shell, which is exactly what a Suspense fallback does
// there. Real stylesheets, real webfont, real Chromium, real widths.
//
// It does **not** claim the router reaches those five. That is a different
// property with its own tests (`tests/app/route-groups.test.ts` for the
// files, `tests/app/middleware.test.ts` for the addresses). What is
// asserted here is the layout law and the picture — the two things a screen
// with no address had no way to earn.
//
// `src/app/global-error.tsx` is the one fallback screen with no row at all:
// it replaces the root layout and carries its own `<html>` and `<body>`, so
// there is no document to stand it on and standing it on one would be
// photographing something it never is. `screens.test.tsx` holds its shape.
import type { Page } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { getAccountCookie, getSetupAccountCookie } from "./browser";
import { SEGMENT_FIXTURES, type EnumeratedRoute } from "./routes";
// Relative, not `@/`, and for one reason: these are the same imports
// `tests/app/fallback/screens.test.tsx` and `loading.test.tsx` already make,
// written the same way. A route group's parentheses and a dynamic segment's
// brackets are ordinary path characters, but they are ordinary path
// characters that only one spelling in this repository has ever been run.
import PublicError from "../../../src/app/(public)/error";
import AccountNotFound from "../../../src/app/(account)/not-found";
import AccountError from "../../../src/app/(account)/error";
import ReportLoading from "../../../src/app/(public)/scan/[domain]/loading";
import AppLoading from "../../../src/app/(account)/app/loading";

export interface UnenumeratedSurface {
  /** What its baselines are named after. Never a route slug: five of these
   *  are at no address, and a name that looked like one would be read as a
   *  picture of an address that does not serve it. */
  readonly name: string;
  /** The approved screen it is a picture of, where the set draws one. S8
   *  for the four fallback screens; the two waiting lines are `new` under
   *  ruling 12a — the set draws no waiting screen — so they have none and
   *  the CI render composes no side-by-side for them. */
  readonly screen?: `S${number}`;
  /** The address the browser is pointed at, and the door it goes through:
   *  the surface's own where it has one, otherwise the document whose group
   *  chrome it really renders inside. */
  readonly route: EnumeratedRoute;
  /** Absent where the address renders the surface itself. Present where it
   *  does not: what to put on that document once it has loaded, and in
   *  place of what. */
  readonly stand?: { readonly selector: string; readonly markup: string };
}

/** The report address the sweep already visits, spelled from the fixture
 *  map rather than typed, so a renamed domain fixture moves this too. */
const REPORT_PATH = `/scan/${SEGMENT_FIXTURES["[domain]"]}`;

/**
 * An address this product does not serve.
 *
 * Its top-level segment is deliberately none of `middleware.ts`'s
 * `GUARDED_SEGMENTS` — `api`, `app`, `setup`, `hosted-gone`, `hosted-page` —
 * because a path under one of those is denied to the sign-in prompt and the
 * sweep would photograph a redirect (the failure #212 pinned: "a redirect
 * can never be measured as a screen"). Under none of them the request falls
 * through to Next, matches nothing, and renders the root screen.
 */
const UNMATCHED_PATH = "/an-address-this-product-does-not-serve";

/** Every screen root on a document carries it, and every surface that
 *  stands in for a screen replaces one — except the app's waiting line,
 *  which replaces the content well inside the shell's. */
const SCREEN_ROOT = "[data-surface]";

/** The Overview's own page root, which is what the shell's `<main>` holds
 *  and therefore what a Suspense fallback under `/app` replaces. */
const OVERVIEW_ROOT = '[data-testid="overview"]';

/**
 * The six, each with the door its own screen is reached through.
 *
 * A function rather than a constant because two of the doors are session
 * cookies minted by `browser.ts`'s global setup: read at import time they
 * would be read before the seed exists.
 */
export function unenumeratedSurfaces(): readonly UnenumeratedSurface[] {
  return [
    // The one with an address. No `stand`: the navigation is the test.
    {
      name: "root-not-found",
      screen: "S8",
      route: { path: UNMATCHED_PATH },
    },
    // `(public)`'s error renders inside `(public)/layout.tsx`, which draws
    // ruling 3a's header and footer around every public page. `/pricing` is
    // the plainest of those documents — no dynamic segment, no session, no
    // clock — so what changes in this picture is the screen.
    {
      name: "fallback-public-error",
      screen: "S8",
      route: { path: "/pricing" },
      stand: { selector: SCREEN_ROOT, markup: renderToStaticMarkup(PublicError()) },
    },
    // `(account)`'s pair renders inside `(account)/layout.tsx`, which is
    // the setup gate and draws no chrome at all — **not** inside the app
    // shell, which is `(account)/app/layout.tsx` and sits below the
    // boundary these two are (see their own headers). `/setup` is the one
    // address whose document is that layout and nothing else, and it is
    // fetched as the founder who is still in setup because that is the only
    // account it does not redirect (issue #272).
    {
      name: "fallback-account-not-found",
      screen: "S8",
      route: { path: "/setup", cookie: getSetupAccountCookie() },
      stand: { selector: SCREEN_ROOT, markup: renderToStaticMarkup(AccountNotFound()) },
    },
    {
      name: "fallback-account-error",
      screen: "S8",
      route: { path: "/setup", cookie: getSetupAccountCookie() },
      stand: { selector: SCREEN_ROOT, markup: renderToStaticMarkup(AccountError()) },
    },
    // The two waiting lines (#327). The report's is a screen root of its
    // own, like the seven arms it stands in for; the app's is not — it
    // replaces the Overview's content well and the shell stays drawn around
    // it, which is the whole point of putting the boundary below the
    // layout.
    {
      name: "waiting-report",
      route: { path: REPORT_PATH },
      stand: { selector: SCREEN_ROOT, markup: renderToStaticMarkup(ReportLoading()) },
    },
    {
      name: "waiting-app",
      route: { path: "/app", cookie: getAccountCookie() },
      stand: { selector: OVERVIEW_ROOT, markup: renderToStaticMarkup(AppLoading()) },
    },
  ];
}

/**
 * Next.js's own screen-reader announcer, and the one signal in this
 * repository that says the client runtime has hydrated.
 *
 * `checks.ts` already writes down what it is and when it appears — "the App
 * Router's own screen-reader element, appended to `<body>` at hydration …
 * It appears only once the client runtime has hydrated, so leaving it in
 * makes every route's sweep a race with hydration rather than a measurement
 * of the page" (issue #13). That is exactly the race this module has to
 * lose: a document mutated *while* React is still reconciling the server's
 * DOM is re-rendered from the payload, which is how `/scan/{domain}` came
 * back with the report's own screen root beside the one standing in for it
 * — two `[data-surface]` roots on one document.
 *
 * Waited for rather than assumed, and bounded: the heaviest screen in this
 * product is the one that lost the race, and it is the one whose hydration
 * takes longest.
 */
const HYDRATED = "next-route-announcer";

/** Long enough for the report to hydrate on a cold CI runner, short enough
 *  that a page which never hydrates fails saying so rather than timing out
 *  the whole `it`. */
const HYDRATION_MS = 30_000;

/**
 * Puts one surface on the page in place of what it stands in for, or leaves
 * the document alone where the address renders the surface itself.
 *
 * **Hydration first.** `browser.ts` has already waited for any waiting
 * state to leave the document; this waits for React to have finished with
 * the DOM it is about to be handed a different one of. After hydration
 * nothing on these documents re-renders without an interaction, and there
 * is none here.
 *
 * A selector that matches nothing **throws, naming itself** rather than
 * leaving the shot to photograph the document it was standing on — which is
 * the failure #418 spent eleven issues not noticing, in its own words: a
 * capture that is quietly of something else is worse than no capture.
 */
export async function standSurface(page: Page, surface: UnenumeratedSurface): Promise<void> {
  const stand = surface.stand;
  if (stand === undefined) return;
  await page.waitForSelector(HYDRATED, { state: "attached", timeout: HYDRATION_MS });
  await page.evaluate(
    ({ selector, markup }: { selector: string; markup: string }) => {
      const host = document.querySelector(selector);
      if (host === null) {
        throw new Error(`tests/ui/layout/surfaces.ts: nothing matched ${selector} on this document`);
      }
      host.outerHTML = markup;
    },
    { selector: stand.selector, markup: stand.markup }
  );
}
