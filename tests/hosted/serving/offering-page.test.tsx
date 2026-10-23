/** @vitest-environment jsdom */
// SPEC §7 (owner ruling B6, 2026-10-19) — an offering page, laid out from
// the writer's parts by its template (`layoutPage`), is served by the hosted
// page as the HostedService board (#1581) holds it: the short answer, the
// sections in the template's order, the steps, the questions and the one
// action. The parts are the board's own Harbor Plumbing sample, its headings
// written as questions as every page's are (SPEC §7, 2026-09-29). 0¢.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { HostedPage } from "@/lib/publish/destinations/hosted";
import { applyEnvFixture } from "../../mail/env-fixture";
import { layoutPage, withClosing } from "@/lib/generate/pipeline/compose";
import type { PageParts } from "@/lib/generate/pipeline/write";
import { TEMPLATES } from "@/lib/generate/templates";

applyEnvFixture();

const HARBOR = { name: "Harbor Plumbing", logoType: null, line: null };
const state: { page: unknown; identity: unknown } = { page: null, identity: HARBOR };

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "content.example.com" }),
}));

const { publications } = vi.hoisted(() => ({ publications: [] as unknown[] }));
vi.mock("@/lib/publish/db", () => {
  const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => resolve({ data: publications, error: null }) };
  for (const step of ["from", "select", "eq", "not", "is", "order", "in", "limit"]) chain[step] = () => chain;
  return { publishDb: () => chain };
});

vi.mock("@/lib/account/billing", () => ({
  hostedServingState: async () => ({ serve: true }),
}));

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
    livePageBySlug: async () => state.page,
    livePagesForSite: async () => (state.page === null ? [] : [state.page]),
    hostedIdentity: async () => state.identity,
    hostedAddress: async () => ({ state: "none", publicationId: null }),
  };
});

const Page = (await import("@/app/(hosted)/hosted-page/[[...slug]]/page")).default;

/** What the writer returns for "emergency plumber austin", in the board's words. */
const PARTS: PageParts = {
  titles: ["Emergency plumber in Austin: 24-hour call-outs from $149"],
  slug: "emergency-plumber-austin",
  description: "Harbor Plumbing answers emergency calls 24 hours a day across Austin, from a $149 call-out.",
  answer:
    "Harbor Plumbing answers emergency calls 24 hours a day across Austin. A call-out is $149, and you get a written price before any work starts. Call and we will talk you through shutting off your water while the van is on its way.",
  takeaways: ["Someone answers at any hour.", "A call-out is $149.", "You get a written price before any work starts."],
  sections: [
    { key: "what", heading: "What is emergency plumbing, and who is it for?", body: "Emergency plumbing is for problems that cannot wait for a weekday booking: a burst pipe, a main valve that will not close, a water heater leaking onto the floor. It is for homes in Austin." },
    { key: "included", heading: "What is included?", body: "- Someone answers your call at any hour\n- Help shutting off your water while you wait\n- A plumber at your door to find the problem\n- A written price before any work starts" },
    { key: "price", heading: "How is it priced?", body: "A call-out is [$149](https://example.com/pricing). It covers the visit and finding the problem. You then get a written price for the repair, and you decide whether to go ahead." },
    { key: "where_when", heading: "Where and when do you come out?", body: "24 hours a day, every day, in Austin, Round Rock, Pflugerville and Cedar Park." },
    {
      key: "how_it_works",
      heading: "How does it work?",
      body: "Four steps, from your call to the repair.\n\n1. You call and tell us what is happening.\n2. You get an arrival window on the phone.\n3. The plumber finds the problem and writes down the price.\n4. We do the work once you have said yes to the price.",
    },
    { key: "why", heading: "Why Harbor Plumbing?", body: "Licensed plumbers, as stated on [example.com](https://example.com/). A written price before any work starts. We stay on the line while the van is on its way." },
  ],
  closing: "Water running now? Call Harbor Plumbing.",
  faq: [
    { question: "Is the call-out price the same at night?", answer: "Yes. The call-out is $149 at any hour, as listed on our pricing page." },
    { question: "Will I know the price before you start?", answer: "Yes. After finding the problem, the plumber gives you a written price. No work starts until you agree to it." },
    { question: "Do you cover my area?", answer: "We cover Austin, Round Rock, Pflugerville and Cedar Park. If your town is not listed, call and ask." },
  ],
  updated: "",
};

function storedDraft() {
  const laid = layoutPage(PARTS, TEMPLATES.offering, { facts: [], promises: [], queries: ["emergency plumber austin"], names: ["Harbor Plumbing", "Austin"] });
  const publishedAt = new Date("2026-10-19T11:00:00.000Z");
  return {
    laid,
    page: {
      publicationId: "pub-1",
      siteId: "site-1",
      slug: PARTS.slug,
      title: laid.body.title,
      heading: laid.body.heading,
      bodyMd: withClosing(laid.body.bodyMarkdown, laid.closing, "https://example.com/contact"),
      description: laid.body.description,
      faq: laid.faq,
      made: null,
      grounded: null,
      publisher: { name: "Harbor Plumbing", category: "emergency plumbing", timeZone: "America/Chicago" },
      byline: null,
      firstPublishedAt: publishedAt,
      publishedAt,
      liveUrl: `https://content.example.com/${PARTS.slug}`,
      record: { opportunityId: "opp-1", targetQuery: "emergency plumber austin", measuredOn: publishedAt, mode: "autopilot", liveUrl: `https://content.example.com/${PARTS.slug}` },
    },
  };
}

async function render(page: unknown = storedDraft().page, identity: unknown = HARBOR): Promise<string> {
  state.page = page;
  state.identity = identity;
  const slug = (page as { slug: string }).slug;
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ slug: [slug] }) }));
}

describe("the hosted Service board renders an offering draft", () => {
  it("the laid page records the template's six sections, in its order", () => {
    expect(storedDraft().laid.sections.map((section) => section.key)).toEqual(TEMPLATES.offering.sections.map((section) => section.key));
  });

  it("draws the title, the short answer, each section in the template's order, the steps and the one action", async () => {
    const html = await render();
    expect(html.match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1]).toBe("Emergency plumber in Austin: 24-hour call-outs from $149");
    expect(html).toContain("A call-out is $149, and you get a written price before any work starts.");
    const headings = [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((match) => match[1]!);
    const sections = [
      "What is emergency plumbing, and who is it for?",
      "What is included?",
      "How is it priced?",
      "Where and when do you come out?",
      "How does it work?",
      "Why Harbor Plumbing?",
    ];
    expect(headings.filter((heading) => sections.includes(heading))).toEqual(sections);
    expect(html).toMatch(/<ol[^>]*>.*You call and tell us what is happening\..*We do the work once you have said yes to the price\..*<\/ol>/s);
    expect(html).toContain('<a href="https://example.com/contact"');
  });

  it("draws the buyers' questions, and restates them as FAQPage data", async () => {
    const html = await render();
    for (const entry of PARTS.faq) expect(html).toContain(entry.question);
    expect(html).toContain('"@type":"FAQPage"');
  });
});

/** Owner R1 (2026-10-22): an offering page states its dates, keeps the made
 *  line and carries no byline; every other type keeps its byline. */
const DAY = "2026-10-19T11:00:00.000Z";
const LATER = "2026-10-22T11:00:00.000Z";
const MADE_LINE = "Written with AI from 3 facts on example.com, checked against 14 rules before publishing.";

function offering(over: Partial<HostedPage> = {}): HostedPage {
  return {
    ...(storedDraft().page as unknown as HostedPage),
    offering: true,
    byline: "Dana Ruiz · Master plumber",
    made: { facts: 3, rules: 14 },
    ...over,
  };
}

/** A SaaS business's own feature page, on the same template. */
function saasOffering(over: Partial<HostedPage> = {}): HostedPage {
  const slug = "onboarding-checklists";
  return offering({
    slug,
    title: "Onboarding checklists with one owner for every step",
    heading: null,
    bodyMd: "Every checklist names one owner for each step.\n\n## What is included?\n\n- Templates per role\n- An export of everything you wrote",
    faq: [],
    publisher: { name: "Publisher", category: "employee onboarding software", timeZone: null },
    liveUrl: `https://content.example.com/${slug}`,
    ...over,
  });
}

const SAAS = { name: "Publisher & Sons Onboarding Software", logoType: null, line: null };

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

function dataOf(doc: Document): Record<string, unknown>[] {
  return [...doc.querySelectorAll('script[type="application/ld+json"]')].flatMap((script) => {
    const data = JSON.parse(script.textContent ?? "") as Record<string, unknown>;
    return Array.isArray(data["@graph"]) ? (data["@graph"] as Record<string, unknown>[]) : [data];
  });
}

function metaLine(doc: Document): string {
  return doc.querySelector("article time")?.parentElement?.textContent ?? "";
}

describe("owner R1: an offering page shows its dates, the made line and no byline", () => {
  for (const [kind, page, identity] of [
    ["a local offering page", offering, HARBOR],
    ["a SaaS offering page", saasOffering, SAAS],
  ] as const) {
    it(`${kind}: the dates alone, no reading time, and the made line`, async () => {
      const doc = parse(await render(page(), identity));
      expect(metaLine(doc)).toBe("Published 19 Oct 2026");
      expect(doc.body.textContent).not.toContain("Dana Ruiz");
      expect(doc.body.textContent).not.toContain("min read");
      expect(doc.body.textContent).toContain(MADE_LINE);
    });

    it(`${kind}: "Updated" only once the page is refreshed`, async () => {
      const doc = parse(await render(page({ publishedAt: new Date(LATER) }), identity));
      expect(metaLine(doc)).toBe("Published 19 Oct 2026 · Updated 22 Oct 2026");
    });

    it(`${kind}: WebPage and Service, by the business, dated as the page is`, async () => {
      const refreshed = page({ publishedAt: new Date(LATER) });
      const doc = parse(await render(refreshed, identity));
      const blocks = dataOf(doc);
      const types = blocks.map((block) => block["@type"]);
      expect(types).toContain("WebPage");
      expect(types).toContain("Service");
      expect(types).not.toContain("BlogPosting");
      expect(JSON.stringify(blocks)).not.toContain('"Person"');
      const organization = "https://example.com/#organization";
      const webPage = blocks.find((block) => block["@type"] === "WebPage")!;
      const service = blocks.find((block) => block["@type"] === "Service")!;
      expect((service.provider as { "@id": string })["@id"]).toBe(organization);
      expect((webPage.publisher as { "@id": string })["@id"]).toBe(organization);
      expect(webPage.datePublished).toBe(DAY);
      expect(webPage.dateModified).toBe(LATER);
      expect(doc.querySelector("article time")?.getAttribute("datetime")).toBe(DAY.slice(0, 10));
    });
  }

  for (const [kind, title] of [
    ["a Q&A page", "Is the call-out price the same at night?"],
    ["a how-to page", "How to shut off the water to a house"],
  ] as const) {
    it(`${kind} keeps its byline, its reading time and its BlogPosting`, async () => {
      const doc = parse(await render(offering({ offering: false, title, heading: null })));
      expect(metaLine(doc)).toMatch(/^published 19 Oct 2026 · by Dana Ruiz · Master plumber·?\s*\d+ min read$/);
      expect(dataOf(doc).map((block) => block["@type"])).toContain("BlogPosting");
    });
  }

  it("the store reads a draft written as an offering page as one, and any other as not", async () => {
    const row = (id: string, contentType: string) => ({
      id,
      site_id: "site-1",
      live_url: `https://content.example.com/${id}`,
      published_at: DAY,
      mode: "autopilot",
      sites: { domain: "example.com", category: null, timezone: null },
      drafts: { title: id, body_md: "One paragraph.", attribution: null, meta: { contentType }, grounded_fact: null, opportunity_id: "o", opportunities: { id: "o", target_query: "q", scans: null } },
    });
    publications.splice(0, publications.length, row("service", "offering"), row("answer", "qa"));
    const { livePagesForSite } = await import("@/lib/publish/destinations/hosted/store");
    const pages = await livePagesForSite("site-1", "content.example.com");
    expect(Object.fromEntries(pages.map((page) => [page.slug, page.offering]))).toEqual({ service: true, answer: false });
  });
});
