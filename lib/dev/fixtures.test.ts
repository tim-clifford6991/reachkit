import { beforeEach, describe, expect, test, vi } from "vitest";

// We mock the env module so fixturesEnabled() reflects what we set, not process.env.
vi.mock("@/lib/config/env", () => ({
  env: { useFixtures: false },
}));

describe("fixture providers return valid Competitor shapes", async () => {
  const { fixtureSerp, fixtureTavily, fixturePh } = await import("./fixtures");

  test("fixtureSerp: non-empty competitors with required fields", () => {
    const r = fixtureSerp("TestApp");
    expect(r.competitors.length).toBeGreaterThan(0);
    for (const c of r.competitors) {
      expect(typeof c.name).toBe("string");
      expect(c.name.length).toBeGreaterThan(0);
      expect(typeof c.url).toBe("string");
      expect(c.url.startsWith("http")).toBe(true);
      expect(c.source).toBe("dataforseo_serp");
      expect(typeof c.rank).toBe("number");
    }
    expect(r.serpResultCount).toBeGreaterThan(0);
    expect(r.raw).toEqual({ fixture: true });
  });

  test("fixtureTavily: non-empty competitors with required fields", () => {
    const r = fixtureTavily("TestApp");
    expect(r.competitors.length).toBeGreaterThan(0);
    for (const c of r.competitors) {
      expect(typeof c.name).toBe("string");
      expect(c.name.length).toBeGreaterThan(0);
      expect(typeof c.url).toBe("string");
      expect(c.url.startsWith("http")).toBe(true);
      expect(c.source).toBe("tavily");
      expect(typeof c.rank).toBe("number");
    }
    expect(r.raw).toEqual({ fixture: true });
  });

  test("fixturePh: non-zero upvotes and non-empty neighbours", () => {
    const r = fixturePh("TestApp");
    expect(r.selfUpvotes).toBeGreaterThan(0);
    expect(r.neighbours.length).toBeGreaterThan(0);
    for (const c of r.neighbours) {
      expect(typeof c.name).toBe("string");
      expect(c.name.length).toBeGreaterThan(0);
      expect(typeof c.url).toBe("string");
      expect(c.url.startsWith("http")).toBe(true);
      expect(c.source).toBe("product_hunt");
      expect(typeof c.rank).toBe("number");
    }
    expect(r.raw).toEqual({ fixture: true });
  });

  test("fixtureSerp interpolates productName into competitor names", () => {
    const r = fixtureSerp("Nudgi");
    expect(r.competitors[0]?.name).toContain("Nudgi");
    expect(r.competitors[1]?.name).toContain("Nudgi");
  });

  test("fixtureTavily interpolates productName into competitor names", () => {
    const r = fixtureTavily("Nudgi");
    expect(r.competitors[0]?.name).toContain("Nudgi");
  });
});

describe("fixturesEnabled() reflects the env flag", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("returns false when env.useFixtures is false", async () => {
    vi.doMock("@/lib/config/env", () => ({ env: { useFixtures: false } }));
    const { fixturesEnabled } = await import("./fixtures");
    expect(fixturesEnabled()).toBe(false);
  });

  test("returns true when env.useFixtures is true", async () => {
    vi.doMock("@/lib/config/env", () => ({ env: { useFixtures: true } }));
    const { fixturesEnabled } = await import("./fixtures");
    expect(fixturesEnabled()).toBe(true);
  });
});
