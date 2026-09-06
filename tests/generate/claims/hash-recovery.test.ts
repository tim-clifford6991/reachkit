// tests/generate/claims/hash-recovery.test.ts — the list hash, and
// DECISIONS 2026-08-31 ADR-070's one recovery rule.
//
// The hash is what makes "is this check still current?" answerable without
// a stored flag: re-ordering or re-casing a list is not a change, and
// adding an entry is. The recovery rule is pure and is enumerated
// exhaustively below, because its one dangerous case — a draft in review
// that fails a re-check — looks identical in the data to the ordinary one.
import "../env";
import { describe, expect, it } from "vitest";
import { GENERATION } from "../../../src/lib/config/constants";
import { listHash, normaliseList } from "../../../src/lib/generate/claims/hash";
import { recoveryOutcome } from "../../../src/lib/generate/claims/recovery";
import type { HardRule } from "../../../src/lib/generate/rules/types";

describe("listHash — one definition, used by the writer of a verdict and the reader of the guard", () => {
  const list = ["HIPAA compliant", "Fastest on the market"];

  it("re-ordering the list gives one hash", () => {
    expect(listHash([...list].reverse())).toBe(listHash(list));
  });

  it("re-casing and re-spacing an entry gives one hash", () => {
    expect(listHash(["hipaa  compliant", "  FASTEST ON THE MARKET "])).toBe(listHash(list));
  });

  it("adding an entry changes it", () => {
    expect(listHash([...list, "SOC 2 certified"])).not.toBe(listHash(list));
  });

  it("removing an entry changes it", () => {
    expect(listHash([list[0]!])).not.toBe(listHash(list));
  });

  it("the empty list has a stable hash of its own", () => {
    expect(listHash([])).toBe(listHash([]));
    expect(listHash([])).not.toBe(listHash(list));
  });

  it("blank entries are not entries", () => {
    expect(listHash(["", "   ", ...list])).toBe(listHash(list));
    expect(normaliseList(["", "  "])).toEqual([]);
  });
});

describe("recoveryOutcome — one automatic regeneration, and never after review", () => {
  it("§8's 'twice = needs-attention' is one regeneration, and that is the pin", () => {
    expect(GENERATION.regenerations).toBe(1);
  });

  const failed: HardRule[] = ["near_duplicate"];

  it("a pre-review draft failing a rule with no automatic attempt yet regenerates once", () => {
    expect(recoveryOutcome({ failed, automaticAttempts: 0, enteredReview: false })).toBe(
      "regenerate_once"
    );
  });

  it("the same draft after one automatic attempt rests", () => {
    expect(recoveryOutcome({ failed, automaticAttempts: 1, enteredReview: false })).toBe("rest");
  });

  it("a draft that has entered review rests, at zero attempts — the case that looks identical in the data", () => {
    expect(recoveryOutcome({ failed, automaticAttempts: 0, enteredReview: true })).toBe("rest");
  });

  it("a draft in review that failed the do-not-claim rule rests too: regenerating would destroy text the customer has read", () => {
    expect(
      recoveryOutcome({ failed: ["do_not_claim"], automaticAttempts: 0, enteredReview: true })
    ).toBe("rest");
  });

  it("every combination of the three inputs is settled", () => {
    const table: Array<[number, boolean, string]> = [
      [0, false, "regenerate_once"],
      [1, false, "rest"],
      [2, false, "rest"],
      [0, true, "rest"],
      [1, true, "rest"],
      [2, true, "rest"],
    ];
    for (const [automaticAttempts, enteredReview, expected] of table) {
      expect(recoveryOutcome({ failed, automaticAttempts, enteredReview })).toBe(expected);
    }
  });

  it("nothing failed is nothing to recover from", () => {
    expect(recoveryOutcome({ failed: [], automaticAttempts: 0, enteredReview: false })).toBe("rest");
  });

  it("it is pure: it imports no store, no clock, no pipeline and no publishing engine", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/lib/generate/claims/recovery.ts"),
      "utf8"
    );
    const imports = [...source.matchAll(/^import .*?from "(.*?)";$/gm)].map((match) => match[1]);
    expect(imports).toEqual(["@/lib/config/constants", "../rules/types"]);
    expect(source).not.toContain("new Date(");
  });
});
