import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchThreadActivity } from "./thread-activity";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body } as Response);
}
afterEach(() => vi.unstubAllGlobals());

describe("fetchThreadActivity", () => {
  it("parses a Reddit thread's score + comments from <url>.json", async () => {
    vi.stubGlobal("fetch", mockFetch(200, [{ data: { children: [{ data: { score: 42, num_comments: 7 } }] } }, {}]));
    const a = await fetchThreadActivity("https://www.reddit.com/r/SaaS/comments/abc/title/");
    expect(a).toEqual({ score: 42, comments: 7 });
  });
  it("parses a Hacker News item's points + descendants from Firebase", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { score: 128, descendants: 33 }));
    const a = await fetchThreadActivity("https://news.ycombinator.com/item?id=12345");
    expect(a).toEqual({ score: 128, comments: 33 });
  });
  it("returns null for an unsupported host (never invents)", async () => {
    vi.stubGlobal("fetch", mockFetch(200, {}));
    expect(await fetchThreadActivity("https://quora.com/q/xyz")).toBeNull();
  });
  it("returns null on non-200 and on malformed json, never throws", async () => {
    vi.stubGlobal("fetch", mockFetch(503, {}));
    expect(await fetchThreadActivity("https://www.reddit.com/r/x/comments/1/t/")).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error("bad"); } } as unknown as Response));
    expect(await fetchThreadActivity("https://www.reddit.com/r/x/comments/1/t/")).toBeNull();
  });
});
