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
// **Every route, three bands, both themes.** The routes are
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
//   * `live-*` — the same four `/app` addresses drawn from the database.
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
import { getAccountCookie, getBaseURL, getLiveAccountCookie, getSetupAccountCookie, withPage } from "./browser";
import {
  enumerateRoutes,
  headersFor,
  SEGMENT_FIXTURES,
  urlFor as routeUrl,
  type EnumeratedRoute,
} from "./routes";
import { LIVE_DRAFT_ID } from "./seed";

const APP_ROOT = path.resolve(__dirname, "../../../src/app");
const BASELINE_DIR = path.join(__dirname, "__screenshots__");

/** ADR-093 decision 1's three bands, and only those.
 *
 *  The property sweep renders five widths because the two boundary-minus-one
 *  values are where an off-by-one in a media query lives — a *property*
 *  question. A picture at 1023px and one at 1024px differ by design, so
 *  baselining both would double the cost of this suite to re-photograph the
 *  same decision. The issue's own lever, if the run outgrows its budget, is
 *  fewer bands for the live account and never fewer routes. */
const BANDS = [BAND_MIN.compact, BAND_MIN.medium, BAND_MIN.wide] as const;

const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

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

interface Shot {
  readonly route: EnumeratedRoute;
  /** What the baseline file is named after — the route's own path, plus
   *  `live` where the same address is photographed twice. */
  readonly name: string;
}

/** The signed-out arm keeps the bare name it has always had; every
 *  signed-in capture is prefixed with the account it is signed in as, so a
 *  reviewer reads which door a picture came through off its filename. */
const SHOTS: readonly Shot[] = [
  ...FIXTURE_ROUTES.map((route) => ({ route, name: slug(route.path) })),
  ...RESERVED_ROUTES.map((route) => ({ route, name: `reserved${slug(route.path)}` })),
  ...SETUP_ROUTES.map((route) => ({ route, name: `unfinished${slug(route.path)}` })),
  ...LIVE_ROUTES.map((route) => ({ route, name: `live${slug(route.path)}` })),
];

console.log(
  `tests/ui/layout/visual.test.ts: ${SHOTS.length} surface(s) × ${BANDS.length} bands × ${THEMES.length} themes` +
    ` = ${SHOTS.length * BANDS.length * THEMES.length} baseline(s)`
);

/** A route path as a filename. Never a hash: a baseline a reviewer cannot
 *  match to an address by reading its name is a baseline nobody checks. */
function slug(routePath: string): string {
  const cleaned = routePath.replace(/[^a-zA-Z0-9/-]/g, "-").replace(/\/+/g, "/");
  return cleaned === "/" ? "-root" : cleaned.replaceAll("/", "-");
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
 * Everything that has to be still before the shutter opens.
 *
 * **The colour scheme is emulated before the navigation, never after.** A
 * theme switched on a loaded page repaints *through* the token transitions,
 * and a screenshot taken then catches whatever frame it lands on: the first
 * run of this suite photographed seven dark screens mid-transition and they
 * differed from each other by up to 1.3% on identical code. Navigating once
 * per theme costs a page load and buys a picture that is the same every
 * time.
 *
 * The stylesheet is the belt to that brace — it stops any transition,
 * animation or caret that a later screen might introduce, so this suite
 * does not start flaking again the day someone adds one. `reducedMotion`
 * alone would not: it only silences what asks it to.
 */
const STILL = `*, *::before, *::after {
  transition: none !important;
  animation: none !important;
  caret-color: transparent !important;
}`;

async function shoot(page: Page, url: string, theme: Theme): Promise<Buffer> {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.goto(url, { timeout: NAVIGATION_MS });
  await page.addStyleTag({ content: STILL });
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
    // The three signed-in sets are three different accounts, which is the
    // only reason there are three: a picture signed in as an account that is
    // redirected off the address is a picture of somewhere else.
    expect(new Set([getAccountCookie(), getLiveAccountCookie(), getSetupAccountCookie()]).size).toBe(
      3
    );
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
        `${shot.name} @ ${width}px matches its baseline in both themes`,
        async () => {
          const taken = await withPage(
            width,
            async (page) => {
              const url = urlFor(shot.route);
              const shots: Record<Theme, Buffer> = {} as Record<Theme, Buffer>;
              // One browser for both themes at this width: a launch costs
              // more than the two navigations put together.
              for (const theme of THEMES) shots[theme] = await shoot(page, url, theme);
              return shots;
            },
            headersFor(shot.route)
          );

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
