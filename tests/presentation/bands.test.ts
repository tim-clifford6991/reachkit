// tests/presentation/bands.test.ts
//
// WO-248's test plan (folded into WO-278 `## Test plan` under rule 2.6 —
// see WO-278 `## Consolidation`). REQ-004 c1, REQ-009 c8, REQ-047 c10,
// REQ-096 c9 (bands half) and REQ-004 c2 (bands half — `LIMITING_LINES`),
// quoted verbatim in the work order's own `## Test plan` table.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BAND_LABELS, LIMITING_LINES, SCORE_BANDS, SEVERITY } from "../../src/lib/presentation/bands.ts";
import { copy } from "../../src/lib/presentation/copy/index.ts";

const SOURCE_PATH = path.resolve(import.meta.dirname, "../../src/lib/presentation/bands.ts");
const SOURCE = readFileSync(SOURCE_PATH, "utf8");

describe(
  'REQ-004 c1 — "Given a completed report whose score could be computed, when it opens, then the first module shows a single score on a 0–100 scale, its band as one of the four written words — Invisible, Hard to find, Findable, Dominant — the domain measured, and the date it was measured." — bands · SCORE_BANDS is the closed four-word set and its only source',
  () => {
    it("has exactly the four keys invisible, hard-to-find, findable, dominant", () => {
      expect(Object.keys(SCORE_BANDS).sort()).toEqual(["dominant", "findable", "hard-to-find", "invisible"]);
    });

    it("each resolves through copy() to REQ-004 criterion 1's own word", () => {
      // REQ-004 c1's own words: "Invisible, Hard to find, Findable, Dominant"
      expect(copy(SCORE_BANDS.invisible)).toBe("Invisible");
      expect(copy(SCORE_BANDS["hard-to-find"])).toBe("Hard to find");
      expect(copy(SCORE_BANDS.findable)).toBe("Findable");
      expect(copy(SCORE_BANDS.dominant)).toBe("Dominant");
    });

    it("the four resolved words are distinct", () => {
      const words = [
        copy(SCORE_BANDS.invisible),
        copy(SCORE_BANDS["hard-to-find"]),
        copy(SCORE_BANDS.findable),
        copy(SCORE_BANDS.dominant),
      ];
      expect(new Set(words).size).toBe(4);
    });

    // The @ts-expect-error fixture below is never invoked at runtime —
    // `npm run typecheck` is what discriminates a weakened guard, not this
    // file (WO-277's `tests/measure/verdict/measured.test.ts` convention).
    function _typeLevelNegatives(): void {
      const fifthHandle: typeof SCORE_BANDS = {
        invisible: "band.score.invisible",
        "hard-to-find": "band.score.hard-to-find",
        findable: "band.score.findable",
        dominant: "band.score.dominant",
        // @ts-expect-error — a fifth score-band handle is not a member of SCORE_BANDS' closed union.
        emerging: "band.score.invisible",
      };
      void fifthHandle;
    }
    void _typeLevelNegatives;

    it("documents the @ts-expect-error fixture above; npm run typecheck discriminates a weakened guard", () => {
      expect(typeof _typeLevelNegatives).toBe("function");
    });
  }
);

describe(
  'REQ-009 c8 — "Given the severity of any of the three problems, when it renders, then it is one of exactly three written levels drawn from one closed set … and of any two reports the one with the larger count for the same problem never carries the lower severity." — bands · SEVERITY is one closed ordered triple',
  () => {
    it("SEVERITY.length === 3", () => {
      expect(SEVERITY.length).toBe(3);
    });

    it("the three resolve to Minor, Worth fixing, Critical in index order (BP-019 decision 6)", () => {
      expect(copy(SEVERITY[0])).toBe("Minor");
      expect(copy(SEVERITY[1])).toBe("Worth fixing");
      expect(copy(SEVERITY[2])).toBe("Critical");
    });

    it("the three are distinct", () => {
      const words = SEVERITY.map((key) => copy(key));
      expect(new Set(words).size).toBe(3);
    });

    // The @ts-expect-error fixture(s) below are never invoked at runtime.
    function _typeLevelNegatives(): void {
      // @ts-expect-error — SEVERITY is a readonly tuple, not keyed by handle; 'low' is not a valid index.
      const byHandle = SEVERITY["low"];
      void byHandle;
      // @ts-expect-error — a fourth element is not assignable to a 3-tuple.
      const fourth: typeof SEVERITY = ["severity.low", "severity.mid", "severity.high", "severity.extreme"];
      void fourth;
    }
    void _typeLevelNegatives;

    it("documents the two @ts-expect-error fixtures above; the triple can only be read by ordinal", () => {
      expect(typeof _typeLevelNegatives).toBe("function");
    });
  }
);

describe(
  'REQ-047 c10 — "Given an assessed target, when its winnability is recorded, then it carries exactly one of three bands: Winnable … Reach … and Not-yet … A Not-yet target is never queued for a page." — bands · BAND_LABELS.winnability is total over the three handles and renders the ruled terms',
  () => {
    it("has exactly the three keys winnable, reach, not-yet", () => {
      expect(Object.keys(BAND_LABELS.winnability).sort()).toEqual(["not-yet", "reach", "winnable"]);
    });

    it("each resolves through copy() to Winnable, Reach, Not yet", () => {
      expect(copy(BAND_LABELS.winnability.winnable)).toBe("Winnable");
      expect(copy(BAND_LABELS.winnability.reach)).toBe("Reach");
      expect(copy(BAND_LABELS.winnability["not-yet"])).toBe("Not yet");
    });

    it("the three are distinct", () => {
      const words = [
        copy(BAND_LABELS.winnability.winnable),
        copy(BAND_LABELS.winnability.reach),
        copy(BAND_LABELS.winnability["not-yet"]),
      ];
      expect(new Set(words).size).toBe(3);
    });

    it('"not-yet" resolves to "Not yet" and never "Not-yet" — the transcription note BP-019 decision 6 declines to smooth', () => {
      expect(copy(BAND_LABELS.winnability["not-yet"])).toBe("Not yet");
      expect(copy(BAND_LABELS.winnability["not-yet"])).not.toBe("Not-yet");
    });

    // The @ts-expect-error fixture(s) below are never invoked at runtime.
    function _typeLevelNegatives(): void {
      const fourthHandle: typeof BAND_LABELS.winnability = {
        winnable: "band.winnability.winnable",
        reach: "band.winnability.reach",
        "not-yet": "band.winnability.notYet",
        // @ts-expect-error — a fourth winnability handle is not a member of the closed union.
        maybe: "band.winnability.winnable",
      };
      void fourthHandle;
    }
    void _typeLevelNegatives;

    it("documents the @ts-expect-error fixture above; a fourth winnability handle fails to compile", () => {
      expect(typeof _typeLevelNegatives).toBe("function");
    });
  }
);

describe(
  "REQ-096 c9 — \"Given a rival's band is rendered anywhere in the product, when the customer reads it, then `near`, `middle` and `far` each render as their own distinct term, the same term for that band on every surface; and no term rendered for a rival's band is a term rendered for a target's winnability band (REQ-047 criterion 10) …\" — bands · BAND_LABELS.rivalSize is total, distinct, and the only source of a rival's term",
  () => {
    it("has exactly the three keys near, middle, far", () => {
      expect(Object.keys(BAND_LABELS.rivalSize).sort()).toEqual(["far", "middle", "near"]);
    });

    it("each resolves through copy() to Similar size, Larger, Much larger", () => {
      expect(copy(BAND_LABELS.rivalSize.near)).toBe("Similar size");
      expect(copy(BAND_LABELS.rivalSize.middle)).toBe("Larger");
      expect(copy(BAND_LABELS.rivalSize.far)).toBe("Much larger");
    });

    it("the three are distinct", () => {
      const words = [copy(BAND_LABELS.rivalSize.near), copy(BAND_LABELS.rivalSize.middle), copy(BAND_LABELS.rivalSize.far)];
      expect(new Set(words).size).toBe(3);
    });

    // "The disjointness clause is NOT tested here" (REQ-096 c9 row) — that
    // is ADR-001 point 3's single assertion in tests/pins.test.ts (BP-005,
    // WO-007), out of this WO's scope. What is asserted structurally here
    // is that this map is the only source of a rival-size term anywhere in
    // the corpus, so "the same term on every surface" reduces to "every
    // surface reaches this map".
    it("no other mapping of near/middle/far to a CopyKey exists under src/lib/ or src/app/", () => {
      const roots = [
        path.resolve(import.meta.dirname, "../../src/lib"),
        path.resolve(import.meta.dirname, "../../src/app"),
      ];
      const bandsFile = SOURCE_PATH;
      const offenders: string[] = [];

      function walk(dir: string): void {
        let entries: string[];
        try {
          entries = readdirSync(dir);
        } catch {
          return;
        }
        for (const entry of entries) {
          const full = path.join(dir, entry);
          const stat = statSync(full);
          if (stat.isDirectory()) {
            if (entry === "node_modules") continue;
            walk(full);
          } else if (/\.(ts|tsx)$/.test(entry) && full !== bandsFile) {
            const src = readFileSync(full, "utf8");
            // A hand-written mapping of the rival-size handles to a CopyKey
            // — the pattern this map alone is allowed to contain.
            if (/["']near["']\s*:\s*["']band\.rivalSize/.test(src) || /["']middle["']\s*:\s*["']band\.rivalSize/.test(src)) {
              offenders.push(full);
            }
          }
        }
      }

      for (const root of roots) walk(root);
      expect(offenders).toEqual([]);
    });
  }
);

describe(
  'REQ-004 c2 — "Given a score that could be computed, when it renders, then one written line beside it names the one driver … whose measurement holds the score down the most … Where the score could not be computed, criterion 3 governs the line instead." — bands · LIMITING_LINES is total over the three factor handles and every key resolves through the registry',
  () => {
    it("has exactly the three keys foundations, answerability, presence", () => {
      expect(Object.keys(LIMITING_LINES).sort()).toEqual(["answerability", "foundations", "presence"]);
    });

    it("each value is a declared CopyKey no longer listed in OWNER_OWED, and copy() returns its sentence (WO-287, owner ruling 2026-09-04, sheet 2)", async () => {
      const { OWNER_OWED } = await import("../../src/lib/presentation/copy/registry.ts");
      for (const key of Object.values(LIMITING_LINES)) {
        expect(OWNER_OWED).not.toContain(key);
        expect(() => copy(key)).not.toThrow();
        expect(copy(key).length).toBeGreaterThan(0);
      }
    });

    it("the three keys are distinct", () => {
      expect(new Set(Object.values(LIMITING_LINES)).size).toBe(3);
    });

    // The @ts-expect-error fixture(s) below are never invoked at runtime.
    function _typeLevelNegatives(): void {
      const fourthHandle: typeof LIMITING_LINES = {
        foundations: "verdict.limiting.foundations",
        answerability: "verdict.limiting.answerability",
        presence: "verdict.limiting.presence",
        // @ts-expect-error — a fourth factor handle is not a member of LIMITING_LINES' closed union.
        velocity: "verdict.limiting.foundations",
      };
      void fourthHandle;
    }
    void _typeLevelNegatives;

    it("documents the @ts-expect-error fixture above; a fourth handle fails to compile", () => {
      expect(typeof _typeLevelNegatives).toBe("function");
    });
  }
);

describe("bands · separation (step 9) — no config import, no customer-visible string", () => {
  it("bands.ts imports no path under src/lib/config/", () => {
    const importSpecifiers = [...SOURCE.matchAll(/\bfrom\s+["']([^"']+)["']/g)]
      .map((m) => m[1])
      .filter((s): s is string => s !== undefined);
    expect(importSpecifiers.length).toBeGreaterThan(0);
    for (const specifier of importSpecifiers) {
      expect(specifier).not.toMatch(/lib\/config/);
    }
  });

  it("bands.ts imports only the CopyKey type from the copy module — a type-only import", () => {
    expect(SOURCE).toMatch(/import\s+type\s*\{\s*CopyKey\s*\}\s*from\s*["']\.\/copy\/index\.ts["']/);
  });

  it("bands.ts contains no numeric literal in its code (comments stripped)", () => {
    const codeOnly = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(codeOnly).not.toMatch(/\d/);
  });

  // The list grows only with a stated reason, which is the whole point of
  // pinning it: ADR-001 point 4's guard is against a *flattened array of
  // the band terms* — a seventh copy through which a fourth term could
  // pass undetected — and not against a fifth handle→CopyKey map. Fifth
  // entry, 2026-09-06, issue #47: `PAGE_VERDICTS`, REQ-063's four words for
  // a published page's weekly standing. It is here rather than in a file of
  // its own for the same reason `LIMITING_LINES` is: §4.5's Overview,
  // §4.6's calendar and §12's Monday mail all speak those four words, and
  // one home is what stops a screen and a mail wording the same verdict
  // differently. It enumerates no band term and flattens nothing.
  it("bands.ts exports exactly BAND_LABELS, SCORE_BANDS, SEVERITY, LIMITING_LINES, PAGE_VERDICTS — no flattened array of the six band terms and no BAND_TERMS constant (ADR-001 point 4)", () => {
    const exportNames = [...SOURCE.matchAll(/^export\s+const\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
    expect(new Set(exportNames)).toEqual(
      new Set(["BAND_LABELS", "SCORE_BANDS", "SEVERITY", "LIMITING_LINES", "PAGE_VERDICTS"])
    );
  });
});
