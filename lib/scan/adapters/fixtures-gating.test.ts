/**
 * Adapter gating tests: when a fixture provider is installed the paid adapters
 * must return the canned fixture data WITHOUT touching the network.
 *
 * Strategy: installFixtures() a provider whose serp/tavily/ph return deterministic
 * canned data, then dynamically import the adapters so they read it via the seam.
 * fetch is NOT stubbed — if any adapter called fetch it would throw/hang, so the
 * test passing proves the short-circuit is in place.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { installFixtures, resetFixtures } from "@/lib/scan/fixture-seam";
import { makeFixtureProvider } from "@/lib/dev/fixtures";

const SERP_FIXTURE = {
  competitors: [
    { name: "x alternative — Habitify", url: "https://habitify.me", source: "dataforseo_serp", rank: 1 },
    { name: "x vs Streaks", url: "https://streaksapp.com", source: "dataforseo_serp", rank: 2 },
  ],
  serpResultCount: 842000,
  raw: { fixture: true },
};
const TAVILY_FIXTURE = {
  competitors: [{ name: "Top x alternatives", url: "https://www.notion.so", source: "tavily", rank: 1 }],
  raw: { fixture: true },
};
const PH_FIXTURE = {
  selfUpvotes: 312,
  neighbours: [{ name: "Habitify", url: "https://habitify.me", source: "product_hunt", rank: 1 }],
  raw: { fixture: true },
};

describe("paid adapters short-circuit to fixtures when fixturesEnabled()=true", () => {
  beforeEach(() => {
    vi.resetModules();
    installFixtures({
      ...makeFixtureProvider(),
      serp: () => SERP_FIXTURE,
      tavily: () => TAVILY_FIXTURE,
      ph: () => PH_FIXTURE,
    });
  });
  afterEach(() => resetFixtures());

  test("liveSerpAlternatives returns fixture without network call", async () => {
    const { liveSerpAlternatives } = await import("./dataforseo");
    const result = await liveSerpAlternatives("x");
    expect(result).toEqual(SERP_FIXTURE);
    expect(result.competitors).toHaveLength(2);
    expect(result.serpResultCount).toBe(842000);
  });

  test("tavilyAlternatives returns fixture without network call", async () => {
    const { tavilyAlternatives } = await import("./tavily");
    const result = await tavilyAlternatives("x");
    expect(result).toEqual(TAVILY_FIXTURE);
    expect(result.competitors).toHaveLength(1);
    expect(result.competitors[0]?.source).toBe("tavily");
  });

  test("fetchPhByName returns fixture without network call", async () => {
    const { fetchPhByName } = await import("./product-hunt");
    const result = await fetchPhByName("x");
    expect(result).toEqual(PH_FIXTURE);
    expect(result.selfUpvotes).toBe(312);
    expect(result.neighbours).toHaveLength(1);
  });
});
