// tests/measure/verdict/bands.test.ts
//
// WO-277 `## Test plan` (carried verbatim from WO-054) — the band-boundary
// suite for `src/lib/measure/bands.ts`. `structure.md` rule 4.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bandOf } from "../../../src/lib/measure/bands.ts";
import { SCORE_BAND_BOUNDS } from "../../../src/lib/config/constants.ts";

const SOURCE_PATH = path.resolve(import.meta.dirname, "../../../src/lib/measure/bands.ts");

describe(
  'REQ-004 c1 — "… the first module shows a single score on a 0–100 scale, its band as one of the four written words …" — bands/bandOf · the four boundaries',
  () => {
    it.each([
      [0, "invisible"],
      [24, "invisible"],
      [25, "hard-to-find"],
      [49, "hard-to-find"],
      [50, "findable"],
      [74, "findable"],
      [75, "dominant"],
      [100, "dominant"],
    ] as const)("bandOf(%i) === %s", (score, expected) => {
      expect(bandOf(score)).toBe(expected);
    });

    it("reads the boundaries from the BP-005 pin, not a private copy", () => {
      expect(bandOf(SCORE_BAND_BOUNDS.findable)).toBe("findable");
      expect(bandOf(SCORE_BAND_BOUNDS.dominant)).toBe("dominant");
      expect(bandOf(SCORE_BAND_BOUNDS["hard-to-find"])).toBe("hard-to-find");
      expect(bandOf(SCORE_BAND_BOUNDS.invisible)).toBe("invisible");
    });
  }
);

describe("bands/bandOf · source discipline", () => {
  const SOURCE = readFileSync(SOURCE_PATH, "utf8");

  it("carries no numeric literal other than the range guard's own 0 and 100", () => {
    // Strip comments so prose mentioning e.g. "25" doesn't count.
    const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const literals = [...code.matchAll(/(?<![\w.])\d+(?:\.\d+)?(?![\w.])/g)].map((m) => m[0]);
    for (const lit of literals) {
      expect(["0", "100"]).toContain(lit);
    }
  });

  it("imports SCORE_BAND_BOUNDS rather than declaring it", () => {
    expect(SOURCE).toMatch(/import\s*\{[^}]*SCORE_BAND_BOUNDS[^}]*\}/);
    expect(SOURCE).not.toMatch(/export\s+const\s+SCORE_BAND_BOUNDS/);
  });

  it("throws rather than returning a band for an out-of-range score", () => {
    expect(() => bandOf(-1)).toThrow();
    expect(() => bandOf(101)).toThrow();
  });
});
