// tests/ui/layout/theme-slots.test.ts — §2.1, §2.2, issue #243
//
// The other half of `tests/ui/design/theme-slots.test.ts`. That file asks
// whether the slot set is complete; this one asks whether the values reach
// the components — which is a question only a browser can answer, because
// what broke was the *cascade*: `border-width:var(--border)` with `--border`
// undeclared is not a default, it is an invalid declaration the browser
// drops, and the UA's `medium` black border arrives in its place. A jsdom
// mount computes none of that, and neither does reading the config.
//
// The five classes are §2.2's own load-bearing ones, and each is asserted
// against the token it must resolve *to*, not merely against "not zero": a
// theme that mapped every radius to `--r-box` would pass a non-zero check
// and round every button like a card.
//
// The elements are made here rather than found on a screen. The claim is
// about the theme, so it must not depend on which screen happens to render
// a `.badge` today — and `/` is loaded only to get a document with the
// product's stylesheet in it.
import { describe, expect, it } from "vitest";
import { BAND_MIN } from "@/ui/layout/bands";
import { getBaseURL, withPage } from "./browser";

/** Chromium starts per call (see `browser.ts`); one page, one navigation. */
const BROWSER_MS = 60_000;

/**
 * What each class must compute, and from which slot.
 *
 * `card` draws no border of its own — daisyUI gives `.card` a radius and
 * nothing else — so its expected width is `0px`, stated rather than
 * omitted so that the day a border appears this row is what asks whether
 * it was meant to.
 */
const EXPECTED = [
  { classes: "btn", radius: "9px", from: "--radius-field", border: "1px" },
  { classes: "card", radius: "14px", from: "--radius-box", border: "0px" },
  { classes: "badge", radius: "999px", from: "--radius-selector", border: "1px" },
  { classes: "input", radius: "9px", from: "--radius-field", border: "1px" },
  { classes: "alert", radius: "14px", from: "--radius-box", border: "1px" },
] as const;

interface Computed {
  radius: string;
  border: string;
  color: string;
}

function url(): string {
  const baseURL = getBaseURL();
  if (!baseURL) {
    throw new Error(
      "tests/ui/layout/theme-slots.test.ts: no app server is running — `browser.ts` starts one " +
        "in globalSetup whenever the route sweep finds a route."
    );
  }
  return baseURL;
}

/** The computed edge of one element per class list, plus the `:root`
 *  tokens the expectations are written against. */
async function measure(): Promise<{
  byClass: Record<string, Computed>;
  tokens: Record<string, string>;
}> {
  return withPage(
    BAND_MIN.compact,
    async (page) => {
      await page.goto(url());
      return page.evaluate(
        (classLists: readonly string[]) => {
          const byClass: Record<string, { radius: string; border: string; color: string }> = {};
          for (const classes of classLists) {
            const el = document.createElement("div");
            el.className = classes;
            document.body.appendChild(el);
            const style = getComputedStyle(el);
            byClass[classes] = {
              radius: style.borderTopLeftRadius,
              border: style.borderTopWidth,
              color: style.color,
            };
            el.remove();
          }
          const root = getComputedStyle(document.documentElement);
          const tokens: Record<string, string> = {};
          for (const name of [
            "--r-box",
            "--r-field",
            "--r-pill",
            "--border-hair",
            "--on-accent",
            "--ink",
          ]) {
            tokens[name] = root.getPropertyValue(name).trim();
          }
          return { byClass, tokens };
        },
        [...EXPECTED.map((e) => e.classes), "btn btn-primary"]
      );
    },
    {}
  );
}

describe("the theme's non-colour slots reach §2.2's components", () => {
  it(
    "each class computes the radius and border width its slot names",
    async () => {
      const { byClass, tokens } = await measure();

      // The expectations above are literals; these two rows are what keeps
      // them honest — they are the same values, read off `:root`.
      expect(tokens["--r-box"]).toBe("14px");
      expect(tokens["--r-field"]).toBe("9px");
      expect(tokens["--r-pill"]).toBe("999px");
      expect(tokens["--border-hair"]).toBe("1px");

      for (const expected of EXPECTED) {
        const computed = byClass[expected.classes];
        expect(computed, `.${expected.classes} was not measured`).toBeDefined();
        expect(
          computed?.radius,
          `.${expected.classes} must round from ${expected.from}`
        ).toBe(expected.radius);
        expect(computed?.border, `.${expected.classes} border width`).toBe(expected.border);
      }
    },
    BROWSER_MS
  );

  it(
    "a primary button's label is the ink for a saturated ground, not the page's ink",
    async () => {
      // The regression this kills: with `--color-primary-content`
      // undeclared, daisyUI falls back to `--color-base-content` and the
      // label renders near-black on the indigo ground.
      const { byClass } = await measure();
      const button = byClass["btn btn-primary"];
      expect(button).toBeDefined();
      expect(button?.color).toBe("rgb(255, 255, 255)");
      expect(button?.color).not.toBe("rgb(25, 25, 37)");
    },
    BROWSER_MS
  );
});
