import { describe, it, expect, vi, beforeEach } from "vitest";
import { lookup } from "node:dns/promises";
import {
  fetchWithTimeout,
  FetchTimeoutError,
  assertPublicHttpUrl,
  resolveAndAssertPublic,
  isBlockedIp,
  MAX_REDIRECTS,
} from "./fetch-timeout";

// DNS is mocked so tests never hit the network and rebind is deterministic.
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
const mockLookup = vi.mocked(lookup);
const PUBLIC = [{ address: "93.184.216.34", family: 4 }] as unknown as Awaited<ReturnType<typeof lookup>>;

beforeEach(() => {
  mockLookup.mockReset();
  mockLookup.mockResolvedValue(PUBLIC); // default: hosts resolve public
});

describe("isBlockedIp", () => {
  it.each([
    "127.0.0.1", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1",
    "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "::",
    "fc00::1", "fd12:3456::1", "fe80::1", "::ffff:169.254.169.254", "::ffff:10.0.0.1",
    // IPv6 embeddings of internal IPv4 (defence-in-depth):
    "::7f00:1", "fec0::1", "64:ff9b::7f00:1", "64:ff9b::a9fe:a9fe", "::a9fe:a9fe",
  ])("blocks %s", (ip) => expect(isBlockedIp(ip)).toBe(true));

  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "192.169.0.1", "2606:2800:220:1::1", "example.com"])(
    "allows %s",
    (ip) => expect(isBlockedIp(ip)).toBe(false),
  );
});

describe("assertPublicHttpUrl", () => {
  it.each([
    "http://localhost/x", "http://foo.localhost/x", "http://metadata.google.internal/x",
    "http://127.0.0.1/", "http://169.254.169.254/latest/meta-data/", "https://[::1]/",
    "http://[::ffff:169.254.169.254]/", "ftp://example.com/", "file:///etc/passwd",
  ])("blocks %s", (url) => expect(() => assertPublicHttpUrl(url)).toThrow());

  it("allows a normal public https URL", () => {
    expect(() => assertPublicHttpUrl("https://example.com/path")).not.toThrow();
  });
});

describe("resolveAndAssertPublic (DNS-rebind)", () => {
  it("throws when the host resolves to a private/metadata IP (A-record rebind)", async () => {
    mockLookup.mockResolvedValue([{ address: "169.254.169.254", family: 4 }] as never);
    await expect(resolveAndAssertPublic("attacker.example")).rejects.toThrow(/resolves to blocked IP/);
  });

  it("throws when ANY of several resolved addresses is private", async () => {
    mockLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.9", family: 4 },
    ] as never);
    await expect(resolveAndAssertPublic("mixed.example")).rejects.toThrow(/blocked IP 10\.0\.0\.9/);
  });

  it("passes a public resolution and does not throw on resolution failure", async () => {
    mockLookup.mockResolvedValue(PUBLIC);
    await expect(resolveAndAssertPublic("good.example")).resolves.toBeUndefined();
    mockLookup.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(resolveAndAssertPublic("nope.example")).resolves.toBeUndefined();
  });
});

describe("fetchWithTimeout — SSRF redirect re-checking", () => {
  it("does NOT follow a 302 into cloud metadata", async () => {
    const spy = vi.fn(async (url: string) => {
      if (url === "https://evil.example/x") {
        return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } });
      }
      return new Response("SHOULD NOT REACH", { status: 200 });
    });
    vi.stubGlobal("fetch", spy);
    await expect(fetchWithTimeout("https://evil.example/x", {}, 200)).rejects.toThrow(/blocked private\/loopback IP/);
    // the metadata URL must never be fetched
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toBe("https://evil.example/x");
    vi.unstubAllGlobals();
  });

  it("blocks a DNS-rebind host BEFORE the first fetch", async () => {
    mockLookup.mockResolvedValue([{ address: "10.0.0.5", family: 4 }] as never);
    const spy = vi.fn(async () => new Response("nope"));
    vi.stubGlobal("fetch", spy);
    await expect(fetchWithTimeout("https://rebind.example/", {}, 200)).rejects.toThrow(/resolves to blocked IP/);
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("follows a redirect to a public target and returns the final response", async () => {
    const spy = vi.fn(async (url: string) => {
      if (url === "https://a.example/") {
        return new Response(null, { status: 301, headers: { location: "https://b.example/final" } });
      }
      return new Response("final", { status: 200 });
    });
    vi.stubGlobal("fetch", spy);
    const res = await fetchWithTimeout("https://a.example/", {}, 200);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("final");
    vi.unstubAllGlobals();
  });

  it(`throws after more than ${MAX_REDIRECTS} redirects`, async () => {
    // Always redirect to a new public URL → exhausts the hop cap.
    const spy = vi.fn(async (url: string) => {
      const n = Number(new URL(url).searchParams.get("n") ?? "0");
      return new Response(null, { status: 302, headers: { location: `https://loop.example/?n=${n + 1}` } });
    });
    vi.stubGlobal("fetch", spy);
    await expect(fetchWithTimeout("https://loop.example/?n=0", {}, 500)).rejects.toThrow(/too many redirects/);
    vi.unstubAllGlobals();
  });
});

describe("fetchWithTimeout — timeout + signal plumbing (unchanged behavior)", () => {
  it("passes the abort signal through and resolves on a fast response", async () => {
    const spy = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response("ok", { status: 200 });
    });
    vi.stubGlobal("fetch", spy);
    const res = await fetchWithTimeout("https://x.example", {}, 50);
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
    await expect(fetchWithTimeout("https://slow.example", {}, 10)).rejects.toMatchObject({
      name: "FetchTimeoutError",
      url: "https://slow.example",
    });
    vi.unstubAllGlobals();
  });

  it("aborts when the caller's signal is already aborted (caller-abort path)", async () => {
    const caller = new AbortController();
    caller.abort();
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
      return new Response("ok");
    });
    await expect(fetchWithTimeout("https://x.example", { signal: caller.signal }, 50)).rejects.toBeInstanceOf(
      FetchTimeoutError,
    );
    vi.unstubAllGlobals();
  });
});
