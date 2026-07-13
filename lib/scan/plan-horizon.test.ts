import { describe, it, expect } from "vitest";
import { horizonForEntry, HORIZON_LABEL } from "./plan-horizon";

describe("horizonForEntry", () => {
  it("maps kinds to horizons: post->short, content->medium, distribution->long", () => {
    expect(horizonForEntry({ kind: "post", channel: null, effortMin: 3 })).toBe("short");
    expect(horizonForEntry({ kind: "content", channel: null, effortMin: 45 })).toBe("medium");
    expect(horizonForEntry({ kind: "distribution", channel: "directory", effortMin: 12 })).toBe("long");
  });
  it("a community reply (distribution+community, tiny effort) is a short quick-win", () => {
    expect(horizonForEntry({ kind: "distribution", channel: "community", effortMin: 4 })).toBe("short");
  });
  it("has a label for every horizon", () => {
    expect(HORIZON_LABEL.short).toBe("Quick win");
    expect(HORIZON_LABEL.medium).toBe("This week");
    expect(HORIZON_LABEL.long).toBe("Compounding");
  });
});
