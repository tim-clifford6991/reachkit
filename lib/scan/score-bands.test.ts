import { describe, it, expect } from "vitest";
import { SCORE_BANDS, bandFor } from "./score-bands";

describe("SCORE_BANDS", () => {
  it("has the five canonical bands with the correct labels and thresholds", () => {
    expect(SCORE_BANDS.map((b) => [b.min, b.max, b.label])).toEqual([
      [0, 29, "Invisible"],
      [30, 49, "Hard to find"],
      [50, 69, "Fair — room to climb"],
      [70, 84, "Findable"],
      [85, 100, "Highly discoverable"],
    ]);
  });

  it("covers 0–100 contiguously with no gaps or overlaps", () => {
    const mins = SCORE_BANDS.map((b) => b.min);
    const maxs = SCORE_BANDS.map((b) => b.max);
    for (let i = 1; i < mins.length; i++) {
      expect(mins[i]).toBe((maxs[i - 1] ?? -999) + 1);
    }
    expect(SCORE_BANDS.at(0)?.min).toBe(0);
    expect(SCORE_BANDS.at(-1)?.max).toBe(100);
  });
});

describe("bandFor", () => {
  it("maps each band's boundaries to that band", () => {
    expect(bandFor(0).label).toBe("Invisible");
    expect(bandFor(29).label).toBe("Invisible");
    expect(bandFor(30).label).toBe("Hard to find");
    expect(bandFor(49).label).toBe("Hard to find");
    expect(bandFor(50).label).toBe("Fair — room to climb");
    expect(bandFor(69).label).toBe("Fair — room to climb");
    expect(bandFor(70).label).toBe("Findable");
    expect(bandFor(84).label).toBe("Findable");
    expect(bandFor(85).label).toBe("Highly discoverable");
    expect(bandFor(100).label).toBe("Highly discoverable");
  });

  it("clamps out-of-range scores into the end bands", () => {
    expect(bandFor(-10).label).toBe("Invisible");
    expect(bandFor(250).label).toBe("Highly discoverable");
  });

  it("rounds fractional scores to the nearest integer band", () => {
    expect(bandFor(29.4).label).toBe("Invisible");
    expect(bandFor(29.6).label).toBe("Hard to find");
  });

  it("returns a usable color for every band", () => {
    for (const b of SCORE_BANDS) {
      expect(typeof bandFor(b.min).color).toBe("string");
      expect(bandFor(b.min).color.length).toBeGreaterThan(0);
    }
  });
});
