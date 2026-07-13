import { describe, it, expect } from "vitest";
import { normalizePains } from "./reviews";

describe("normalizePains", () => {
  it("passes through new PainInsight[] and back-fills text", () => {
    expect(normalizePains([{ text: "slow", sourceUrl: "https://g2.com/x", mentions: 3 }]))
      .toEqual([{ text: "slow", sourceUrl: "https://g2.com/x", mentions: 3 }]);
  });
  it("upgrades legacy string[] to PainInsight[] (no source)", () => {
    expect(normalizePains(["accuracy", "privacy"]))
      .toEqual([{ text: "accuracy" }, { text: "privacy" }]);
  });
  it("drops junk and empties", () => {
    expect(normalizePains([{ text: "" }, 3, null, { nope: 1 }, "  ok  "]))
      .toEqual([{ text: "ok" }]);
  });
});
