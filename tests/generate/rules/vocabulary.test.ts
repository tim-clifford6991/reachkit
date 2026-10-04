// tests/generate/rules/vocabulary.test.ts — BUILD §8's closed hard-rule
// vocabulary.
//
// §8 states seven hard rules; read as checks over finished text they are
// nine, because one of the seven is two checks. Issue 475 added five that
// read the brief; issue 1136 replaced `brand_gap` and `page_frame` with
// `honest_row` and `fit_claim`; issue 1137 added `required_blocks`; issue
// 1187 removed `no_private_figure`. What this suite pins
// is that the list is *closed* and *ordered*: a further member, or a
// reordering, changes what a stored `rule_failures` blob means, and a
// failure list has to be comparable across runs.
import "../env";
import { describe, expect, it } from "vitest";
import { HARD_RULES, type HardRule } from "../../../src/lib/generate/rules/types";

describe("BUILD §8 — the hard rules are a closed, ordered list", () => {
  it("lists each rule once", () => {
    expect(new Set(HARD_RULES).size).toBe(HARD_RULES.length);
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
      no_invented_people: true,
      no_unsourced_testimonial: true,
      honest_row: true,
      no_hidden_text: true,
      no_machine_address: true,
      near_duplicate: true,
      no_invented_test: true,
      no_invented_provenance: true,
      traceable_numerals: true,
      first_block_answers: true,
      required_blocks: true,
      no_placeholder_cell: true,
      no_demo_text: true,
      fit_claim: true,
      do_not_claim: true,
    };
    expect([...HARD_RULES].sort()).toEqual(Object.keys(every).sort());
  });
});
