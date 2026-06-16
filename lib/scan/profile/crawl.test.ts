import { describe, it, expect, vi, beforeEach } from "vitest";
import { toHost } from "./crawl";

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

  it("returns [] in fixtures mode (no network)", async () => {
    vi.doMock("@/lib/dev/fixtures", () => ({ fixturesEnabled: () => true }));
    const fetchSpy = vi.fn();
    vi.doMock("@/lib/scan/adapters/fetch-timeout", () => ({ fetchWithTimeout: fetchSpy }));
    const { crawlContentChannels } = await import("./crawl");
    expect(await crawlContentChannels("acme.com")).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
