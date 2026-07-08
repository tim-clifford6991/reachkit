import { describe, it, expect } from "vitest";
import { pruneHuskCompetitors } from "./cohort";
import type { DistributionProfile } from "./types";

const prof = (domain: string, organicKeywords: number | null): DistributionProfile =>
  ({ domain, seo: organicKeywords == null ? null : { organicKeywords } } as unknown as DistributionProfile);

describe("pruneHuskCompetitors (F5)", () => {
  it("drops dead/rebranded husks (near-zero organic footprint) like microacquire", () => {
    const kept = pruneHuskCompetitors([
      prof("flippa.com", 14288),
      prof("acquire.com", 4708),
      prof("microacquire.com", 6), // rebranded → acquire.com, residual keywords
      prof("empireflippers.com", 5895),
    ]);
    expect(kept.map((c) => c.domain)).toEqual(["flippa.com", "acquire.com", "empireflippers.com"]);
  });

  it("keeps competitors whose SEO is unknown (null) — absence of data is not death", () => {
    const kept = pruneHuskCompetitors([prof("a.com", null), prof("b.com", 500)]);
    expect(kept.map((c) => c.domain)).toEqual(["a.com", "b.com"]);
  });

  it("keeps legitimately small-but-live competitors (>= floor)", () => {
    expect(pruneHuskCompetitors([prof("small.com", 25)]).map((c) => c.domain)).toEqual(["small.com"]);
  });
});
