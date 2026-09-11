// `src/ui/theme.css` carries exactly `docs/design/approved/tokens.css`.
// tests/ui/design/token-set.test.ts  ·  issue #349
//
// The owner approved a token file and ruled it the source of truth for
// `theme.css` (2026-09-08; BUILD §2.1 as amended by #378). Until this test
// nothing compared the two, and they had drifted in both directions: the
// product declared sixty-four tokens under an older document's names —
// `--t-h1` for `--h1`, `--t-floor` for `--t-eyebrow`, a `--r-card` the owner
// had struck — while five names the approved file carries, `--font-num`,
// `--num-weight`, `--t-body`, `--t-explain` and `--t-eyebrow`, existed
// nowhere.
//
// The comparison runs in both directions and on values, not just names,
// because all three failures are real: a token here and not there is a value
// nobody approved, a token there and not here is a rule nothing enforces,
// and a name that matches at a different value is the drift that looks green.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { approvedTokens, APPROVED_TOKENS_CSS, type Block, THEME_CSS, tokenSet } from "./tokens-doc";

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

const BLOCKS: readonly Block[] = ["light", "dark-media", "dark-toggle"];

describe("issue #349 — theme.css is the approved token file", () => {
  const approved = tokenSet(APPROVED_TOKENS_CSS);
  const declared = tokenSet(THEME_CSS);

  for (const block of BLOCKS) {
    it(`${block}: every approved token is declared, at the approved value`, () => {
      const wrong = [...approved[block]]
        .filter(([token, value]) => declared[block].get(token) !== value)
        .map(
          ([token, value]) =>
            `${token}: approved ${value}, theme.css ${declared[block].get(token) ?? "—"}`
        );
      expect(wrong, `theme.css differs from the approved set:\n${wrong.join("\n")}`).toEqual([]);
    });

    it(`${block}: every declared token is one the owner approved`, () => {
      const extra = [...declared[block].keys()]
        .filter((token) => !approved[block].has(token))
        .sort();
      expect(extra, `declared in theme.css and approved nowhere: ${extra.join(" ")}`).toEqual([]);
    });
  }

  it("the two struck tokens are gone", () => {
    // Ruling 8a strikes `--r-card`: "Card radius is `--r-box: 14px`
    // everywhere". `--ring-accent` is not in the approved file either — the
    // set draws focus as `0 0 0 3px var(--accent-bg)`, written where it is
    // spent rather than carried as a token nobody approved. Named here
    // because both were in `theme.css` before this issue, so the check is
    // against a real previous state rather than a hypothetical one.
    for (const struck of ["--r-card", "--ring-accent"]) {
      expect(approved.light.has(struck), `${struck} in the approved file`).toBe(false);
      expect(declared.light.has(struck), `${struck} still in theme.css`).toBe(false);
    }
  });

  it("the set is the size the approved file carries, and the dark blocks agree", () => {
    // Rule 5.5: the number is stated rather than read off a green run. 53 =
    // the artifact's 47 plus 10a's six. The two dark blocks are one palette
    // reached two ways (§2.1), so they must be identical — an override in
    // one and not the other is how the toggle and the OS setting come apart.
    expect(approved.light.size).toBe(54);
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

  it("no token is defined only in a dark block", () => {
    // `SPEC.md` §2.1: "Never define a color only inside a dark block." A
    // token the light block never declares renders as nothing in light.
    const orphans = [...declared["dark-media"].keys(), ...declared["dark-toggle"].keys()]
      .filter((token) => !declared.light.has(token))
      .sort();
    expect(orphans, `declared only in a dark block: ${orphans.join(" ")}`).toEqual([]);
  });
});
