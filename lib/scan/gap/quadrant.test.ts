import { describe, it, expect } from "vitest";
import { quadrantOf } from "./quadrant";

describe("quadrantOf", () => {
  it("high ease + high impact → Quick win", () => {
    expect(quadrantOf(0.8, 0.8)).toBe("Quick win");
  });

  it("low ease + high impact → Big bet", () => {
    expect(quadrantOf(0.2, 0.8)).toBe("Big bet");
  });

  it("high ease + low impact → Fill-in", () => {
    expect(quadrantOf(0.8, 0.2)).toBe("Fill-in");
  });

  it("low ease + low impact → Low priority", () => {
    expect(quadrantOf(0.2, 0.2)).toBe("Low priority");
  });

  it("treats the 0.5 midpoint as the high side (inclusive)", () => {
    expect(quadrantOf(0.5, 0.5)).toBe("Quick win");
  });
});
