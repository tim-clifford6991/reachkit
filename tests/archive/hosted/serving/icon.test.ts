// tests/hosted/serving/icon.test.ts — SPEC §7 (2026-10-18), issue 1514
//
// The icon a customer's content host names: their kept logo where a search
// result can show it, else the first letter of their name on a tile —
// never ReachKit's mark, and never a 404 on a host that serves a site.
import { PNG } from "pngjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

// `next/og` loads its layout engine from a `data:` address in its own
// bundle, through `fetch`; every other address is refused, as in
// `share-image.test.ts`.
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const address = String(input);
  const comma = address.indexOf(",");
  if (!address.startsWith("data:") || comma === -1) {
    throw new Error(`icon.test.ts: unexpected fetch of ${address.slice(0, 60)}`);
  }
  return new Response(Buffer.from(address.slice(comma + 1), "base64"));
}) as typeof fetch;

function png(width: number, height: number): Buffer {
  return PNG.sync.write(new PNG({ width, height }));
}

const state: { logo: { bytes: Buffer; type: string } | null | Error } = { logo: null };

vi.mock("@/lib/publish/destinations/hosted", () => ({
  tags: { site: (s: string) => `hosted:site:${s}`, page: (p: string) => `hosted:page:${p}` },
  retiredSlugsForSite: async () => new Set<string>(),
  hostedSiteForDomain: async (domain: string) =>
    domain === "example.com" ? { siteId: "site-1", domain, host: `content.${domain}` } : null,
  hostedSiteForHostname: async () => null,
  hostedIdentity: async () => ({ name: "example", logoType: null, line: null }),
}));

vi.mock("@/lib/account/billing", () => ({
  hostedServingState: async () => ({ serve: true }),
}));

vi.mock("@/lib/site-profile", async () => {
  const { iconWorthy } = await import("@/lib/site-profile/logo");
  return {
    iconWorthy,
    readSiteLogo: async () => {
      if (state.logo instanceof Error) throw state.logo;
      return state.logo;
    },
  };
});

const { GET } = await import("@/app/(hosted)/hosted-page/icon.img/route");

function get(host: string): Promise<Response> {
  return GET(new Request("https://ignored.example/hosted-page/icon.img", { headers: { host } }));
}

async function bytesOf(response: Response): Promise<Buffer> {
  return Buffer.from(await response.arrayBuffer());
}

beforeEach(() => {
  state.logo = null;
});

describe("issue 1514 — the content host's icon is the customer's", () => {
  it("a square kept logo of at least 48 px is the icon, byte for byte", async () => {
    const logo = png(64, 64);
    state.logo = { bytes: logo, type: "image/png" };
    const response = await get("content.example.com");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect((await bytesOf(response)).equals(logo)).toBe(true);
  });

  it("a square SVG and a square WebP draw the tile: Google shows neither as an icon", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96"/></svg>');
    // A 64×64 WebP header (VP8X: canvas width and height, each less one).
    const webp = Buffer.alloc(30);
    webp.write("RIFF", 0);
    webp.writeUInt32LE(22, 4);
    webp.write("WEBPVP8X", 8);
    webp.writeUInt32LE(10, 16);
    webp.writeUIntLE(63, 24, 3);
    webp.writeUIntLE(63, 27, 3);
    for (const logo of [
      { bytes: svg, type: "image/svg+xml" },
      { bytes: webp, type: "image/webp" },
    ]) {
      state.logo = logo;
      const response = await get("content.example.com");
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type"), logo.type).toBe("image/png");
      const tile = PNG.sync.read(await bytesOf(response));
      expect([tile.width, tile.height]).toEqual([96, 96]);
    }
  });

  it("a wide logo, a small one, no logo and a failed read draw the 96 px letter tile", async () => {
    for (const logo of [
      { bytes: png(180, 60), type: "image/png" },
      { bytes: png(32, 32), type: "image/png" },
      { bytes: Buffer.from("not an image"), type: "image/png" },
      null,
      new Error("the database is away"),
    ]) {
      state.logo = logo;
      const response = await get("content.example.com");
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/png");
      const tile = PNG.sync.read(await bytesOf(response));
      expect([tile.width, tile.height]).toEqual([96, 96]);
    }
  });

  it("a host that serves no site answers 404", async () => {
    expect((await get("content.unknown.example")).status).toBe(404);
  });
});
