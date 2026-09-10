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
//
// The arithmetic itself moved to `./contrast.ts` under issue #328, which
// measures the rest of the set the same way; nothing about this measurement
// changed with it.
import { describe, expect, it } from "vitest";
import { AA_TEXT, contrast, declaredMix, mix, resolve, type Theme } from "./contrast";

/** The mix is declared where it is spent (issue #349): `theme.css` carries
 *  `docs/design/approved/tokens.css` and nothing else, and this ink is a
 *  construction over two of its tokens rather than a token of its own. */
const IDIOM_CSS = "src/ui/idiom/idiom.css";

const THEMES: readonly Theme[] = ["light", "dark"];

describe("issue #290 — the quiet on-accent ink clears WCAG AA in both themes", () => {
  const declared = declaredMix(IDIOM_CSS, "--on-accent-quiet");

  for (const theme of THEMES) {
    it(`${theme}: --on-accent-quiet on flat --accent is at least ${AA_TEXT}:1`, () => {
      const accent = resolve(theme, "--accent");
      const ink = mix(resolve(theme, "--on-accent"), accent, declared.percent);
      const ratio = contrast(ink, accent);
      expect(
        ratio,
        `${theme} measures ${ratio.toFixed(2)}:1 at a ${declared.percent}% mix`
      ).toBeGreaterThanOrEqual(AA_TEXT);
    });
  }

  it("the preview's own 28% fails — so this test is measuring, not asserting a constant", () => {
    // Non-vacuity, and the record of what was actually wrong: the same
    // function on the value the idiom was drawn with must fail both themes.
    for (const theme of THEMES) {
      const accent = resolve(theme, "--accent");
      const ratio = contrast(mix(resolve(theme, "--on-accent"), accent, 28), accent);
      expect(ratio, `${theme} at 28% measures ${ratio.toFixed(2)}:1`).toBeLessThan(2);
    }
  });

  it("the declared mix is the lowest ladder step that clears both — not a rounder number", () => {
    // 80% clears dark and fails light, so the light column is the binding
    // one and a future accent change must be re-measured against it.
    const accent = resolve("light", "--accent");
    expect(contrast(mix(resolve("light", "--on-accent"), accent, 80), accent)).toBeLessThan(AA_TEXT);
    expect(declared.percent).toBe(85);
    // The mix is over the two tokens it says it is over — a rename that left
    // the percentage alone would otherwise measure some other pair.
    expect([declared.first, declared.second]).toEqual(["--on-accent", "--accent"]);
  });
});
