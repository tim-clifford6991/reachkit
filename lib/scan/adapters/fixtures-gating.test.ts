/**
 * Adapter gating tests: when REACHKIT_USE_FIXTURES=true the paid adapters must
 * return the canned fixture data WITHOUT touching the network.
 *
 * Strategy: vi.doMock "@/lib/dev/fixtures" so fixturesEnabled() returns true and
 * the fixture providers return deterministic canned data, then dynamically
 * import the adapters so they pick up the mock.  fetch is NOT stubbed — if any
 * adapter called fetch it would throw/hang, so the test passing proves the
 * short-circuit is in place.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

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
    vi.doMock("@/lib/dev/fixtures", () => ({
      fixturesEnabled: () => true,
      fixtureSerp: () => SERP_FIXTURE,
      fixtureTavily: () => TAVILY_FIXTURE,
      fixturePh: () => PH_FIXTURE,
    }));
  });

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
