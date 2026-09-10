// The colour arithmetic every contrast measurement shares (issue #328).
// tests/ui/design/contrast.ts
//
// `on-accent-contrast.test.ts` (issue #290) carried all of this inline,
// because it was the only test measuring a ratio. Issue #328 measures every
// state pair in the set, and two copies of a WCAG formula is how two tests
// come to disagree about what 4.5:1 means. So the arithmetic moves here,
// unchanged, and both files read it.
//
// Three things live here and nothing else:
//
//   · **sRGB ↔ oklab**, so `color-mix(in oklab, …)` can be computed exactly
//     as a browser computes it. Every derived ink in `src/ui/idiom/idiom.css`
//     is one of those mixes, and a test that approximated it would be
//     measuring a colour the product does not draw.
//   · **alpha compositing**, because the dark theme's `-bg` and `-line`
//     tints are `rgb(r g b/.12)` — a tone *over* whatever is beneath it.
//     The literal value is not a colour anything renders; the composite
//     against the named ground is.
//   · **WCAG 2.1's contrast ratio** (§1.4.3's relative luminance), and the
//     two floors it states: 4.5:1 for text under 18.66px bold / 24px, and
//     3:1 for large text and for the non-text contrast of §1.4.11.
import { readFileSync } from "node:fs";
import path from "node:path";
import { rawTokenSet, THEME_CSS, type Block } from "./tokens-doc";

const REPO = path.resolve(import.meta.dirname, "../../..");

export type Rgb = readonly [number, number, number];

/** WCAG 2.1 §1.4.3 — the floor for text below the large-text threshold,
 *  which is every rung of this product's type ladder (15px body down to the
 *  11px eyebrow; nothing renders above 16px except a heading). */
export const AA_TEXT = 4.5;

/** WCAG 2.1 §1.4.3's large-text floor, and §1.4.11's non-text floor. The
 *  same number for two different reasons; both are named so a caller says
 *  which one it means. */
export const AA_LARGE_TEXT = 3;
export const AA_NON_TEXT = 3;

/* ── parsing ──────────────────────────────────────────────────────────── */

/** A colour as `theme.css` writes it, with the alpha it carries. `alpha` is
 *  1 for the opaque hexes and the declared fraction for the dark theme's
 *  `rgb(r g b/.12)` tints, which are not colours until they are composited
 *  (see `composite`). */
export interface Declared {
  readonly rgb: Rgb;
  readonly alpha: number;
}

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ] as const;
}

/** `#rrggbb` or `rgb(r g b / a)` in any of CSS's spellings. Anything else
 *  throws: a token whose value this cannot read is a token whose ratio
 *  nobody measured, and a silent skip would read like a clean pass. */
export function parseColour(value: string): Declared {
  const text = value.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(text);
  if (hex !== null) return { rgb: hexToRgb(text), alpha: 1 };
  const fn = /^rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)\s*(?:[/,]\s*([0-9.]+))?\s*\)$/i.exec(text);
  if (fn !== null) {
    return {
      rgb: [Number(fn[1]), Number(fn[2]), Number(fn[3])] as const,
      alpha: fn[4] === undefined ? 1 : Number(fn[4]),
    };
  }
  throw new Error(`tests/ui/design/contrast.ts: cannot read the colour "${value}"`);
}

/* ── sRGB, oklab, compositing ─────────────────────────────────────────── */

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
export function mix(first: Rgb, second: Rgb, pct: number): Rgb {
  const a = toOklab(first);
  const b = toOklab(second);
  const t = pct / 100;
  return fromOklab([
    a[0] * t + b[0] * (1 - t),
    a[1] * t + b[1] * (1 - t),
    a[2] * t + b[2] * (1 - t),
  ] as const);
}

/** A translucent colour over an opaque one — the composite a browser paints,
 *  in sRGB, which is where `alpha` in a colour function applies. */
export function composite(fg: Declared, ground: Rgb): Rgb {
  if (fg.alpha >= 1) return fg.rgb;
  return fg.rgb.map((channel, i) =>
    Math.round(channel * fg.alpha + ground[i]! * (1 - fg.alpha))
  ) as unknown as Rgb;
}

/* ── the ratio ────────────────────────────────────────────────────────── */

export function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(srgbToLinear) as unknown as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(fg: Rgb, bg: Rgb): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/* ── reading the product's own colours ────────────────────────────────── */

/** The theme a measurement is taken in. `theme.css` declares the dark values
 *  twice — media-guarded and explicit — and `token-set.test.ts` holds the two
 *  byte-equal, so one read serves both. */
export type Theme = "light" | "dark";

const BLOCK: Readonly<Record<Theme, Block>> = { light: "light", dark: "dark-toggle" };

/** Every colour token `src/ui/theme.css` declares for a theme, as declared —
 *  so the dark tints arrive with their alpha intact. */
export function themeTokens(theme: Theme): ReadonlyMap<string, string> {
  return rawTokenSet(THEME_CSS)[BLOCK[theme]];
}

/**
 * One token, resolved to the colour a browser paints.
 *
 * `over` names the ground a translucent token is composited against — the
 * dark theme's `--ok-bg` is `rgb(123 216 176/.12)`, which is a green nobody
 * sees until it is laid over the card it tints. A token with no alpha
 * ignores it. Passing `over` for a token that needs one is not optional:
 * without it the value parses and the ratio is wrong, which is the one
 * failure mode this whole file exists to rule out.
 */
export function resolve(theme: Theme, token: string, over?: string): Rgb {
  const tokens = themeTokens(theme);
  const value = tokens.get(token);
  if (value === undefined) {
    throw new Error(`tests/ui/design/contrast.ts: theme.css declares no ${token} in the ${theme} theme`);
  }
  const declared = parseColour(value);
  if (declared.alpha >= 1) return declared.rgb;
  if (over === undefined) {
    throw new Error(
      `tests/ui/design/contrast.ts: ${token} is ${value} in the ${theme} theme — a translucent ` +
        "token has no colour until it is composited, so the ground it sits on must be named"
    );
  }
  return composite(declared, resolve(theme, over));
}

/**
 * A token over a ground that is already a colour — the shape a *translucent
 * foreground* needs. The dark theme's `--accent-line` and `--bad-line` are
 * `rgb(r g b/.28)`, and a line drawn in one is the composite over whatever
 * it is drawn on, exactly as `--ok-bg` is.
 */
export function resolveOnto(theme: Theme, token: string, ground: Rgb): Rgb {
  const value = themeTokens(theme).get(token);
  if (value === undefined) {
    throw new Error(`tests/ui/design/contrast.ts: theme.css declares no ${token} in the ${theme} theme`);
  }
  return composite(parseColour(value), ground);
}

/**
 * A `color-mix(in oklab, var(--a) N%, var(--b))` declaration, read out of the
 * stylesheet that spends it rather than restated here (issue #290's rule):
 * a changed percentage has to fail the measurement, not pass it.
 */
export interface DeclaredMix {
  readonly first: string;
  readonly second: string;
  readonly percent: number;
}

export function declaredMix(file: string, token: string): DeclaredMix {
  const source = readFileSync(path.join(REPO, file), "utf8");
  const found = new RegExp(
    `${token}:\\s*color-mix\\(in oklab,\\s*var\\((--[\\w-]+)\\)\\s*(\\d+)%,\\s*var\\((--[\\w-]+)\\)\\s*\\)`
  ).exec(source);
  if (found === null) {
    throw new Error(`tests/ui/design/contrast.ts: ${file} declares no oklab color-mix() for ${token}`);
  }
  return { first: found[1]!, second: found[3]!, percent: Number(found[2]) };
}

/** The colour a declared mix resolves to, in a theme. Both operands are
 *  opaque tokens in every case the set has, so neither needs a ground. */
export function resolveMix(theme: Theme, declared: DeclaredMix): Rgb {
  return mix(resolve(theme, declared.first), resolve(theme, declared.second), declared.percent);
}
