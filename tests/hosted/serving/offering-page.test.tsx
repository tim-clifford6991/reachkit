/** @vitest-environment jsdom */
// SPEC §7 (owner ruling B6, 2026-10-19) — an offering page, laid out from
// the writer's parts by its template (`layoutPage`), is served by the hosted
// page as the HostedService board (#1581) holds it: the short answer, the
// sections in the template's order, the steps, the questions and the one
// action. The parts are the board's own Harbor Plumbing sample, its headings
// written as questions as every page's are (SPEC §7, 2026-09-29). 0¢.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { layoutPage, withClosing } from "@/lib/generate/pipeline/compose";
import type { PageParts } from "@/lib/generate/pipeline/write";
import { TEMPLATES } from "@/lib/generate/templates";

applyEnvFixture();

const state: { page: unknown } = { page: null };

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "content.example.com" }),
}));

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
    hostedIdentity: async () => ({ name: "Harbor Plumbing", logoType: null, line: null }),
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

async function render(): Promise<string> {
  const { page } = storedDraft();
  state.page = page;
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ slug: [PARTS.slug] }) }));
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
