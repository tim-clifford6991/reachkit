import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * WS-A class sweep (2026-07-19): `runMarketAnalysis`'s "recent buzz" pass runs a
 * Tavily NEWS search keyed on the subject's own product NAME — exactly as
 * brand-ambiguous as the reviews search that produced the reachkit.ai/reachkit.app
 * mix-up (prod scan 4093f1c9). Unit-tests the orchestration only: every other
 * collaborator (profileCohort, discoverDemand, analyzeGap, buildPlan) is mocked
 * so this file exercises just the `dropDomainConflicts` wiring around the news call.
 */

vi.mock("@/lib/scan/profile", () => ({
  profileCohort: vi.fn(),
}));
vi.mock("@/lib/scan/demand", () => ({
  discoverDemand: vi.fn(),
}));
vi.mock("@/lib/scan/adapters/tavily", () => ({
  tavilySearch: vi.fn(),
}));
vi.mock("./analyze", () => ({
  analyzeGap: vi.fn(),
}));
vi.mock("./plan", () => ({
  buildPlan: vi.fn(),
}));

import { profileCohort } from "@/lib/scan/profile";
import { discoverDemand } from "@/lib/scan/demand";
import { tavilySearch } from "@/lib/scan/adapters/tavily";
import { analyzeGap } from "./analyze";
import { buildPlan } from "./plan";
import { runMarketAnalysis } from "./run";

const COHORT = {
  product: { name: "Reachkit", description: "A discoverability engine" },
  self: {},
  competitors: [],
} as never;

function stubCollaborators() {
  vi.mocked(profileCohort).mockResolvedValue(COHORT);
  vi.mocked(discoverDemand).mockResolvedValue({ pockets: [] } as never);
  vi.mocked(analyzeGap).mockReturnValue({} as never);
  vi.mocked(buildPlan).mockReturnValue({} as never);
}

describe("runMarketAnalysis — recent-buzz subject validation (WS-A class sweep)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubCollaborators();
  });

  it("drops same-brand different-domain news from recentBuzz (reachkit.ai vs reachkit.app)", async () => {
    vi.mocked(tavilySearch).mockResolvedValue([
      {
        title: "Reachkit.ai raises seed round",
        url: "https://techcrunch.com/reachkit-ai-raises-seed",
        content: "Reachkit.ai today announced funding.",
        publishedDate: "2026-07-01",
      },
    ]);

    const result = await runMarketAnalysis("reachkit.app", { light: false });

    expect(result.recentBuzz ?? []).toEqual([]);
  });

  it("keeps genuine news with no conflicting domain", async () => {
    vi.mocked(tavilySearch).mockResolvedValue([
      {
        title: "Stripe launches new product",
        url: "https://techcrunch.com/stripe-news",
        content: "Stripe today announced X.",
        publishedDate: "2026-07-01",
      },
    ]);

    const result = await runMarketAnalysis("stripe.com", { light: false });

    expect(result.recentBuzz).toHaveLength(1);
    expect(result.recentBuzz?.[0]?.url).toContain("stripe-news");
  });

  it("skips the news call entirely on the light (free-tier) pass", async () => {
    await runMarketAnalysis("reachkit.app", { light: true });
    expect(tavilySearch).not.toHaveBeenCalled();
  });
});
