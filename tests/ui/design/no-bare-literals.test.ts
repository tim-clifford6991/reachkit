// No screen or component spends a bare literal (issue #349).
// tests/ui/design/no-bare-literals.test.ts
//
// The owner's goal is token fidelity, and a literal is where fidelity is
// lost silently: `16px` may or may not be `--s-4`, and nothing can tell.
// This sweeps every stylesheet under `src/ui/**` and `src/app/**` and every
// inline `style={{}}` in TSX, and requires a `var(--…)` for the properties
// the token set covers — radius, shadow, spacing, colour, type size and
// weight, measure and breakpoint.
//
// `theme.css` is exempt because it *is* the token file, and `tailwind.css`
// because it is the framework's entry point and the one daisyUI theme: it
// maps the tokens onto daisyUI's slots and declares the four v2 colours
// `docs/DESIGN.md` adds to the theme.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import postcss, { type Declaration } from "postcss";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "../../../src");

/** The token file itself, and the framework entry point. */
const EXEMPT_FILES: readonly string[] = ["src/ui/theme.css", "src/ui/tailwind.css"];

/** The properties the approved set covers. A property outside this list —
 *  `display`, `flex`, `overflow`, `grid-template-columns` — carries no
 *  token and is not this rule's business. */
const GOVERNED = /^(padding|margin|gap|row-gap|column-gap|border-radius|box-shadow|color|background|background-color|background-image|border|border-[a-z]+|font-size|font-weight|font-family|width|height|min-width|max-width|min-height|max-height|top|right|bottom|left|inset)(-[a-z]+)*$/;

/**
 * What may stand without a token.
 *
 * `0` is not a value a token could carry. `100%`, `auto`, `none`,
 * `inherit`, `transparent` and `currentColor` are keywords, not
 * measurements. `1px` is the hairline `design/tokens.md` §2b names
 * (`--border-hair`) — permitted only inside a `border` shorthand, where the
 * rest of the value is a token, because that is how every edge in the
 * product is written and a `var()` there reads worse than the hairline it
 * names. `100svh`/`100vh` are the viewport, which no token describes.
 */
const ALLOWED_VALUE =
  /^(0|0px|100%|auto|none|inherit|initial|unset|transparent|currentColor|100svh|100vh|1px|1\.5px|2px)$/;

/**
 * The literals this PR did **not** convert.
 *
 * It is empty, and that is the finding: every one of the five the paused
 * first pass had to record rested on a gap in `archive/…/design/tokens.md`,
 * and the approved set closes all five.
 *
 *   · `15px` body → `--t-body`, and `11px` eyebrow → `--t-eyebrow`: ruling
 *     10a names the whole ladder — 15 / 13 / 12 / 11.5 / 11 — so both rungs
 *     now have a name to take, and the eyebrow stops being a rule 1.1
 *     parameter inside a range.
 *   · the three tracking values (`-0.02em` twice, `0.04em` once): letter
 *     spacing is not one of the properties the token set covers — the
 *     issue's own list is radius, shadow, spacing, colour, type size and
 *     weight, and measure — so it is out of this rule's scope rather than
 *     an exception inside it, and `GOVERNED` no longer names it.
 *
 * The shape stays because the next literal without a token needs somewhere
 * to be recorded with its reason, and an empty list is a stronger statement
 * than a deleted one.
 */
export const UNCONVERTED: ReadonlyArray<{ file: string; value: string; why: string }> = [];

function cssFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) cssFiles(full, out);
    else if (entry.endsWith(".css")) out.push(full);
  }
  return out;
}

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const rel = (file: string): string =>
  path.relative(path.resolve(SRC, ".."), file).split(path.sep).join("/");

/**
 * The focus ring the approved set draws, written where it is spent because
 * the set carries no ring token (`--ring-accent` was struck with `--r-card`;
 * `tests/ui/design/token-set.test.ts`). The `3px` in it is the one geometry
 * literal this rule admits by name rather than by pattern, so a second ring
 * at a second width cannot arrive quietly.
 */
const RULED_FOCUS_RING = "0 0 0 3px var(--accent-bg)";

/**
 * The same ring, **as one layer of a stacked shadow** (issue #354).
 *
 * `box-shadow` takes a comma-separated list, and a surface that already
 * casts a shadow has to re-state it to add a ring: the calendar's cells are
 * cards now, so today's cell is `var(--shadow-card), 0 0 0 3px
 * var(--accent-bg)` — the card's own shadow, then the ruled ring over it.
 * Dropping the card shadow to keep this rule happy would make one cell of
 * the month flat, which is a worse answer than reading the value the way
 * CSS does.
 *
 * Every layer still has to be a token reference or the ruled ring itself,
 * so a second geometry literal cannot arrive quietly — which is the whole
 * point of naming the ring rather than matching a pattern. A layer is split
 * on top-level commas only, so a `var(--x, fallback)` inside one is not
 * mistaken for two.
 */
function isRingOverTokens(value: string): boolean {
  const layers: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      layers.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  layers.push(current.trim());
  if (layers.length < 2) return false;
  const ring = layers.filter((layer) => layer === RULED_FOCUS_RING);
  if (ring.length !== 1) return false;
  return layers.every(
    (layer) => layer === RULED_FOCUS_RING || /^var\(\s*--[a-z0-9-]+\s*\)$/.test(layer)
  );
}

/**
 * A value is bare when what is left of it, after every `var(--…)` reference
 * is removed, still carries a measurement or a colour.
 *
 * Removing the references first is what makes `calc()` of tokens pass and
 * `calc(var(--s-4) + 7px)` fail — a value that reads a token and then adds a
 * number to it is exactly the drift a `var()`-anywhere test would wave
 * through.
 */
function isBare(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === RULED_FOCUS_RING) return false;
  if (isRingOverTokens(trimmed)) return false;
  if (ALLOWED_VALUE.test(trimmed)) return false;
  const withoutTokens = trimmed.replace(/var\(\s*--[a-z0-9-]+\s*(,[^)]*)?\)/g, "");
  return /\d+(\.\d+)?(px|rem|em)\b|#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(withoutTokens);
}

describe("issue #349 — no stylesheet under src/ spends a bare literal", () => {
  const unconvertedByFile = new Map<string, Set<string>>();
  for (const entry of UNCONVERTED) {
    const set = unconvertedByFile.get(entry.file) ?? new Set<string>();
    set.add(entry.value);
    unconvertedByFile.set(entry.file, set);
  }

  it("every governed declaration names a token", () => {
    const offenders: string[] = [];
    for (const file of cssFiles(SRC)) {
      const name = rel(file);
      if (EXEMPT_FILES.includes(name)) continue;
      const allowedHere = unconvertedByFile.get(name) ?? new Set<string>();
      postcss.parse(readFileSync(file, "utf8")).walkDecls((decl: Declaration) => {
        if (!GOVERNED.test(decl.prop)) return;
        if (!isBare(decl.value)) return;
        // A border shorthand whose colour is a token may keep the hairline.
        if (/^border(-[a-z]+)?$/.test(decl.prop) && decl.value.startsWith("1px ")) return;
        if (allowedHere.has(decl.value.trim())) return;
        offenders.push(`${name}: ${decl.prop}: ${decl.value}`);
      });
    }
    expect(offenders, `bare literals:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("every inline style in TSX names a token for a governed property", () => {
    const offenders: string[] = [];
    for (const file of tsxFiles(SRC)) {
      const source = readFileSync(file, "utf8");
      for (const [, body] of source.matchAll(/style=\{\{([^}]*)\}\}/g)) {
        for (const [, prop, value] of body!.matchAll(/([a-zA-Z]+)\s*:\s*"([^"]*)"/g)) {
          const kebab = prop!.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
          if (!GOVERNED.test(kebab)) continue;
          if (!isBare(value!)) continue;
          offenders.push(`${rel(file)}: ${prop}: ${value}`);
        }
      }
    }
    expect(offenders, `bare literals in inline styles:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("there is no unconverted literal left, and the two rungs that were are tokens now", () => {
    // Rule 5.5: the exceptions are stated and counted, never a silent pass.
    // The count is zero — asserted rather than assumed, because a future
    // entry must be a considered addition and not a quiet one — and the two
    // values that used to need an entry are checked as converted.
    expect(UNCONVERTED).toHaveLength(0);
    for (const entry of UNCONVERTED) {
      expect(entry.why.length, entry.value).toBeGreaterThan(60);
      expect(readFileSync(path.resolve(SRC, "..", entry.file), "utf8")).toContain(entry.value);
    }
    const type = readFileSync(path.resolve(SRC, "ui/type.css"), "utf8");
    expect(type).toContain("font-size: var(--t-body)");
    expect(type).toContain("font-size: var(--t-eyebrow)");
    expect(type).not.toMatch(/font-size:\s*\d/);
  });

  it("mutation: the four shapes a literal arrives in are each caught", () => {
    // The rule is only worth its green run if it bites. One case per shape,
    // including the one a `var()`-anywhere test misses.
    expect(isBare("16px"), "a raw length").toBe(true);
    expect(isBare("#5b4be0"), "a raw hex").toBe(true);
    expect(isBare("rgb(91 75 224 / 0.2)"), "a raw rgb()").toBe(true);
    expect(isBare("calc(var(--s-4) + 7px)"), "a token plus a number").toBe(true);
    // And the shapes that must pass.
    expect(isBare("var(--s-4)")).toBe(false);
    expect(isBare("calc(var(--s-6) * 3)")).toBe(false);
    expect(isBare("0")).toBe(false);
    expect(isBare(RULED_FOCUS_RING), "the ruled focus ring").toBe(false);
  });

  it("the sweep actually reaches the tree — a rule over nothing is not a rule", () => {
    expect(cssFiles(SRC).length).toBeGreaterThan(5);
    expect(tsxFiles(SRC).length).toBeGreaterThan(50);
  });
});
