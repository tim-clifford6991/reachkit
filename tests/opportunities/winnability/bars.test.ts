// BUILD §7 — the two bars, and the property that keeps Reach reachable.
import "../env";
import { describe, expect, it } from "vitest";
import { WINNABILITY } from "../../../src/lib/config/constants";
import { qualifyingBar, winnableBar } from "../../../src/lib/opportunities/winnability/bars";

describe('§7, quoted: "a Write target qualifies only if its top-10 contains at least one domain whose ranked count <= max(500, 5x customer\'s)"', () => {
  it("the qualifying bar is the greater of the floor and the multiple", () => {
    expect(qualifyingBar(0)).toBe(500);
    expect(qualifyingBar(50)).toBe(500); // 5 x 50 = 250, below the floor
    expect(qualifyingBar(100)).toBe(500); // exactly at the floor
    expect(qualifyingBar(200)).toBe(1000); // 5 x 200, above the floor
  });

  it("the bars read the pins and are not a second copy of the four numbers", () => {
    const own = 137;
    expect(qualifyingBar(own)).toBe(
      Math.max(WINNABILITY.qualifyFloor, WINNABILITY.qualifyMultiple * own)
    );
    expect(winnableBar(own)).toBe(
      Math.max(WINNABILITY.nearFloor, WINNABILITY.nearMultiple * own)
    );
  });
});

describe("the winnable bar sits strictly inside the qualifying bar, for every customer", () => {
  it("winnableBar(r) < qualifyingBar(r) over the whole non-negative range", () => {
    // The property, not three examples: it is the only reason the Reach
    // band is reachable at all, and it is what would catch someone raising
    // `WINNABILITY.nearFloor` to the qualifying floor.
    for (const ownRanked of [0, 1, 9, 49, 50, 51, 99, 100, 249, 250, 251, 1000, 10_000, 1e6]) {
      expect(winnableBar(ownRanked)).toBeLessThan(qualifyingBar(ownRanked));
    }
  });
});

describe('§6.6, quoted: "winnability `max(500, 5xranked)` keeps winnable targets non-empty at ranked = 0"', () => {
  it("a customer who ranks for nothing still has both bars positive", () => {
    expect(winnableBar(0)).toBeGreaterThan(0);
    expect(qualifyingBar(0)).toBeGreaterThan(0);
  });
});

describe("the bar takes one number and nothing else", () => {
  it("neither function has a second parameter a per-customer threshold could arrive through", () => {
    // §17 bars settings that tune the engine. This is that, as a shape:
    // there is no options object, no site id, and no configuration — so
    // two customers cannot be held to two thresholds.
    expect(qualifyingBar.length).toBe(1);
    expect(winnableBar.length).toBe(1);
  });
});
