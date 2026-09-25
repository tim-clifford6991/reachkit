// `src/ui/theme.css` — every token spent as text meets 4.5:1.
// tests/ui/design/contrast.test.ts
//
// The owner's ruling of 2026-09-22 (#946), as a test over the token file
// rather than a promise about it: a value that drifts back under the floor
// fails here, in milliseconds, instead of on the axe sweep at the end of a
// pull request.
//
// **Each token is measured against the worst ground it is drawn on.** In
// light that is `--color-base-200`, the darkest of the three surfaces; in dark it is
// `--color-base-100`, the lightest. A token that clears the floor there clears it
// on the other two, which is why one number per token is the whole check.
//
// **The four state colours are measured twice**: as text on a surface, and
// as a filled control with `--color-primary-content` on it (`--color-warning-content`
// and its three siblings are `--color-primary-content` in `tailwind.css`). A fill that
// passes one and fails the other is a button whose label cannot be read.
//
// **What is not here.** The opacity arms — `text-base-content/60`, and the
// `opacity-*` utilities — are not tokens and cannot be checked from this
// file; they are held by the axe sweep, which measures what was actually
// rendered. #946 moved the ones that were under the floor off the thinned
// arms entirely: `--color-base-content` at 50% over white is 3.5:1 even if `--color-base-content` were
// pure black, so no token value could have saved them.
import { describe, expect, it } from "vitest";
import { THEME_CSS, tokenSet } from "./tokens-doc";

/** WCAG 2.1's floor for body text (1.4.3). Large text has a lower one and
 *  is deliberately not given it here: the tokens below are spent on body
 *  copy, captions and numerals, and a token that only passes at 24px is a
 *  token that fails wherever it is actually used. */
const FLOOR = 4.5;

function channels(hex: string): [number, number, number] {
  const value = hex.trim().replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const channel = v / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG's own ratio, to two places — the precision axe reports. */
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
}

const tokens = tokenSet(THEME_CSS);

function value(block: "light" | "dark-media" | "dark-toggle", name: string): string {
  const found = tokens[block].get(name);
  if (found === undefined) throw new Error(`theme.css declares no ${name} in the ${block} block`);
  return found;
}

/** The tokens that reach a customer as text, and the ground each is worst
 *  against. Total over what the palette spends on words: a token added to
 *  the ink or state families and not listed here is one nobody measured. */
const TEXT_TOKENS = ["--color-base-content", "--ink-2", "--ink-3", "--color-primary", "--color-success", "--color-warning", "--color-error", "--chart-you", "--chart-rival", "--chart-goal"] as const;

/** The four that are also drawn as a filled control, with `--color-primary-content` as
 *  the label (`tailwind.css` maps all four `*-content` slots to it). */
const FILLS = ["--color-primary", "--color-success", "--color-warning", "--color-error"] as const;

describe("#946 — every token spent as text clears 4.5:1, in both themes", () => {
  it("light: on `--color-base-200`, the darkest surface a word is drawn on", () => {
    const ground = value("light", "--color-base-200");
    const under = TEXT_TOKENS.map((name) => [name, contrast(value("light", name), ground)] as const).filter(
      ([, ratio]) => ratio < FLOOR
    );
    expect(under).toEqual([]);
  });

  it("dark: on `--color-base-100`, the lightest ground a word is drawn on", () => {
    for (const block of ["dark-media", "dark-toggle"] as const) {
      const ground = value(block, "--color-base-100");
      const under = TEXT_TOKENS.map(
        (name) => [name, contrast(value(block, name), ground)] as const
      ).filter(([, ratio]) => ratio < FLOOR);
      expect(under, block).toEqual([]);
    }
  });

  it("a filled control's label clears it too, on all four fills and in both themes", () => {
    for (const block of ["light", "dark-media", "dark-toggle"] as const) {
      const ink = value(block, "--color-primary-content");
      const under = FILLS.map((name) => [name, contrast(ink, value(block, name))] as const).filter(
        ([, ratio]) => ratio < FLOOR
      );
      expect(under, block).toEqual([]);
    }
  });

  it("the measure is WCAG's own — black on white is 21, and a colour against itself is 1", () => {
    // Watch it fail first: without a real ratio the three rows above would
    // pass on any palette at all.
    expect(contrast("#000000", "#ffffff")).toBe(21);
    expect(contrast("#5b4be0", "#5b4be0")).toBe(1);
    // And the value this ruling replaced is still under the floor, so the
    // rows above are measuring something that can fail.
    expect(contrast("#9695a8", value("light", "--color-base-200"))).toBeLessThan(FLOOR);
  });
});
