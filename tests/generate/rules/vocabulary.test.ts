// tests/generate/rules/vocabulary.test.ts — BUILD §8's closed hard-rule
// vocabulary.
//
// §8 states seven hard rules; read as checks over finished text they are
// ten, because three of the seven are two checks each. What this suite
// pins is that the list is *closed* and *ordered*: an eleventh member, or a
// reordering, changes what a stored `rule_failures` blob means, and a
// failure list has to be comparable across runs.
import "../env";
import { describe, expect, it } from "vitest";
import { HARD_RULES, type HardRule } from "../../../src/lib/generate/rules/types";

describe("BUILD §8 — the hard rules are a closed, ordered list", () => {
  it("has exactly ten members and lists each once", () => {
    expect(HARD_RULES).toHaveLength(10);
    expect(new Set(HARD_RULES).size).toBe(10);
  });

  it("is in the order §8 states the rules, with the two-check rules split where they split", () => {
    expect([...HARD_RULES]).toEqual([
      "grounding",
      "rival_source",
      "no_private_figure",
      "no_invented_people",
      "no_unsourced_testimonial",
      "brand_gap",
      "no_hidden_text",
      "no_machine_address",
      "near_duplicate",
      "do_not_claim",
    ]);
  });

  it("is frozen, so no caller can add a rule at runtime", () => {
    expect(Object.isFrozen(HARD_RULES)).toBe(true);
  });

  it("covers every member of the `HardRule` union — a union member absent from the list would never run", () => {
    // Total by construction: a `Record<HardRule, true>` is a compile error
    // if a member is missing, and the runtime check below is a compile
    // error if the list and the union disagree.
    const every: Record<HardRule, true> = {
      grounding: true,
      rival_source: true,
      no_private_figure: true,
      no_invented_people: true,
      no_unsourced_testimonial: true,
      brand_gap: true,
      no_hidden_text: true,
      no_machine_address: true,
      near_duplicate: true,
      do_not_claim: true,
    };
    expect([...HARD_RULES].sort()).toEqual(Object.keys(every).sort());
  });
});
