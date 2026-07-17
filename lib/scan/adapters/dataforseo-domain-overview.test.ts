import { describe, it, expect } from "vitest";
import { parseDomainOverview } from "./dataforseo-domain-overview";

// Shape captured LIVE from domain_rank_overview/live for resend.com (2026-07-17).
// The metrics are at result[0].items[0].metrics.organic — NOT result[0].metrics.
const LIVE_RESEND = {
  tasks: [
    {
      result: [
        {
          target: "resend.com",
          total_count: 1,
          items_count: 1,
          items: [
            {
              se_type: "google",
              metrics: {
                organic: { count: 2100, etv: 28529.84, pos_1: 87, pos_2_3: 210, is_new: 1409 },
                paid: { count: 0, etv: 0 },
              },
            },
          ],
        },
      ],
    },
  ],
};

describe("parseDomainOverview", () => {
  it("reads the TRUE totals from result[0].items[0].metrics.organic (verified live path)", () => {
    const o = parseDomainOverview(LIVE_RESEND);
    expect(o).not.toBeNull();
    expect(o!.organicKeywords).toBe(2100); // ← the true count, not the capped 50
    expect(o!.organicEtv).toBe(28529.84);
    expect(o!.pos1).toBe(87);
    expect(o!.pos2_3).toBe(210);
  });

  it("returns null on the WRONG (plan-assumed) path so a shape regression can't ship a false 0", () => {
    // metrics at result[0].metrics (the path the plan assumed) — must NOT parse.
    const wrongPath = { tasks: [{ result: [{ metrics: { organic: { count: 999 } } }] }] };
    expect(parseDomainOverview(wrongPath)).toBeNull();
  });

  it("returns null (not 0) when count is absent — degrade to the sample, never render a false 0", () => {
    const noCount = { tasks: [{ result: [{ items: [{ metrics: { organic: { etv: 5 } } }] }] }] };
    expect(parseDomainOverview(noCount)).toBeNull();
  });

  it("returns null on empty / malformed bodies (never throws)", () => {
    expect(parseDomainOverview(null)).toBeNull();
    expect(parseDomainOverview({})).toBeNull();
    expect(parseDomainOverview({ tasks: [{ result: [] }] })).toBeNull();
    expect(parseDomainOverview({ tasks: [{ result: [{ items: [] }] }] })).toBeNull();
  });
});
