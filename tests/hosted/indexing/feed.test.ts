/** @vitest-environment jsdom */
// tests/hosted/indexing/feed.test.ts — SPEC §7 (2026-09-29), issue 1141
//
// The hosted blog's feed: this site's live pages on its own host, newest
// first, and nothing a customer's host should not carry — another site's
// page, a ReachKit address, or a feed at all on a host that is not a site.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const state: { pages: unknown[]; serve: boolean; line: string | null } = {
  pages: [],
  serve: true,
  line: null,
};

vi.mock("@/lib/publish/destinations/hosted", () => ({
  tags: { site: (s: string) => `hosted:site:${s}`, page: (p: string) => `hosted:page:${p}` },
  hostedSiteForDomain: async (domain: string) =>
    domain === "example.com" ? { siteId: "site-1", domain, host: `content.${domain}` } : null,
  hostedSiteForHostname: async () => null,
  livePagesForSite: async () => state.pages,
  hostedIdentity: async () => ({ name: "Example & Co", logoType: null, line: state.line }),
}));

vi.mock("@/lib/account/billing", () => ({
  hostedServingState: async () =>
    state.serve ? { serve: true } : { serve: false, because: "retention_elapsed" },
}));

const { GET } = await import("@/app/(hosted)/hosted-page/rss.xml/route");

function page(slug: string, title: string, publishedAt: string, description: string | null): unknown {
  return {
    slug,
    title,
    description,
    publishedAt: new Date(publishedAt),
    firstPublishedAt: new Date(publishedAt),
    liveUrl: `https://content.example.com/${slug}`,
  };
}

function get(host: string): Promise<Response> {
  return GET(new Request("https://ignored.example/hosted-page/rss.xml", { headers: { host } }));
}

interface Item {
  title: string | null;
  link: string | null;
  pubDate: string | null;
  description: string | null;
}

interface Channel {
  title: string | null;
  link: string | null;
  description: string | null;
  generator: string | null;
  items: Item[];
}

/** The document parsed as XML, so a string survives only if it was escaped. */
async function channelOf(response: Response): Promise<Channel> {
  const doc = new DOMParser().parseFromString(await response.text(), "application/xml");
  expect(doc.querySelector("parsererror")).toBeNull();
  const text = (parent: Element | null, name: string): string | null =>
    Array.from(parent?.children ?? []).find((child) => child.tagName === name)?.textContent ?? null;
  const channel = doc.querySelector("rss > channel");
  return {
    title: text(channel, "title"),
    link: text(channel, "link"),
    description: text(channel, "description"),
    generator: text(channel, "generator"),
    items: Array.from(doc.querySelectorAll("channel > item")).map((item) => ({
      title: text(item, "title"),
      link: text(item, "link"),
      pubDate: text(item, "pubDate"),
      description: text(item, "description"),
    })),
  };
}

beforeEach(() => {
  state.serve = true;
  state.line = null;
  state.pages = [
    page("newest", "Tools <compared> & priced", "2026-09-20T09:00:00.000Z", "Which tools, and what they cost."),
    page("older", "An older guide", "2026-09-01T09:00:00.000Z", null),
  ];
});

describe("issue 1141 — the feed at /rss.xml", () => {
  it("answers 200 as RSS, uncached", async () => {
    const response = await get("content.example.com");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/rss+xml");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("is headed by the business and links the index on its own host", async () => {
    const channel = await channelOf(await get("content.example.com"));
    expect(channel.title).toBe("Articles · Example & Co");
    expect(channel.link).toBe("https://content.example.com/");
    expect(channel.description).toBe("Articles and guides from Example & Co.");
    state.line = "Onboarding your customers finish.";
    expect((await channelOf(await get("content.example.com"))).description).toBe(
      "Onboarding your customers finish. Articles and guides from Example & Co."
    );
  });

  it("lists the live pages newest first, each at its live address with its date", async () => {
    const { items } = await channelOf(await get("content.example.com"));
    expect(items.map((item) => item.link)).toEqual([
      "https://content.example.com/newest",
      "https://content.example.com/older",
    ]);
    // Parsed back, so the title survived as text: the markup in it was escaped.
    expect(items[0]?.title).toBe("Tools <compared> & priced");
    expect(items[0]?.description).toBe("Which tools, and what they cost.");
    expect(new Date(items[0]?.pubDate ?? "").toISOString()).toBe("2026-09-20T09:00:00.000Z");
    expect(items[1]?.description).toBeNull();
  });

  it("names no generator and no ReachKit address", async () => {
    const response = await get("content.example.com");
    const body = await response.clone().text();
    expect((await channelOf(response)).generator).toBeNull();
    expect(body.toLowerCase()).not.toContain("reachkit");
  });

  it("a site with no live page gets a valid, empty feed", async () => {
    state.pages = [];
    const response = await get("content.example.com");
    expect(response.status).toBe(200);
    expect((await channelOf(response)).items).toEqual([]);
  });

  it("a host that is not a site, and a site whose serving stopped, have none", async () => {
    expect((await get("content.unknown.example")).status).toBe(404);
    state.serve = false;
    expect((await get("content.example.com")).status).toBe(404);
  });
});
