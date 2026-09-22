// tests/ui/design/heading-layer.test.ts — issue #941
//
// **A heading sized with a utility computes the utility's size.**
//
// `src/ui/type.css` used to state the heading scale *unlayered*, and
// unlayered CSS out-ranks every cascade layer. So `@layer utilities` lost:
// `<h2 class="text-xs">` computed 25px instead of 12px, on every screen, and
// nothing anywhere was red. The scale is a `@layer base` default now, and
// this file is the guard that keeps it one.
//
// **It runs in the blocking gate, which is why it resolves the cascade
// instead of opening a browser.** `tests/ui/layout/heading-scale.test.ts`
// asserts the same thing the other way — Chromium, over the real route tree
// — but the layout suite needs a `next build`, a Postgres substrate and a
// Chromium binary, and `typecheck · lint · unit` has none of the three. A
// defect the owner sees on every screen deserves a guard in the gate that
// blocks merge, so this one takes the real compiled stylesheet, matches it
// against one element, and applies the cascade CSS itself defines: layer
// order first, then specificity, then source order.
//
// Three things make that honest rather than a re-implementation of a
// browser:
//
//   * **The stylesheet is the real one.** Not `type.css` read as text — the
//     whole chain, in the order `src/app/layout.tsx` imports it, through
//     `@tailwindcss/postcss`. Tailwind's preflight, daisyUI's components and
//     the `text-*` utilities are all in it, emitted exactly as the browser
//     gets them. A test that parsed `type.css` alone would have passed on
//     the day this broke: the file was not wrong, it was outranked.
//   * **The order is read off the sheet, not assumed.** `@layer theme, base,
//     components, utilities` is a statement in the compiled output; so are
//     daisyUI's nested `daisyui.l1.l2` sub-layers. Both are parsed.
//   * **One element, no selector engine.** The only selectors considered are
//     the ones that can match a lone `<h2>` — an element name, a class list,
//     or both — and any rule whose selector this file cannot decide is
//     *counted*, so a sheet that grew a construct the matcher does not know
//     fails the last test rather than silently narrowing the sweep.
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss, { type AtRule, type Rule } from "postcss";
import tailwind from "@tailwindcss/postcss";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");

/** The root font size every `rem` in the sheet is relative to. Not a token:
 *  it is the browser's own default, which nothing in this product changes. */
const ROOT_FONT_PX = 16;

/** `--breakpoint-sm`: the one width at which a step of the scale moves. */
const NARROW_PX = 390;
const WIDE_PX = 1280;

interface Candidate {
  /** The layer path, as indices — `[]` for unlayered, which wins. */
  readonly rank: readonly number[];
  readonly specificity: readonly [number, number, number];
  readonly order: number;
  readonly selector: string;
  readonly value: string;
  readonly important: boolean;
  /** The widest lower bound this rule sits under, or 0. */
  readonly minWidth: number;
  /** The narrowest **exclusive** upper bound this rule sits under, or
   *  `Infinity`. A `max-*:` utility (2026-09-21, #931: the draft's Decide
   *  bar writes `max-md:text-xs`) compiles to `@media (width < 48rem)`, and
   *  a rule that only applies below a width is not a candidate above it. */
  readonly maxWidth: number;
}

/* ── the real compiled stylesheet ─────────────────────────────────────── */

/** The sheets the root layout imports, in the order it imports them — read
 *  off `layout.tsx` itself, so this file cannot disagree with the app about
 *  what the cascade is. */
function importedSheets(): string[] {
  const layout = readFileSync(path.join(ROOT, "src/app/layout.tsx"), "utf8");
  return [...layout.matchAll(/^import "@\/(ui\/[^"]+\.css)";$/gm)].map(
    (m) => `src/${m[1]}`,
  );
}

async function compile(): Promise<string> {
  const parts: string[] = [];
  for (const rel of importedSheets()) {
    const from = path.join(ROOT, rel);
    const result = await postcss([tailwind()]).process(
      readFileSync(from, "utf8"),
      { from },
    );
    parts.push(result.css);
  }
  return parts.join("\n");
}

/* ── the cascade, as CSS defines it ───────────────────────────────────── */

/** Specificity of a compound selector made of an element name and classes.
 *  Anything else is not a candidate (see `undecidable` below). */
const COMPOUND = /^(h[1-6])?((?:\.[A-Za-z0-9_\\/!:-]+)*)$/;

function parseCompound(
  selector: string,
): { element: string | null; classes: string[] } | undefined {
  const m = COMPOUND.exec(selector.trim());
  if (!m) return undefined;
  const [, element, classPart] = m;
  if (!element && !classPart) return undefined;
  const classes = classPart
    ? classPart
        .split(".")
        .filter(Boolean)
        // `.text-base\!` in the sheet is the class `text-base!` on the element.
        .map((name) => name.replace(/\\/g, ""))
    : [];
  return { element: element ?? null, classes };
}

/** Every `font-size` declaration in the sheet that could apply to a lone
 *  heading element, with everything the cascade needs to rank it. */
function candidates(
  css: string,
  element: string,
  elementClasses: readonly string[],
): { matched: Candidate[]; undecidable: string[] } {
  const root = postcss.parse(css);
  const matched: Candidate[] = [];
  const undecidable: string[] = [];
  // The order each named layer was first seen in, statements included — the
  // rule CSS itself uses to rank them.
  const layerOrder = new Map<string, number>();
  const note = (name: string): void => {
    if (!layerOrder.has(name)) layerOrder.set(name, layerOrder.size);
  };
  root.walkAtRules("layer", (at) => {
    if (at.nodes === undefined) {
      // A statement: `@layer theme, base, components, utilities;`
      for (const name of at.params.split(",")) note(name.trim());
    } else {
      note(at.params.trim());
    }
  });

  /** The layer path of a rule, as ranks, outermost first — `[]` for a rule
   *  in no layer at all, which is the strongest thing there is.
   *
   *  The trailing `MAX_SAFE_INTEGER` is the part that matters: a rule that is
   *  *not* in a sub-layer of its layer sorts after every rule that is. That
   *  is why `.text-xs`, a bare rule in `@layer utilities`, beats daisyUI's
   *  `.card-title` in `utilities`' own `daisyui.l1.l2`. */
  const rankOf = (node: Rule): number[] => {
    const names: string[] = [];
    let cursor: AtRule | Rule = node;
    while (cursor.parent) {
      const parent = cursor.parent as AtRule;
      if (parent.type === "atrule" && parent.name === "layer") {
        names.unshift(parent.params.trim());
      }
      if (parent.type !== "atrule") break;
      cursor = parent;
    }
    if (names.length === 0) return [];
    return [
      ...names.map((name) => layerOrder.get(name) ?? 0),
      Number.MAX_SAFE_INTEGER,
    ];
  };

  /** The width band a rule applies in, read off every `@media` above it.
   *
   *  Both ends, and both spellings of each: `type.css` writes its own step
   *  as `(min-width: 640px)` and Tailwind 4 writes a `max-md:` utility as
   *  `(width < 48rem)`. The bands *intersect* as they nest, which is what
   *  `Math.max` / `Math.min` are doing. */
  const bandOf = (node: Rule): { min: number; max: number } => {
    let min = 0;
    let max = Number.POSITIVE_INFINITY;
    const px = (value: string, unit: string): number =>
      unit === "rem" ? Number(value) * ROOT_FONT_PX : Number(value);
    let cursor: Rule | AtRule | undefined = node;
    while (cursor?.parent) {
      const parent = cursor.parent as AtRule;
      if (parent.type === "atrule" && parent.name === "media") {
        const params = parent.params;
        const lower =
          /min-width:\s*([\d.]+)(px|rem)/.exec(params) ??
          /width\s*>=\s*([\d.]+)(px|rem)/.exec(params);
        if (lower) min = Math.max(min, px(lower[1]!, lower[2]!));
        // `max-width: N` includes N; `width < N` does not. One pixel of
        // difference, and it is the difference between a rule applying at
        // the breakpoint and not, so it is not rounded away.
        const upperInclusive = /max-width:\s*([\d.]+)(px|rem)/.exec(params);
        if (upperInclusive) {
          max = Math.min(max, px(upperInclusive[1]!, upperInclusive[2]!) + 1);
        }
        const upperExclusive = /width\s*<\s*([\d.]+)(px|rem)/.exec(params);
        if (upperExclusive)
          max = Math.min(max, px(upperExclusive[1]!, upperExclusive[2]!));
      }
      cursor = parent as AtRule;
    }
    return { min, max };
  };

  let order = 0;
  root.walkRules((rule) => {
    order += 1;
    const sizes = rule.nodes?.filter(
      (node) => node.type === "decl" && node.prop === "font-size",
    );
    if (!sizes || sizes.length === 0) return;
    // A rule in a media query this file cannot read is not a candidate it
    // may quietly drop.
    let cursor: Rule | AtRule | undefined = rule;
    while (cursor?.parent) {
      const parent = cursor.parent as AtRule;
      if (
        parent.type === "atrule" &&
        parent.name !== "layer" &&
        !(
          parent.name === "media" &&
          /^\((?:min-width:\s*[\d.]+(?:px|rem)|max-width:\s*[\d.]+(?:px|rem)|width\s*(?:>=|<)\s*[\d.]+(?:px|rem))\)$/.test(
            parent.params.trim(),
          )
        )
      ) {
        undecidable.push(
          `@${parent.name} ${parent.params} { ${rule.selector} }`,
        );
        return;
      }
      cursor = parent as AtRule;
    }

    for (const selector of rule.selectors) {
      const compound = parseCompound(selector);
      if (!compound) {
        // Only report what could plausibly be about our element: a selector
        // for some other element or a descendant of something is not a gap.
        if (
          new RegExp(`(^|[\\s,>+~])${element}([.:\\[\\s,]|$)`).test(selector)
        ) {
          undecidable.push(selector);
        }
        continue;
      }
      if (compound.element !== null && compound.element !== element) continue;
      if (!compound.classes.every((name) => elementClasses.includes(name)))
        continue;
      const decl = sizes[sizes.length - 1]!;
      if (decl.type !== "decl") continue;
      matched.push({
        rank: rankOf(rule),
        specificity: [0, compound.classes.length, compound.element ? 1 : 0],
        order,
        selector,
        value: decl.value,
        important: decl.important === true,
        minWidth: bandOf(rule).min,
        maxWidth: bandOf(rule).max,
      });
    }
  });
  return { matched, undecidable };
}

/** Lexicographic on the layer path: unlayered (`[]`) is the strongest, and a
 *  deeper sub-layer is weaker than its parent's own bare rules. */
function compareRank(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i] ?? Number.MAX_SAFE_INTEGER;
    const y = b[i] ?? Number.MAX_SAFE_INTEGER;
    if (x !== y) return x - y;
  }
  return 0;
}

/** The declaration that wins for `font-size`, at a stated viewport. */
function winner(
  all: readonly Candidate[],
  viewport: number,
): Candidate | undefined {
  return all
    .filter((c) => c.minWidth <= viewport && viewport < c.maxWidth)
    .sort(
      (a, b) =>
        Number(a.important) - Number(b.important) ||
        compareRank(a.rank, b.rank) ||
        a.specificity[0] - b.specificity[0] ||
        a.specificity[1] - b.specificity[1] ||
        a.specificity[2] - b.specificity[2] ||
        a.order - b.order,
    )
    .at(-1);
}

/* ── resolving the value the winner declares ──────────────────────────── */

/** `var(--text-xs)` → `0.75rem` → 12. One `var()` deep, which is as deep as
 *  this product's type ladder goes, and the custom property is read off the
 *  same compiled sheet rather than from a second copy of the token file. */
function resolvePx(value: string, css: string): number {
  const root = postcss.parse(css);
  const seen = new Map<string, string>();
  root.walkDecls((decl) => {
    if (decl.prop.startsWith("--") && !seen.has(decl.prop))
      seen.set(decl.prop, decl.value.trim());
  });
  let current = value.trim();
  for (let depth = 0; depth < 4; depth += 1) {
    const m = /^var\((--[A-Za-z0-9-]+)(?:,\s*([^)]+))?\)$/.exec(current);
    if (!m) break;
    current = (seen.get(m[1]!) ?? m[2] ?? "").trim();
  }
  if (current.endsWith("rem")) return Number.parseFloat(current) * ROOT_FONT_PX;
  if (current.endsWith("px")) return Number.parseFloat(current);
  return Number.NaN;
}

/* ── the assertions ───────────────────────────────────────────────────── */

let css = "";
beforeAll(async () => {
  css = await compile();
}, 120_000);

describe("a heading sized with a utility computes the utility's size (#941)", () => {
  it('<h2 class="text-xs"> resolves to the text-xs rung, not the h2 step', () => {
    const { matched } = candidates(css, "h2", ["text-xs"]);
    // Rule 5.5: the sweep found the rules it was meant to rank.
    expect(
      matched.length,
      "no font-size rule in the sheet matched an h2 at all",
    ).toBeGreaterThan(1);

    for (const viewport of [NARROW_PX, WIDE_PX]) {
      const won = winner(matched, viewport);
      expect(
        won,
        `nothing won font-size for h2.text-xs at ${viewport}px`,
      ).toBeDefined();
      expect(
        won!.selector,
        `at ${viewport}px the winner is \`${won!.selector}\` — the utility must win, not an element rule`,
      ).toBe(".text-xs");
      expect(resolvePx(won!.value, css), `h2.text-xs at ${viewport}px`).toBe(
        12,
      );
    }
  });

  it("a bare <h2> still computes the ruled 25px step, and a bare <h1> still steps down under 640px", () => {
    // The other half: `base` is a default, not a deletion. The scale is
    // still what speaks when no class does.
    const h2 = candidates(css, "h2", []);
    expect(resolvePx(winner(h2.matched, WIDE_PX)!.value, css), "bare h2").toBe(
      25,
    );

    const h1 = candidates(css, "h1", []);
    expect(
      resolvePx(winner(h1.matched, NARROW_PX)!.value, css),
      `bare h1 at ${NARROW_PX}px`,
    ).toBe(25);
    expect(
      resolvePx(winner(h1.matched, WIDE_PX)!.value, css),
      `bare h1 at ${WIDE_PX}px`,
    ).toBe(31);
  });

  it("the heading scale is in a layer at all — nothing unlayered sizes a heading", () => {
    // The cause, stated directly. An unlayered element rule is what beat
    // every utility, so its absence is the invariant worth naming: a later
    // edit that drops the `@layer base` wrapper fails here first, with the
    // selector that did it in the message.
    const unlayered = candidates(css, "h2", []).matched.filter(
      (c) => c.rank.length === 0,
    );
    expect(
      unlayered.map((c) => c.selector),
      "an unlayered rule sizes a heading again — it will out-rank every Tailwind utility",
    ).toEqual([]);
  });

  it("names every selector its matcher could not decide, so a narrowed sweep cannot pass quietly", () => {
    const all = [
      ...candidates(css, "h1", []).undecidable,
      ...candidates(css, "h2", ["text-xs"]).undecidable,
    ];
    expect(
      [...new Set(all)],
      "the compiled sheet grew a font-size rule about a heading that this file cannot rank — extend the matcher or the assertions above are narrower than they read",
    ).toEqual([]);
  });
});
