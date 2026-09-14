// `src/ui/theme.css` is the only token file.
// tests/ui/design/token-set.test.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  approvedTokens,
  daisyTheme,
  TAILWIND_CSS,
  THEME_CSS,
  tokenSet,
} from "./tokens-doc";

const SRC = path.resolve(import.meta.dirname, "../../../src");

/** Every `.css` file under `src/`. */
function cssFiles(dir: string = SRC, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) cssFiles(full, out);
    else if (entry.endsWith(".css")) out.push(full);
  }
  return out;
}

describe("theme.css is the only token file", () => {
  const declared = tokenSet(THEME_CSS);

  it("the two struck tokens are gone", () => {
    for (const struck of ["--r-card", "--ring-accent"]) {
      expect(declared.light.has(struck), `${struck} still in theme.css`).toBe(false);
    }
  });

  it("the set is 54 light tokens, and the dark blocks agree", () => {
    expect(declared.light.size).toBe(54);
    expect([...declared["dark-media"]].sort()).toEqual([...declared["dark-toggle"]].sort());
  });

  it("no other stylesheet declares an approved token — one name, one home", () => {
    // The diff above is only worth its green run if `theme.css` is the only
    // declaration. Until this issue three sheets carried scoped copies of
    // the spacing ladder and the day-panel width, each with the same note:
    // `theme.css` was §2.1 verbatim and refused a token §2.1 did not state,
    // so a component that needed a step declared its own. That exception is
    // gone with the rule that created it, and a second copy of an approved
    // value is exactly the drift this file exists to catch.
    //
    // A sheet may still declare a name the approved set does **not** carry —
    // `--grid-week`, `--w-cell-min`, `--border-hair`, the idiom's two
    // compositions — because those are its own, and the set never named
    // them. What it may not do is redeclare one the owner approved.
    const approved = approvedTokens();
    const offenders: string[] = [];
    for (const file of cssFiles()) {
      if (path.resolve(file) === path.resolve(THEME_CSS)) continue;
      const source = readFileSync(file, "utf8");
      for (const [, token] of source.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)) {
        if (approved.has(token!)) {
          offenders.push(`${path.relative(path.resolve(SRC, ".."), file)}: ${token}`);
        }
      }
    }
    expect(offenders, `a second home for an approved token:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("the daisyUI theme block restates no approved token, and its own names have one home", () => {
    // `docs/DESIGN.md`: one theme, declared once in `src/ui/tailwind.css`. It
    // maps daisyUI's slots onto the approved set by `var()` and adds the four
    // v2 colours; it never redeclares an approved token, or `theme.css` stops
    // being the one home of the 54. And nothing else declares a name the
    // theme block owns, or a sheet could re-colour a v2 token or a slot unseen.
    const theme = daisyTheme();
    const approved = approvedTokens();
    const restated = [...theme.keys()].filter((token) => approved.has(token));
    expect(restated, `approved tokens restated in the theme block: ${restated.join(" ")}`).toEqual([]);

    const offenders: string[] = [];
    for (const file of cssFiles()) {
      if (path.resolve(file) === path.resolve(TAILWIND_CSS)) continue;
      const source = readFileSync(file, "utf8");
      for (const [, token] of source.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)) {
        if (theme.has(token!)) offenders.push(`${path.relative(path.resolve(SRC, ".."), file)}: ${token}`);
      }
    }
    expect(offenders, `a second home for a theme-block name:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("no token is defined only in a dark block", () => {
    // `BUILD.md` §2.1: "Never define a color only inside a dark block." A
    // token the light block never declares renders as nothing in light.
    const orphans = [...declared["dark-media"].keys(), ...declared["dark-toggle"].keys()]
      .filter((token) => !declared.light.has(token))
      .sort();
    expect(orphans, `declared only in a dark block: ${orphans.join(" ")}`).toEqual([]);
  });
});
