import { describe, it, expect } from "vitest";
import { parseCompetitorsDomain, rankCompetitorDomains } from "./competitors";

describe("parseCompetitorsDomain", () => {
  it("parses Labs items into {domain, intersections}", () => {
    const body = {
      tasks: [
        {
          result: [
            {
              items: [
                { domain: "Rival.com", intersections: 120 },
                { domain: "other.io", intersections: 30 },
                { domain: "", intersections: 5 }, // dropped (no domain)
              ],
            },
          ],
        },
      ],
    };
    expect(parseCompetitorsDomain(body)).toEqual([
      { domain: "rival.com", intersections: 120 },
      { domain: "other.io", intersections: 30 },
    ]);
  });
  it("returns [] for an empty body", () => {
    expect(parseCompetitorsDomain({})).toEqual([]);
  });
});

describe("rankCompetitorDomains", () => {
  it("drops self + own subdomain + aggregators, sorts by intersections, caps", () => {
    const rows = [
      { domain: "blog.acme.com", intersections: 999 }, // own subdomain → drop
      { domain: "acme.com", intersections: 999 }, // self → drop
      { domain: "reddit.com", intersections: 800 }, // aggregator → drop
      { domain: "rival-a.com", intersections: 120 },
      { domain: "rival-b.com", intersections: 200 },
      { domain: "rival-c.com", intersections: 50 },
    ];
    expect(rankCompetitorDomains(rows, "acme.com", 2)).toEqual(["rival-b.com", "rival-a.com"]);
  });

  it("dedupes hosts", () => {
    const rows = [
      { domain: "https://www.rival.com/x", intersections: 100 },
      { domain: "rival.com", intersections: 90 },
    ];
    expect(rankCompetitorDomains(rows, "acme.com", 5)).toEqual(["rival.com"]);
  });
});
