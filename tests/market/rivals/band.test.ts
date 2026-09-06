// tests/market/rivals/band.test.ts — BUILD §6.6
//
// The two bars, read from the pins rather than restated, and the two
// properties §6.6's cold-start law turns into promises: the bands are
// monotone in the rival's size, and all three stay reachable at every
// customer count, zero included.
import { describe, expect, it } from "vitest";
import { bandRivalSize, type RivalSizeBand } from "../../../src/lib/market/rivals/band.ts";
import { RIVAL_SIZE_BANDS } from "../../../src/lib/config/constants.ts";
import { codeOf, importsOf, sourceOf } from "./source.ts";

const SOURCE = sourceOf("band.ts");
const CODE = codeOf("band.ts");

/** near < middle < far. Used only to say "never ordered nearer than". */
const ORDER: Record<RivalSizeBand, number> = { near: 0, middle: 1, far: 2 };

const { nearFloor, nearMultiple, middleFloor, middleMultiple } = RIVAL_SIZE_BANDS;

describe('REQ-096 c2 — "no more than the greater of 100 searches and twice the customer\'s own measured count … no more than the greater of 500 searches and five times"', () => {
  it("band/two-bars-at-the-stated-counts — at a customer count of 0 the floors carry both bars", () => {
    const at = (rivalRanked: number) => bandRivalSize({ rivalRanked, ownRanked: 0 });
    expect(at(nearFloor)).toBe("near");
    expect(at(nearFloor + 1)).toBe("middle");
    expect(at(middleFloor)).toBe("middle");
    expect(at(middleFloor + 1)).toBe("far");
  });

  it("band/two-bars-at-the-stated-counts — above the floors the multipliers carry them", () => {
    const ownRanked = 1000;
    const at = (rivalRanked: number) => bandRivalSize({ rivalRanked, ownRanked });
    expect(at(nearMultiple * ownRanked)).toBe("near");
    expect(at(nearMultiple * ownRanked + 1)).toBe("middle");
    expect(at(middleMultiple * ownRanked)).toBe("middle");
    expect(at(middleMultiple * ownRanked + 1)).toBe("far");
  });

  it("band/reads-the-pins — no boundary is written into the function's source", () => {
    for (const literal of [nearFloor, nearMultiple, middleFloor, middleMultiple]) {
      expect(CODE).not.toMatch(new RegExp(`[^\\w.]${literal}[^\\w]`));
    }
    expect(CODE).toContain("RIVAL_SIZE_BANDS.nearFloor");
    expect(CODE).toContain("RIVAL_SIZE_BANDS.middleMultiple");
  });

  it("band/is-monotone — of two rivals at one customer count, the larger is never banded nearer", () => {
    for (let ownRanked = 0; ownRanked <= 10_000; ownRanked += 137) {
      let previous = -1;
      for (const rivalRanked of [0, 1, 99, 100, 101, 499, 500, 501, 1999, 2000, 2001, 4999, 5000, 5001, 10_000, 60_000]) {
        const order = ORDER[bandRivalSize({ rivalRanked, ownRanked })];
        expect(order).toBeGreaterThanOrEqual(previous);
        previous = order;
      }
    }
  });
});

describe('REQ-096 c8 — "at every measured customer count, zero included, all three bands remain reachable"', () => {
  it("band/all-three-reachable-at-every-C", () => {
    for (let ownRanked = 0; ownRanked <= 10_000; ownRanked += 97) {
      const nearBar = Math.max(nearFloor, nearMultiple * ownRanked);
      const middleBar = Math.max(middleFloor, middleMultiple * ownRanked);
      expect(bandRivalSize({ rivalRanked: nearBar, ownRanked })).toBe("near");
      expect(bandRivalSize({ rivalRanked: nearBar + 1, ownRanked })).toBe("middle");
      expect(bandRivalSize({ rivalRanked: middleBar + 1, ownRanked })).toBe("far");
      // The two bars never coincide, which is why `middle` is never empty.
      expect(middleBar).toBeGreaterThan(nearBar);
    }
  });

  it("band/zero-customer-count-is-not-special — a cold-start customer bands every rival and throws on none", () => {
    for (const rivalRanked of [0, 1, 100, 101, 500, 501, 10_000]) {
      expect(() => bandRivalSize({ rivalRanked, ownRanked: 0 })).not.toThrow();
      expect(["near", "middle", "far"]).toContain(bandRivalSize({ rivalRanked, ownRanked: 0 }));
    }
    // No branch in the function reads the customer's own count for
    // anything but the two multiplications.
    expect(CODE).not.toMatch(/ownRanked\s*===?\s*0/);
  });
});

describe("ADR-001 — handles here, words in BAND_LABELS", () => {
  it("band/emits-handles-only — none of the three ruled terms, no copy key, no presentation import", () => {
    for (const term of ["Similar size", "Larger", "Much larger"]) {
      expect(SOURCE).not.toContain(`"${term}"`);
    }
    expect(CODE).not.toContain("band.rivalSize.");
    expect(importsOf("band.ts").filter((i) => i.includes("presentation"))).toEqual([]);
  });

  it("band/is-pure — the only import is the pins; no clock, no cost context", () => {
    expect(importsOf("band.ts")).toEqual(["@/lib/config/constants"]);
    expect(CODE).not.toContain("Date");
    expect(CODE).not.toContain("CostContext");
  });
});
