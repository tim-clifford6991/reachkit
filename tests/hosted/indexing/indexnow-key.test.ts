// tests/hosted/indexing/indexnow-key.test.ts — issue 1511, SPEC §7
// (2026-10-18).
//
// IndexNow accepts a site's submissions only from whoever serves its key at
// the host's root. The middleware sends `/<key>.txt` on a customer's host to
// the key route before any page read, and the route answers the site's own
// key and nothing else: another name, another host, a host that is not a
// site, all 404.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import "../../scan/run/harness";

vi.mock("@/lib/scan/removal", () => ({ isDomainRemoved: async () => false }));

const reads = { address: 0 };

vi.mock("@/lib/publish/destinations/hosted", async () => {
  const address = await import("@/lib/publish/destinations/hosted/address");
  return {
    hostedHostFor: address.hostedHostFor,
    liveUrlFor: address.liveUrlFor,
    liveUrlOnHost: address.liveUrlOnHost,
    tags: { site: (s: string) => `hosted:site:${s}`, page: (p: string) => `hosted:page:${p}` },
    retiredSlugsForSite: async () => new Set<string>(),
    hostedSiteForDomain: async (domain: string) =>
      domain === "example.com" ? { siteId: "site-1", domain, host: `content.${domain}` } : null,
    hostedSiteForHostname: async () => null,
    livePagesForSite: async () => [],
    hostedIdentity: async (a: { domain: string }) => ({ name: a.domain, logoType: null, line: null }),
    livePageBySlug: async () => null,
    hostedAddress: async () => {
      reads.address += 1;
      return { state: "none", publicationId: null };
    },
  };
});

vi.mock("@/lib/account/billing", () => ({ hostedServingState: async () => ({ serve: true }) }));

const { middleware } = await import("@/middleware");
const { GET } = await import("@/app/(hosted)/hosted-page/indexnow/[key]/route");
const { indexNowKey } = await import("@/lib/publish/destinations/hosted/announce");

const KEY = indexNowKey("site-1");

function keyRequest(key: string, host: string): Promise<Response> {
  return GET(new Request(`https://ignored.example/hosted-page/indexnow/${key}`, { headers: { host } }), {
    params: Promise.resolve({ key }),
  });
}

beforeEach(() => {
  reads.address = 0;
});

describe("the key file at a customer host's root", () => {
  it("is a stable 32-character key per site, and differs between sites", () => {
    expect(KEY).toMatch(/^[0-9a-f]{32}$/);
    expect(indexNowKey("site-1")).toBe(KEY);
    expect(indexNowKey("site-2")).not.toBe(KEY);
  });

  it("the middleware rewrites /<key>.txt to the key route, before any page read", async () => {
    const response = await middleware(new NextRequest(new URL(`/${KEY}.txt`, "http://localhost"), { headers: { host: "content.example.com" } }));
    const destination = response.headers.get("x-middleware-rewrite");
    expect(destination === null ? null : new URL(destination).pathname).toBe(`/hosted-page/indexnow/${KEY}`);
    expect(reads.address).toBe(0);
  });

  it("answers the site's own key as plain text", async () => {
    const response = await keyRequest(KEY, "content.example.com");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^text\/plain/);
    expect(await response.text()).toBe(KEY);
  });

  it("is 404 for another site's key, and on a host that is not a site", async () => {
    expect((await keyRequest(indexNowKey("site-2"), "content.example.com")).status).toBe(404);
    expect((await keyRequest(KEY, "content.stranger.com")).status).toBe(404);
  });
});
