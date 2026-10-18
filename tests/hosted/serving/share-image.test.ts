// tests/hosted/serving/share-image.test.ts — SPEC §7 (2026-09-29), issue 1141
//
// The picture a shared hosted link draws. It is rendered for real here —
// `next/og` in this process — because the two ways it can fail are both
// invisible to a type: a layout Satori refuses, and a logo it cannot draw.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

// `next/og` loads its layout engine from a `data:` address embedded in its
// own bundle, through `fetch`. That is not the network, which
// `tests/setup.ts` refuses: this decodes the embedded bytes and still
// refuses every other address.
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const address = String(input);
  const comma = address.indexOf(",");
  if (!address.startsWith("data:") || comma === -1) {
    throw new Error(`share-image.test.ts: unexpected fetch of ${address.slice(0, 60)}`);
  }
  return new Response(Buffer.from(address.slice(comma + 1), "base64"));
}) as typeof fetch;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
/** One transparent pixel. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

const state: {
  pages: unknown[];
  logo: { bytes: Buffer; type: string } | null | Error;
  logoReads: number;
} = { pages: [], logo: null, logoReads: 0 };

vi.mock("@/lib/publish/destinations/hosted", () => ({
  tags: { site: (s: string) => `hosted:site:${s}`, page: (p: string) => `hosted:page:${p}` },
  retiredSlugsForSite: async () => new Set<string>(),
  hostedSiteForDomain: async (domain: string) =>
    domain === "example.com" ? { siteId: "site-1", domain, host: `content.${domain}` } : null,
  hostedSiteForHostname: async () => null,
  livePagesForSite: async () => state.pages,
  hostedIdentity: async () => ({ name: "Example", logoType: null, line: "Onboarding customers finish." }),
}));

vi.mock("@/lib/account/billing", () => ({
  hostedServingState: async () => ({ serve: true }),
}));

vi.mock("@/lib/site-profile", () => ({
  readSiteLogo: async () => {
    state.logoReads += 1;
    if (state.logo instanceof Error) throw state.logo;
    return state.logo;
  },
}));

const { GET } = await import("@/app/(hosted)/hosted-page/share.img/[[...slug]]/route");

function get(host: string, slug?: string[]): Promise<Response> {
  return GET(new Request("https://ignored.example/hosted-page/share.img", { headers: { host } }), {
    params: Promise.resolve(slug === undefined ? {} : { slug }),
  });
}

async function isPng(response: Response): Promise<boolean> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

beforeEach(() => {
  state.logo = null;
  state.logoReads = 0;
  state.pages = [
    {
      slug: "a-page",
      title: `The best onboarding tools for small teams ${"and what each one costs ".repeat(8)}`,
    },
  ];
});

describe("issue 1141 — a hosted page's share image", () => {
  it("a live page draws a PNG, with the first-letter tile where no logo is kept", async () => {
    const response = await get("content.example.com", ["a-page"]);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(await isPng(response)).toBe(true);
  });

  it("the kept logo is drawn on it", async () => {
    state.logo = { bytes: PIXEL, type: "image/png" };
    const response = await get("content.example.com", ["a-page"]);
    expect(state.logoReads).toBe(1);
    expect(response.status).toBe(200);
    expect(await isPng(response)).toBe(true);
  });

  it("a logo Satori cannot draw, and a logo read that fails, still draw the card", async () => {
    state.logo = { bytes: Buffer.from("<svg/>"), type: "image/svg+xml" };
    expect(await isPng(await get("content.example.com", ["a-page"]))).toBe(true);
    state.logo = new Error("the database is away");
    expect(await isPng(await get("content.example.com", ["a-page"]))).toBe(true);
  });

  it("the index has one too, at the path itself", async () => {
    const response = await get("content.example.com");
    expect(response.status).toBe(200);
    expect(await isPng(response)).toBe(true);
  });

  it("no picture for an address with no live page, a deeper path, or a host that is not a site", async () => {
    expect((await get("content.example.com", ["never-published"])).status).toBe(404);
    expect((await get("content.example.com", ["a-page", "more"])).status).toBe(404);
    expect((await get("content.unknown.example", ["a-page"])).status).toBe(404);
  });
});
