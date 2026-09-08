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
import { describe, expect, it } from "vitest";
import { APPROVED_TOKENS_CSS, type Block, THEME_CSS, tokenSet } from "./tokens-doc";

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
    expect(approved.light.size).toBe(53);
    expect(declared.light.size).toBe(53);
    expect([...declared["dark-media"]].sort()).toEqual([...declared["dark-toggle"]].sort());
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
