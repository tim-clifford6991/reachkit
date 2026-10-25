/** @vitest-environment jsdom */
// The cached article writes its own head; the uncached route still hands Next `articleMetadata`.
// Every value `articleMetadata` returns must be a tag of the served head, so the two cannot drift.
import { describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const AT = new Date("2026-09-04T11:00:00.000Z");
const LIVE_URL = "https://content.example.com/a-page";
const PAGE = {
  publicationId: "pub-1",
  siteId: "site-1",
  slug: "a-page",
  title: "The best onboarding tools",
  heading: null,
  bodyMd: "One paragraph.",
  description: "Which onboarding tools small teams pick, and why.",
  faq: [],
  made: null,
  grounded: null,
  publisher: { name: "example.com", category: null, timeZone: "UTC" },
  byline: null,
  publishedAt: AT,
  firstPublishedAt: AT,
  liveUrl: LIVE_URL,
  record: { opportunityId: "opp-1", targetQuery: "onboarding tools", measuredOn: AT, mode: "autopilot", liveUrl: LIVE_URL },
};

vi.mock("@/lib/account/billing", () => ({ hostedServingState: async () => ({ serve: true }) }));
vi.mock("@/lib/publish/destinations/hosted", () => ({
  tags: { site: (s: string) => `hosted:site:${s}`, page: (p: string) => `hosted:page:${p}` },
  hostedSiteForHostname: async () => null,
  hostedSiteForDomain: async (domain: string) => ({ siteId: "site-1", domain, host: `content.${domain}` }),
  livePagesForSite: async () => [PAGE],
  retiredSlugsForSite: async () => new Set<string>(),
  hostedIdentity: async () => ({ name: "Example", logoType: null, line: null }),
  taggedForHosted: async () => undefined,
}));

const { GET } = await import("@/app/(hosted)/hosted-live/[host]/[slug]/route");
const { articleHead, loadArticle } = await import("@/app/(hosted)/hosted-page/[[...slug]]/article");
const { readingIn } = await import("@/lib/presentation/copy/reader");

/** Where the served head draws each value of `articleMetadata`, as Next names the tag. */
const DRAWN: Record<string, string> = {
  title: "title",
  description: 'meta[name="description"]',
  "robots.max-image-preview": 'meta[name="robots"]',
  "icons.icon": 'link[rel="icon"]',
  "alternates.canonical": 'link[rel="canonical"]',
  "alternates.types.application/rss+xml.0.url": 'link[rel="alternate"][type="application/rss+xml"]',
  "alternates.types.application/rss+xml.0.title": 'link[rel="alternate"][type="application/rss+xml"]',
  "openGraph.url": 'meta[property="og:url"]',
  "openGraph.title": 'meta[property="og:title"]',
  "openGraph.description": 'meta[property="og:description"]',
  "openGraph.siteName": 'meta[property="og:site_name"]',
  "openGraph.locale": 'meta[property="og:locale"]',
  "openGraph.images.0.url": 'meta[property="og:image"]',
  "openGraph.images.0.width": 'meta[property="og:image:width"]',
  "openGraph.images.0.height": 'meta[property="og:image:height"]',
  "openGraph.images.0.alt": 'meta[property="og:image:alt"]',
  "openGraph.type": 'meta[property="og:type"]',
  "openGraph.publishedTime": 'meta[property="article:published_time"]',
  "openGraph.modifiedTime": 'meta[property="article:modified_time"]',
  "twitter.card": 'meta[name="twitter:card"]',
  "twitter.title": 'meta[name="twitter:title"]',
  "twitter.description": 'meta[name="twitter:description"]',
  "twitter.images.0": 'meta[name="twitter:image"]',
};

function leaves(value: unknown, path: string[] = []): [string, string][] {
  if (value === undefined) return [];
  if (value === null || typeof value !== "object") return [[path.join("."), String(value)]];
  return Object.entries(value).flatMap(([key, inner]) => leaves(inner, [...path, key]));
}

describe("the cached article's head draws every value articleMetadata returns", () => {
  it("each value is a tag Next would write for it", async () => {
    const resolved = await readingIn(() => loadArticle("content.example.com", "a-page"));
    if (resolved === null) throw new Error("the fixture page did not resolve");
    const metadata = readingIn(() => articleHead(resolved));
    const response = await GET(new Request(LIVE_URL), { params: Promise.resolve({ host: "content.example.com", slug: "a-page" }) });
    const head = new DOMParser().parseFromString(await response.text(), "text/html").head;

    const found = leaves(metadata);
    expect(found.length).toBeGreaterThan(20);
    for (const [path, value] of found) {
      const selector = DRAWN[path];
      expect(selector, `${path} has no tag in the cached article's head`).toBeDefined();
      const tag = head.querySelector(selector!);
      const said = [tag?.textContent ?? "", ...[...(tag?.attributes ?? [])].map((attribute) => attribute.value)];
      expect(said.some((text) => text.includes(value)), `${path} = ${value}`).toBe(true);
    }
  });
});
