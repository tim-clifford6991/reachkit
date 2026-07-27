import { describe, it, expect } from "vitest";
import { channelStrengthFor, CHANNEL_GROUPS } from "./channel-strength";

describe("channelStrengthFor", () => {
  it("maps all 8 quality categories into the 5 groups and buckets by count", () => {
    const s = channelStrengthFor({
      marketplace: 12,       // reviews → hi (>10)
      software_directory: 2, // directories → lo (1-3)
      blog: 4, newsletter: 1, media: 3, // media = 8 → med (4-10)
      community: 5, social: 1,          // community = 6 → med
      // partners: none → absent
    });
    expect(s.reviews).toBe("hi");
    expect(s.directories).toBe("lo");
    expect(s.media).toBe("med");
    expect(s.community).toBe("med");
    expect(s.partners).toBe("absent");
  });

  it("returns absent for every group on empty input, and is total over all groups", () => {
    const s = channelStrengthFor({});
    expect(CHANNEL_GROUPS.every((g) => s[g] === "absent")).toBe(true);
    expect(Object.keys(s).sort()).toEqual([...CHANNEL_GROUPS].sort());
  });

  it("ignores low-value categories (ai_directory/spam/other)", () => {
    const s = channelStrengthFor({ ai_directory: 50, spam: 20, other: 10 });
    expect(CHANNEL_GROUPS.every((g) => s[g] === "absent")).toBe(true);
  });
});
