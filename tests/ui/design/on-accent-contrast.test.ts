// BUILD §2.1 — the quiet ink on an accent ground meets AA (issue #290).
// tests/ui/design/on-accent-contrast.test.ts
//
// The card idiom's preview drew `--on-accent-quiet` at a 28% mix, and the
// master's screenshots of dev after #285 showed the sign-in panel's domain,
// its `/100` and the line under its bar as barely visible. Measured, that
// mix is **1.82:1** in light and **1.89:1** in dark against the ground —
// under every threshold there is.
//
// This is the guard that keeps the fix: the mix is read out of
// `src/ui/idiom/idiom.css`, the colour is computed in **oklab exactly as
// `color-mix` does it**, and the ratio is WCAG 2.1's. So a change to the
// percentage, or to either accent in `theme.css`, fails here with the
// number rather than on someone's screen.
//
// The ground is the **darkest point** of `--grad-accent`: flat `--accent`,
// where the radial `--on-accent` highlight has fallen off. Text on the
// highlight has more contrast, not less, so the flat ground is the bound.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const IDIOM_CSS = path.resolve(import.meta.dirname, "../../../src/ui/idiom/idiom.css");
const THEME_CSS = path.resolve(import.meta.dirname, "../../../src/ui/theme.css");

/** WCAG 2.1's floor for text under 18px, which is the smallest this ink
 *  carries — the sign-in panel's mono domain line. */
const AA_NORMAL = 4.5;

type Rgb = readonly [number, number, number];

function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ] as const;
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number): number {
  const v = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

function toOklab(rgb: Rgb): Rgb {
  const [r, g, b] = rgb.map(srgbToLinear) as unknown as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ] as const;
}

function fromOklab(lab: Rgb): Rgb {
  const [big, a, b] = lab;
  const l = (big + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (big - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (big - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ] as const;
}

/** `color-mix(in oklab, first pct%, second)`. */
function mix(first: string, second: string, pct: number): Rgb {
  const a = toOklab(hexToRgb(first));
  const b = toOklab(hexToRgb(second));
  const t = pct / 100;
  return fromOklab([
    a[0] * t + b[0] * (1 - t),
    a[1] * t + b[1] * (1 - t),
    a[2] * t + b[2] * (1 - t),
  ] as const);
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(srgbToLinear) as unknown as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg: Rgb, bg: Rgb): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** The percentage `idiom.css` actually declares — read, never restated. */
function declaredMixPercent(): number {
  const source = readFileSync(IDIOM_CSS, "utf8");
  const found = /--on-accent-quiet:\s*color-mix\(in oklab, var\(--on-accent\) (\d+)%/.exec(source);
  if (found === null) throw new Error("idiom.css: no --on-accent-quiet color-mix() to read");
  return Number(found[1]);
}

/** `--accent` and `--on-accent` for a theme, out of `theme.css`. The dark
 *  pair is the one inside the `[data-theme="dark"]` block, which is the
 *  same pair the media-guarded state declares. */
function themePair(theme: "light" | "dark"): { accent: string; onAccent: string } {
  const source = readFileSync(THEME_CSS, "utf8");
  // The selector's own block, brace-matched — not a slice on a word, which
  // `prefers-color-scheme` fails at because the file's header explains the
  // three theme states in prose before declaring any of them.
  const selector = theme === "light" ? ":root {" : '[data-theme="dark"] {';
  const open = source.indexOf(selector);
  if (open === -1) throw new Error(`theme.css: no ${selector} block`);
  const close = source.indexOf("}", open);
  const scope = source.slice(open, close);
  // `--accent:` would also match inside `--on-accent:`, so the accent is
  // read with a boundary that a hyphen cannot cross.
  const accent = /(?:^|[;{\s])--accent:\s*(#[0-9a-f]{6})/i.exec(scope);
  const onAccent = /--on-accent:\s*(#[0-9a-f]{6})/i.exec(scope);
  if (accent === null || onAccent === null) throw new Error(`theme.css: no accent pair for ${theme}`);
  return { accent: accent[1]!, onAccent: onAccent[1]! };
}

describe("issue #290 — the quiet on-accent ink clears WCAG AA in both themes", () => {
  const pct = declaredMixPercent();

  for (const theme of ["light", "dark"] as const) {
    it(`${theme}: --on-accent-quiet on flat --accent is at least ${AA_NORMAL}:1`, () => {
      const { accent, onAccent } = themePair(theme);
      const ink = mix(onAccent, accent, pct);
      const ratio = contrast(ink, hexToRgb(accent));
      expect(ratio, `${theme} measures ${ratio.toFixed(2)}:1 at a ${pct}% mix`).toBeGreaterThanOrEqual(
        AA_NORMAL
      );
    });
  }

  it("the preview's own 28% fails — so this test is measuring, not asserting a constant", () => {
    // Non-vacuity, and the record of what was actually wrong: the same
    // function on the value the idiom was drawn with must fail both themes.
    for (const theme of ["light", "dark"] as const) {
      const { accent, onAccent } = themePair(theme);
      const ratio = contrast(mix(onAccent, accent, 28), hexToRgb(accent));
      expect(ratio, `${theme} at 28% measures ${ratio.toFixed(2)}:1`).toBeLessThan(2);
    }
  });

  it("the declared mix is the lowest ladder step that clears both — not a rounder number", () => {
    // 80% clears dark and fails light, so the light column is the binding
    // one and a future accent change must be re-measured against it.
    const { accent, onAccent } = themePair("light");
    expect(contrast(mix(onAccent, accent, 80), hexToRgb(accent))).toBeLessThan(AA_NORMAL);
    expect(pct).toBe(85);
  });
});
