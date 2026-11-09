/** @vitest-environment jsdom */
// Ruling E10 (seo-master on #1715, 2026-10-24): every full business block on a
// hosted page draws the business's one line and, where its market stores a
// place, "Serves {place}." after lucide's pin, in the site's language. A place
// is never inferred, and the page's markup says nothing more. Four kinds of
// site: a local plumber, a SaaS with no place, a German business and a site
// with neither. 0¢.
import { renderToStaticMarkup } from "react-dom/server";
import { MapPin } from "lucide-react";
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { readIn, readingIn } from "@/lib/presentation/copy/reader";
import { mainSiteOf } from "@/lib/site-profile/main-site-row";
import type { HostedPage } from "@/lib/publish/destinations/hosted";

applyEnvFixture();

const { HostedArticle } = await import("@/app/(hosted)/hosted-page/[[...slug]]/article");
const { HostedIndex } = await import("@/app/(hosted)/hosted-page/[[...slug]]/listing");
const { HostedGoneBody } = await import("@/app/(hosted)/hosted-page/[[...slug]]/gone");
const { Glyph } = await import("@/app/(hosted)/hosted-page/[[...slug]]/chrome");
type HostedBusiness = import("@/app/(hosted)/hosted-page/[[...slug]]/chrome").HostedBusiness;

interface Site {
  language: "en" | "de";
  business: HostedBusiness;
  /** The sentence each full block draws after the line, or `null`. */
  serves: string | null;
}

const PHONE = "(512) 555-0142";

const SITES: Record<string, Site> = {
  "(a) a plumber with a line, Austin and region TX": {
    language: "en",
    serves: "Serves Austin, TX.",
    business: {
      domain: "harborplumbing.example",
      name: "Harbor Plumbing",
      logoType: null,
      line: "Licensed plumbers in Austin, TX: repairs, water heaters and 24-hour emergency calls.",
      mainSite: mainSiteOf({ home: "https://harborplumbing.example/", phone: PHONE }),
      offer: { category: "a plumber", place: "Austin", region: "TX" },
    },
  },
  "(b) a SaaS with a line and no place": {
    language: "en",
    serves: null,
    business: {
      domain: "tallyhq.example",
      name: "Tally",
      logoType: null,
      line: "Onboarding checklists with one owner for every step.",
      mainSite: mainSiteOf({ home: "https://tallyhq.example/", phone: PHONE }),
      offer: { category: "onboarding checklist software", place: null, region: null },
    },
  },
  "(c) a German business with a place": {
    language: "de",
    serves: "Vor Ort in Düsseldorf, Nordrhein-Westfalen.",
    business: {
      domain: "mueller-sanitaer.example",
      name: "Müller Sanitär",
      logoType: null,
      line: "Sanitär und Heizung für Haus und Betrieb.",
      mainSite: mainSiteOf({ home: "https://mueller-sanitaer.example/", phone: "0211 123456" }),
      offer: { category: "Sanitär-Notdienst", place: "Düsseldorf", region: "Nordrhein-Westfalen" },
    },
  },
  "(d) a site with neither a line nor a place": {
    language: "en",
    serves: null,
    business: {
      domain: "nothing.example",
      name: "Nothing Stored",
      logoType: null,
      line: null,
      mainSite: mainSiteOf({ home: "https://nothing.example/", phone: PHONE }),
    },
  },
};

const BODY = [":::answer", "Close the main valve.", ":::", "", "## Where is the main valve?", "", "Where the water line comes in."].join("\n");

function pageFor(business: HostedBusiness, offering: boolean): HostedPage {
  const at = new Date("2026-10-19T11:00:00.000Z");
  const liveUrl = `https://content.${business.domain}/shut-off-water`;
  return {
    publicationId: "pub-1",
    siteId: "site-1",
    slug: "shut-off-water",
    title: "How to shut off water to a house",
    heading: null,
    bodyMd: BODY,
    description: null,
    faq: [],
    grounded: null,
    made: null,
    publisher: { name: business.domain, category: null, timeZone: "UTC" },
    byline: null,
    offering,
    businessFit: null,
    publishedAt: at,
    firstPublishedAt: at,
    liveUrl,
    record: { opportunityId: "opp-1", targetQuery: "shut off water", measuredOn: at, mode: "autopilot", liveUrl },
  };
}

function renderIn(language: "en" | "de", draw: () => React.JSX.Element): string {
  return readingIn(() => {
    readIn(language);
    return renderToStaticMarkup(draw());
  });
}

const article = (site: Site, offering: boolean): string => {
  const page = pageFor(site.business, offering);
  return renderIn(site.language, () => (
    <HostedArticle resolved={{ page, canonical: page.liveUrl, others: [], business: site.business }} />
  ));
};
const index = (site: Site): string =>
  renderIn(site.language, () => (
    <HostedIndex
      business={site.business}
      canonical={`https://content.${site.business.domain}/`}
      pages={[pageFor(site.business, false)]}
      query=""
      page={1}
    />
  ));
const gone = (site: Site): string => renderIn(site.language, () => <HostedGoneBody business={site.business} />);

const parsed = (html: string): Document => new DOMParser().parseFromString(html, "text/html");
const ABOUT = { en: "About ", de: "Über " } as const;

/** What the index draws between its title and its search. */
function openingOf(doc: Document): Element {
  const opening = doc.createElement("div");
  for (let at = doc.querySelector("main h1")!.nextElementSibling; at !== null && at.tagName !== "FORM"; at = at.nextElementSibling) {
    opening.append(at.cloneNode(true));
  }
  return opening;
}

/** Each block a page draws the business in, by kind. */
function blocks(site: Site): Record<string, Element[]> {
  const full = (doc: Document): Element[] =>
    [...doc.querySelectorAll("aside")].filter((aside) => aside.getAttribute("aria-label")?.startsWith(ABOUT[site.language]));
  const indexDoc = parsed(index(site));
  return {
    "the article's about card": full(parsed(article(site, false))),
    "the offering page's block under the answer and at the foot": full(parsed(article(site, true))),
    "the 410 page's block": full(parsed(gone(site))),
    "the index opening": [openingOf(indexDoc)],
    "the index's compact block": [...indexDoc.querySelectorAll("main aside")],
  };
}

const EXPECTED_COUNTS: Record<string, number> = {
  "the article's about card": 1,
  "the offering page's block under the answer and at the foot": 2,
  "the 410 page's block": 1,
  "the index opening": 1,
  "the index's compact block": 1,
};

const PIN = renderToStaticMarkup(<Glyph name="map-pin" />);

describe("E10 — every full business block draws the line and, where stored, the place it serves", () => {
  for (const [name, site] of Object.entries(SITES)) {
    for (const [kind, drawn] of Object.entries(blocks(site))) {
      it(`${name}: ${kind}`, () => {
        expect(drawn).toHaveLength(EXPECTED_COUNTS[kind]!);
        for (const block of drawn) {
          const text = block.textContent ?? "";
          if (site.business.line !== null) expect(text).toContain(site.business.line);
          const sentences = [...block.querySelectorAll("span")].filter((span) => /^(Serves|Vor Ort in) /.test(span.textContent ?? ""));
          expect(sentences.map((span) => span.textContent)).toEqual(site.serves === null ? [] : [site.serves]);
          // The sentence opens with lucide's pin, hidden from a screen reader; no place, no pin.
          for (const span of sentences) expect(span.firstElementChild?.outerHTML).toBe(PIN);
          expect(block.querySelectorAll("svg.lucide-map-pin")).toHaveLength(site.serves === null ? 0 : 1);
          expect(text.replace(site.serves ?? "", "")).not.toMatch(/Serves|Vor Ort/);
        }
      });
    }
  }

  it("(d) draws no line and no place: its index opens with nothing between the title and the search", () => {
    const site = SITES["(d) a site with neither a line nor a place"]!;
    expect(openingOf(parsed(index(site))).innerHTML).toBe("");
  });

  it("the index's compact block reads the line and the place as one sentence after its question", () => {
    const site = SITES["(a) a plumber with a line, Austin and region TX"]!;
    const [compact] = blocks(site)["the index's compact block"]!;
    const lines = [...compact!.querySelectorAll("p")].map((p) => p.textContent);
    expect(lines).toEqual([
      "Need a plumber in Austin?",
      "Licensed plumbers in Austin, TX: repairs, water heaters and 24-hour emergency calls. Serves Austin, TX.",
    ]);
  });

  it("a region already in the stored name is not written twice, and a place with no region is the name", () => {
    const plumber = SITES["(a) a plumber with a line, Austin and region TX"]!;
    const sentence = (offer: HostedBusiness["offer"]): string | null | undefined =>
      [...parsed(gone({ ...plumber, business: { ...plumber.business, offer } })).querySelectorAll("aside span")]
        .map((span) => span.textContent)
        .find((text) => text?.startsWith("Serves"));
    expect(sentence({ category: "a plumber", place: "Austin, TX", region: "TX" })).toBe("Serves Austin, TX.");
    expect(sentence({ category: "a plumber", place: "Austin", region: null })).toBe("Serves Austin.");
    expect(sentence({ category: "a plumber", place: "Austin" })).toBe("Serves Austin.");
  });

  it("the pin is lucide's own MapPin, not a drawing of our own", () => {
    const inner = (svg: string): string => /<svg[^>]*>(.*)<\/svg>/s.exec(svg)?.[1] ?? "";
    expect(inner(PIN)).toBe(inner(renderToStaticMarkup(<MapPin />)));
    expect(inner(PIN)).not.toBe("");
    expect(PIN).toContain('aria-hidden="true"');
  });
});

/** Every JSON-LD block a render carries, parsed. */
function jsonLd(html: string): unknown[] {
  return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((match) => JSON.parse(match[1] ?? ""));
}

describe("E10 — the markup says nothing new", () => {
  for (const [name, site] of Object.entries(SITES)) {
    it(`${name}: the JSON-LD is what it was with no place stored, with no areaServed and no "Serves"`, () => {
      const unplaced: Site = { ...site, business: { ...site.business, offer: null } };
      for (const draw of [(s: Site) => article(s, false), (s: Site) => article(s, true), index]) {
        const stated = jsonLd(draw(site));
        expect(stated.length).toBeGreaterThan(0);
        expect(stated).toEqual(jsonLd(draw(unplaced)));
        expect(JSON.stringify(stated)).not.toMatch(/areaServed|Serves|Vor Ort/);
      }
    });
  }
});
