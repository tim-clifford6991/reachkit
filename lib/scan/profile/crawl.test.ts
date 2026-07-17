import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toHost } from "./crawl";
import { installFixtures, resetFixtures } from "@/lib/scan/fixture-seam";
import { makeFixtureProvider } from "@/lib/dev/fixtures";

describe("toHost", () => {
  it("normalizes domains and URLs to a bare host (www stripped)", () => {
    expect(toHost("acme.com")).toBe("acme.com");
    expect(toHost("https://www.acme.com/blog")).toBe("acme.com");
    expect(toHost("http://acme.com")).toBe("acme.com");
    expect(toHost("www.acme.com/x")).toBe("acme.com");
  });
});

describe("crawlContentChannels (fixtures short-circuit)", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => resetFixtures());

  it("returns [] in fixtures mode (no network)", async () => {
    installFixtures(makeFixtureProvider());
    const fetchSpy = vi.fn();
    vi.doMock("@/lib/scan/adapters/fetch-timeout", () => ({ fetchWithTimeout: fetchSpy }));
    const { crawlContentChannels } = await import("./crawl");
    expect(await crawlContentChannels("acme.com")).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
