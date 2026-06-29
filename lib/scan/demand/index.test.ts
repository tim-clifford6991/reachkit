import { describe, it, expect, vi, beforeEach } from "vitest";
import { dedupeHits } from "./index";
import type { DemandHit } from "./types";

function hit(url: string, query = "q"): DemandHit {
  return { title: url, url, snippet: "", subreddit: null, platform: "Reddit", theme: "Problem", query, publishedAt: null };
}

describe("dedupeHits", () => {
  it("keeps the first occurrence of each URL across queries", () => {
    const out = dedupeHits([hit("https://a"), hit("https://b"), hit("https://a", "q2")]);
    expect(out.map((h) => h.url)).toEqual(["https://a", "https://b"]);
  });
});

describe("discoverDemand (wiring)", () => {
  beforeEach(() => vi.resetModules());

  it("threads queries → search → classify → cluster into a ranked result", async () => {
    vi.doMock("./queries", () => ({
      generatePainQueries: vi.fn().mockResolvedValue([{ query: "no users find my app", theme: "Problem" }]),
      normalizePainQueries: vi.fn(),
    }));
    vi.doMock("./search", () => ({
      searchDemand: vi.fn().mockResolvedValue([
        {
          title: "how do I get users",
          url: "https://reddit.com/r/SaaS/x",
          snippet: "",
          subreddit: "r/SaaS",
          query: "no users find my app",
          publishedAt: null,
        },
      ]),
      parseDemandHits: vi.fn(),
      buildRedditDemandKeyword: vi.fn(),
      subredditFromUrl: vi.fn(),
    }));
    vi.doMock("./classify", () => ({
      classifyHits: vi.fn().mockImplementation(async (_p: string, hits: DemandHit[]) =>
        hits.map((h) => ({ ...h, isBuyerPain: true, intent: 0.9 })),
      ),
      intentLabelToScore: vi.fn(),
    }));

    const { discoverDemand } = await import("./index");
    const res = await discoverDemand({
      brand: "X",
      problem: "no users find my app",
      audience: "founders",
      valueProp: "distribution",
    });

    expect(res.painQueries).toEqual(["no users find my app"]);
    expect(res.totalHits).toBe(1);
    expect(res.buyerPainHits).toBe(1);
    expect(res.pockets).toHaveLength(1);
    expect(res.pockets[0]).toMatchObject({ surface: "r/SaaS", count: 1 });
  });
});
