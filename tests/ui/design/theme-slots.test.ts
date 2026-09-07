// tests/ui/design/theme-slots.test.ts — §2.1, §2.2, issue #243
//
// The eight colour slots §2.1 names are not the whole of what daisyUI 5
// reads, and the gap was not theoretical: every button in the product
// rendered square, black-bordered and near-black on the indigo ground,
// because `.btn` resolves `border-width:var(--border)` and
// `border-radius:var(--radius-field)` — **neither with a fallback** — to
// nothing, and `--btn-fg` then falls back to the page's own ink.
//
// So the question this file asks is not "are the slots we thought of
// declared". It is **"is the slot set complete"**, and it asks daisyUI
// itself: `node_modules/daisyui/themes.css`'s own `light` theme is the
// canonical list of what a custom theme has to supply, and every name in
// it must be either declared by `tailwind.config.ts` or named below with
// the reason it is not. A daisyUI release that adds a slot fails here,
// naming it, rather than shipping as another silently dropped
// declaration (ADR-010's idiom: enumerate the source, never a hand list).
//
// The browser half — that the values actually compute on `.btn`, `.card`,
// `.badge`, `.input` and `.alert` — is `tests/ui/layout/theme-slots.test.ts`,
// which is where a real stylesheet and a real cascade exist.
import { describe, expect, it } from "vitest";
import { classTokensAcrossSurfaces, REPO_ROOT, read } from "./vocabulary";
import path from "node:path";
import { readFileSync } from "node:fs";

/* ── daisyUI's own slot set ───────────────────────────────────────────── */

const DAISY_THEMES = path.join(REPO_ROOT, "node_modules/daisyui/themes.css");

/** Every custom property daisyUI's bundled `light` theme declares — the
 *  canonical answer to "what does a custom theme have to supply". */
function daisySlots(): { names: readonly string[]; values: Readonly<Record<string, string>> } {
  const css = readFileSync(DAISY_THEMES, "utf8");
  const block = /\[data-theme=light\]\{(.*?)\}/s.exec(css);
  if (block === null) {
    throw new Error("tests/ui/design/theme-slots.test.ts: daisyUI's light theme block moved");
  }
  const values: Record<string, string> = {};
  for (const match of (block[1] ?? "").matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+)/g)) {
    const [, name, value] = match;
    if (name === undefined || value === undefined) continue;
    values[name] = value.trim();
  }
  return { names: Object.keys(values), values };
}

/* ── what the config declares ─────────────────────────────────────────── */

/** The `"--slot": "value"` pairs in `tailwind.config.ts`. Read off the
 *  source rather than the module: the theme is registered by *calling*
 *  daisyUI's plugin, so the object is gone by the time the config is
 *  imported. Comments in that file quote slot names in backticks, never in
 *  the `"--x": "y"` shape this matches. */
function declaredSlots(): Readonly<Record<string, string>> {
  const source = read("tailwind.config.ts");
  const slots: Record<string, string> = {};
  for (const match of source.matchAll(/^\s*"(--[a-z0-9-]+)":\s*"([^"]*)",?\s*$/gm)) {
    const [, name, value] = match;
    if (name === undefined || value === undefined) continue;
    slots[name] = value;
  }
  return slots;
}

/** The tokens `src/ui/theme.css`'s bare `:root` declares — §2.1 verbatim,
 *  and the only colours a slot may point at. */
function themeTokens(): ReadonlySet<string> {
  const css = read("src/ui/theme.css");
  const root = /:root\s*\{(.*?)\n\}/s.exec(css);
  if (root === null) throw new Error("tests/ui/design/theme-slots.test.ts: theme.css's :root moved");
  const names = [...(root[1] ?? "").matchAll(/(--[a-z0-9-]+)\s*:/g)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined);
  return new Set(names);
}

/**
 * The eight slots this theme deliberately does not declare, and why.
 *
 * §2.1 states no value for any of the four families, and the product's
 * closed component registry uses none of their modifiers — they reach
 * daisyUI's CSS only through `.btn-neutral`, `.badge-info`,
 * `.input-secondary` and their like. Declaring them would mean minting
 * eight colours the specification does not name (rule 2.4); the row below
 * is checked against the registry, so the day one of those modifiers is
 * registered this list stops being true and this file says so.
 */
const NOT_DECLARED: Readonly<Record<string, string>> = {
  "--color-secondary": "§2.1 names no secondary; no `-secondary` modifier is registered",
  "--color-secondary-content": "the ink for a ground that is never drawn",
  "--color-accent": "§2.1's `--accent` is daisyUI's *primary*; its own `accent` family is unused",
  "--color-accent-content": "the ink for a ground that is never drawn",
  "--color-neutral": "§2.1 names no neutral; reached only by `-neutral` modifiers and by `--depth` shadows, which are off",
  "--color-neutral-content": "the ink for a ground that is never drawn",
  "--color-info": "§2.2's four alert tones are ok/warn/bad and the base one — there is no info tone",
  "--color-info-content": "the ink for a ground that is never drawn",
};

/** The modifier suffixes the four undeclared families would arrive by. */
const UNUSED_FAMILIES = ["secondary", "accent", "neutral", "info"] as const;

describe("the slot set is complete — daisyUI's own list, not ours", () => {
  it("every slot daisyUI's light theme declares is either declared here or named as excluded", () => {
    const declared = declaredSlots();
    const missing = daisySlots().names.filter(
      (name) => !(name in declared) && !(name in NOT_DECLARED)
    );
    expect(missing).toEqual([]);
  });

  it("nothing is excluded that daisyUI does not ask for, and nothing is both", () => {
    const daisy = new Set(daisySlots().names);
    const declared = declaredSlots();
    for (const name of Object.keys(NOT_DECLARED)) {
      expect(daisy.has(name), `${name} is not a daisyUI slot`).toBe(true);
      expect(name in declared, `${name} is both declared and excluded`).toBe(false);
    }
  });

  it("no modifier of an undeclared family is written anywhere under src/app or src/ui", () => {
    // The exclusions rest on this, so it is swept rather than asserted: a
    // `.badge-info` in a panel would render a ground with no colour and a
    // label with no ink, and the sweep is what notices the day one appears.
    const written = [...classTokensAcrossSurfaces().entries()];
    expect(written.length).toBeGreaterThan(0);
    const offenders = written
      .filter(([token]) => UNUSED_FAMILIES.some((family) => token.endsWith(`-${family}`)))
      .map(([token, files]) => `${token} (${[...files].join(", ")})`);
    expect(offenders).toEqual([]);
  });
});

describe("every colour slot points at a §2.1 token, never at a value", () => {
  it("each is `var(--token)` on a token theme.css declares", () => {
    const tokens = themeTokens();
    for (const [name, value] of Object.entries(declaredSlots())) {
      if (!name.startsWith("--color-")) continue;
      const ref = /^var\((--[a-z0-9-]+)\)$/.exec(value);
      expect(ref, `${name} must be var(--token), got ${value}`).not.toBeNull();
      const token = ref?.[1] ?? "";
      expect(tokens.has(token), `${name} points at ${token}, which §2.1 does not state`).toBe(true);
    }
  });

  it("the four `-content` slots all take `--on-accent` — the one token named for ink on a saturated ground", () => {
    const declared = declaredSlots();
    for (const tone of ["primary", "success", "warning", "error"]) {
      expect(declared[`--color-${tone}-content`]).toBe("var(--on-accent)");
    }
  });
});

describe("the four numbers that are not colours", () => {
  it("radius comes from tokens.md §2's three, by use", () => {
    const declared = declaredSlots();
    expect(declared["--radius-box"]).toBe("var(--r-box)");
    expect(declared["--radius-field"]).toBe("var(--r-field)");
    expect(declared["--radius-selector"]).toBe("var(--r-pill)");
  });

  it("the border is the hairline token, declared once in the entry stylesheet", () => {
    expect(declaredSlots()["--border"]).toBe("var(--border-hair)");
    // tokens.md §2b: "`--border-hair` `1px` … Named, not changed."
    expect(read("src/ui/tailwind.css")).toMatch(/--border-hair:\s*1px;/);
  });

  it("daisyUI's own two effects are off, not undeclared", () => {
    // Undeclared is not off: the reads carry no fallback, so leaving them
    // out drops whole declarations rather than switching an effect off.
    const declared = declaredSlots();
    expect(declared["--depth"]).toBe("0");
    expect(declared["--noise"]).toBe("0");
    // daisyUI's own light theme turns depth *on*; this theme differs on
    // purpose (§2.5 — nothing decorative carries meaning), and the row
    // says so rather than leaving the difference to be discovered.
    expect(daisySlots().values["--depth"]).not.toBe("0");
  });

  it("the two control-size units are daisyUI's own number, written down", () => {
    const daisy = daisySlots().values;
    const declared = declaredSlots();
    for (const slot of ["--size-field", "--size-selector"] as const) {
      // `.25rem` in daisyUI's source, `0.25rem` here — the same length,
      // compared as a number so neither spelling is the assertion.
      const ours = declared[slot] ?? "";
      const theirs = daisy[slot] ?? "";
      expect(parseFloat(ours)).toBe(parseFloat(theirs));
      expect(ours).toMatch(/rem$/);
    }
  });
});
