// Token reader. `src/ui/theme.css` is the only token file.
// tests/ui/design/tokens-doc.ts
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss, { type AtRule, type Declaration, type Rule } from "postcss";

const REPO = path.resolve(import.meta.dirname, "../../..");

export const THEME_CSS = path.join(REPO, "src/ui/theme.css");

/** The three states a token can be declared in. Two files carry the same
 *  set only if all three blocks agree. */
export type Block = "light" | "dark-media" | "dark-toggle";

export type TokenSet = Readonly<Record<Block, ReadonlyMap<string, string>>>;

/**
 * Which of the three blocks a rule belongs to.
 *
 * `BUILD.md` §2.1 fixes the three selectors, so they are matched rather than
 * guessed: a bare `:root`, the media-guarded `:root:not([data-theme=
 * "light"])`, and the explicit `:root[data-theme="dark"]`. A rule that is
 * none of them is a mistake in whichever file carries it, and `tokenSet`
 * throws rather than skipping it — a token declared somewhere unexpected is
 * the one case where silence would let the two files differ unnoticed.
 */
function blockOf(rule: Rule): Block | null {
  const selector = rule.selector.replace(/\s+/g, "");
  if (selector === ":root") return rule.parent?.type === "atrule" ? null : "light";
  if (selector === ':root:not([data-theme="light"])') return "dark-media";
  if (selector === ':root[data-theme="dark"]') return "dark-toggle";
  return null;
}

/**
 * A value, normalised for comparison: case-folded and stripped of the
 * whitespace two files may spell differently — `0 1px 3px rgb(24 24 48/.045)`
 * against `0 1px 3px rgb(24 24 48/.045)`, `"JetBrains Mono",ui-monospace`
 * against `"JetBrains Mono", ui-monospace`. Nothing else is touched: a
 * different number, hex or fallback face is a difference and must fail.
 */
export function normalise(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

/** Every custom property a token file declares, by block, normalised. */
export function tokenSet(file: string): TokenSet {
  const out: Record<Block, Map<string, string>> = {
    light: new Map(),
    "dark-media": new Map(),
    "dark-toggle": new Map(),
  };
  const unplaced: string[] = [];
  postcss.parse(readFileSync(file, "utf8")).walkRules((rule: Rule) => {
    const block = blockOf(rule);
    rule.walkDecls((decl: Declaration) => {
      if (!decl.prop.startsWith("--")) return;
      if (block === null) {
        unplaced.push(`${rule.selector} { ${decl.prop} }`);
        return;
      }
      out[block].set(decl.prop, normalise(decl.value));
    });
  });
  if (unplaced.length > 0) {
    throw new Error(
      `${path.basename(file)} declares a token outside the three ruled blocks: ${unplaced.join(", ")}`
    );
  }
  return out;
}

/** Every token name `theme.css` declares, in any block. */
export function approvedTokens(): ReadonlySet<string> {
  const set = tokenSet(THEME_CSS);
  return new Set([...set.light.keys(), ...set["dark-media"].keys(), ...set["dark-toggle"].keys()]);
}

export function approvedLightValue(token: string): string | undefined {
  return tokenSet(THEME_CSS).light.get(token);
}

export const TAILWIND_CSS = path.join(REPO, "src/ui/tailwind.css");

/**
 * The one daisyUI theme: every custom property the `@plugin "daisyui/theme"`
 * block in `src/ui/tailwind.css` declares, by name, value as written.
 * `docs/DESIGN.md` rules the theme is declared there and nowhere
 * else, so a second block, or none, throws rather than reading as an empty
 * theme. `source` lets a mutation check parse an edited copy.
 */
export function daisyTheme(source: string = readFileSync(TAILWIND_CSS, "utf8")): ReadonlyMap<string, string> {
  const blocks: AtRule[] = [];
  postcss.parse(source).walkAtRules("plugin", (rule: AtRule) => {
    if (rule.params.replace(/["']/g, "") === "daisyui/theme") blocks.push(rule);
  });
  if (blocks.length !== 1) {
    throw new Error(`src/ui/tailwind.css declares ${blocks.length} daisyUI theme blocks, not one`);
  }
  const out = new Map<string, string>();
  blocks[0]!.walkDecls((decl: Declaration) => {
    if (decl.prop.startsWith("--")) out.set(decl.prop, decl.value.trim());
  });
  return out;
}
