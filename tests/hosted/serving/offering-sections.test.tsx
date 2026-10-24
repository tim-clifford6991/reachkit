/** @vitest-environment jsdom */
// E10, E26 and E41 (2026-10-24): the hosted offering page draws the sections its
// draft holds, in the fixed order answer › what › included › price › where
// and when › how it works › why › questions › more guides. Its Service's
// `areaServed` is the visible "Where and when" list, absent with the section;
// that section draws lucide's pin on each place and no clock until an hours
// fact exists (E41), and the steps are numbers. Drafts laid out by code from stored packs;
// no model, no vendor. 0¢.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { OFFERING_FIXTURES, type OfferingFixture } from "../../generate/offering-packs";
import type { HostedPage } from "@/lib/publish/destinations/hosted";
import type { Template } from "@/lib/generate/templates";

applyEnvFixture();

const { HostedArticle } = await import("@/app/(hosted)/hosted-page/[[...slug]]/article");
const { layoutPage, withClosing } = await import("@/lib/generate/pipeline/compose");
const { fittedTemplate } = await import("@/lib/generate/pipeline/pack");
const { TEMPLATES } = await import("@/lib/generate/templates");
const { copy } = await import("@/lib/presentation/copy/reader");

const BUSINESS = { domain: "harborplumbing.example", name: "Harbor Plumbing", logoType: null, line: null };
const AT = new Date("2026-10-19T11:00:00.000Z");

function hosted(slug: string, over: Partial<HostedPage>): HostedPage {
  const liveUrl = `https://content.${BUSINESS.domain}/${slug}`;
  return {
    publicationId: `pub-${slug}`,
    siteId: "site-1",
    slug,
    title: slug,
    heading: null,
    bodyMd: "One paragraph.",
    description: null,
    faq: [],
    grounded: null,
    made: null,
    publisher: { name: BUSINESS.domain, category: null, timeZone: "UTC" },
    byline: null,
    publishedAt: AT,
    firstPublishedAt: AT,
    liveUrl,
    record: { opportunityId: `opp-${slug}`, targetQuery: slug, measuredOn: AT, mode: "autopilot", liveUrl },
    ...over,
  };
}

const GUIDE = hosted("shut-off-water", { title: "How to shut off water to a house in an emergency" });

/** The draft as generation stores it, read back as the store reads it: its
 *  body, its questions and the heading it recorded for "Where and when". */
function stored({ pack, parts }: OfferingFixture, template: Template = fittedTemplate(pack)): HostedPage {
  const laid = layoutPage(parts, template, { facts: [], promises: [], queries: pack.target.searches, names: ["Harbor Plumbing", "Austin"] });
  return hosted(parts.slug, {
    title: laid.body.title,
    heading: laid.body.heading,
    bodyMd: withClosing(laid.body.bodyMarkdown, laid.closing, `https://${BUSINESS.domain}/contact`),
    faq: laid.faq,
    offering: true,
    whereWhen: laid.sections.find((section) => section.key === "where_when")?.heading ?? null,
  });
}

function render(page: HostedPage, others: HostedPage[] = [GUIDE]): Document {
  const html = renderToStaticMarkup(<HostedArticle resolved={{ page, canonical: page.liveUrl, others, business: BUSINESS }} />);
  return new DOMParser().parseFromString(html, "text/html");
}

function graph(doc: Document): Record<string, unknown>[] {
  return [...doc.querySelectorAll('script[type="application/ld+json"]')].flatMap((script) => {
    const data = JSON.parse(script.textContent ?? "") as Record<string, unknown>;
    return Array.isArray(data["@graph"]) ? (data["@graph"] as Record<string, unknown>[]) : [data];
  });
}

const ofType = (doc: Document, type: string) => graph(doc).filter((node) => node["@type"] === type);
const text = (element: Element | null | undefined): string => (element?.textContent ?? "").replace(/\s+/g, " ").trim();
const h2 = (doc: Document, words: string): Element | undefined => [...doc.querySelectorAll("article h2")].find((heading) => text(heading) === words);
const labelled = (doc: Document, words: string): Element | undefined => [...doc.querySelectorAll("article p")].find((p) => text(p) === words);
const before = (earlier: Element, later: Element): boolean => (earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

const PLUMBER = OFFERING_FIXTURES["(a) a local plumber with every fact"];
const HEADINGS = PLUMBER.parts.sections.map((section) => section.heading);
const WHERE = PLUMBER.parts.sections.find((section) => section.key === "where_when")!.heading;

/** The page's "Where and when" list: the list after the section's heading. */
function whereList(doc: Document): string[] {
  const heading = h2(doc, WHERE);
  const list = [...doc.querySelectorAll("article ul")].find((ul) => heading !== undefined && before(heading, ul));
  return [...(list?.querySelectorAll("li") ?? [])].map(text);
}

describe("E10: the hosted offering page draws the draft's sections in the fixed order", () => {
  it("(a) a plumber with every fact: answer › what › included › price › where and when › how it works › why › questions › more guides", () => {
    const doc = render(stored(PLUMBER));
    const marks = [
      labelled(doc, copy("body.answer.heading")),
      ...HEADINGS.map((heading) => h2(doc, heading)),
      h2(doc, copy("body.faq.heading")),
      labelled(doc, copy("body.guides.heading", { publisher: BUSINESS.name })),
    ];
    expect(marks.every((mark) => mark !== undefined)).toBe(true);
    for (let i = 1; i < marks.length; i++) expect(before(marks[i - 1]!, marks[i]!)).toBe(true);
    expect(ofType(doc, "FAQPage")).toHaveLength(1);
  });

  it("(a) Service.areaServed is the visible Where and when list, exactly; Organization carries none", () => {
    const doc = render(stored(PLUMBER));
    expect(whereList(doc)).toEqual(["Austin", "Round Rock", "Pflugerville", "Cedar Park"]);
    expect(ofType(doc, "Service")[0]!.areaServed).toEqual(whereList(doc));
    expect(ofType(doc, "Organization").every((node) => !("areaServed" in node))).toBe(true);
  });

  it("(b) a SaaS: no Where and when, and no areaServed anywhere", () => {
    const doc = render(stored(OFFERING_FIXTURES["(b) a SaaS with no place"]));
    expect(h2(doc, WHERE)).toBeUndefined();
    expect(JSON.stringify(graph(doc))).not.toContain("areaServed");
    expect(doc.querySelector("svg.lucide-clock")).toBeNull();
  });

  it("(e) fewer than three questions buyers asked: no questions section and no FAQPage", () => {
    const doc = render(stored(OFFERING_FIXTURES["(e) a plumber with two questions buyers asked"]));
    expect(h2(doc, copy("body.faq.heading"))).toBeUndefined();
    expect(ofType(doc, "FAQPage")).toEqual([]);
  });

  it("(f) no other live page: no more guides", () => {
    const doc = render(stored(PLUMBER), []);
    expect(labelled(doc, copy("body.guides.heading", { publisher: BUSINESS.name }))).toBeUndefined();
  });
});

describe("E26, E41: where and when: map-pin per area, no clock; step tiles are numbers", () => {
  it("(a) a plain opening line right before the pin list, no clock, each place the pin, and no step a glyph", () => {
    const doc = render(stored(PLUMBER));
    expect(doc.querySelector("svg.lucide-clock")).toBeNull();
    const pins = doc.querySelectorAll("li svg.lucide-map-pin");
    const list = pins[0]?.closest("ul");
    // The last element before the list in document order: the prose block's closing paragraph.
    const prior = list?.previousElementSibling;
    const line = prior?.tagName === "P" ? prior : prior?.lastElementChild;
    expect(line?.tagName).toBe("P");
    expect(line?.querySelector("svg")).toBeNull();
    expect(text(line)).toBe("It serves the areas the main site lists:");
    expect([...pins].map((pin) => text(pin.closest("li")))).toEqual(whereList(doc));
    const steps = [...doc.querySelectorAll("article ol li")];
    expect(steps).toHaveLength(4);
    expect(steps.every((step) => step.querySelector("svg") === null)).toBe(true);
    expect(doc.querySelector("svg.lucide-flame")).toBeNull();
  });
});

describe("a page already live keeps its body", () => {
  it("a stored draft laid out before E10, with a section the rule would now leave out, renders every section as it was written", () => {
    // A SaaS page written to the whole template before, its Where and when not recorded.
    const page = { ...stored(OFFERING_FIXTURES["(b) a SaaS with no place"], TEMPLATES.offering), whereWhen: undefined };
    const doc = render(page);
    for (const heading of HEADINGS) expect(h2(doc, heading)).toBeDefined();
    expect([...doc.querySelectorAll("article li")].map(text)).toEqual(expect.arrayContaining(["Austin", "Round Rock", "Pflugerville", "Cedar Park"]));
    expect(JSON.stringify(graph(doc))).not.toContain("areaServed");
  });
});
