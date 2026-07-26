import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchThreadActivity } from "./thread-activity";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body } as Response);
}
afterEach(() => vi.unstubAllGlobals());

describe("fetchThreadActivity", () => {
  it("returns null for Reddit (unauthenticated 403 gate); does not fetch", async () => {
    const mockFetchFn = vi.fn();
    vi.stubGlobal("fetch", mockFetchFn);
    const a = await fetchThreadActivity("https://www.reddit.com/r/SaaS/comments/abc/title/");
    expect(a).toBeNull();
    expect(mockFetchFn).not.toHaveBeenCalled();
  });
  it("parses a Hacker News item's points + descendants from Firebase", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { score: 128, descendants: 33 }));
    const a = await fetchThreadActivity("https://news.ycombinator.com/item?id=12345");
    expect(a).toEqual({ score: 128, comments: 33 });
  });
  it("returns null for a dead/deleted HN item — never surfaces a dead thread (R3)", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { score: 40, descendants: 5, dead: true }));
    expect(await fetchThreadActivity("https://news.ycombinator.com/item?id=99")).toBeNull();
    vi.stubGlobal("fetch", mockFetch(200, { score: 40, descendants: 5, deleted: true }));
    expect(await fetchThreadActivity("https://news.ycombinator.com/item?id=99")).toBeNull();
  });
  it("returns null for an unsupported host (never invents)", async () => {
    vi.stubGlobal("fetch", mockFetch(200, {}));
    expect(await fetchThreadActivity("https://quora.com/q/xyz")).toBeNull();
  });
  it("returns null on non-200 and on malformed json, never throws", async () => {
    vi.stubGlobal("fetch", mockFetch(503, {}));
    expect(await fetchThreadActivity("https://news.ycombinator.com/item?id=12345")).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error("bad"); } } as unknown as Response));
    expect(await fetchThreadActivity("https://news.ycombinator.com/item?id=12345")).toBeNull();
  });
});
