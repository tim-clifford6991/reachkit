// The approved token set, read from `docs/design/tokens.css`.
// tests/ui/design/tokens-doc.ts
//
// One reader, three tests: `token-set.test.ts` holds `src/ui/theme.css`
// equal to this file by name *and* value, `tests/ui/tokens.test.ts` uses the
// names to say which tokens may exist at all, and `no-bare-literals.test.ts`
// uses the values to prove a converted literal kept the value it had.
// A second copy of "what the owner approved" is exactly the drift issue #349
// is about.
//
// The source is the token file of record (owner ruling 2026-09-08; UI-SPEC
// §1, rulings 8a and 10a): the artifact's own three blocks, verbatim, plus
// the six additions 10a made on top of them. `archive/…/design/tokens.md` is
// superseded and is not read here — reading it is what the paused first pass
// of this issue did, and the owner ruled that file is not the approved set.
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss, { type Declaration, type Rule } from "postcss";

const REPO = path.resolve(import.meta.dirname, "../../..");

export const APPROVED_TOKENS_CSS = path.join(REPO, "docs/design/tokens.css");
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

/** The approved set — every token name the owner approved, in any block. */
export function approvedTokens(): ReadonlySet<string> {
  const set = tokenSet(APPROVED_TOKENS_CSS);
  return new Set([...set.light.keys(), ...set["dark-media"].keys(), ...set["dark-toggle"].keys()]);
}

/** An approved light value, for a test that has to prove a converted
 *  literal kept the value it had. */
export function approvedLightValue(token: string): string | undefined {
  return tokenSet(APPROVED_TOKENS_CSS).light.get(token);
}
