/** @vitest-environment jsdom */
// tests/hosted/serving/moved-links.test.tsx — issue 1511, SPEC §7
// (2026-10-18).
//
// Found live on reachkit.app's page D: it linked a page that had moved, so
// a reader and a crawler took a 301 to reach it, and would for weeks until
// the `link` refresh (issue 1487) rewrote D. The page now draws that link at
// the address it answers with now, at render, from D's stored body as it
// stands: the row is not edited and its dates do not move.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const OLD = "https://content.example.com/tools-to-track-where-ai-sends-potential-customers";
const NEW = "https://content.example.com/how-to-rank-on-chatgpt";
const STORED = `For what the measurement side can tell you, see [tools to track where ChatGPT sends customers](${OLD}). And [pricing](https://example.com/pricing).`;

const state: { moved: Map<string, string> } = { moved: new Map() };

vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "content.example.com" }) }));
vi.mock("@/lib/account/billing", () => ({ hostedServingState: async () => ({ serve: true }) }));

const pageD = {
  publicationId: "pD",
  siteId: "site-1",
  slug: "how-to-rank-in-ai-overview",
  title: "How to rank in AI Overview for your business",
  bodyMd: STORED,
  description: "How to rank in AI Overview.",
  faq: [],
  made: null,
  grounded: null,
  publisher: { name: "example.com", category: null, timeZone: "UTC" },
  publishedAt: new Date("2026-10-10T07:00:43.503Z"),
  firstPublishedAt: new Date("2026-10-10T07:00:43.503Z"),
  byline: null,
  liveUrl: "https://content.example.com/how-to-rank-in-ai-overview",
  record: {
    opportunityId: "oD",
    targetQuery: "how to rank in ai overview",
    measuredOn: new Date("2026-10-05T00:00:00.000Z"),
    mode: "autopilot",
    liveUrl: "https://content.example.com/how-to-rank-in-ai-overview",
  },
};

vi.mock("@/lib/publish/destinations/hosted", async () => {
  const address = await import("@/lib/publish/destinations/hosted/address");
  return {
    liveUrlFor: address.liveUrlFor,
    liveUrlOnHost: address.liveUrlOnHost,
    hostedHostFor: address.hostedHostFor,
    tags: { site: (s: string) => `hosted:site:${s}`, page: (p: string) => `hosted:page:${p}` },
    retiredSlugsForSite: async () => new Set<string>(),
    hostedSiteForDomain: async (domain: string) => (domain === "example.com" ? { siteId: "site-1", domain, host: `content.${domain}` } : null),
    hostedSiteForHostname: async () => null,
    livePageBySlug: async () => pageD,
    livePagesForSite: async () => [pageD],
    hostedIdentity: async (a: { domain: string }) => ({ name: a.domain, logoType: null, line: null }),
    hostedAddress: async () => ({ state: "none", publicationId: null }),
  };
});

vi.mock("@/lib/publish/destinations/hosted/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/publish/destinations/hosted/store")>()),
  movedSlugsForSite: async () => state.moved,
}));

const Page = (await import("@/app/(hosted)/hosted-page/[[...slug]]/page")).default;

async function render(): Promise<Document> {
  const tree = await Page({ params: Promise.resolve({ slug: ["how-to-rank-in-ai-overview"] }) });
  return new DOMParser().parseFromString(renderToStaticMarkup(tree), "text/html");
}

const bodyLinks = (doc: Document): string[] =>
  Array.from(doc.querySelectorAll("article a[href]"))
    .map((anchor) => anchor.getAttribute("href") ?? "")
    .filter((href) => href.includes("content.example.com/") && !href.endsWith(".example.com/"));

beforeEach(() => {
  state.moved = new Map([["tools-to-track-where-ai-sends-potential-customers", "how-to-rank-on-chatgpt"]]);
});

describe("a link to a moved page is drawn at its final address", () => {
  it("page D links the moved page's new address and never the redirect, from its stored body as it stands", async () => {
    const doc = await render();
    expect(bodyLinks(doc)).toContain(NEW);
    expect(doc.documentElement.innerHTML).not.toContain(OLD);
    // The link's words and the other links are as written.
    expect(doc.body.textContent).toContain("tools to track where ChatGPT sends customers");
    expect(Array.from(doc.querySelectorAll("a")).some((a) => a.getAttribute("href") === "https://example.com/pricing")).toBe(true);
    // The stored body and the dates are not touched (ADR-080).
    expect(pageD.bodyMd).toBe(STORED);
    expect(pageD.publishedAt.toISOString()).toBe("2026-10-10T07:00:43.503Z");
  });
});
