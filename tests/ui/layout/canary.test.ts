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
  checkTypeFloor,
  MONO_FONT_FAMILY,
} from "./checks";
import { withPage } from "./browser";
import { widths } from "./widths";

const FIXTURE_URL = "file://" + path.resolve(__dirname, "./fixtures/canary.html");
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
    expect(offenders.some((o) => o.element.includes("no-box-hidden"))).toBe(false);
    expect(offenders.some((o) => o.element.includes("no-box-script"))).toBe(false);
    expect(offenders.some((o) => o.element.includes("escapee"))).toBe(true);
  });

  it("check 2 — a zero-area box outside its parent is not an offender; the escapee still is (issue #19)", async () => {
    // `<next-route-announcer>` is Next.js's own route-change announcer: an
    // empty custom element the client runtime appends to `<body>` after the
    // app tree, with a 0 × 0 border box. It *does* generate a box, so the
    // no-box skip above misses it, and a collapsed margin on a screen's
    // first or last child shortens `<body>` out from under it. Built here
    // the same way the case above is: body gets the UA's 8px margin, and a
    // real zero-area element is appended below its bottom edge. A box with
    // no area cannot clip, overflow or hide anything a reader could see.
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
    expect(offenders.some((o) => o.element.includes("zero-area-announcer"))).toBe(false);
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
    expect(offenders.some((o) => o.element.includes("clipped-name"))).toBe(true);
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
    expect(offenders.some((o) => o.element.includes("clipped-value"))).toBe(true);
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
