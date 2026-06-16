import { describe, it, expect } from "vitest";
import {
  parseCompetitorsDomain,
  rankCompetitorDomains,
  parseKeepList,
  buildCompetitorFilterPrompt,
  COMPETITOR_BLOCKLIST,
} from "./competitors";

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

  it("blocklists the finance-media class that keyword overlap surfaces", () => {
    const rows = [
      { domain: "forbes.com", intersections: 9999 },
      { domain: "investopedia.com", intersections: 9000 },
      { domain: "nerdwallet.com", intersections: 8000 },
      { domain: "wise.com", intersections: 500 },
    ];
    expect(rankCompetitorDomains(rows, "stripe.com", 5)).toEqual(["wise.com"]);
  });
});

describe("blocklist", () => {
  it("includes the news/reference publishers that pollute keyword-overlap results", () => {
    for (const d of ["forbes.com", "investopedia.com", "nerdwallet.com", "techcrunch.com"]) {
      expect(COMPETITOR_BLOCKLIST.has(d)).toBe(true);
    }
  });
});

describe("parseKeepList", () => {
  const domains = ["wise.com", "intuit.com", "forbes.com"];

  it("keeps only the model's subset, preserving input order", () => {
    const raw = '{"keep":["intuit.com","wise.com"]}';
    expect(parseKeepList(raw, domains)).toEqual(["wise.com", "intuit.com"]);
  });

  it("ignores domains the model invents", () => {
    expect(parseKeepList('{"keep":["made-up.com","wise.com"]}', domains)).toEqual(["wise.com"]);
  });

  it("honours an explicit empty keep-list", () => {
    expect(parseKeepList('{"keep":[]}', domains)).toEqual([]);
  });

  it("falls back to the full list on unparseable output", () => {
    expect(parseKeepList("garbage", domains)).toEqual(domains);
  });
});

describe("buildCompetitorFilterPrompt", () => {
  it("embeds the subject description and the adjacent-category drop rule", () => {
    const p = buildCompetitorFilterPrompt(
      { domain: "trustmrr.com", description: "verified MRR badges for indie SaaS founders" },
      ["zoominfo.com", "wise.com"],
    );
    expect(p).toContain("verified MRR badges for indie SaaS founders");
    expect(p).toContain("ADJACENT-BUT-DIFFERENT-category");
    expect(p).toContain("zoominfo.com");
  });

  it("works without a description (domain only)", () => {
    const p = buildCompetitorFilterPrompt({ domain: "acme.com" }, ["rival.com"]);
    expect(p).toContain("acme.com");
    expect(p).toContain("rival.com");
  });
});
