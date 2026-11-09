// tests/measure/verdict/measured.test.ts
//
// WO-277 `## Test plan` (carried verbatim from WO-052) — the constructor,
// map, combine and worseReason suites for `src/lib/measure/measured.ts`.
// `structure.md` rule 4: tests live beside the module they exercise.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  combine,
  mapMeasured,
  measured,
  measuredZero,
  unmeasured,
  worseReason,
  type Measured,
  type UnmeasuredReason,
} from "../../../src/lib/measure/measured.ts";

const AT = new Date("2026-09-04T00:00:00.000Z");
const OTHER_AT = new Date("2026-09-01T00:00:00.000Z");

const SOURCE_PATH = path.resolve(import.meta.dirname, "../../../src/lib/measure/measured.ts");

describe(
  'REQ-004 c12 — "… then nothing stands in its place: no estimate, no interpolated value, no default … Every number the report shows and the product stores comes from the scan whose measurement date the report carries." — measured/constructors · there is no way to make a value out of nothing',
  () => {
    const SOURCE = readFileSync(SOURCE_PATH, "utf8");
    // Comment-stripped view — prose (e.g. "There is no `Measured.of(...)`")
    // legitimately uses these English words to say a thing does NOT exist;
    // only the actual code should be free of them.
    const CODE_ONLY = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    it("exports exactly the eight named symbols BP-024's public interface declares", () => {
      const exportNames = [...SOURCE.matchAll(/^export\s+(?:type|function|const)\s+([A-Za-z_$][\w$]*)/gm)].map(
        (m) => m[1]
      );
      expect(new Set(exportNames)).toEqual(
        new Set(["Measured", "UnmeasuredReason", "measured", "measuredZero", "unmeasured", "mapMeasured", "combine", "worseReason"])
      );
      expect(exportNames).toHaveLength(8);
    });

    it.each(["of", "fromNullable", "orElse", "getOrDefault", "unwrap"])(
      "declares no escape-hatch named `%s`",
      (name) => {
        // A declaration or export of that exact name — not the bare word,
        // which for `of` also matches every idiomatic `for (… of …)` loop.
        const declaration = new RegExp(`\\b(?:function|const)\\s+${name}\\b|\\bexport\\s*\\{[^}]*\\b${name}\\b`);
        expect(declaration.test(CODE_ONLY)).toBe(false);
      }
    );

    // Type-level negatives — never invoked at runtime. `npm run typecheck`
    // is the enforcement: if a guard weakens, one of these lines stops
    // producing an error and its own `@ts-expect-error` directive becomes
    // an "unused directive" type error, failing the build (file plan step 7).
    function _typeLevelNegatives(): void {
      // @ts-expect-error — `measured` requires an `at: Date` second argument; there is no one-argument overload.
      measured(5);
      // @ts-expect-error — `measuredZero` requires an `at: Date` second argument.
      measuredZero(0);
      // @ts-expect-error — `unmeasured`'s first argument must be a valid `UnmeasuredReason` string literal, not a `Date`.
      unmeasured(new Date(), new Date());
      // @ts-expect-error — `unmeasured`'s first argument is not any string; `'nope'` is not a member of `UnmeasuredReason`.
      unmeasured("nope", new Date());
    }
    void _typeLevelNegatives;

    it("documents the four @ts-expect-error assertions above; `npm run typecheck` is what discriminates a weakened guard, not this runtime assertion", () => {
      expect(typeof _typeLevelNegatives).toBe("function");
    });
  }
);

describe("measured/map · never fabricates", () => {
  it("mapMeasured over a measured value applies f and preserves `at`", () => {
    const f = vi.fn((n: number) => n * 2);
    const result = mapMeasured(measured(3, AT), f);
    expect(result).toEqual({ kind: "measured", value: 6, at: AT });
    expect(f).toHaveBeenCalledWith(3);
  });

  it("mapMeasured over a zero value applies f and preserves `at` and the `zero` kind", () => {
    const f = vi.fn((n: number) => n * 2);
    const result = mapMeasured(measuredZero(0, AT), f);
    expect(result).toEqual({ kind: "zero", value: 0, at: AT });
  });

  it("mapMeasured over an unmeasured value returns unmeasured with the same reason and the same `at`, and never calls f", () => {
    const f = vi.fn((n: number) => n * 2);
    const input = unmeasured<number>("undeterminable", AT);
    const result = mapMeasured(input, f);
    expect(result).toEqual({ kind: "unmeasured", reason: "undeterminable", at: AT });
    expect(f).not.toHaveBeenCalled();
  });
});

describe(
  'REQ-004 c6 — "… every driver depending on it is recorded as \'—\' … the score is shown as \'—\' only where a driver it is composed of depended on that input." — measured/combine · one undeterminable part makes the whole undeterminable',
  () => {
    type Sample = { label: string; m: Measured<number> };
    const SAMPLES: Sample[] = [
      { label: "measured(1)", m: measured(1, AT) },
      { label: "zero(0)", m: measuredZero(0, AT) },
      { label: "unmeasured/not_attempted", m: unmeasured("not_attempted", AT) },
      { label: "unmeasured/undeterminable", m: unmeasured("undeterminable", AT) },
    ];

    const arrangements: Sample[][] = [];
    for (const a of SAMPLES) for (const b of SAMPLES) for (const c of SAMPLES) arrangements.push([a, b, c]);
    const withUndeterminable = arrangements.filter((arr) => arr.some((s) => s.m.kind === "unmeasured" && s.m.reason === "undeterminable"));

    it(`covers every 3-part arrangement with at least one undeterminable part (${withUndeterminable.length} cases)`, () => {
      expect(withUndeterminable.length).toBeGreaterThan(0);
    });

    it.each(withUndeterminable.map((arr) => [arr.map((s) => s.label).join(" + "), arr] as const))(
      "%s → unmeasured/undeterminable, f never called",
      (_label, arr) => {
        const f = vi.fn();
        const parts = arr.map((s) => s.m) as [Measured<number>, Measured<number>, Measured<number>];
        const result = combine(parts, f);
        expect(result.kind).toBe("unmeasured");
        expect((result as { kind: "unmeasured"; reason: UnmeasuredReason }).reason).toBe("undeterminable");
        expect(f).not.toHaveBeenCalled();
      }
    );
  }
);

describe(
  'REQ-004 c9 — "… it is never shown or recorded as 0 … never computed, banded or estimated from the drivers that were measured." — measured/combine · not_attempted propagates and never becomes zero',
  () => {
    type Sample = { label: string; m: Measured<number> };
    const SAMPLES: Sample[] = [
      { label: "measured(1)", m: measured(1, AT) },
      { label: "zero(0)", m: measuredZero(0, AT) },
      { label: "unmeasured/not_attempted", m: unmeasured("not_attempted", AT) },
    ];

    const arrangements: Sample[][] = [];
    for (const a of SAMPLES) for (const b of SAMPLES) for (const c of SAMPLES) arrangements.push([a, b, c]);
    const withNotAttempted = arrangements.filter((arr) => arr.some((s) => s.m.kind === "unmeasured"));

    it.each(withNotAttempted.map((arr) => [arr.map((s) => s.label).join(" + "), arr] as const))(
      "%s → unmeasured/not_attempted, never 0, never zero-kind",
      (_label, arr) => {
        const f = vi.fn();
        const parts = arr.map((s) => s.m) as [Measured<number>, Measured<number>, Measured<number>];
        const result = combine(parts, f);
        expect(result.kind).toBe("unmeasured");
        expect((result as { kind: "unmeasured"; reason: UnmeasuredReason }).reason).toBe("not_attempted");
        expect(result).not.toBe(0);
        expect(result.kind).not.toBe("zero");
      }
    );
  }
);

describe("measured/combine · a zero is a value", () => {
  it("combine over parts that are all zero calls f with the zero values and never returns unmeasured", () => {
    const f = vi.fn((values: readonly [number, number]) => values[0] + values[1]);
    const result = combine([measuredZero(0, AT), measuredZero(0, AT)] as const, f);
    expect(f).toHaveBeenCalledWith([0, 0]);
    expect(result.kind).not.toBe("unmeasured");
  });

  it("a zero part never turns the whole into a dash — mixed zero + measured combines", () => {
    const f = vi.fn((values: readonly [number, number]) => values[0] + values[1]);
    const result = combine([measuredZero(0, AT), measured(5, AT)] as const, f);
    expect(result.kind).not.toBe("unmeasured");
    expect(f).toHaveBeenCalledWith([0, 5]);
  });
});

describe("BP-024 decision 3 — measured/worseReason · undeterminable outranks not_attempted", () => {
  it.each([
    ["undeterminable", "undeterminable", "undeterminable"],
    ["undeterminable", "not_attempted", "undeterminable"],
    ["not_attempted", "undeterminable", "undeterminable"],
    ["not_attempted", "not_attempted", "not_attempted"],
  ] as const)("worseReason(%s, %s) === %s", (a, b, expected) => {
    expect(worseReason(a, b)).toBe(expected);
  });

  it("is commutative", () => {
    const reasons: UnmeasuredReason[] = ["undeterminable", "not_attempted"];
    for (const a of reasons) for (const b of reasons) expect(worseReason(a, b)).toBe(worseReason(b, a));
  });

  it("is idempotent", () => {
    const reasons: UnmeasuredReason[] = ["undeterminable", "not_attempted"];
    for (const a of reasons) expect(worseReason(a, a)).toBe(a);
  });
});

describe("measured/constructors · basic shape", () => {
  it("measured() produces the measured arm carrying value and at", () => {
    expect(measured("v", AT)).toEqual({ kind: "measured", value: "v", at: AT });
  });
  it("measuredZero() produces the zero arm carrying value and at", () => {
    expect(measuredZero(0, AT)).toEqual({ kind: "zero", value: 0, at: AT });
  });
  it("unmeasured() produces the unmeasured arm carrying reason and at, never a value", () => {
    const m = unmeasured("undeterminable", AT);
    expect(m).toEqual({ kind: "unmeasured", reason: "undeterminable", at: AT });
    expect("value" in m).toBe(false);
  });
  it("at is read from the caller, never a clock — two constructions with different `at` differ only in `at`", () => {
    expect(measured(1, AT).at).toBe(AT);
    expect(measured(1, OTHER_AT).at).toBe(OTHER_AT);
  });
});
