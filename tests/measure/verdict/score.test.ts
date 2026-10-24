// tests/measure/verdict/score.test.ts
//
// WO-277 `## Test plan` (carried verbatim from WO-054) — the arithmetic and
// ADR-021 suites for `src/lib/measure/score.ts`. `structure.md` rule 4.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SCORING } from "@/lib/config/constants";
import { measured, measuredZero, unmeasured } from "../../../src/lib/measure/measured.ts";
import { searchPresenceOf, searchPresenceRangeOf } from "../../../src/lib/measure/drivers.ts";
import { FEEDS, type InputOutcome, type ScanInput } from "../../../src/lib/measure/partition.ts";
import { verdictOf } from "../../../src/lib/measure/verdict.ts";
import type { CanonicalDomain } from "../../../src/lib/scan/domain.ts";
import {
  computeScore,
  estimateOf,
  factorsOf,
  limitingFactorOf,
  NO_AI_ANSWERS,
  presenceOf,
  presenceRangeOf,
  type Drivers,
  type ScoreFactors,
} from "../../../src/lib/measure/score.ts";

const AT = new Date("2026-09-04T00:00:00.000Z");
const SOURCE_PATH = path.resolve(import.meta.dirname, "../../../src/lib/measure/score.ts");
const CONSTANTS_MODULE = "@/lib/config/constants";
const SCORE_MODULE = "../../../src/lib/measure/score.ts";

function factors(f: ScoreFactors): ScoreFactors {
  return f;
}

describe(
  'REQ-004 c1 — "… the first module shows a single score on a 0–100 scale, its band …" — score/compute · one number on a 0–100 scale with one band handle',
  () => {
    const VALUES = [1, 25, 50, 75, 100];
    const cases: ScoreFactors[] = [];
    for (const foundations of VALUES)
      for (const answerability of VALUES)
        for (const presence of VALUES)
          cases.push(
            factors({
              foundations: measured(foundations, AT),
              answerability: measured(answerability, AT),
              presence: measured(presence, AT),
            })
          );

    it.each(cases.map((f, i) => [i, f] as const))("case %i — measured result in [0,100] with a valid band handle", (_i, f) => {
      const result = computeScore(f);
      expect(result.kind).not.toBe("unmeasured");
      const { score, band } = (result as { kind: "measured" | "zero"; value: { score: number; band: string } }).value;
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(["invisible", "hard-to-find", "findable", "dominant"]).toContain(band);
    });
  }
);

describe(
  'REQ-004 c3 — "… the first module shows \'—\' in place of the score, shows no band word at all …" — score/compute · one unmeasured factor makes an unmeasured score, for every combination',
  () => {
    const factorSamples = {
      unmeasured_u: unmeasured<number>("undeterminable", AT),
      unmeasured_n: unmeasured<number>("not_attempted", AT),
      measured_low: measured(1, AT),
      measured_high: measured(100, AT),
      zero: measuredZero(0, AT),
    };
    const keys = Object.keys(factorSamples) as (keyof typeof factorSamples)[];

    const arrangements: [keyof typeof factorSamples, keyof typeof factorSamples, keyof typeof factorSamples][] = [];
    for (const a of keys) for (const b of keys) for (const c of keys) arrangements.push([a, b, c]);
    const withUnmeasured = arrangements.filter(([a, b, c]) => [a, b, c].some((k) => k.startsWith("unmeasured")));

    it(`covers every arrangement with at least one unmeasured factor (${withUnmeasured.length} cases) — must fail first`, () => {
      expect(withUnmeasured.length).toBeGreaterThan(0);
    });

    it.each(withUnmeasured)("[%s, %s, %s] → unmeasured, no score field, no band field", (a, b, c) => {
      const f = factors({
        foundations: factorSamples[a],
        answerability: factorSamples[b],
        presence: factorSamples[c],
      });
      const result = computeScore(f);
      expect(result.kind).toBe("unmeasured");
      expect("value" in result).toBe(false);
    });
  }
);

describe(
  'REQ-004 c9 — "… the score itself is shown as \'—\' … never computed, banded or estimated from the drivers that were measured …" — score/compute · the ceiling case yields no number',
  () => {
    it("Foundations and Answerability measured, Presence unmeasured/not_attempted (ADR-021's exact scenario) → unmeasured/not_attempted — must fail first", () => {
      const f = factors({
        foundations: measured(80, AT),
        answerability: measured(90, AT),
        presence: unmeasured("not_attempted", AT),
      });
      const result = computeScore(f);
      expect(result.kind).toBe("unmeasured");
      expect((result as { kind: "unmeasured"; reason: string }).reason).toBe("not_attempted");
    });

    it("ADR-021 — computeScore takes exactly one parameter", () => {
      expect(computeScore.length).toBe(1);
    });

    it("ADR-021 — no exported symbol of score.ts accepts a flag, option or second argument that would produce a partial score", () => {
      const source = readFileSync(SOURCE_PATH, "utf8");
      for (const forbidden of ["partial", "provisional", "force", "allowIncomplete"]) {
        expect(source.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }
    });
  }
);

describe(
  'REQ-004 c7 — "… the value is recorded as a measured zero … never as \'—\' …" — score/compute · a read generic noindex scores 0, by arithmetic and not by override',
  () => {
    it("Foundations measured 0, Answerability and Presence at their floors → score measured 0, band invisible", () => {
      const f = factors({
        foundations: measured(0, AT),
        answerability: measured(1, AT),
        presence: measured(1, AT),
      });
      const result = computeScore(f);
      expect(result.kind).toBe("measured");
      const { score, band } = (result as { kind: "measured"; value: { score: number; band: string } }).value;
      expect(score).toBe(0);
      expect(band).toBe("invisible");
    });

    it("carries no special case keyed on 0 or on noindex — the arithmetic alone produces 0", () => {
      // Comment-stripped: the source legitimately explains, in prose, that
      // "a read generic noindex is a measured 0" and that no special case
      // exists for it — only the actual code must be free of the word and
      // of a literal zero-guard.
      const source = readFileSync(SOURCE_PATH, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(source.toLowerCase()).not.toContain("noindex");
      // No literal `=== 0` / `== 0` guard on a factor value anywhere.
      expect(source).not.toMatch(/===?\s*0\b/);
    });
  }
);

describe(
  'REQ-004 c8 — "… that absence is recorded as a measured zero, never as a measurement that could not be taken." — score/presenceOf · a cold-start domain scores, honestly, low',
  () => {
    it("searchPresence and aiPresence both zero → presenceOf is measured/zero, floored at 1, never unmeasured, and computeScore over it returns a number", () => {
      const presence = presenceOf({ searchPresence: measuredZero(0, AT), aiPresence: measuredZero(0, AT) });
      expect(presence.kind).not.toBe("unmeasured");
      expect((presence as { kind: "measured" | "zero"; value: number }).value).toBe(1);

      const result = computeScore(
        factors({ foundations: measured(50, AT), answerability: measured(50, AT), presence })
      );
      expect(result.kind).not.toBe("unmeasured");
    });
  }
);

describe(
  'REQ-004 c2 — "… one written line beside it names the one driver … whose measurement holds the score down the most … without stating that driver\'s value …" — score/limitingFactorOf · one handle, never a value',
  () => {
    it.each([
      [{ foundations: 10, answerability: 50, presence: 50 }, "foundations"],
      [{ foundations: 50, answerability: 10, presence: 50 }, "answerability"],
      [{ foundations: 50, answerability: 50, presence: 10 }, "presence"],
      // Ties break foundations → answerability → presence.
      [{ foundations: 10, answerability: 10, presence: 90 }, "foundations"],
      [{ foundations: 90, answerability: 10, presence: 10 }, "answerability"],
      [{ foundations: 10, answerability: 10, presence: 10 }, "foundations"],
    ] as const)("factors %o → limiting factor %s", (values, expected) => {
      const f = factors({
        foundations: measured(values.foundations, AT),
        answerability: measured(values.answerability, AT),
        presence: measured(values.presence, AT),
      });
      const result = limitingFactorOf(f);
      expect(result).toEqual({ kind: "factor", factor: expected });
    });

    it("any factor unmeasured → { kind: 'none', because: 'score_unmeasured' }", () => {
      const f = factors({
        foundations: measured(50, AT),
        answerability: unmeasured("undeterminable", AT),
        presence: measured(50, AT),
      });
      expect(limitingFactorOf(f)).toEqual({ kind: "none", because: "score_unmeasured" });
    });

    it("every factor at 100 (the ceiling) → { kind: 'none', because: 'at_ceiling' }", () => {
      const f = factors({
        foundations: measured(100, AT),
        answerability: measured(100, AT),
        presence: measured(100, AT),
      });
      expect(limitingFactorOf(f)).toEqual({ kind: "none", because: "at_ceiling" });
    });

    it("type-level: LimitingFactor has no numeric field at all", () => {
      // The `{ kind: 'factor'; factor: ScoreFactorName }` arm carries a
      // handle string, never a number; the `{ kind: 'none'; because }` arm
      // carries only the two named reasons. Witnessed by exhaustive
      // property access below, which fails to compile if a numeric field
      // is ever added to either arm.
      const result = limitingFactorOf(
        factors({ foundations: measured(10, AT), answerability: measured(50, AT), presence: measured(50, AT) })
      );
      if (result.kind === "factor") {
        const keys = Object.keys(result);
        expect(keys.sort()).toEqual(["factor", "kind"]);
      }
    });

    it("no export of score.ts returns a ScoreFactors to a caller outside verdict.ts — every call site of factorsOf in this repo's src/ is inside verdict.ts", () => {
      const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
      let matches = "";
      try {
        matches = execFileSync("grep", ["-rl", "factorsOf(", path.join(REPO_ROOT, "src")], { encoding: "utf8" });
      } catch {
        matches = "";
      }
      const files = matches.split("\n").filter(Boolean);
      for (const file of files) {
        expect(file.endsWith("src/lib/measure/verdict.ts") || file.endsWith("src/lib/measure/score.ts")).toBe(true);
      }
    });

    it("score/factorsOf · four measured quantities become exactly three factors", () => {
      const drivers: Drivers = {
        foundations: measured(80, AT),
        answerability: measured(90, AT),
        searchPresence: measured(60, AT),
        aiPresence: measured(40, AT),
      };
      const result = factorsOf(drivers);
      expect(new Set(Object.keys(result))).toEqual(new Set(["foundations", "answerability", "presence"]));
      expect("searchPresence" in result).toBe(false);
      expect("aiPresence" in result).toBe(false);
    });
  }
);

describe(
  'REQ-004 c12 — "… nothing stands in its place: no estimate, no interpolated value, no default …" — score/floors · a floor never manufactures a value',
  () => {
    it("an unread half is the middle of its scale, never the best case, so the figure sits inside its range (issue 1439)", () => {
      const noSearch = { searchPresence: unmeasured<number>("not_attempted", AT), aiPresence: measured(20, AT) };
      expect(presenceOf(noSearch)).toEqual({ kind: "measured", value: 0.5 * 50 + 0.5 * 20, at: AT });
      expect(presenceRangeOf(noSearch)).toEqual({ low: 10, high: 60 });
      const noAi = { searchPresence: measured(100, AT), aiPresence: unmeasured<number>("undeterminable", AT) };
      expect(presenceOf(noAi)).toEqual({ kind: "measured", value: 0.5 * 100 + 0.5 * 50.5, at: AT });
      expect(presenceRangeOf(noAi)).toEqual({ low: 50.5, high: 100 });
    });

    it("with neither half read Presence is mid-range, never a floor", () => {
      const neither = { searchPresence: unmeasured<number>("not_attempted", AT), aiPresence: unmeasured<number>("undeterminable", AT) };
      expect(presenceRangeOf(neither)).toEqual({ low: 1, high: 100 });
      expect(presenceOf(neither)).toEqual({ kind: "measured", value: 0.5 * 50 + 0.5 * 50.5, at: AT });
    });

    it("factorsOf's answerability path over an unmeasured Drivers.answerability stays unmeasured — the floor never applies", () => {
      const drivers: Drivers = {
        foundations: measured(50, AT),
        answerability: unmeasured("not_attempted", AT),
        searchPresence: measured(50, AT),
        aiPresence: measured(50, AT),
      };
      const result = factorsOf(drivers);
      expect(result.answerability.kind).toBe("unmeasured");
    });

    it("the floor of 1 applies only on measured and zero arms — an answerability of 0 (measured) floors to 1", () => {
      const drivers: Drivers = {
        foundations: measured(50, AT),
        answerability: measured(0, AT),
        searchPresence: measured(50, AT),
        aiPresence: measured(50, AT),
      };
      const result = factorsOf(drivers);
      expect(result.answerability.kind).not.toBe("unmeasured");
      expect((result.answerability as { value: number }).value).toBeGreaterThanOrEqual(1);
    });
  }
);

describe(
  "WO-251 — the answerability floor `factorsOf` applies is the pinned SCORING.answerabilityFloor, not the literal 1",
  () => {
    it("an answerability of 0 (measured) floors to SCORING.answerabilityFloor, asserted against the pin", () => {
      const drivers: Drivers = {
        foundations: measured(50, AT),
        answerability: measured(0, AT),
        searchPresence: measured(50, AT),
        aiPresence: measured(50, AT),
      };
      const result = factorsOf(drivers);
      expect((result.answerability as { value: number }).value).toBe(SCORING.answerabilityFloor);
    });
  }
);

describe(
  'BP-005 `SCORING` comment — "`PRESENCE_FLOOR` is deliberately not a fourth member, and unifying it with `answerabilityFloor` would be a defect wearing a cleanup\'s clothes." — the two floors are separate numbers that happen to be equal',
  () => {
    it("score.ts still declares its own local PRESENCE_FLOOR, and presenceOf's body reads it, not SCORING", () => {
      const source = readFileSync(SOURCE_PATH, "utf8");
      expect(source).toMatch(/const\s+PRESENCE_FLOOR\s*=\s*1\s*;/);
      const fnMatch = source.match(/export function presenceOf\([\s\S]*?\n}\n/);
      expect(fnMatch).not.toBeNull();
      const body = (fnMatch as RegExpMatchArray)[0];
      expect(body).toMatch(/\bPRESENCE_FLOOR\b/);
      expect(body).not.toMatch(/\bSCORING\b/);
    });

    it("mutation guard: stubbing SCORING.answerabilityFloor to 2 moves factorsOf's answerability and leaves presenceOf's output unmoved — the 'cleanup' that points presenceOf at SCORING fails this pair", async () => {
      vi.resetModules();
      vi.doMock(CONSTANTS_MODULE, async (importOriginal) => {
        const actual = await importOriginal<Record<string, unknown>>();
        return {
          ...actual,
          SCORING: { ...(actual.SCORING as Record<string, unknown>), answerabilityFloor: 2 },
        };
      });
      const stubbed = await import(SCORE_MODULE);
      const drivers: Drivers = {
        foundations: measured(50, AT),
        answerability: measured(0, AT),
        searchPresence: measured(0, AT),
        aiPresence: measured(0, AT),
      };
      const result = stubbed.factorsOf(drivers) as ScoreFactors;
      // Answerability moves with the stubbed pin.
      expect((result.answerability as { value: number }).value).toBe(2);
      // Presence does not — PRESENCE_FLOOR is untouched by the pin.
      expect((result.presence as { value: number }).value).toBe(1);
      vi.doUnmock(CONSTANTS_MODULE);
      vi.resetModules();
    });
  }
);

describe("the Google half's range is the Wilson interval of its share, and its sample decides a thin estimate", () => {
  const card = (top10Count: number, measuredSearches: number) => ({ measuredSearches, you: { top10Count } });
  const rounded = (r: { low: number; high: number } | null) => (r === null ? null : { low: Math.round(r.low), high: Math.round(r.high) });

  it("is 0–49 over 0 of 4, 0–79 over 0 of 1, 76–100 over 12 of 12, and holds the share over 2 of 5", () => {
    expect(rounded(searchPresenceRangeOf(card(0, 4)))).toEqual({ low: 0, high: 49 });
    expect(rounded(searchPresenceRangeOf(card(0, 1)))).toEqual({ low: 0, high: 79 });
    expect(rounded(searchPresenceRangeOf(card(12, 12)))).toEqual({ low: 76, high: 100 });
    const twoOfFive = searchPresenceRangeOf(card(2, 5));
    expect(twoOfFive?.low).toBeLessThan(40);
    expect(twoOfFive?.high).toBeGreaterThan(40);
  });

  it("is absent with no card or no measured search: an unread half keeps the whole scale, a stored driver its point", () => {
    expect(searchPresenceRangeOf(null)).toBeNull();
    expect(searchPresenceRangeOf(card(0, 0))).toBeNull();
    const noAnswers = unmeasured<number>("undeterminable", AT, NO_AI_ANSWERS);
    expect(presenceRangeOf({ searchPresence: unmeasured("not_attempted", AT), aiPresence: noAnswers }, null, null)).toEqual({ low: 1, high: 100 });
    expect(presenceRangeOf({ searchPresence: measured(40, AT), aiPresence: noAnswers }, null, null)).toEqual({ low: 40, high: 40 });
  });

  // Foundations 100, Content 30, AI answered none of the searches read, and
  // the Google half counted over `measuredSearches`: what `verdictOf` does
  // with a card's range.
  const estimateFor = (top10Count: number, measuredSearches: number, aiRead: number) => {
    const drivers: Drivers = {
      foundations: measured(100, AT),
      answerability: measured(30, AT),
      searchPresence: searchPresenceOf({ card: card(top10Count, measuredSearches), serps: [], at: AT }),
      aiPresence: unmeasured("undeterminable", AT, NO_AI_ANSWERS),
    };
    const f = factorsOf(drivers);
    const range = searchPresenceRangeOf(card(top10Count, measuredSearches));
    return { score: computeScore(f), estimate: estimateOf(f, presenceRangeOf(drivers, null, range), range?.read ?? aiRead) };
  };

  it("on page one for 0 of 4 searches scores 14 with an estimate of 14–53, rough", () => {
    const { score, estimate } = estimateFor(0, 4, 12);
    expect(score.kind !== "unmeasured" && score.value.score).toBe(14);
    expect(estimate).toEqual({ low: 14, high: 53, confidence: "rough" });
  });

  it("twelve measured searches are no thin sample, however few AI results were read", () => {
    const v = verdictOf({
      domain: "example.com" as CanonicalDomain,
      measuredAt: AT,
      drivers: {
        foundations: measured(100, AT),
        answerability: measured(30, AT),
        searchPresence: searchPresenceOf({ card: card(12, 12), serps: [], at: AT }),
        aiPresence: unmeasured("undeterminable", AT, NO_AI_ANSWERS),
      },
      inputs: Object.fromEntries(Object.keys(FEEDS).map((input) => [input, { read: true, empty: false }])) as Record<ScanInput, InputOutcome>,
      robots: unmeasured("not_attempted", AT),
      searchRange: searchPresenceRangeOf(card(12, 12)),
      searchesRead: 3,
    });
    expect(v.estimate?.confidence).toBe("close");
  });
});
