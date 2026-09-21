// tests/ui/layout/no-overflow-canary.test.ts — the two defects issue #910
// names, built on purpose
//
// Issue #910 `**Done when.**`: "A deliberately too-long step label and a
// chart placed outside a `ResponsiveContainer` each turn the check red;
// `main` is green."
//
// That is two claims, and only one of them is provable by a green run. A
// suite that passes proves the screens it swept are clean; it proves nothing
// at all about whether the ruler works, and a ruler that measures nothing
// passes every screen for ever. So the same reasoning ADR-093 decision 6
// point 5 gives for `canary.test.ts` applies here: **a green run in which a
// canary also passes is a failed run.**
//
// Both defects are built as documents rather than as edits to a route, for
// two reasons. A route this pass is meant to protect cannot be left
// permanently broken to prove the pass works — and three other agents have
// open work on those routes this week. And the defect is the *shape*, not
// the screen: a label that cannot break inside its column, and a chart that
// kept the width it was given while its card narrowed. Written here, both
// are reproducible on any machine with a browser, in milliseconds, with no
// database and no build.
import { describe, expect, it } from "vitest";
import {
  checkContainment,
  checkNoClippingOrTruncation,
  checkNoHorizontalScroll,
  MONO_FONT_FAMILY,
  type Offender,
} from "./checks";
import { withPage } from "./browser";
import {
  checkChartsResponsive,
  checkFixedBoxesFitViewport,
  EDGE_EPSILON_PX,
  NO_OVERFLOW_CLAMPED_TEXT,
  NO_OVERFLOW_SCROLL_CONTAINERS,
  NO_OVERFLOW_WIDTHS,
  RECHARTS_CLASS,
} from "./no-overflow";

/** The phone, which is where a label that can grow runs out of its column
 *  first — and the width the 2026-09-20 ruling put at the head of its list. */
const PHONE = NO_OVERFLOW_WIDTHS[0];

const HEAD = `<!doctype html><html><head><style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, sans-serif; font-size: 15px; }
  .steps { display: grid; width: 100%; }
  /* The two ways five columns can be written, and the difference #922's
     second commit was about. \`1fr\` is \`minmax(auto, 1fr)\`: a column
     refuses to shrink below its content, so a label that will not break
     widens the whole row past the viewport. \`minmax(0, 1fr)\` is the fixed
     share \`SetupForm.tsx\` now writes: the row keeps its width and the
     label is cut off by its own column instead. Both are defects and they
     are not the same defect, which is why each has a fixture. */
  .columns-that-grow { grid-template-columns: repeat(5, 1fr); }
  .columns-that-hold { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .step { text-align: center; font-size: 12px; }
  /* The same column, inside a card that cuts what does not fit — which is
     the ruling's own sentence ("no text is clipped by its card") and the
     only shape in which a label is actually lost to the reader. */
  .step-in-a-card .step { overflow: hidden; }
  .card { width: 320px; padding: 8px; border: 1px solid #ccc; }
  /* Tailwind's \`truncate\`, on the block element it is written on. */
  .truncate { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* The three shapes a fixed box takes on these screens: a bar drawn to the
     screen's width, the same bar given a width and an inset at once — which
     is \`sonner\`'s defect (#942) — and a side panel parked off screen,
     which is daisyUI's closed \`drawer-side\`. */
  .bar { position: fixed; left: 0; right: 0; bottom: 0; height: 56px; }
  .bar-overconstrained { position: fixed; left: 16px; right: 16px; bottom: 0; width: 100%; height: 56px; }
  .drawer-closed { position: fixed; top: 0; bottom: 0; width: 280px; transform: translateX(-100%); }
</style></head><body>`;
const FOOT = `</body></html>`;

/**
 * A step label with no break opportunity in it.
 *
 * Unbroken on purpose, and this is the part a first draft of this fixture
 * got wrong: a hyphenated phrase *does* break — CSS takes a hyphen as a line
 * break opportunity — so it wraps to three lines inside its column, the row
 * grows taller, every character stays readable and **nothing is a defect**.
 * The pass reports nothing on it and is right to. What overflows a column is
 * a single unbroken token, which is what a long business name, a domain or
 * an untrimmed heading actually is.
 */
const TOO_LONG_STEP_LABEL = "publishingandschedulingandeverythingelse";

/** The five one-word labels `docs/DESIGN.md` asks a step indicator to carry
 *  ("A step indicator is daisyUI `steps` with one-word labels"), with the
 *  fifth replaced by whatever is passed. */
function stepsRow(columns: string, fifth: string): string {
  return (
    `${HEAD}<ul class="steps ${columns}">` +
    `<li class="step">Site</li><li class="step">Business</li>` +
    `<li class="step">Rivals</li><li class="step">Voice</li>` +
    `<li class="step" id="too-long-step">${fifth}</li></ul>${FOOT}`
  );
}

/**
 * A chart that kept the width it was given.
 *
 * This is the DOM Recharts 3 leaves behind when a chart is drawn at a fixed
 * size rather than responsively — the wrapper div and its `<svg>` surface,
 * with the surface's own width, inside a card that is narrower. Written out
 * rather than rendered, because what the check reads is the geometry and the
 * geometry is the defect; `tests/ui/recharts-charts.test.tsx` is where the
 * real components are mounted.
 */
const FIXED_WIDTH_CHART =
  `${HEAD}<div class="card"><figure aria-label="Where you show up" style="margin:0">` +
  `<div class="${RECHARTS_CLASS.wrapper}" style="width:600px">` +
  `<svg class="${RECHARTS_CLASS.surface}" width="600" height="80" viewBox="0 0 600 80"></svg>` +
  `</div></figure></div>${FOOT}`;

/** The same chart drawn to the box it was given. */
const RESPONSIVE_CHART =
  `${HEAD}<div class="card"><figure aria-label="Where you show up" style="margin:0">` +
  `<div class="${RECHARTS_CLASS.wrapper}" style="width:100%">` +
  `<svg class="${RECHARTS_CLASS.surface}" width="302" height="80" viewBox="0 0 302 80"></svg>` +
  `</div></figure></div>${FOOT}`;

/** A chart frame with nothing in it — rk-901's finding, and the reason this
 *  pass renders hydrated: a chart that never measured its box draws no
 *  surface at all, and an element with no box cannot overflow one, so every
 *  check that measures boxes reports a clean screen. */
const UNDRAWN_CHART =
  `${HEAD}<div class="card"><figure aria-label="Your rivals" style="margin:0">` +
  `<div class="${RECHARTS_CLASS.wrapper}" style="width:100%"></div>` +
  `</figure></div>${FOOT}`;

/** A phone's bottom menu, drawn to the width of the screen. */
const FIXED_BAR = `${HEAD}<nav class="bar" id="bottom-menu">Overview · Plan · Settings</nav>${FOOT}`;

/** The same bar, given a width **and** an inset on both sides — the box is
 *  over-constrained, the width wins, and the bar hangs 16px past the side of
 *  the phone. This is `sonner`'s stack as PR #942 found it, and it is the
 *  case a containment check corrected for out-of-flow elements no longer
 *  reports by itself. */
const FIXED_BAR_PAST_THE_EDGE = `${HEAD}<nav class="bar-overconstrained" id="bottom-menu">Overview · Plan · Settings</nav>${FOOT}`;

/** A closed daisyUI `drawer-side`: a fixed panel translated wholly out of
 *  view. Nothing of it is cut off because none of it is on screen, and the
 *  pass must say so — a check that reported this would be switched off by
 *  the first PR that drew a side panel. */
const CLOSED_DRAWER = `${HEAD}<aside class="drawer-closed" id="side-panel">Overview</aside>${FOOT}`;

/** The pass's own three layout checks and its chart rule, on a document
 *  stood up by hand. The axe run is deliberately not here: what these
 *  fixtures are for is the ruler, and a fragment with no landmark or page
 *  title would fail axe for reasons that say nothing about overflow. */
async function offendersOn(html: string, width = PHONE): Promise<Offender[]> {
  return withPage(width, async (page) => {
    await page.setContent(html);
    return [
      await page.evaluate(checkNoHorizontalScroll),
      await page.evaluate(checkContainment, {
        scrollContainerAllowlist: NO_OVERFLOW_SCROLL_CONTAINERS,
      }),
      await page.evaluate(checkNoClippingOrTruncation, {
        scrollContainerAllowlist: NO_OVERFLOW_SCROLL_CONTAINERS,
        truncationAllowlist: NO_OVERFLOW_CLAMPED_TEXT,
        monoFontFamily: MONO_FONT_FAMILY,
      }),
      await page.evaluate(checkChartsResponsive, {
        wrapperClass: RECHARTS_CLASS.wrapper,
        surfaceClass: RECHARTS_CLASS.surface,
      }),
      await page.evaluate(checkFixedBoxesFitViewport, { epsilon: EDGE_EPSILON_PX }),
    ].flat();
  });
}

describe("issue #910 — a too-long step label turns the check red", () => {
  it(`reports the label that widens the row past the phone, at ${PHONE}px`, async () => {
    // Columns that grow: the row itself ends up wider than the viewport, so
    // the document scrolls sideways and the step escapes its own row. This
    // is the shape #922's second commit fixed, kept here so a column set
    // written back as `1fr` cannot reach main again unnoticed.
    const offenders = await offendersOn(stepsRow("columns-that-grow", TOO_LONG_STEP_LABEL));
    expect(offenders.map((o) => o.check)).toContain("no-horizontal-scroll");
    expect(
      offenders.some((o) => o.check === "containment" && o.element.includes("too-long-step")),
    ).toBe(true);
  });

  it(`reports the label its own card cuts off, at ${PHONE}px`, async () => {
    // Columns that hold their share, inside a card that clips: the row keeps
    // its width, and the label is **cut off** rather than spilled. A
    // different check catches it — the content of a box is wider than the
    // box, and the box hides the difference — and that is the point of
    // having both.
    //
    // The card is what makes this a clip. Without it the same label spills a
    // column that hides nothing, every character stays on screen, and what
    // the pass reports is the spill (the case above), never a clip: issue
    // #910 scopes this check to "a box with `overflow` other than
    // `visible`", and `checks.ts` reads it that way since 2026-09-21.
    const offenders = await offendersOn(
      stepsRow("columns-that-hold step-in-a-card", TOO_LONG_STEP_LABEL),
    );
    expect(
      offenders.some(
        (o) => o.check === "no-clipping-or-truncation" && o.element.includes("too-long-step"),
      ),
    ).toBe(true);
  });

  it("reports nothing once the same label is clamped with an ellipsis", async () => {
    // The other half of the claim, and the one that keeps the allow-list
    // honest: clamping is the ruling's *approved* answer for a label that
    // can grow ("clamped to one or two lines with an ellipsis"), so the pass
    // must not report the screen that took it. A canary that only ever went
    // red would be satisfied by a check that fails everything.
    const offenders = await offendersOn(
      stepsRow(
        "columns-that-hold step-in-a-card",
        `<span class="truncate" title="${TOO_LONG_STEP_LABEL}">${TOO_LONG_STEP_LABEL}</span>`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("reports nothing on a label that wraps — a taller row is not a defect", async () => {
    // Stated as a test because it is the distinction this pass has to get
    // right to be worth having. Text that breaks is text a reader can read;
    // the law is "content fits its box **or the box changes**", and a row
    // that grew a line is the box changing.
    const offenders = await offendersOn(
      stepsRow("columns-that-hold step-in-a-card", "publishing and scheduling and everything else"),
    );
    expect(offenders).toEqual([]);
  });
});

describe("issue #910 — a chart outside a ResponsiveContainer turns the check red", () => {
  it("reports a chart drawn wider than the card it sits in", async () => {
    const offenders = await offendersOn(FIXED_WIDTH_CHART);
    expect(offenders.map((o) => o.check)).toContain("chart-wider-than-its-box");
  });

  it("reports a chart frame that drew no surface at all — rk-901's blind spot", async () => {
    const offenders = await offendersOn(UNDRAWN_CHART);
    expect(offenders.map((o) => o.check)).toContain("chart-not-drawn");
  });

  it("reports nothing on a chart drawn to the box it was given", async () => {
    const offenders = await offendersOn(RESPONSIVE_CHART);
    expect(offenders).toEqual([]);
  });
});

/**
 * The fixed-box rule alone, deliberately — not the whole battery.
 *
 * `checkContainment` holds an out-of-flow element to its DOM parent until PR
 * #942 lands and to its containing block afterwards, so a fixed bar drawn
 * correctly to the screen's width is an offender there today and is not one
 * tomorrow. That is #942's property to assert and its canary to own. What
 * this file has to prove is that *this* pass's own rule fires on a bar that
 * hangs off the screen and stays quiet on the two that do not, and that
 * claim should not change its answer on the day another PR merges.
 */
async function fixedOffendersOn(html: string, width = PHONE): Promise<Offender[]> {
  return withPage(width, async (page) => {
    await page.setContent(html);
    return page.evaluate(checkFixedBoxesFitViewport, { epsilon: EDGE_EPSILON_PX });
  });
}

describe("issue #910 / PR #942 — a fixed box is held to the screen, not to its parent", () => {
  it("reports a fixed bar that hangs past the side of the phone", async () => {
    // The defect #942 found in `sonner`'s stack, as a document: a width and
    // two insets on one box, the width winning, and 32px of the bar off the
    // screen. Nothing contains it — that is what `position: fixed` means —
    // so the screen is the only thing it can be measured against.
    const offenders = await fixedOffendersOn(FIXED_BAR_PAST_THE_EDGE);
    expect(
      offenders.some(
        (o) => o.check === "fixed-box-outside-viewport" && o.element.includes("bottom-menu"),
      ),
    ).toBe(true);
  });

  it("reports nothing on a fixed bar drawn to the width of the screen", async () => {
    const offenders = await fixedOffendersOn(FIXED_BAR);
    expect(offenders).toEqual([]);
  });

  it("reports nothing on a side panel parked off screen — a closed drawer is the component working", async () => {
    const offenders = await fixedOffendersOn(CLOSED_DRAWER);
    expect(offenders).toEqual([]);
  });
});
