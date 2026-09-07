// tests/ui/layout/canary.test.ts
//
// ADR-093 decision 6 point 5, quoted in WO-269 `## Test plan`: "The suite
// ships one fixture route that overflows on purpose … and asserts that
// checks 1–4 fail on it … A green run in which the canary also passes is a
// failed run." Every `it` below is red exactly when a check *passes* on
// `fixtures/canary.html` — the demonstration that a DOM with no layout
// engine makes this happen (WO-269 step 1, recorded in the work order's
// `## Log`, not in this file) is why this suite runs under the `layout`
// project, against a real Chromium tab, and never under jsdom.
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkNoHorizontalScroll,
  checkContainment,
  checkNoClippingOrTruncation,
  checkSurfaceContainer,
  checkTypeFloor,
  CONTENT_MEASURE_PX,
  MONO_FONT_FAMILY,
  SURFACE_GUTTER_PX,
} from "./checks";
import { BAND_MIN } from "@/ui/layout/bands";
import { withPage } from "./browser";
import { widths } from "./widths";

const FIXTURE_URL =
  "file://" + path.resolve(__dirname, "./fixtures/canary.html");
const [FLOOR_WIDTH] = widths();

describe("ADR-093 decision 6 point 5 — the canary overflows on purpose and must fail", () => {
  it("check 1 (no horizontal scroll) fails, naming the overflowing element", async () => {
    const offenders = await withPage(FLOOR_WIDTH, async (page) => {
      await page.goto(FIXTURE_URL);
      return page.evaluate(checkNoHorizontalScroll);
    });
    expect(offenders.length).toBeGreaterThan(0);
  });

  it("check 2 (containment) fails, naming the escaping element", async () => {
    const offenders = await withPage(FLOOR_WIDTH, async (page) => {
      await page.goto(FIXTURE_URL);
      return page.evaluate(checkContainment, { scrollContainerAllowlist: [] });
    });
    expect(offenders.length).toBeGreaterThan(0);
  });

  it("check 2 — an element that generates no box is not an offender; the escapee still is (issue #62)", async () => {
    // A `<script>` or a `[hidden]` `<div>` has `display: none` and no border
    // box; its empty rect reads as 0×0 at the origin, outside a parent that
    // carries a margin. The fixture's body has no margin, so the case is
    // built here: give body the UA's 8px and prepend both no-box elements.
    const offenders = await withPage(FLOOR_WIDTH, async (page) => {
      await page.goto(FIXTURE_URL);
      await page.evaluate(() => {
        document.body.style.margin = "8px";
        const hidden = document.createElement("div");
        hidden.hidden = true;
        hidden.id = "no-box-hidden";
        const script = document.createElement("script");
        script.id = "no-box-script";
        script.textContent = "/* inert */";
        document.body.prepend(hidden, script);
      });
      return page.evaluate(checkContainment, { scrollContainerAllowlist: [] });
    });
    expect(offenders.some((o) => o.element.includes("no-box-hidden"))).toBe(
      false,
    );
    expect(offenders.some((o) => o.element.includes("no-box-script"))).toBe(
      false,
    );
    expect(offenders.some((o) => o.element.includes("escapee"))).toBe(true);
  });

  it("check 2 — a zero-area box outside its parent is not an offender; the escapee still is (issue #13's rule)", async () => {
    // `checks.ts`'s zero-area skip (issue #13) had no fixture of its own;
    // this is it. `<next-route-announcer>` is Next.js's own route-change
    // announcer: an empty custom element the client runtime appends to
    // `<body>` after the app tree, with a 0 × 0 border box. It *does*
    // generate a box, so the no-box skip above misses it, and a collapsed
    // margin on a screen's first or last child shortens `<body>` out from
    // under it. Built here the same way the case above is: body gets the
    // UA's 8px margin, and a real zero-area element is appended below its
    // bottom edge. A box with no area cannot clip, overflow or hide
    // anything a reader could see.
    const offenders = await withPage(FLOOR_WIDTH, async (page) => {
      await page.goto(FIXTURE_URL);
      await page.evaluate(() => {
        document.body.style.margin = "8px";
        const announcer = document.createElement("next-route-announcer");
        announcer.id = "zero-area-announcer";
        announcer.style.position = "absolute";
        announcer.style.top = `${document.body.getBoundingClientRect().bottom + 20}px`;
        announcer.style.left = "0";
        announcer.style.width = "0";
        announcer.style.height = "0";
        document.body.append(announcer);
      });
      return page.evaluate(checkContainment, { scrollContainerAllowlist: [] });
    });
    expect(
      offenders.some((o) => o.element.includes("zero-area-announcer")),
    ).toBe(false);
    expect(offenders.some((o) => o.element.includes("escapee"))).toBe(true);
  });

  it("check 3 (no clipping or truncation) fails on the clipped name", async () => {
    const offenders = await withPage(FLOOR_WIDTH, async (page) => {
      await page.goto(FIXTURE_URL);
      return page.evaluate(checkNoClippingOrTruncation, {
        truncationAllowlist: [],
        monoFontFamily: MONO_FONT_FAMILY,
      });
    });
    expect(offenders.some((o) => o.element.includes("clipped-name"))).toBe(
      true,
    );
  });

  it("check 3 — an allow-list entry does not save an element whose text is a value", async () => {
    // ADR-093 decision 6 point 3, verbatim: "An allow-list entry does not
    // save an element whose text is a value." Allow-listing the mono value
    // by selector must still leave it reported.
    const offenders = await withPage(FLOOR_WIDTH, async (page) => {
      await page.goto(FIXTURE_URL);
      return page.evaluate(checkNoClippingOrTruncation, {
        truncationAllowlist: [".clipped-value"],
        monoFontFamily: MONO_FONT_FAMILY,
      });
    });
    expect(offenders.some((o) => o.element.includes("clipped-value"))).toBe(
      true,
    );
  });

  it("check 2 — a chart label drawn outside its own viewBox is still an offender", async () => {
    // The guarantee that check 3's SVG exemption (ADR-093 decision 3) does
    // not drop. A chart label the `<svg>` clips is a half-printed value to
    // the reader, and it fails here — measured as what it is, an element
    // escaping its container's box, rather than through `scrollWidth`
    // metrics that are not defined inside a viewBox.
    const offenders = await withPage(FLOOR_WIDTH, async (page) => {
      await page.goto(FIXTURE_URL);
      return page.evaluate(checkContainment, { scrollContainerAllowlist: [] });
    });
    expect(offenders.some((o) => o.element.includes("svg-escapee"))).toBe(true);
  });

  it("check 3 — text inside an SVG is exempt; the clipped HTML name still is not", async () => {
    // ADR-093 decision 3's viewBox exemption, applied to check 3 for the
    // same reason check 4 already applies it: `scrollWidth`/`clientWidth`
    // describe CSS boxes, and inside a viewBox they describe nothing. The
    // exemption is narrow — it reaches only what is inside an `<svg>`, and
    // every clipped box on the page still fails.
    const offenders = await withPage(FLOOR_WIDTH, async (page) => {
      await page.goto(FIXTURE_URL);
      return page.evaluate(checkNoClippingOrTruncation, {
        truncationAllowlist: [],
        monoFontFamily: MONO_FONT_FAMILY,
      });
    });
    expect(offenders.some((o) => o.element.includes("svg-escapee"))).toBe(
      false,
    );
    expect(offenders.some((o) => o.element.includes("clipped-name"))).toBe(
      true,
    );
    expect(offenders.some((o) => o.element.includes("clipped-value"))).toBe(
      true,
    );
  });

  it("check 4 (the type floor) fails on text rendered under --t-floor", async () => {
    const offenders = await withPage(FLOOR_WIDTH, async (page) => {
      await page.goto(FIXTURE_URL);
      return page.evaluate(checkTypeFloor);
    });
    expect(offenders.some((o) => o.element.includes("below-floor"))).toBe(true);
  });

  it("check 4 fails, never defaults, when --t-floor is undeclared", async () => {
    const offenders = await withPage(FLOOR_WIDTH, async (page) => {
      await page.goto(FIXTURE_URL);
      await page.evaluate(() => {
        document.documentElement.style.setProperty("--t-floor", "");
        // jsdom-and-browser-agnostic removal: also strip the <style> rule so
        // the cascade cannot resupply the value from the stylesheet.
        for (const sheet of Array.from(document.styleSheets)) {
          for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
            const rule = sheet.cssRules[i] as CSSStyleRule;
            if (rule.style && rule.style.getPropertyValue("--t-floor")) {
              rule.style.removeProperty("--t-floor");
            }
          }
        }
      });
      return page.evaluate(checkTypeFloor);
    });
    expect(offenders.length).toBeGreaterThan(0);
    expect(offenders[0]?.element).toContain(":root");
  });
});

/** Issue #241's own canary: the defect that shipped, built by hand. A
 *  document whose only content is a `Surface` with its three arms and no
 *  stylesheet matching them — which is exactly what `src/ui/layout/`
 *  served until `surface.css` existed. Checks 1-4 all report nothing on
 *  it (that is the point: they are properties of content inside boxes, and
 *  a bare block with no padding satisfies every one of them), and check 5
 *  reports it. A run in which check 5 passes here is a failed run, for the
 *  same reason ADR-093 decision 6 point 5 gives for the fixture above. */
const UNSTYLED_SURFACE = `<!doctype html><html><head><style>
  :root { --t-floor: 11px; }
  * { box-sizing: border-box; }
  body { margin: 0; font-size: 15px; }
</style></head><body>
  <div data-surface="" data-arm-compact="columns:1" data-arm-medium="same-as-below" data-arm-wide="same-as-below">
    <p>A screen that renders flush to the top-left.</p>
  </div>
</body></html>`;

const SURFACE_LAW = {
  bandMin: { medium: BAND_MIN.medium, wide: BAND_MIN.wide },
  gutterPx: SURFACE_GUTTER_PX,
  measurePx: CONTENT_MEASURE_PX,
};

describe("issue #241 — a screen root with no container fails check 5 and nothing else", () => {
  it("checks 1-4 report nothing on it — which is why the defect reached dev", async () => {
    const offenders = await withPage(FLOOR_WIDTH, async (page) => {
      await page.setContent(UNSTYLED_SURFACE);
      return [
        await page.evaluate(checkNoHorizontalScroll),
        await page.evaluate(checkContainment, { scrollContainerAllowlist: [] }),
        await page.evaluate(checkNoClippingOrTruncation, {
          truncationAllowlist: [],
          monoFontFamily: MONO_FONT_FAMILY,
        }),
        await page.evaluate(checkTypeFloor),
      ].flat();
    });
    expect(offenders).toEqual([]);
  });

  it("check 5 reports the missing gutter, naming the band and what it wanted", async () => {
    const offenders = await withPage(FLOOR_WIDTH, async (page) => {
      await page.setContent(UNSTYLED_SURFACE);
      return page.evaluate(checkSurfaceContainer, SURFACE_LAW);
    });
    expect(offenders.some((o) => o.check === "surface-gutter")).toBe(true);
    expect(offenders[0]?.element).toContain(
      `${SURFACE_GUTTER_PX.compact}px either side`,
    );
  });

  it("check 5 reports a surface wider than its measure, and passes once both hold", async () => {
    const offenders = await withPage(BAND_MIN.wide, async (page) => {
      await page.setContent(UNSTYLED_SURFACE);
      // The gutter alone is not the law: a full-bleed column with the
      // right air either side still exceeds a reading column's measure.
      await page.evaluate((gutter) => {
        const el = document.querySelector("[data-surface]") as HTMLElement;
        el.style.paddingInline = `${gutter}px`;
      }, SURFACE_GUTTER_PX.wide);
      return page.evaluate(checkSurfaceContainer, SURFACE_LAW);
    });
    expect(offenders.map((o) => o.check)).toEqual(["surface-measure"]);

    const clean = await withPage(BAND_MIN.wide, async (page) => {
      await page.setContent(UNSTYLED_SURFACE);
      await page.evaluate(
        (law) => {
          const el = document.querySelector("[data-surface]") as HTMLElement;
          el.style.boxSizing = "border-box";
          el.style.marginInline = "auto";
          el.style.paddingInline = `${law.gutter}px`;
          el.style.maxWidth = `${law.measure + 2 * law.gutter}px`;
        },
        { gutter: SURFACE_GUTTER_PX.wide, measure: CONTENT_MEASURE_PX.read },
      );
      return page.evaluate(checkSurfaceContainer, SURFACE_LAW);
    });
    expect(clean).toEqual([]);
  });

  it("check 5 fails a document with no screen root at all", async () => {
    const offenders = await withPage(FLOOR_WIDTH, async (page) => {
      await page.setContent(
        "<!doctype html><html><body><p>No surface here.</p></body></html>",
      );
      return page.evaluate(checkSurfaceContainer, SURFACE_LAW);
    });
    expect(offenders.length).toBe(1);
    expect(offenders[0]?.element).toContain("no [data-surface]");
  });
});
