import { describe, it, expect, vi } from "vitest";
import { fetchWithTimeout, FetchTimeoutError } from "./fetch-timeout";

describe("fetchWithTimeout", () => {
  it("passes the abort signal through and resolves on a fast response", async () => {
    const spy = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response("ok", { status: 200 });
    });
    vi.stubGlobal("fetch", spy);
    const res = await fetchWithTimeout("https://x.test", {}, 50);
    expect(res.status).toBe(200);
    vi.unstubAllGlobals();
  });

  it("throws FetchTimeoutError (named, with url) when the underlying fetch aborts", async () => {
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
        );
      });
    });
    await expect(fetchWithTimeout("https://slow.test", {}, 10)).rejects.toMatchObject({
      name: "FetchTimeoutError",
      url: "https://slow.test",
    });
    vi.unstubAllGlobals();
  });

  it("merges a caller-supplied signal with the timeout signal", async () => {
    const caller = new AbortController();
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response("ok");
    });
    await fetchWithTimeout("https://x.test", { signal: caller.signal }, 50);
    vi.unstubAllGlobals();
  });
});
