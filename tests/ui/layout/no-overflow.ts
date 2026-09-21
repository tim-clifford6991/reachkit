// tests/ui/layout/no-overflow.ts — the parts of the no-overflow pass that
// are not the pass (issue #910)
//
// `docs/DESIGN.md`, "Layout that cannot overflow" (owner, 2026-09-20, #908):
//
//   "No element is wider than its container and no text is clipped by its
//    card at 390, 768 and 1280 pixels, in light and dark. CI renders every
//    route at those widths and fails on either; `@axe-core/playwright` runs
//    in the same pass."
//
// The three measurements are `checks.ts`'s — the same closure-free functions
// the 1280-light sweep has run since WO-269, re-run here at the three ruled
// widths in both themes. Nothing about what an offender *is* is re-decided
// in this file; what is new is **where** and **in what state** the document
// is measured:
//
//   * **hydrated.** `settleForMeasurement` waits for the client runtime, the
//     webfont and every Recharts chart before a single box is read. A chart
//     draws nothing until React has hydrated and measured its box, so a
//     static render of `/app` shows three empty frames — which is how a
//     clipped sparkline reached design review on 2026-09-20 past a harness
//     that could not see its own charts.
//   * **through the door each screen is reachable in.** `/setup` signed in
//     as the reserved account is a redirect to `/app` (`browser.ts`), so a
//     sweep that sent one cookie to every `(account)` address measured the
//     Overview twice and the five-step setup screen never — the one screen
//     whose step labels overflowed.
//   * **with a chart held to `docs/DESIGN.md`'s own rule**, which
//     `checkChartsResponsive` below states as two things a browser can see.
import type { Page } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import {
  SCROLL_CONTAINER_ALLOWLIST,
  TRUNCATION_ALLOWLIST,
  type Offender,
} from "./checks";
import { enumerateRoutes, type EnumeratedRoute } from "./routes";

/**
 * The three widths the 2026-09-20 ruling names, in CSS px.
 *
 * Not `widths()` (`widths.ts`), and the difference is the ruling's: that set
 * is the five-band property sweep's — the floor, each band and each boundary
 * minus one, which is where an off-by-one lives. These three are the
 * *screens a customer holds*: a phone (390), a tablet or a half-width window
 * (768), and a laptop (1280). 390 is new to this repository and is the
 * ruling's own number; 768 and 1280 already appear in `widths.ts`, read from
 * `BREAKPOINT_MD_PX` and `BAND_MIN.wide`, and are named here as the ruling
 * names them so the three read as one sentence rather than as two sets that
 * happen to overlap.
 */
export const NO_OVERFLOW_WIDTHS: readonly [number, number, number] = [390, 768, 1280];

/** Both, always — the ruling says "in light and dark", and dark is not a
 *  second palette but the same `reachkit` theme's dark values
 *  (`docs/DESIGN.md`, Theme). A box that fits in one and not the other is a
 *  box sized by a string whose weight changed, which is exactly what this
 *  pass is for. */
export const NO_OVERFLOW_THEMES: readonly ["light", "dark"] = ["light", "dark"];

/**
 * The wrappers this pass does not measure a box against.
 *
 * `checks.ts` takes this list under the name `scrollContainerAllowlist`, and
 * what both checks do with it is one thing: a box inside one of these is not
 * measured against it, because the relationship between the two says nothing
 * about whether a reader lost anything. Three of the seven rows are that
 * file's, spread rather than retyped — `.overflow-x-auto` (every `table`
 * sits in one), `.collapse` (daisyUI's clip container) and `textarea` (a
 * multi-line field *is* a scroll container). The owner's 2026-09-07 ruling
 * behind them is in that file and is not restated here.
 *
 * Two are the scrolling panes `checks.ts`'s first row already admits, in
 * the other axis and in the component daisyUI draws them with:
 *
 *   * **`.overflow-y-auto`** — the side panel's own scrolling column
 *     (`src/app/(account)/app/layout.tsx`, #940). `checks.ts`'s row is
 *     `.overflow-x-auto` because a wide `table` was the case that came up
 *     first; a column that scrolls downward is the same ruling ("a declared
 *     scroll container is the box changing, not the text being cut off",
 *     owner, 2026-09-07) turned ninety degrees. This is the editor's
 *     scrolling pane the 2026-09-20 ruling anticipates, arriving early.
 *   * **`.drawer-side`** — daisyUI's off-canvas container, admitted on
 *     exactly the grounds `.collapse` is: it **is** a clip container. A
 *     closed drawer keeps its panel in the document and parks it off screen,
 *     so the panel's box sitting left of its shell is the component working,
 *     not a panel escaping. Since PR #942 this is not academic — that PR
 *     holds an out-of-flow box to `box.left < 0`, which a closed drawer is
 *     by construction, so from the day #940's side panel landed every
 *     `(account)` screen reported it at 390 and 768 in both themes. **What
 *     is still measured is the drawer that is open**: a panel wider than the
 *     screen is caught by `checkNoHorizontalScroll` and by
 *     `checkFixedBoxesFitViewport`, neither of which this row touches.
 *
 * Two rows are this pass's own, and each is a box that is not a box:
 *
 *   * **`.sr-only`** — the screen-reader-only list every Recharts chart
 *     writes beside its drawing (`GrowthLine`, `PresenceBars`,
 *     `RivalSparkline`: "The readings are also written as a visually hidden
 *     list"). Tailwind draws it one pixel square with `clip`, so every
 *     reading inside it measures as overflowing, and its `<li>` elements
 *     measure as escaping their `<ul>`. Nothing is cut off from anybody: the
 *     text is complete, it is in the accessibility tree, and being undrawn
 *     is the entire point of it. Six offenders per chart, on every route
 *     with a chart, at every width, in both themes.
 *   * **`.contents`** — `display: contents` generates **no box at all**. Its
 *     children are laid out by its grandparent, and `getBoundingClientRect`
 *     answers for an element that has no border box, so comparing a child
 *     with it is comparing a real box with nothing. This is the same class
 *     of measurement error PR #942 corrects for out-of-flow elements, one
 *     row along: `checks.ts` already skips an *element* that generates no
 *     box ("No box, nothing to measure — skipped, never reported") and the
 *     rule has simply never been applied to the *parent*. The rivals ×
 *     questions grid writes `display: contents` on every row, so this was
 *     seven offenders per row on `/`, `/app` and `/scan/{domain}`.
 *
 * The mechanical fix for the second — skip a parent with no box, wherever it
 * came from — belongs in `checkContainment` beside #942's correction rather
 * than in a selector here, and is named in this PR for whoever lands next in
 * that function.
 *
 * Nothing else is added, and each row names a component that is on screen
 * today. The editor's own panes (#932) are not drawn yet; the row that
 * admits them, if `.overflow-y-auto` does not already, belongs to the PR
 * that draws them.
 */
export const NO_OVERFLOW_SCROLL_CONTAINERS: readonly string[] = [
  ...SCROLL_CONTAINER_ALLOWLIST,
  ".overflow-y-auto",
  ".drawer-side",
  ".sr-only",
  ".contents",
];

/**
 * The deliberately clamped text.
 *
 * The 2026-09-20 ruling makes clamping the *approved* answer for a label
 * that can grow — "a title, a domain, a search … is clamped to one or two
 * lines with an ellipsis" — so the Tailwind utilities that do it are
 * declarations of intent in the markup, and a box carrying one is a box
 * whose author chose the ellipsis. Four rows, each a utility a reader can
 * find in the route file that wrote it.
 *
 * `checks.ts`'s two calendar rows are spread in rather than retyped, for the
 * same reason the list above spreads: two lists of what this product clamps
 * is how they come to disagree.
 *
 * **This list still saves nothing whose text is a value.** `checks.ts`
 * re-derives that from the computed font — a number, a date, a domain or a
 * query cut in half is a different value, and no selector exempts one.
 */
export const NO_OVERFLOW_CLAMPED_TEXT: readonly string[] = [
  ...TRUNCATION_ALLOWLIST,
  ".truncate",
  ".line-clamp-1",
  ".line-clamp-2",
  ".line-clamp-3",
];

/** The two class names Recharts 3 writes, named once. `recharts-wrapper` is
 *  the div `RechartsWrapper` renders; `recharts-surface` is the `<svg>`
 *  inside it (`node_modules/recharts/lib/chart/RechartsWrapper.js`,
 *  `container/Surface.js`). A Recharts upgrade that renamed either would
 *  fail `charts-are-drawn` below on every chart route at once, which is the
 *  loud way for this to be wrong. */
export const RECHARTS_CLASS = { wrapper: "recharts-wrapper", surface: "recharts-surface" } as const;

/**
 * `docs/DESIGN.md`'s chart rule, as two things a browser can see.
 *
 * The rule is "Every Recharts series sits in a `ResponsiveContainer`", and
 * in Recharts 3 that is spelled `responsive` on the chart root — the wrapper
 * div then measures itself and reports its own size (`RechartsWrapper`'s
 * `ResponsiveDiv`). A chart that opted out of it keeps whatever width it was
 * given, and the reader sees one of exactly two things:
 *
 *   1. **nothing** — the wrapper is there and no surface was ever drawn, or
 *      it was drawn at zero. This is rk-901's finding: a harness that
 *      measured a static render reported three empty frames as three clean
 *      charts, because an element with no box cannot overflow one.
 *   2. **a chart wider than the box it was given** — the surface keeps its
 *      fixed width while the card narrows around it, so at 390 the series
 *      runs off the card. `checkContainment` sees this too when the card
 *      clips; this check sees it whether or not anything clips, and says
 *      which chart rather than which `div`.
 *
 * Closure-free and one object argument, for the reason `checks.ts`'s header
 * gives: this source text is serialised into a Chromium tab by
 * `page.evaluate`, so a reference to anything outside its own body is a
 * `ReferenceError` there.
 */
export function checkChartsResponsive(opts: {
  wrapperClass: string;
  surfaceClass: string;
}): Offender[] {
  const { wrapperClass, surfaceClass } = opts;
  function describe(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const cls = el.getAttribute("class");
    const clsPart = cls ? `.${cls.trim().split(/\s+/).join(".")}` : "";
    const label =
      el.closest("figure")?.getAttribute("aria-label") ??
      el.closest("[data-testid]")?.getAttribute("data-testid") ??
      "";
    return `${tag}${clsPart}${label ? ` "${label}"` : ""}`;
  }

  const offenders: Offender[] = [];
  for (const wrapper of Array.from(document.querySelectorAll(`.${wrapperClass}`))) {
    const surface = wrapper.querySelector(`svg.${surfaceClass}`);
    const box = surface?.getBoundingClientRect();
    if (!surface || !box || box.width < 1 || box.height < 1) {
      offenders.push({ check: "chart-not-drawn", element: describe(wrapper) });
      continue;
    }
    // The box the chart was given: its parent's content box, which is what a
    // responsive chart tracks and a fixed-size one ignores. Padding is taken
    // off explicitly rather than read off `clientWidth`, which includes it.
    const parent = wrapper.parentElement;
    if (!parent) continue;
    const style = getComputedStyle(parent);
    const available =
      parent.getBoundingClientRect().width -
      parseFloat(style.borderLeftWidth || "0") -
      parseFloat(style.borderRightWidth || "0") -
      parseFloat(style.paddingLeft || "0") -
      parseFloat(style.paddingRight || "0");
    // One pixel of slack: a sub-pixel container width rounds, and a chart
    // one hundredth of a pixel wide of its box is not what a reader sees.
    if (box.width > available + 1) {
      offenders.push({
        check: "chart-wider-than-its-box",
        element: `${describe(wrapper)} — ${Math.round(box.width)}px drawn in ${Math.round(available)}px`,
      });
    }
  }
  return offenders;
}

/**
 * Every fixed box fits the screen.
 *
 * **This does not restate `checkContainment`, and it must not.** PR #942
 * (merged 2026-09-21) corrects that check for out-of-flow elements: CSS
 * gives `position: fixed` the viewport as its containing block and
 * `position: absolute` the nearest *positioned* ancestor, neither of which
 * is reliably the DOM parent, so holding a fixed box to its parent reported
 * two offenders on every route in the product with nothing clipped and
 * nothing off screen. That rule lives in `checks.ts`, and this pass takes it
 * from there exactly as it takes the other three.
 *
 * What #942 leaves for a check like this one is the rest of the same
 * sentence. Read its code: an out-of-flow box is held to `box.left < 0 ||
 * box.right > innerWidth` — **the screen's left and right edges, and only
 * those.** That is deliberate there ("an out-of-flow box may sit anywhere
 * down the page"), and it is right for `position: absolute`, which follows
 * the document. It is not the whole property for `position: fixed`, which is
 * pinned to the viewport in *both* axes: a phone's bottom menu taller than
 * the screen it is docked to, or a toast stack that starts below the fold,
 * is off screen in the direction that check does not look.
 *
 * So this is `fixed` alone, all four edges, and it adds one thing #942's
 * rule cannot afford to: **a box wholly off screen is not reported.** A
 * closed daisyUI `drawer-side` is a fixed panel translated out of view,
 * which is the component working — nothing of it is cut off because none of
 * it is on screen. The rule is the one a reader would state: what is on the
 * screen fits on the screen.
 *
 * Closure-free, one object argument, for the reason `checks.ts`'s header
 * gives.
 */
export function checkFixedBoxesFitViewport(opts: { epsilon: number }): Offender[] {
  const { epsilon } = opts;
  function describe(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = el.getAttribute("class");
    const clsPart = cls ? `.${cls.trim().split(/\s+/).join(".")}` : "";
    const text = (el.textContent ?? "").trim().slice(0, 40);
    return `${tag}${id}${clsPart}${text ? ` "${text}"` : ""}`;
  }

  const offenders: Offender[] = [];
  const width = window.innerWidth;
  const height = window.innerHeight;
  for (const el of Array.from(document.querySelectorAll("*"))) {
    if (getComputedStyle(el).position !== "fixed") continue;
    // The same two skips checks 2 and 3 make, for the same reasons: an
    // element that generates no box has none to fit, and a box with no area
    // draws nothing a reader could see cut off.
    if (el.getClientRects().length === 0) continue;
    const box = el.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) continue;
    if (box.right <= 0 || box.bottom <= 0 || box.left >= width || box.top >= height) continue;
    if (
      box.left < -epsilon ||
      box.right > width + epsilon ||
      box.top < -epsilon ||
      box.bottom > height + epsilon
    ) {
      offenders.push({
        check: "fixed-box-outside-viewport",
        element:
          `${describe(el)} — ${Math.round(box.left)}…${Math.round(box.right)} × ` +
          `${Math.round(box.top)}…${Math.round(box.bottom)} in ${width} × ${height}`,
      });
    }
  }
  return offenders;
}

/** Half a pixel, the slack `checks.ts` gives containment. A sub-pixel layout
 *  rounds, and a box a hundredth of a pixel past the screen's edge is not
 *  what a reader sees. */
export const EDGE_EPSILON_PX = 0.5;

/**
 * The custom element Next.js's App Router appends to `<body>` once the
 * client runtime has hydrated (`next/dist/client/components/app-router-announcer.js`).
 *
 * It is this repository's existing answer to "has this document hydrated?" —
 * `checks.ts` already skips it by name for exactly that reason ("It appears
 * only once the client runtime has hydrated, so leaving it in makes every
 * route's sweep a race with hydration"). What that comment treats as a
 * nuisance is the signal: a document carrying it is a document whose
 * JavaScript ran.
 *
 * `no-overflow.test.ts` asserts it appears, on one real route, so a Next.js
 * upgrade that stopped emitting it fails one named test rather than quietly
 * turning every wait below into a no-op.
 */
export const HYDRATION_MARKER = "next-route-announcer";

/** How long a document may take to hydrate, load its webfont and draw its
 *  charts. Generous on purpose and never the real bound — every caller runs
 *  under its own per-test timeout, and this exists so a page that never
 *  settles is *reported* rather than timed out with nothing to say, the same
 *  reasoning `browser.ts`'s `SETTLE_MS` is written under. */
const SETTLE_MS = 30_000;

/**
 * Everything that has to have happened before a box on this page means
 * anything.
 *
 * Deliberately tolerant: each wait that expires leaves the page as it is and
 * returns, because the checks that run next are better at saying what is
 * wrong than a timeout is. A chart that never drew is `chart-not-drawn`
 * naming the figure; a document that never hydrated is a page full of
 * server-rendered boxes, which the hydration test names directly.
 */
export async function settleForMeasurement(page: Page): Promise<void> {
  // 1. The client runtime. `withPage`'s navigation already resolved on
  //    `load` and waited out any `[data-waiting]` fallback; this is the step
  //    after, and it is what makes the charts below possible at all.
  await page
    .waitForSelector(HYDRATION_MARKER, { state: "attached", timeout: SETTLE_MS })
    .catch(() => undefined);
  // 2. The webfont. A run that races it measures the fallback face, whose
  //    glyphs are a different width — which is a layout pass reporting a
  //    clip that no reader will ever see, and the flake that gets a suite
  //    switched off (`visual.test.ts` waits on the same promise, before its
  //    shutter, for the same reason).
  await page.evaluate(() => document.fonts.ready.then(() => undefined)).catch(() => undefined);
  // 3. Every chart, drawn. Recharts measures its box in an effect and paints
  //    on the frame after, so a page read the moment hydration finished is a
  //    page of empty chart frames.
  await page
    .waitForFunction(
      (selectors) => {
        const wrappers = Array.from(document.querySelectorAll(`.${selectors.wrapper}`));
        return wrappers.every((w) => {
          const svg = w.querySelector(`svg.${selectors.surface}`);
          return svg !== null && svg.getBoundingClientRect().width > 0;
        });
      },
      { wrapper: RECHARTS_CLASS.wrapper, surface: RECHARTS_CLASS.surface },
      { timeout: SETTLE_MS },
    )
    .catch(() => undefined);
  // 4. One painted frame past all of it, so a layout still settling is
  //    settled before the first `getBoundingClientRect`.
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

/** The two impacts the issue makes blocking: "fail on serious and critical
 *  findings". `minor` and `moderate` are reported by axe and are not a merge
 *  gate — a gate that fails on every one of them on the day it lands is a
 *  gate that gets switched off in a week. */
export const BLOCKING_AXE_IMPACTS: readonly string[] = ["serious", "critical"];

/**
 * Accessibility, in the same tab, on the same document, at the same width
 * and in the same theme — which is the point of "in the same pass". A
 * contrast finding is a property of the theme, and a target-size finding is
 * a property of the width; run once at one width in one theme, axe would
 * answer for a sixth of this product.
 *
 * Reported as `Offender`s so one list answers "what is wrong with this
 * screen", in the order a person would read it, rather than two reports that
 * have to be correlated by eye.
 */
export async function axeOffenders(page: Page): Promise<Offender[]> {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((violation) => BLOCKING_AXE_IMPACTS.includes(violation.impact ?? ""))
    .map((violation) => ({
      check: `axe-${violation.impact}`,
      element:
        `${violation.id}: ${violation.help} — ` +
        violation.nodes
          .slice(0, 3)
          .map((node) => node.target.join(" "))
          .join(", "),
    }));
}

/**
 * One defect this gate found on `main` on the day it was written, and the
 * issue that owns the fix.
 *
 * **Why a list like this exists at all.** This gate went up against a
 * product that had never been measured at 390, in dark, hydrated, or by axe,
 * and it found twenty findings across five defects. A gate that is red on
 * `main` blocks nothing, because everything is already failing; a gate that
 * launches when the last of five unrelated fixes lands is a gate that
 * launches in a month. Naming what is already broken is what lets it block
 * the *next* defect from today, which is the promise issue #910 makes.
 *
 * **What keeps it from rotting.** Two things, and they are the reason this
 * is not a skip list:
 *
 *   1. Every row names an open issue. There is no row whose fix is nobody's.
 *   2. **The pass fails when a row stops matching.** A defect that gets
 *      fixed takes its row with it — `no-overflow.test.ts`'s last test
 *      asserts that every row here was still found during the run, and says
 *      which to delete when one was not. So the list can only ever shrink,
 *      and it cannot quietly outlive what it excuses.
 *
 * `match` is a substring of the offender's `element`, kept to the part that
 * is stable across widths and themes — an axe rule's id, or the element's
 * selector without the geometry after the dash.
 */
export interface KnownDefect {
  /** The route path, exactly as `noOverflowRoutes` spells it. */
  readonly route: string;
  /** The offender's `check`, exactly. */
  readonly check: string;
  /** A substring of the offender's `element`. */
  readonly match: string;
  /** The issue that owns the fix. */
  readonly issue: number;
}

/** Found 2026-09-21 by this pass against `main` at 06b33bb, after #938,
 *  #939, #940 and #942. */
export const KNOWN_ON_MAIN: readonly KnownDefect[] = [
  // #944 — the day card's stage badge, past its cell at 768 and 1280.
  { route: "/app/calendar", check: "containment", match: "badge.badge-sm.badge-primary", issue: 944 },
  // #946 — the theme's muted arms, under the contrast floor on ten screens.
  { route: "/", check: "axe-serious", match: "color-contrast", issue: 946 },
  { route: "/scan/example.com", check: "axe-serious", match: "color-contrast", issue: 946 },
  { route: "/pricing", check: "axe-serious", match: "color-contrast", issue: 946 },
  { route: "/privacy", check: "axe-serious", match: "color-contrast", issue: 946 },
  { route: "/terms", check: "axe-serious", match: "color-contrast", issue: 946 },
  { route: "/imprint", check: "axe-serious", match: "color-contrast", issue: 946 },
  { route: "/app", check: "axe-serious", match: "color-contrast", issue: 946 },
  { route: "/app/calendar", check: "axe-serious", match: "color-contrast", issue: 946 },
  { route: "/app/draft/draft-2026-09-15", check: "axe-serious", match: "color-contrast", issue: 946 },
  { route: "/app/settings", check: "axe-serious", match: "color-contrast", issue: 946 },
  { route: "/app/search", check: "axe-serious", match: "color-contrast", issue: 946 },
  { route: "/app/ai-answers", check: "axe-serious", match: "color-contrast", issue: 946 },
  { route: "/app/rivals", check: "axe-serious", match: "color-contrast", issue: 946 },
];

/**
 * Whether this run is allowed to conclude that a `KNOWN_ON_MAIN` row has
 * been fixed.
 *
 * **CI is the environment of record, and it has to be.** Two of these rows
 * depend on how wide a string renders: a pane is only *scrollable*, and so
 * only reported by axe's `scrollable-region-focusable`, when its content is
 * wider than its box. `/app/search`'s table crosses that line at 390 and 768
 * under the fonts GitHub's runner installs and does not cross it on this
 * build box. The defect is identical on both — a pane that scrolls with no
 * way into it from a keyboard — but only one of them can be asked "is it
 * still there?" and be believed.
 *
 * So the last test in `no-overflow.test.ts` **asserts** in CI and **reports**
 * anywhere else. The gate itself is unaffected: a new offender fails the run
 * on any machine, which is what the gate is for. What is CI-only is the
 * narrower claim that a row has stopped matching *because someone fixed it*
 * rather than because this machine draws text differently.
 */
export const ENVIRONMENT_OF_RECORD = process.env.CI === "true" || process.env.CI === "1";

/** The row that excuses this offender on this route, or `undefined` — in
 *  which case it fails the gate. */
export function knownDefectFor(route: string, offender: Offender): KnownDefect | undefined {
  return KNOWN_ON_MAIN.find(
    (known) =>
      known.route === route &&
      known.check === offender.check &&
      offender.element.includes(known.match),
  );
}

/**
 * Every `(public)` and `(account)` route, through the door it is actually
 * reachable in.
 *
 * The enumeration is `routes.ts`'s, so a screen added later is in scope by
 * construction and never by being listed here — the rule `visual.test.ts`
 * and `gallery.ts` are both written under.
 *
 * Two things this adds to it:
 *
 *   * **`/setup` and `/setup/zone` take the unfinished founder's session.**
 *     Those two addresses answer with a screen *only* for an account that
 *     has paid and not finished setup; for the reserved account `/setup` is
 *     a redirect to `/app` (`browser.ts`'s `getSetupAccountCookie`). A sweep
 *     that sent the reserved cookie everywhere therefore measured `/app`
 *     three times and the five-step setup screen never, which is the screen
 *     #908's design review found labels overflowing on.
 *   * **the `(hosted)` route is not here.** Issue #910's Build names
 *     `(public)` and `(account)`, and a customer's published page is served
 *     through a `content.` Host on a stranger's domain — a different door,
 *     a different fixture, and one the 1280 sweep already walks. Adding it
 *     is a row, not a rewrite; it is called out in this PR rather than
 *     smuggled in.
 */
export function noOverflowRoutes(
  appRoot: string,
  cookies: { reserved: string; setup: string },
): EnumeratedRoute[] {
  return enumerateRoutes(appRoot, { accountCookie: cookies.reserved })
    .filter((route) => route.host === undefined)
    .map((route) =>
      route.path === "/setup" || route.path.startsWith("/setup/")
        ? { ...route, cookie: cookies.setup }
        : route,
    );
}
