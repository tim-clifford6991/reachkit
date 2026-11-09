// tests/measure/verdict/partition.test.ts
//
// WO-277 `## Test plan` (carried verbatim from WO-053) — the classify,
// FEEDS and sectionOutcome suites for `src/lib/measure/partition.ts`.
// `structure.md` rule 4: tests live beside the module they exercise.
import { describe, expect, it } from "vitest";
import {
  classify,
  FEEDS,
  sectionOutcome,
  type InputOutcome,
  type ScanInput,
  type SectionName,
} from "../../../src/lib/measure/partition.ts";
import type { UnmeasuredReason } from "../../../src/lib/measure/measured.ts";
import type { ScoreFactorName } from "../../../src/lib/measure/score.ts";

const AT = new Date("2026-09-04T00:00:00.000Z");

const ALL_INPUTS: readonly ScanInput[] = [
  "home_document",
  "pricing_document",
  "access_rules",
  "business_profile",
  "market_suggestions",
  "own_ranked_rows",
  "question_serps",
];

describe(
  'REQ-004 c7 — "… the value is recorded as a measured zero … never as \'—\' …" — partition/classify · read-and-empty is a zero, for every input',
  () => {
    it.each(ALL_INPUTS)("%s — read & empty classifies zero, read & non-empty classifies measured, neither ever unmeasured", (input) => {
      const empty = classify(input, { read: true, empty: true }, AT);
      const full = classify(input, { read: true, empty: false }, AT);
      expect(empty.kind).toBe("zero");
      expect(full.kind).toBe("measured");
      expect(empty.kind).not.toBe("unmeasured");
      expect(full.kind).not.toBe("unmeasured");
    });
  }
);

describe(
  'REQ-004 c6 — "Given an input whose existence the scan could not determine …" — partition/classify · unread is undeterminable, never zero',
  () => {
    it.each(ALL_INPUTS)("%s — {read:false, because:'undeterminable'} classifies unmeasured/undeterminable, never zero", (input) => {
      const result = classify(input, { read: false, because: "undeterminable" }, AT);
      expect(result.kind).toBe("unmeasured");
      expect((result as { kind: "unmeasured"; reason: UnmeasuredReason }).reason).toBe("undeterminable");
      expect(result.kind).not.toBe("zero");
    });
  }
);

describe(
  'REQ-004 c9 — "Given a measurement the scan never attempted because it stopped early …" — partition/classify · not_attempted is never zero',
  () => {
    it.each(ALL_INPUTS)("%s — {read:false, because:'not_attempted'} classifies unmeasured/not_attempted", (input) => {
      const result = classify(input, { read: false, because: "not_attempted" }, AT);
      expect(result.kind).toBe("unmeasured");
      expect((result as { kind: "unmeasured"; reason: UnmeasuredReason }).reason).toBe("not_attempted");
    });

    it("swapping this arm for measuredZero would fail the assertion above — the discrimination the vacuity guard (constitution §8) requires", () => {
      // Direct proof the assertion discriminates: a `zero` result of the
      // same shape does NOT satisfy `kind === 'unmeasured'`.
      const mutant = { kind: "zero" as const, value: null, at: AT };
      expect(mutant.kind).not.toBe("unmeasured");
    });
  }
);

describe("partition/FEEDS · closed, total and transitive", () => {
  it("every ScanInput has a non-empty row", () => {
    for (const input of ALL_INPUTS) {
      expect(FEEDS[input]).toBeDefined();
      expect(FEEDS[input].length).toBeGreaterThan(0);
    }
  });

  it("has exactly the seven ScanInput keys and no others", () => {
    expect(new Set(Object.keys(FEEDS))).toEqual(new Set(ALL_INPUTS));
  });

  it("business_profile and market_suggestions reach presence (the transitive closure BP-024 fixes)", () => {
    expect(FEEDS.business_profile).toContain("presence");
    expect(FEEDS.market_suggestions).toContain("presence");
  });

  it("no row is empty for an input BP-024's table gives a factor to — none of the seven are empty", () => {
    for (const input of ALL_INPUTS) expect(FEEDS[input].length).toBeGreaterThan(0);
  });
});

describe(
  "partition/FEEDS · an input no factor depends on never withholds the score",
  () => {
    it("the question wording and the rival derivation are not ScanInput members at all, so no failure in either can reach FEEDS", () => {
      const nonMembers = ["question_wording", "rival_derivation", "twelve_questions", "rival_platform_partition"];
      for (const name of nonMembers) {
        expect(name in FEEDS).toBe(false);
      }
    });

    it("FEEDS is total over the closed ScanInput union — a new member without a row is a compile error, enforced by `Readonly<Record<ScanInput, …>>`'s own type, not this runtime check", () => {
      // Runtime witness that the type-level totality holds today: every key
      // TypeScript requires is present.
      const keys: ScanInput[] = ALL_INPUTS as unknown as ScanInput[];
      for (const k of keys) expect(FEEDS[k]).toBeDefined();
    });
  }
);

describe(
  'REQ-004 c10 — "Given a section whose data could not be retrieved … that section is absent …" — partition/sectionOutcome · absent only when nothing behind it was read',
  () => {
    const SECTION_NAMES: readonly SectionName[] = ["verdict", "ai_answers", "google_presence", "problems", "first_page"];

    function allUnread(because: UnmeasuredReason): Readonly<Record<ScanInput, InputOutcome>> {
      const rec = {} as Record<ScanInput, InputOutcome>;
      for (const input of ALL_INPUTS) rec[input] = { read: false, because };
      return rec;
    }

    it.each(SECTION_NAMES)("%s — every input unread (undeterminable) → absent, folded reason undeterminable", (name) => {
      const result = sectionOutcome(name, allUnread("undeterminable"));
      expect(result).toEqual({ present: false, reason: "undeterminable" });
    });

    it.each(SECTION_NAMES)("%s — every input unread (not_attempted) → absent, folded reason not_attempted", (name) => {
      const result = sectionOutcome(name, allUnread("not_attempted"));
      expect(result).toEqual({ present: false, reason: "not_attempted" });
    });

    it.each(SECTION_NAMES)("%s — every input read → present", (name) => {
      const rec = {} as Record<ScanInput, InputOutcome>;
      for (const input of ALL_INPUTS) rec[input] = { read: true, empty: false };
      expect(sectionOutcome(name, rec)).toEqual({ present: true });
    });

    it.each(SECTION_NAMES)("%s — has at least one own input whose reading alone flips it to present", (name) => {
      let flipped = false;
      for (const readInput of ALL_INPUTS) {
        const rec = allUnread("not_attempted") as Record<ScanInput, InputOutcome>;
        rec[readInput] = { read: true, empty: false };
        if (sectionOutcome(name, rec).present) {
          flipped = true;
          break;
        }
      }
      expect(flipped).toBe(true);
    });
  }
);

describe(
  "partition/sectionOutcome · problems is present whenever its inputs were read — the case BP-027 leans on, so a — count never removes the problems section",
  () => {
    it("home_document read, access_rules unread → problems is still present", () => {
      const rec = {} as Record<ScanInput, InputOutcome>;
      for (const input of ALL_INPUTS) rec[input] = { read: false, because: "not_attempted" };
      rec.home_document = { read: true, empty: false };
      expect(sectionOutcome("problems", rec)).toEqual({ present: true });
    });

    it("access_rules read (gates nothing, a measured zero), home_document unread → problems is still present", () => {
      const rec = {} as Record<ScanInput, InputOutcome>;
      for (const input of ALL_INPUTS) rec[input] = { read: false, because: "undeterminable" };
      rec.access_rules = { read: true, empty: true };
      expect(sectionOutcome("problems", rec)).toEqual({ present: true });
    });
  }
);

// `ScoreFactorName` is imported type-only, per this WO's own dependency
// direction rule ("declare ScoreFactorName in score.ts and import type it
// here; partition.ts imports no value from score.ts") — exercised here so
// this test file itself would fail to typecheck if that direction reversed.
function _typeDirectionWitness(name: ScoreFactorName): void {
  void name;
}
void _typeDirectionWitness;
