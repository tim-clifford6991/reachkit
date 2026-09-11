// tests/ui/layout/checks.ts
//
// ADR-093 decision 6, checks 1-4, quoted in WO-269 `## Test plan`:
// "asserting: no horizontal document scroll; every border box contained in
// its containing block's padding box; `scrollWidth <= clientWidth` and
// `scrollHeight <= clientHeight` on every text-bearing element outside the
// declared truncation allow-list, with a truncated **value** failing
// whether allow-listed or not; and computed `font-size` at or above the
// floor."
//
// Each function below is closure-free — it references only DOM globals
// (`document`, `window`, `getComputedStyle`) and its own parameters, and
// every helper it needs is declared *inside* its own body. That is what
// lets one definition run unchanged in two hosts: called directly, in
// process, against the jsdom `ui` project's global `document` (WO-269 step
// 1 — the demonstration that a DOM with no layout engine makes every metric
// these checks read return `0`, so all four report nothing on a page that
// overflows on purpose); and passed to Playwright's `page.evaluate()`,
// which serialises a function's own source text and re-runs it inside a
// real Chromium tab, where a reference to a sibling function declared
// elsewhere in this module would be a `ReferenceError`.
export interface Offender {
  check: string;
  element: string;
}

// design/tokens.md §4: "`--font-mono` … Every numeral, date, URL, search
// query and code-like string." Check 3 reads this name off the computed
// `font-family`, mechanically, rather than trusting an allow-list to say
// whether a clipped string is a value (ADR-093 decision 6 point 3).
export const MONO_FONT_FAMILY = "JetBrains Mono";

// A surface that declares its own scroll container, or its own registered
// truncation, adds its own row — never a default.
//
// 2026-09-05, issue #13: `.overflow-x-auto` is the first row. `SPEC.md`
// §2.2 requires every `table` to sit "always inside an `overflow-x-auto`
// wrap", and `src/ui/components/Table.tsx` is built that way — so a wide
// table overflowing that wrapper is the design system working as
// specified, not a containment defect. The row names the wrapper, so the
// exemption reaches exactly one child level: anything overflowing a box
// that is *not* declared scrollable is still reported.
// `.collapse` is the second row, for the same kind of reason: daisyUI's
// collapse *is* a clip container — a closed section keeps its content in
// the document (collapsed markup, never a lazy fetch, so it is readable
// with JavaScript off once opened) and hides it with `overflow: hidden`.
// Its content box sitting outside the closed shell is the component
// working, not text escaping its box.
// `textarea` is the third row, and it is the plainest of them (issue #374):
// a multi-line field IS a scroll container — that is what the element is —
// and a customer typing a paragraph into a four-row box reaches every line
// of it by scrolling, exactly as they do in any editor. Its content box
// standing taller than its border box is the control working, not text
// escaping. The row names the element rather than a class, so it holds for
// any field that ever takes `Input`'s multi-line arm.
export const SCROLL_CONTAINER_ALLOWLIST: readonly string[] = [
  ".overflow-x-auto",
  ".collapse",
  "textarea",
];
// 2026-09-08, issue #354: the calendar cell's own two strings, and the
// first rows this list has ever carried.
//
// A month grid cell is `--w-cell-min` wide by construction (§4.6 fixes the
// columns at `repeat(7, minmax(0, 1fr))`) and holds a string of unbounded
// length — a page's title, or the one written line a date with no page
// states. ADR-093 decision 2 offers a box that grows; here that box is one
// of seven in a row, and every cell in the row grows with it, so one long
// title re-cuts the whole month. Decision 3 refuses the other way out,
// which is smaller type.
//
// So the approved S14 clamps: three lines, and the full value on the
// cell's own `title` attribute (`CalendarGrid.tsx`), which is what makes
// this a **registered truncation** rather than a loss — the string is
// still in the document and still reachable. `tests/app/calendar` asserts
// that the attribute carries the whole of whichever string the cell drew.
//
// Neither element is set in the mono face, and check 3 re-derives that
// mechanically rather than trusting these rows: a clipped **value** is
// reported whatever this list says, because a value cut in half is a
// different value. Both of these are prose.
export const TRUNCATION_ALLOWLIST: readonly string[] = [
  ".rk-cal-label",
  ".rk-cal-empty",
];

/** Check 1 — no horizontal document scroll. */
export function checkNoHorizontalScroll(): Offender[] {
  function describe(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    return `${tag}${id}`;
  }
  const se = document.scrollingElement ?? document.documentElement;
  if (se.scrollWidth > window.innerWidth) {
    return [{ check: "no-horizontal-scroll", element: describe(se) }];
  }
  return [];
}

/** Check 2 — containment: every border box inside its containing block's padding box.
 *  Takes one object argument (rather than positional parameters) so the same
 *  function reference can be handed to Playwright's `page.evaluate(fn, arg)`,
 *  which passes exactly one argument through. */
export function checkContainment(opts: {
  scrollContainerAllowlist: readonly string[];
}): Offender[] {
  const { scrollContainerAllowlist } = opts;
  function describe(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = el.getAttribute("class");
    const clsPart = cls ? `.${cls.trim().split(/\s+/).join(".")}` : "";
    return `${tag}${id}${clsPart}`;
  }
  function matchesAny(el: Element, selectors: readonly string[]): boolean {
    return selectors.some((sel) => el.matches(sel));
  }

  const offenders: Offender[] = [];
  const EPS = 0.5;
  const all = Array.from(document.querySelectorAll("*"));
  for (const el of all) {
    const parent = el.parentElement;
    if (!parent) continue;
    if (matchesAny(parent, scrollContainerAllowlist)) continue;
    // ADR-093 decision 6 point 2 speaks of an element's *border box*. An
    // element that generates no box at all — `display: none`, which is
    // every `<script>`, `<head>` child and `[hidden]` placeholder the
    // framework writes into `<body>` — has none to contain, and
    // `getBoundingClientRect()` reports it as a 0×0 rect at the origin,
    // which lies outside any parent carrying a margin (issue #62: the
    // landing's four "offenders" were Next.js's own empty hidden `<div>`
    // and three `<script>` tags, against `<body>`'s 8px UA margin). No box,
    // nothing to measure — skipped, never reported.
    if (el.getClientRects().length === 0) continue;
    const box = el.getBoundingClientRect();
    // 2026-09-05, issue #13: the same reasoning one step further. An
    // element whose border box has zero area draws nothing and has no
    // extent to contain, so a rect sitting a few pixels past its parent's
    // edge says nothing about layout. The case that surfaced it is
    // `<next-route-announcer>` — the App Router's own screen-reader
    // element, appended to `<body>` at hydration, empty and 0x0. It
    // appears only once the client runtime has hydrated, so leaving it in
    // makes every route's sweep a race with hydration rather than a
    // measurement of the page.
    if (box.width === 0 && box.height === 0) continue;
    const pbox = parent.getBoundingClientRect();
    if (
      box.left < pbox.left - EPS ||
      box.right > pbox.right + EPS ||
      box.top < pbox.top - EPS ||
      box.bottom > pbox.bottom + EPS
    ) {
      offenders.push({ check: "containment", element: describe(el) });
    }
  }
  return offenders;
}

/**
 * Check 3 — no clipping and no truncation; a value is never saved by an
 * allow-list. One object argument, for the same reason as check 2.
 *
 * **A declared scroll container is the box changing, not the text being cut
 * off** (owner's ruling, 2026-09-07, issue #256). ADR-093's law is "content
 * fits its box **or the box changes**", and an `overflow-x-auto` wrap is how
 * this design system has always carried wide content — every registered
 * `Table` sits in one, which is why `.overflow-x-auto` is the first row of
 * check 2's `SCROLL_CONTAINER_ALLOWLIST`. Content inside such a container is
 * reachable: scrolled, never clipped, never ellipsised, and — the point of
 * the ruling — never broken mid-word to make it fit.
 *
 * So an element whose content overflows it is **not** an offender when a
 * declared scroll container around it can scroll to reach that content. It
 * still is when nothing can: overflow under `overflow: hidden`, or an
 * element that simply spills its parent, is exactly what this check exists
 * to find.
 *
 * **This is not a widening of the allow-list, and `TRUNCATION_ALLOWLIST`
 * stays empty.** An allow-list forgives an element for cutting text off; a
 * scroll container means no text was cut off. The distinction is what keeps
 * "a value is never saved by an allow-list" true — a value *outside* a
 * scroll container is an offender with no exemption available to it, which
 * is the case #256 was opened about.
 */
export function checkNoClippingOrTruncation(opts: {
  truncationAllowlist: readonly string[];
  monoFontFamily: string;
  /** The same selectors check 2 treats as scroll containers, passed in
   *  rather than re-listed, so the two checks cannot come to disagree about
   *  what one is. */
  scrollContainerAllowlist: readonly string[];
}): Offender[] {
  const { truncationAllowlist, monoFontFamily, scrollContainerAllowlist } = opts;
  function describe(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = el.getAttribute("class");
    const clsPart = cls ? `.${cls.trim().split(/\s+/).join(".")}` : "";
    const text = (el.textContent ?? "").trim().slice(0, 40);
    return `${tag}${id}${clsPart}${text ? ` "${text}"` : ""}`;
  }
  function matchesAny(el: Element, selectors: readonly string[]): boolean {
    return selectors.some((sel) => el.matches(sel));
  }
  function isTextBearing(el: Element): boolean {
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 3 && (node.textContent ?? "").trim() !== "")
        return true;
    }
    return false;
  }

  const offenders: Offender[] = [];
  const all = Array.from(document.querySelectorAll("*"));
  for (const el of all) {
    // ADR-093 decision 3's SVG viewBox exemption — the same one check 4
    // already applies, applied where the same reason holds. `scrollWidth`
    // and `clientWidth` are defined for CSS boxes; on an element inside an
    // `<svg>` Chromium answers from the SVG root rather than from the
    // glyphs, so a `<text>` drawn wholly inside its viewBox reports
    // `scrollHeight 41 > clientHeight 13` and a chart that clips nothing is
    // reported as clipping everything (issue #15 — the first route to carry
    // a chart). What this check is for inside a viewBox is check 2's: a
    // label drawn outside the viewBox escapes the `<svg>`'s box and is
    // reported there, which `canary.test.ts` asserts directly. The
    // exemption is the drawing's, never the page's — an `<svg>` that
    // overflows its own container is still an offender, because the `<svg>`
    // element itself is not inside one.
    if (el.closest("svg")) continue;
    if (!isTextBearing(el)) continue;
    const clipped =
      el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
    if (!clipped) continue;
    // The box changed rather than the text being cut off: a declared scroll
    // container around this element can reach the overflow. `closest`
    // includes the element itself, which is right — a `Table`'s own wrap
    // carries its text and is the container at the same time.
    if (
      scrollContainerAllowlist.some((sel) => el.closest(sel) !== null)
    ) {
      continue;
    }
    const allowListed = matchesAny(el, truncationAllowlist);
    const family = getComputedStyle(el).fontFamily || "";
    const isValue = family.toLowerCase().includes(monoFontFamily.toLowerCase());
    if (!allowListed || isValue) {
      offenders.push({
        check: "no-clipping-or-truncation",
        element: describe(el),
      });
    }
  }
  return offenders;
}

/** Check 4 — the type floor. Reads `--t-eyebrow` from `:root`; never defaults. */
export function checkTypeFloor(): Offender[] {
  function describe(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = el.getAttribute("class");
    const clsPart = cls ? `.${cls.trim().split(/\s+/).join(".")}` : "";
    const text = (el.textContent ?? "").trim().slice(0, 40);
    return `${tag}${id}${clsPart}${text ? ` "${text}"` : ""}`;
  }
  function isTextBearing(el: Element): boolean {
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 3 && (node.textContent ?? "").trim() !== "")
        return true;
    }
    return false;
  }

  const floorRaw = getComputedStyle(document.documentElement)
    .getPropertyValue("--t-eyebrow")
    .trim();
  if (!floorRaw) {
    return [{ check: "type-floor", element: ":root (no --t-eyebrow declared)" }];
  }
  const floor = parseFloat(floorRaw);
  const offenders: Offender[] = [];
  const all = Array.from(document.querySelectorAll("*"));
  for (const el of all) {
    if (el.closest("svg")) continue; // ADR-093 decision 3's SVG viewBox exemption.
    if (!isTextBearing(el)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (Number.isFinite(size) && size < floor) {
      offenders.push({ check: "type-floor", element: describe(el) });
    }
  }
  return offenders;
}

/** `design/tokens.md` §2's spacing scale, one step per band: the air a
 *  screen root keeps either side of its content, and the same step it
 *  keeps above and below. `--s-4` at compact, `--s-5` at medium, `--s-6`
 *  at wide — and `--s-6` is §2b's own construction, "the breakpoint above
 *  the content, less 2 × `--s-6` of air", so the wide band's gutter is the
 *  one the two measures were derived against. Pinned back against
 *  `src/ui/layout/surface.css` by `tests/ui/layout-tokens.test.ts`. */
export const SURFACE_GUTTER_PX = { compact: 16, medium: 24, wide: 32 } as const;

/** `design/tokens.md` §2b, "Two content measures": `--w-read` 704px for a
 *  single reading column, `--w-wide` 1216px for a multi-column one. Which
 *  a surface gets is read off its arms, never declared twice. */
export const CONTENT_MEASURE_PX = { read: 704, wide: 1216 } as const;

/** Check 5 — the screen root renders its container.
 *
 *  Issue #241: `Surface` wrote its attributes and no stylesheet matched
 *  them, so every screen root was a bare block flush to the top-left — and
 *  checks 1-4 all passed, because none of them fails on a page with zero
 *  padding. Overflow, containment, truncation and the type floor are
 *  properties of content inside boxes; nothing above asks whether the
 *  outermost box exists.
 *
 *  Three assertions since #267, all read off the rendered document rather
 *  than off the stylesheet: the content edge is at least the band's gutter
 *  from the viewport edge on both sides, a `main` drawn beside a box is at
 *  least the band's gutter clear of it, and the content box is at most the
 *  ruled measure. `src/ui/layout/surface.css` is what satisfies them; the check
 *  never names that file, so a second way of drawing the same container
 *  would pass it and a screen that opted out of the law would not.
 *
 *  One object argument, closure-free, for the same reason as checks 2-4:
 *  this source text is serialised into a Chromium tab by `page.evaluate`.
 *  The numbers come from `BAND_MIN` and `design/tokens.md` through the
 *  caller (`layout.test.ts`), so this file mints none of them. */
export function checkSurfaceContainer(opts: {
  /** `BAND_MIN` — the two boundaries that pick the band, in CSS px. */
  bandMin: { medium: number; wide: number };
  /** The band's gutter, in CSS px: `design/tokens.md` §2's spacing steps. */
  gutterPx: { compact: number; medium: number; wide: number };
  /** §2b's two content measures, in CSS px. */
  measurePx: { read: number; wide: number };
}): Offender[] {
  const { bandMin, gutterPx, measurePx } = opts;
  function describe(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const arms = ["compact", "medium", "wide"]
      .map((band) => `${band}=${el.getAttribute(`data-arm-${band}`) ?? "?"}`)
      .join(" ");
    return `${tag}[data-surface] (${arms})`;
  }

  const surface = document.querySelector("[data-surface]");
  if (!surface)
    return [
      {
        check: "surface-container",
        element: "no [data-surface] in the document",
      },
    ];

  const width = window.innerWidth;
  const band =
    width >= bandMin.wide
      ? "wide"
      : width >= bandMin.medium
        ? "medium"
        : "compact";
  const gutter = gutterPx[band];

  // The measure the arms select, walking `same-as-below` down exactly as
  // `surface.css` does: wide, else medium, else compact. A surface still
  // one column at its widest is a reading column (`--w-read`); anything
  // that opens into columns is a content column (`--w-wide`).
  function resolvedWideArm(el: Element): string {
    let arm = el.getAttribute("data-arm-wide") ?? "";
    if (arm === "same-as-below") arm = el.getAttribute("data-arm-medium") ?? "";
    if (arm === "same-as-below")
      arm = el.getAttribute("data-arm-compact") ?? "";
    return arm;
  }
  const measure =
    resolvedWideArm(surface) === "columns:1" ? measurePx.read : measurePx.wide;

  const offenders: Offender[] = [];

  // A surface that **declares** its own layout declares its own edges
  // (issue #297). `Arm`'s third kind is the band whose behaviour is
  // written down rather than drawn, and `surface.css` gives such a surface
  // "the container and nothing else" — no measure and no gutter. The
  // sign-in split is the screen that needs it: two full-height panels that
  // run to the viewport's edges, which a gutter would frame.
  //
  // The exemption is the *arm's*, not a screen's: nothing here names a
  // route or a class, so a second screen that declares its layout is held
  // to the same rule and a screen that stops declaring one loses the
  // exemption the moment its arm changes. What it does not exempt is the
  // content inside — checks 1 to 4 still measure every box on the page,
  // and a declared screen with no air of its own still has to fit.
  const declaresOwnEdges = (surface.getAttribute("data-arm-compact") ?? "").startsWith(
    "declared:"
  );

  const box = surface.getBoundingClientRect();
  const style = getComputedStyle(surface);
  const padLeft = parseFloat(style.paddingLeft) || 0;
  const padRight = parseFloat(style.paddingRight) || 0;
  // Half a pixel, the epsilon check 2 already uses: a centred column at an
  // odd viewport width lands on a fractional edge.
  const EPS = 0.5;

  const leftAir = box.left + padLeft;
  const rightAir = width - (box.right - padRight);
  if (!declaresOwnEdges && (leftAir < gutter - EPS || rightAir < gutter - EPS)) {
    offenders.push({
      check: "surface-gutter",
      element: `${describe(surface)} — ${band} band wants ${gutter}px either side, has ${Math.round(leftAir)}/${Math.round(rightAir)}`,
    });
  }

  // Issue #267 — the one content edge the container cannot reach.
  //
  // `[data-surface]` pads the whole screen root. Where a screen puts a
  // sidebar *inside* that root and the content beside it, the container's
  // left gutter is spent on the sidebar and the content column can begin
  // flush against it — which is what the app shell did at 1024 and 1280,
  // and what checks 1-4 and the two assertions above all pass on, because
  // every one of them measures against the viewport or the root.
  //
  // Stated over `main` and its preceding box rather than over the shell's
  // own classes: this file names no screen's markup, so a second layout
  // that put a column beside its content would be held to the same rule
  // and a screen that stopped using the shell would not be exempted by a
  // selector going stale.
  const main = document.querySelector("main");
  const beside = main?.previousElementSibling ?? null;
  if (main && beside) {
    const mainBox = main.getBoundingClientRect();
    const besideBox = beside.getBoundingClientRect();
    const drawn = besideBox.width > 0 && besideBox.height > 0;
    // Side by side, not stacked: the sidebar collapses into a header below
    // the band that shows it, and two stacked boxes need no gutter between
    // them.
    if (drawn && besideBox.right <= mainBox.left + EPS) {
      const gap =
        mainBox.left + (parseFloat(getComputedStyle(main).paddingLeft) || 0) - besideBox.right;
      if (gap < gutter - EPS) {
        offenders.push({
          check: "surface-gutter",
          element: `main beside ${beside.tagName.toLowerCase()} — ${band} band wants ${gutter}px between them, has ${Math.round(gap)}`,
        });
      }
    }
  }

  // The measure is the other half of what a declared surface declares: it
  // takes no `max-width`, because the sign-in split *is* the viewport's
  // width by construction. Same exemption, same reason, same one line
  // that turns it off the moment the arm stops saying `declared`.
  const content = box.width - padLeft - padRight;
  if (!declaresOwnEdges && content > measure + EPS) {
    offenders.push({
      check: "surface-measure",
      element: `${describe(surface)} — content ${Math.round(content)}px exceeds the ${measure}px measure`,
    });
  }
  return offenders;
}
