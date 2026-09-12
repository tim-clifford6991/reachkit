// tests/ui/layout/visual.test.ts — BUILD §2, §16 M1 (issue #247)
//
// **What a route looks like, against an approved picture.** The rest of
// this project asserts *properties* — nothing scrolls sideways, nothing is
// clipped, no type is under the floor — and every one of them passed
// through roughly a hundred PRs while every screen root rendered unstyled
// (#241). A property suite cannot catch that: an unstyled document has no
// horizontal scroll either. This file is the other half, and it is the one
// the milestone audit marked PARTIAL.
//
// **Every route, one band × one theme by default; three bands and both
// themes under `RK_LAYOUT_FULL=1` (`matrix.ts`, issue #545).** The routes are
// `routes.ts`'s enumeration — the same one `layout.test.ts` sweeps, so a
// surface added later is in scope by construction and never by being listed
// here — plus the four live-account addresses `live-account.test.ts` owns,
// captured signed in as an account no fixture answers for. The bands are
// `BAND_MIN`'s three; the boundary-minus-one widths the property sweep uses
// are deliberately **not** here (see the cost note below).
//
// **And every account screen is photographed through its own door**
// (issue #272). The enumeration carries a cookie that names no account, so
// until now every `-app-*` and `-setup*` baseline was the sign-in prompt and
// the live pass was the only signed-in capture in the suite — a visual suite
// whose account screens were all one picture of the same door. There are now
// four sets, and each is one door:
//
//   * signed out — every route, the prompt included, one capture each;
//   * `reserved-*` — the four `/app` addresses drawn from their fixtures;
//   * `unfinished-*` — §4.3's two setup screens, signed in as the founder
//     who has paid and has not finished setup, which is the only state
//     those screens are reachable in (`seed.ts`'s `SETUP_ACCOUNT`);
//   * `live-*` — the same four `/app` addresses drawn from the database,
//     and — since issue #418 — the hosted page drawn from a real
//     publication, whose door is a `Host` rather than a session.
//
// **The theme is emulated, not stamped.** `page.emulateMedia` sets
// `prefers-color-scheme`, which is the un-stamped state most viewers are
// actually in — the product's own three-state theming makes that the
// default arm, and a `data-theme` attribute set by hand would test the
// toggle rather than what a customer sees.
//
// ## Updating a baseline
//
// A pixel change fails this suite until its baseline is regenerated **in
// the same PR**, so every visual change arrives as a reviewable diff:
//
//     UPDATE_BASELINES=1 npm run test:layout
//
// (`--update-snapshots` is Playwright's own runner's flag and this project
// does not use that runner; the env var is the same idea through vitest.)
// A failure writes `<name>.actual.png` and `<name>.diff.png` beside the run's
// temporary directory and names both in the message, so a reviewer can look
// at what changed before deciding whether to regenerate.
//
// **The comparison is `pixelmatch`, not `toHaveScreenshot`.** That matcher
// ships in `@playwright/test`, a second test runner this repository does not
// have and should not gain for one assertion (master's ruling, 2026-09-07).
// `playwright` the library — already a dependency, already what `browser.ts`
// drives — takes the screenshot, and two small well-known packages compare
// it.
import { mkdtempSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import type { Page } from "playwright";
import { BAND_MIN } from "@/ui/layout/bands";
import { bands, themes, type LayoutTheme } from "./matrix";
import { getAccountCookie, getBaseURL, getLiveAccountCookie, getSetupAccountCookie, getWeekZeroAccountCookie, withPage } from "./browser";
import {
  enumerateRoutes,
  headersFor,
  PUBLISHED_HOST_FIXTURES,
  SEGMENT_FIXTURES,
  urlFor as routeUrl,
  type EnumeratedRoute,
} from "./routes";
// Which screen a capture is, what a capture is called, and what has to be
// still before the shutter — one home, shared with the review gallery
// (issue #383). Two copies of `screenFor` would be two answers to "which
// screen is this address?", which is the question `docs/design-reference.md`
// exists to have exactly one of.
import { HOSTED_PAGE_PATH, screenFor, slug, STILL, type Door } from "./gallery";
import { LIVE_DRAFT_ID } from "./seed";
import { standSurface, unenumeratedSurfaces, type UnenumeratedSurface } from "./surfaces";

const APP_ROOT = path.resolve(__dirname, "../../../src/app");
const BASELINE_DIR = path.join(__dirname, "__screenshots__");

/** The bands this suite photographs — one by default, three under the
 *  full matrix (`matrix.ts`, issue #545). The property sweep's
 *  boundary-minus-one widths are deliberately not baselined here. */
const BANDS = bands();

/** Both themes under the full matrix, light alone by default. */
const THEMES = themes();
type Theme = LayoutTheme;

/**
 * How different two pictures of one screen may be and still be the same
 * screen.
 *
 * Two numbers, and they do different jobs. `PIXEL_THRESHOLD` is
 * `pixelmatch`'s own per-pixel YIQ tolerance: below it, a pixel is "the same
 * colour", which absorbs the sub-pixel antialiasing that differs between a
 * CI runner and this box even with the same fonts. `MAX_DIFFERING_RATIO` is
 * how much of the picture may differ at all — the thing that actually
 * decides pass or fail.
 *
 * Chosen, not transcribed (rule 1.1), and deliberately small: 0.1% of a
 * 1280×480 viewport is about 600 pixels, which is a few glyph edges and not
 * a moved element, a changed colour or a dropped stylesheet. Reversal cost:
 * one number, here. They are not in `constants.ts` because they bound one
 * test suite's comparison and no product behaviour reads them.
 */
const PIXEL_THRESHOLD = 0.2;
const MAX_DIFFERING_RATIO = 0.001;

/** Whether this run is regenerating rather than checking. */
const UPDATING = process.env.UPDATE_BASELINES === "1";

/** The whole `it`, including a Chromium launch and two screenshots. The
 *  same bound `live-account.test.ts` states for the same reason. */
const PER_SHOT_BROWSER_MS = 90_000;

/**
 * How long one navigation may take before this suite calls it a hang.
 *
 * Wider than `live-account.test.ts`'s 15 s, and for a reason that suite does
 * not meet: this one photographs every route rather than the four `/app`
 * addresses, and it is the **first** thing to reach some of them on a cold
 * server — the `(hosted)` catch-all took longer than 15 s to compile on its
 * first hit and failed here as a timeout while rendering perfectly well.
 * That is a cold compile, not a hang, and a bound that cannot tell them
 * apart is a flaky suite.
 *
 * A real hang still fails: `PER_SHOT_BROWSER_MS` is the backstop, and this
 * is far below it, so a screen that never answers is reported against its
 * own address rather than timing out the whole `it` with nothing to say.
 */
const NAVIGATION_MS = 45_000;

/**
 * Every route, signed **out** — one capture each.
 *
 * The cookie these carry is `routes.ts`'s `ACCOUNT_SESSION_COOKIE`, which
 * names no account: it gets a request past `src/middleware.ts` and then
 * fails the `users` check every `(account)` screen makes, so an `(account)`
 * address here is photographed as the sign-in prompt. That is a real arm and
 * it keeps its picture — what #272 found is that it was the **only** arm any
 * of these addresses had.
 */
const FIXTURE_ROUTES = enumerateRoutes(APP_ROOT);

/**
 * The four §4.4–§4.7 addresses signed in as the **reserved** account
 * (issue #272).
 *
 * This is the gap the account audit named: every `-app-*` baseline was the
 * sign-in prompt, because this set passed no `accountCookie` and the live
 * pass was the only signed-in capture in the suite. The reserved account is
 * where each `/app` screen draws its fixture — the densest content each can
 * hold, with no provider making a live read on the render path — so these are
 * the pictures that change when a component moves and the live ones are the
 * pictures that change when a *read* does.
 */
const RESERVED_ROUTES = enumerateRoutes(APP_ROOT, {
  accountCookie: getAccountCookie(),
}).filter((route) => route.path === "/app" || route.path.startsWith("/app/"));

/**
 * §4.3's two screens, signed in as the founder who is still in setup
 * (issue #272).
 *
 * **Not the reserved account, and not the live one**, though the issue asks
 * for both: `seed.ts`'s `SETUP_ACCOUNT` states the reason in full. Setup is
 * a screen a founder passes through once, and both of the other accounts
 * have already passed through it — REQ-025 c4 sends them from `/setup` to
 * `/app`, so their capture would be a picture of the overview under a setup
 * name. One account is in the state these screens exist in, and one capture
 * each is what that yields.
 */
const SETUP_ROUTES = enumerateRoutes(APP_ROOT, {
  accountCookie: getSetupAccountCookie(),
}).filter((route) => route.path === "/setup" || route.path.startsWith("/setup/"));

/**
 * The §4.4–§4.7 addresses again, signed in as the live account — **all of
 * them, including the calendar again since issue #305.**
 *
 * Enumerated and filtered as `live-account.test.ts` does it, so the two
 * suites cannot disagree about which addresses those are.
 *
 * **`/app/calendar` was subtracted here and is back.** It draws the month
 * *today* falls in, marks the cell today is, and plans supply onto the dates
 * from today forward; signed in as the live account every one of those was a
 * live read, so the picture was a function of the day the sweep ran and its
 * baseline went red at the next midnight for nothing anybody changed (#295,
 * #299). The clock is now the sweep's own — `SWEEP_NOW`, seeded into the rows
 * and handed to the app as `RK_FIXED_NOW` (`browser.ts`), read back through
 * `src/lib/config/now.ts` — so today is a fixture like every other input, and
 * the densest signed-in screen this product has is photographed rather than
 * argued about.
 *
 * The same instant is what makes `/app` photographable at all: its growth
 * chart labels three Mondays off the trailing window, and those labels moved
 * every Monday while the window ended at the wall clock.
 */
const LIVE_ROUTES = enumerateRoutes(APP_ROOT, {
  segmentFixtures: { ...SEGMENT_FIXTURES, "[draftId]": LIVE_DRAFT_ID },
  accountCookie: getLiveAccountCookie(),
}).filter((route) => route.path === "/app" || route.path.startsWith("/app/"));

/**
 * UI-SPEC S13, photographed (issue #353): the customer in their first week.
 *
 * `/app` only. The week-0 arm is a property of Overview — one point on the
 * chart from the deep pass, three tiles with no readings yet, the rivals
 * card stating when sizing arrives — and the calendar, settings and draft
 * screens are the same screens the live account already photographs. A
 * second picture of an identical page is a baseline that can only ever go
 * red for someone else's reason.
 */
const WEEK_ZERO_ROUTES = enumerateRoutes(APP_ROOT, {
  segmentFixtures: SEGMENT_FIXTURES,
  accountCookie: getWeekZeroAccountCookie(),
}).filter((route) => route.path === "/app");

/**
 * UI-SPEC S19, photographed as the page it is (issue #418).
 *
 * Every capture of this address was the 404, so the CI render composed the
 * approved hosted page beside an empty white frame (#416's run) — the one
 * approved screen the render path (#404) could not review. **Two things
 * were wrong and both had to go**:
 *
 *   * the sweep drove the *router's* path on a `content.` host, which the
 *     middleware then prefixed a second time — `routes.ts`'s `visitorPath`
 *     is that fix, and until it landed no Host and no seeded row could have
 *     produced a page;
 *   * and the host it drove is a site that has published nothing, which is
 *     the 404's own honest arm and not S19.
 *
 * The second is fixed by one more host, not a changed one:
 * `PUBLISHED_HOST_FIXTURES` names the customer `seed.ts`'s
 * `seedHostedPublisher()` writes, whose one live publication is at this
 * route's own `[...slug]` fixture. The bare capture above keeps the 404
 * arm; this adds the live arm beside it.
 *
 * No cookie, and that is the surface's own promise: the hosted edge answers
 * a stranger on a stranger's domain with no session, no cookie and no
 * payment (`(hosted)/hosted-page/[...slug]/page.tsx`).
 */
const PUBLISHED_HOSTED_ROUTES = enumerateRoutes(APP_ROOT, {
  hostFixtures: PUBLISHED_HOST_FIXTURES,
}).filter((route) => route.host !== undefined);

/**
 * The six surfaces the `page.tsx` enumerator cannot see (issue #327):
 * `src/app/not-found.tsx`, `(public)/error.tsx`, `(account)`'s
 * `not-found.tsx` and `error.tsx`, and the two `loading.tsx` files the same
 * issue adds.
 *
 * Until now none of them had a picture. The root 404 is at an address but
 * not at a `page.tsx`; a route group's not-found file is a `notFound()`
 * boundary and no page in either group calls one; an error boundary is
 * reached by a throw; a Suspense fallback by a render that has not
 * returned. So the one screen of the six that any capture in this suite had
 * ever been of was `(hosted)/not-found.tsx`, photographed as the arm of a
 * real address — S8 is a screen the owner approved and this product draws
 * it five times, and it had one picture.
 *
 * `surfaces.ts` owns what each one is and how it reaches the page. Here it
 * is one more kind of door: an address that matches no route for the first,
 * and for the rest the real document of the group the screen mounts in,
 * with that group's chrome around it.
 */
const UNENUMERATED = unenumeratedSurfaces();

/**
 * Which door an unenumerated surface's own document was opened through.
 *
 * Read off the session the surface carries rather than typed beside it: the
 * six stand on real documents, and a picture of one is a picture taken
 * through the same door as the screen underneath it. It names the document
 * and nothing more — the *screen* is the surface's own (`screenOf`), which
 * is why no rule in `gallery.ts`'s table has to know these six exist.
 */
function doorOfSurface(surface: UnenumeratedSurface): Door {
  const cookie = surface.route.cookie;
  if (cookie === getSetupAccountCookie()) return "unfinished";
  if (cookie === getAccountCookie()) return "reserved";
  return "signedout";
}

interface Shot {
  readonly route: EnumeratedRoute;
  /** What the baseline file is named after — the route's own path, plus
   *  `live` where the same address is photographed twice, or the surface's
   *  own name where it has no address at all. */
  readonly name: string;
  /** Which door this capture came through, said outright rather than
   *  sniffed back out of `name` (issue #383). `screenOf` needs it — a
   *  `/app` address is S12 through an account and S9 through none — and a
   *  prefix test on a filename was the wrong place to keep that fact. */
  readonly door: Door;
  /** Present only for a surface the route enumerator cannot see: which one
   *  it is, and — where its address does not render it — what to stand on
   *  the document once it has loaded. */
  readonly surface?: UnenumeratedSurface;
}

/** The signed-out arm keeps the bare name it has always had; every
 *  signed-in capture is prefixed with the account it is signed in as, so a
 *  reviewer reads which door a picture came through off its filename. */
const SHOTS: readonly Shot[] = [
  ...FIXTURE_ROUTES.map((route) => ({ route, name: slug(route.path), door: "signedout" as const })),
  ...RESERVED_ROUTES.map((route) => ({ route, name: `reserved${slug(route.path)}`, door: "reserved" as const })),
  ...SETUP_ROUTES.map((route) => ({ route, name: `unfinished${slug(route.path)}`, door: "unfinished" as const })),
  ...LIVE_ROUTES.map((route) => ({ route, name: `live${slug(route.path)}`, door: "live" as const })),
  ...WEEK_ZERO_ROUTES.map((route) => ({ route, name: `week0${slug(route.path)}`, door: "week0" as const })),
  // `live` for the same reason the four `/app` addresses use it: this is
  // the picture drawn from rows in the database rather than from a fixture
  // arm. The door it names is a host rather than an account, which is the
  // only door this surface has.
  ...PUBLISHED_HOSTED_ROUTES.map((route) => ({
    route,
    name: `live${slug(route.path)}`,
    door: "published" as const,
  })),
  // The six the enumerator cannot see (issue #327). Their names are their
  // own — never a route slug, because five of them are at no address and a
  // baseline that looked like one would be read as a picture of it. The
  // door each carries is the door of the document it stands on; its screen
  // is its own, which is what `screenOf` reads.
  ...UNENUMERATED.map((surface) => ({
    route: surface.route,
    name: surface.name,
    door: doorOfSurface(surface),
    surface,
  })),
];

console.log(
  `tests/ui/layout/visual.test.ts: ${SHOTS.length} surface(s) × ${BANDS.length} bands × ${THEMES.length} themes` +
    ` = ${SHOTS.length * BANDS.length * THEMES.length} baseline(s)`
);

/**
 * Where this run leaves the pictures the master reviews — CI only (issue
 * #404).
 *
 * The side-by-side render used to be an implementer's job: a `next build`
 * and a Chromium on a four-core box shared by four agents, three of which
 * were doing the same thing, while GitHub ran the identical suite in
 * parallel for free. The suite that already photographs every screen is the
 * one place the picture is free, so when `RENDER_CAPTURE_DIR` is set this
 * file drops two files per surface into it and `scripts/renders/` does the
 * rest:
 *
 *   * `<name>-1280-light.png` — the **viewport** shot, byte-comparable with
 *     the committed baseline of the same name, which is what tells the
 *     composer which routes this branch actually moved;
 *   * `<name>-full.png` — the same screen **full page**, which is what a
 *     fidelity review needs: the approved screens are 1280×3400 and a
 *     480-pixel crop beside one of those compares nothing.
 *
 * Unset — every local run — this costs a branch test and nothing else.
 */
const CAPTURE_DIR = process.env.RENDER_CAPTURE_DIR;

/** The band the approved set is drawn at (`docs/design/approved/README.md`:
 *  "twenty light and four dark, at 1280"), so it is the only band worth
 *  capturing for a comparison against it. */
const CAPTURE_WIDTH = BAND_MIN.wide;

/** The theme the approved set has for every screen; four of them also have
 *  a dark render, but light is the set that is complete. */
const CAPTURE_THEME: Theme = "light";

/**
 * The screen a capture is a picture of.
 *
 * `gallery.ts`'s `screenFor` is the repository's one answer for anything at
 * an address (issue #383), and this file asks it rather than keeping a
 * second copy of the rules. What that table cannot answer for is a surface
 * the route enumerator cannot see: those carry their own screen, and for
 * the two waiting lines the honest answer is *none* — the approved set
 * draws no waiting screen, so they are `new` under ruling 12a and there is
 * nothing to compose them beside.
 */
function screenOf(shot: Shot): `S${number}` | undefined {
  if (shot.surface) return shot.surface.screen;
  return screenFor(shot.door, shot.route.path);
}

/** One row per capture this run will leave behind, so `scripts/renders/`
 *  never has to re-derive a route or a screen id from a filename. */
function captureManifest(): string {
  return JSON.stringify(
    {
      width: CAPTURE_WIDTH,
      theme: CAPTURE_THEME,
      shots: SHOTS.map((shot) => ({
        name: shot.name,
        route: shot.route.path,
        screen: screenOf(shot) ?? null,
        viewport: `${shot.name}-${CAPTURE_WIDTH}-${CAPTURE_THEME}.png`,
        full: `${shot.name}-full.png`,
      })),
    },
    null,
    2
  );
}

if (CAPTURE_DIR) {
  mkdirSync(CAPTURE_DIR, { recursive: true });
  writeFileSync(path.join(CAPTURE_DIR, "manifest.json"), captureManifest());
  console.log(`tests/ui/layout/visual.test.ts: capturing renders into ${CAPTURE_DIR}`);
}

function baselineFor(name: string, width: number, theme: Theme): string {
  return path.join(BASELINE_DIR, `${name}-${width}-${theme}.png`);
}

function urlFor(route: EnumeratedRoute): string {
  const baseURL = getBaseURL();
  if (!baseURL) {
    throw new Error(
      "tests/ui/layout/visual.test.ts: a route was enumerated but no app server is running."
    );
  }
  return routeUrl(baseURL, route);
}

/**
 * What differs between two pictures, or `null` where they are the same
 * screen.
 *
 * A **size** change is reported as itself rather than compared: two pictures
 * of different heights are not a pixel diff, and `pixelmatch` throws on
 * mismatched dimensions. That is a real failure — a screen that grew — and
 * it says so in those words.
 */
function compare(
  baseline: Buffer,
  actual: Buffer
): { ratio: number; differing: number; total: number; diff: Buffer } | { sizeChanged: string } {
  const before = PNG.sync.read(baseline);
  const after = PNG.sync.read(actual);
  if (before.width !== after.width || before.height !== after.height) {
    return {
      sizeChanged:
        `the screen changed size: baseline ${before.width}×${before.height}, ` +
        `now ${after.width}×${after.height}`,
    };
  }
  const diff = new PNG({ width: before.width, height: before.height });
  const differing = pixelmatch(before.data, after.data, diff.data, before.width, before.height, {
    threshold: PIXEL_THRESHOLD,
  });
  const total = before.width * before.height;
  return { ratio: differing / total, differing, total, diff: PNG.sync.write(diff) };
}

/** Where a failure's evidence goes. One directory per run, named in the
 *  message, so a reviewer opens two files rather than re-running anything. */
let evidenceDir: string | undefined;
function evidencePath(file: string): string {
  evidenceDir ??= mkdtempSync(path.join(os.tmpdir(), "reachkit-visual-"));
  return path.join(evidenceDir, file);
}

/**
 * **The colour scheme is emulated before the navigation, never after.** A
 * theme switched on a loaded page repaints *through* the token transitions,
 * and a screenshot taken then catches whatever frame it lands on: the first
 * run of this suite photographed seven dark screens mid-transition and they
 * differed from each other by up to 1.3% on identical code. Navigating once
 * per theme costs a page load and buys a picture that is the same every
 * time. `STILL` (`gallery.ts`) is the belt to that brace.
 */
async function shoot(
  page: Page,
  url: string,
  theme: Theme,
  surface?: UnenumeratedSurface
): Promise<Buffer> {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.goto(url, { timeout: NAVIGATION_MS });
  await page.addStyleTag({ content: STILL });
  // A surface that stands on another document goes on **after** the
  // navigation and the stillness sheet and **before** the font wait — the
  // document under it is loaded and hydrated by now, and its own glyphs
  // still have to be ready before the shutter opens like every other
  // screen's. A surface at its own address passes straight through.
  if (surface) await standSurface(page, surface);
  // The webfont, before the shutter: a run that races it photographs the
  // fallback face, which is the flake that gets a visual suite switched off.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return page.screenshot({ fullPage: false });
}

describe(`visual baselines — ${SHOTS.length} surface(s) × ${BANDS.length} bands × ${THEMES.length} themes`, () => {
  it("photographs the enumerated routes, not a list of its own", () => {
    // The premise: this suite is in scope for a surface added later because
    // it asks `routes.ts`, exactly as the property sweep does. A hand-kept
    // list here would silently stop covering the newest screen — which is
    // the failure mode #247 exists to close, one level up.
    expect(FIXTURE_ROUTES.length).toBeGreaterThan(0);
    expect(SHOTS.map((shot) => shot.name)).toEqual([...new Set(SHOTS.map((shot) => shot.name))]);
  });

  it("the reserved account's four addresses are photographed signed in, not only signed out", () => {
    // The finding itself, as an assertion: before #272 this set did not
    // exist and every `-app-*` picture was the sign-in prompt.
    expect(RESERVED_ROUTES.map((route) => route.path).sort()).toEqual([
      "/app",
      "/app/calendar",
      `/app/draft/${SEGMENT_FIXTURES["[draftId]"]}`,
      "/app/settings",
    ]);
    expect(RESERVED_ROUTES.every((route) => route.cookie === getAccountCookie())).toBe(true);
  });

  it("both setup screens are photographed signed in, as the founder who is still in setup", () => {
    expect(SETUP_ROUTES.map((route) => route.path).sort()).toEqual(["/setup", "/setup/waiting"]);
    expect(SETUP_ROUTES.every((route) => route.cookie === getSetupAccountCookie())).toBe(true);
    // The four signed-in sets are four different accounts, which is the
    // only reason there are four: a picture signed in as an account that is
    // redirected off the address is a picture of somewhere else.
    expect(
      new Set([
        getAccountCookie(),
        getLiveAccountCookie(),
        getSetupAccountCookie(),
        getWeekZeroAccountCookie(),
      ]).size
    ).toBe(4);
  });

  it("S13 is photographed as its own account, at /app and nowhere else", () => {
    // The week-0 arm is Overview's. Every other address this account can
    // reach is the screen the live account already photographs, and a
    // second picture of an identical page is a baseline that can only go
    // red for somebody else's reason.
    expect(WEEK_ZERO_ROUTES.map((route) => route.path)).toEqual(["/app"]);
    expect(WEEK_ZERO_ROUTES.every((route) => route.cookie === getWeekZeroAccountCookie())).toBe(
      true
    );
    expect(SHOTS.filter((shot) => shot.name.startsWith("week0")).map((shot) => shot.name)).toEqual([
      "week0-app",
    ]);
  });

  it("the hosted page is photographed as a published page, not only as its 404", () => {
    // The finding itself, as an assertion (issue #418). Both arms, each
    // through its own host, each paired with the screen it actually draws.
    expect(PUBLISHED_HOSTED_ROUTES.map((route) => route.path)).toEqual([HOSTED_PAGE_PATH]);
    expect(PUBLISHED_HOSTED_ROUTES.every((route) => route.host === "content.publisher.test")).toBe(
      true
    );
    // No session reaches this surface, through either host.
    expect(PUBLISHED_HOSTED_ROUTES.every((route) => route.cookie === undefined)).toBe(true);

    const hosted = SHOTS.filter((shot) => shot.route.path === HOSTED_PAGE_PATH);
    expect(hosted.map((shot) => shot.name).sort()).toEqual([
      slug(HOSTED_PAGE_PATH),
      `live${slug(HOSTED_PAGE_PATH)}`,
    ]);
    expect(hosted.map(screenOf).sort()).toEqual(["S19", "S8"]);
    // And the two are different hosts, which is the whole of why they are
    // different screens.
    expect(new Set(hosted.map((shot) => shot.route.host)).size).toBe(2);
  });

  it("the six the enumerator cannot see are photographed, and S8 is no longer one picture", () => {
    // The finding #327 names, as an assertion. Four of the six are S8 — the
    // screen the owner approved — and until now the only capture of it in
    // this suite was the hosted 404, which is a mount in a group of its
    // own. A screen approved once and built five times had one picture.
    expect(
      SHOTS.filter((shot) => shot.surface !== undefined).map((shot) => shot.name).sort()
    ).toEqual([
      "fallback-account-error",
      "fallback-account-not-found",
      "fallback-public-error",
      "root-not-found",
      "waiting-app",
      "waiting-report",
    ]);
    expect(
      SHOTS.filter((shot) => screenOf(shot) === "S8").map((shot) => shot.name).sort()
    ).toEqual(
      [
        "fallback-account-error",
        "fallback-account-not-found",
        "fallback-public-error",
        "root-not-found",
        slug(HOSTED_PAGE_PATH),
      ].sort()
    );
    // The root 404 is driven as the address it is — no reconstruction —
    // and `(public)/not-found.tsx` needs no capture of its own because
    // that screen renders this component (issue #405).
    const root = UNENUMERATED.find((surface) => surface.name === "root-not-found");
    expect(root?.stand).toBeUndefined();
    expect(root?.route.cookie).toBeUndefined();
    // The two waiting lines pair with nothing, and that is the honest
    // answer rather than a gap: the approved set draws no waiting screen,
    // so they are `new` under ruling 12a and the CI render composes no
    // side-by-side for them. Pairing them with a screen they are not is
    // exactly what put an empty frame beside the hosted page in #416.
    expect(
      SHOTS.filter((shot) => shot.name.startsWith("waiting")).every(
        (shot) => screenOf(shot) === undefined
      )
    ).toBe(true);
    // Each of the five that stands on a document stands on the document of
    // the group it really mounts in, so the chrome around it in a picture is
    // the chrome around it in the product.
    expect(
      UNENUMERATED.filter((surface) => surface.name.startsWith("fallback-public")).every(
        (surface) => surface.route.path === "/pricing" && surface.route.cookie === undefined
      )
    ).toBe(true);
    expect(
      UNENUMERATED.filter((surface) => surface.name.startsWith("fallback-account")).every(
        (surface) => surface.route.cookie === getSetupAccountCookie()
      )
    ).toBe(true);
  });

  it("the live account's addresses are photographed as well as the fixture ones — all of them", () => {
    expect(LIVE_ROUTES.map((route) => route.path).sort()).toEqual([
      "/app",
      "/app/calendar",
      `/app/draft/${LIVE_DRAFT_ID}`,
      "/app/settings",
    ]);
    // There is no subtraction left to state (issue #305): the clock-driven
    // address is photographed through both doors, because the clock is the
    // sweep's own. A list that lost the live capture again would fail here
    // rather than quietly shrink.
    expect(SHOTS.map((shot) => shot.name)).toContain(`reserved${slug("/app/calendar")}`);
    expect(SHOTS.map((shot) => shot.name)).toContain(`live${slug("/app/calendar")}`);
  });

  for (const shot of SHOTS) {
    for (const width of BANDS) {
      it(
        `${shot.name} @ ${width}px matches its baseline in ${THEMES.join(" and ")}`,
        async () => {
          const { taken, fullPage } = await withPage(
            width,
            async (page) => {
              const url = urlFor(shot.route);
              const shots: Record<Theme, Buffer> = {} as Record<Theme, Buffer>;
              let full: Buffer | undefined;
              // One browser for every theme at this width: a launch costs
              // more than the two navigations put together.
              for (const theme of THEMES) {
                shots[theme] = await shoot(page, url, theme, shot.surface);
                // The extra shutter for CI's side-by-side (issue #404),
                // taken here and nowhere else: the page is already loaded,
                // already still and already past `document.fonts.ready`, so
                // the whole screen costs one screenshot and no navigation.
                if (CAPTURE_DIR && width === CAPTURE_WIDTH && theme === CAPTURE_THEME) {
                  full = await page.screenshot({ fullPage: true });
                }
              }
              return { taken: shots, fullPage: full };
            },
            headersFor(shot.route)
          );

          // Written before the comparison, deliberately: the run the master
          // most wants to look at is the one where a baseline went red.
          if (CAPTURE_DIR && width === CAPTURE_WIDTH) {
            writeFileSync(
              path.join(CAPTURE_DIR, `${shot.name}-${width}-${CAPTURE_THEME}.png`),
              taken[CAPTURE_THEME]
            );
            if (fullPage) writeFileSync(path.join(CAPTURE_DIR, `${shot.name}-full.png`), fullPage);
          }

          const failures: string[] = [];
          for (const theme of THEMES) {
            const file = baselineFor(shot.name, width, theme);
            const actual = taken[theme];

            if (!existsSync(file)) {
              mkdirSync(BASELINE_DIR, { recursive: true });
              writeFileSync(file, actual);
              continue;
            }

            const verdict = compare(readFileSync(file), actual);

            // Regenerating rewrites a baseline whose **pixels** moved, and
            // leaves the rest byte-for-byte alone (issue #304).
            //
            // It used to write all 156 unconditionally, and Chromium's PNG
            // writer does not emit the same bytes twice for the same image:
            // a regeneration on an unchanged tree came back with a handful
            // of files differing by 1-22 bytes and **zero** differing
            // pixels, and which files those were changed from run to run.
            // Nothing rendered differently, so there was nothing to review —
            // and a diff nobody can read is a diff nobody reads, which is
            // how a real change would have gone through in the same commit
            // unnoticed.
            //
            // Any differing pixel at all is enough, deliberately stricter
            // than `MAX_DIFFERING_RATIO` below: the tolerance exists to
            // forgive rendering noise **between machines** when checking,
            // and a regeneration is this machine against itself. A change
            // that sits under the tolerance is still a change, and one that
            // is never written down is one that accumulates until the day
            // it crosses and fails a PR that did not cause it.
            if (UPDATING) {
              if ("sizeChanged" in verdict || verdict.differing > 0) writeFileSync(file, actual);
              continue;
            }
            if ("sizeChanged" in verdict) {
              const actualFile = evidencePath(`${shot.name}-${width}-${theme}.actual.png`);
              writeFileSync(actualFile, actual);
              failures.push(`${theme}: ${verdict.sizeChanged} — see ${actualFile}`);
              continue;
            }
            if (verdict.ratio > MAX_DIFFERING_RATIO) {
              const actualFile = evidencePath(`${shot.name}-${width}-${theme}.actual.png`);
              const diffFile = evidencePath(`${shot.name}-${width}-${theme}.diff.png`);
              writeFileSync(actualFile, actual);
              writeFileSync(diffFile, verdict.diff);
              failures.push(
                `${theme}: ${verdict.differing} of ${verdict.total} pixels differ ` +
                  `(${(verdict.ratio * 100).toFixed(3)}%, budget ${(MAX_DIFFERING_RATIO * 100).toFixed(
                    3
                  )}%) — see ${diffFile} and ${actualFile}`
              );
            }
          }

          expect(
            failures,
            failures.length === 0
              ? ""
              : `${shot.name} @ ${width}px changed. If the change is intended, regenerate in this ` +
                `PR with \`UPDATE_BASELINES=1 npm run test:layout\` so the diff is reviewable.\n` +
                failures.join("\n")
          ).toEqual([]);
        },
        PER_SHOT_BROWSER_MS
      );
    }
  }
});
