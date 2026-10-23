/** @vitest-environment jsdom */
// Owner R1 (2026-10-22): a hosted page leads to the business's own action in
// fixed places, from what the scan stored and nothing else. The header holds
// the primary action and Visit; the compact block, after the takeaways, holds
// the primary action where the page's search is the business's own offering
// (fit 3); the full block holds it, at most two quiet links and Visit, at a
// guide's foot and under an offering page's short answer and at its foot.
// Four kinds of site: a local plumber, a SaaS with nothing but its home, a
// German Handwerker and a site with no reading at all. 0¢.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { readIn, readingIn } from "@/lib/presentation/copy/reader";
import { mainSiteOf } from "@/lib/site-profile/main-site-row";
import type { HostedPage } from "@/lib/publish/destinations/hosted";

applyEnvFixture();

const { HostedArticle } = await import("@/app/(hosted)/hosted-page/[[...slug]]/article");
const { HostedIndex } = await import("@/app/(hosted)/hosted-page/[[...slug]]/listing");
const { readMainSite } = await import("@/lib/site-profile/main-site");
type HostedBusiness = import("@/app/(hosted)/hosted-page/[[...slug]]/chrome").HostedBusiness;

interface Site {
  language: "en" | "de";
  business: HostedBusiness;
  /** Whether a primary action is stored for it. */
  stored: boolean;
  /** The number it stores, or `null`. */
  phone: string | null;
}

const SITES: Record<string, Site> = {
  "a local plumber with phone, book and quote": {
    language: "en",
    stored: true,
    phone: "(512) 555-0142",
    business: {
      domain: "harborplumbing.example",
      name: "Harbor Plumbing",
      logoType: null,
      line: "Licensed plumbers in Austin, TX.",
      mainSite: mainSiteOf({
        home: "https://harborplumbing.example/",
        phone: "(512) 555-0142",
        actions: [
          { kind: "book", url: "https://harborplumbing.example/book" },
          { kind: "quote", url: "https://harborplumbing.example/get-a-quote" },
        ],
      }),
      offer: { category: "emergency plumbing", place: "Austin" },
    },
  },
  "a SaaS site with no phone and no stored action": {
    language: "en",
    stored: false,
    phone: null,
    business: {
      domain: "tallyhq.example",
      name: "Tally",
      logoType: null,
      line: null,
      mainSite: mainSiteOf({ home: "https://www.tallyhq.example/" }),
      offer: { category: "onboarding checklist software", place: null },
    },
  },
  "a SaaS site with no phone and a demo link": {
    language: "en",
    stored: true,
    phone: null,
    business: {
      domain: "tallyhq.example",
      name: "Tally",
      logoType: null,
      line: null,
      mainSite: mainSiteOf({
        home: "https://www.tallyhq.example/",
        actions: [{ kind: "book", url: "https://www.tallyhq.example/demo", book: "demo" }],
      }),
      offer: { category: "onboarding checklist software", place: null },
    },
  },
  "a German Handwerker": {
    language: "de",
    stored: true,
    phone: "0211 123456",
    business: {
      domain: "mueller-sanitaer.example",
      name: "Müller Sanitär",
      logoType: null,
      line: null,
      mainSite: mainSiteOf({
        home: "https://mueller-sanitaer.example/",
        phone: "0211 123456",
        actions: [{ kind: "book", url: "https://mueller-sanitaer.example/termin" }],
      }),
      offer: { category: "Sanitär-Notdienst", place: "Düsseldorf" },
    },
  },
  "a site with nothing stored": {
    language: "en",
    stored: false,
    phone: null,
    business: { domain: "nothing.example", name: "Nothing Stored", logoType: null, line: null },
  },
};

const BODY = [
  ":::answer",
  "Close the main valve: a lever a quarter turn, a wheel clockwise.",
  ":::",
  "",
  ":::takeaways",
  "- Most homes have one main valve.",
  "- A lever is closed when it sits across the pipe.",
  ":::",
  "",
  "## Where is the main valve?",
  "",
  "Where the water line comes into the house.",
  "",
  "## What if it will not close?",
  "",
  "Call the water utility.",
].join("\n");

function pageFor(business: HostedBusiness, a: { fit: number | null; offering?: boolean; bodyMd?: string }): HostedPage {
  const at = new Date("2026-10-19T11:00:00.000Z");
  const liveUrl = `https://content.${business.domain}/shut-off-water`;
  return {
    publicationId: "pub-1",
    siteId: "site-1",
    slug: "shut-off-water",
    title: "How to shut off water to a house",
    heading: null,
    bodyMd: a.bodyMd ?? BODY,
    description: null,
    faq: [],
    grounded: null,
    made: null,
    publisher: { name: business.domain, category: null, timeZone: "UTC" },
    byline: null,
    offering: a.offering ?? false,
    businessFit: a.fit,
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

function article(site: Site, a: { fit: number | null; offering?: boolean; bodyMd?: string }): string {
  const page = pageFor(site.business, a);
  return renderIn(site.language, () => (
    <HostedArticle resolved={{ page, canonical: page.liveUrl, others: [], business: site.business }} />
  ));
}

const parsed = (html: string): Document => new DOMParser().parseFromString(html, "text/html");
const ABOUT = { en: "About ", de: "Über " } as const;
/** The full blocks: the cards that name the business. */
const fullBlocks = (doc: Document, site: Site): Element[] =>
  [...doc.querySelectorAll("aside")].filter((aside) => aside.getAttribute("aria-label")?.startsWith(ABOUT[site.language]));
/** The compact blocks: every other card in the article. */
const compactBlocks = (doc: Document, site: Site): Element[] =>
  [...doc.querySelectorAll("main aside")].filter((aside) => !fullBlocks(doc, site).includes(aside));
const boxLabelled = (doc: Document, label: string): Element =>
  [...doc.querySelectorAll("p")].find((p) => p.textContent === label)!.parentElement!;
const follows = (later: Element, earlier: Element): boolean =>
  (earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
const QUIET = /\/(book|get-a-quote|termin)$/;

describe("condition 1 — the compact block follows its rule", () => {
  for (const [name, site] of Object.entries(SITES)) {
    for (const fit of [3, 2, null]) {
      it(`${name}, fit ${fit}: it renders iff the fit is 3 and an action is stored`, () => {
        const doc = parsed(article(site, { fit }));
        expect(compactBlocks(doc, site)).toHaveLength(fit === 3 && site.stored ? 1 : 0);
      });
    }

    it(`${name}: it comes after the takeaways, never before the answer box, and outside every question section`, () => {
      const doc = parsed(article(site, { fit: 3 }));
      for (const compact of compactBlocks(doc, site)) {
        const answer = boxLabelled(doc, site.language === "de" ? "Die kurze Antwort" : "The short answer");
        const takeaways = boxLabelled(doc, site.language === "de" ? "Das Wichtigste in Kürze" : "Key takeaways");
        expect(follows(compact, answer) && follows(compact, takeaways)).toBe(true);
        expect(compact.nextElementSibling?.querySelector("h2")?.textContent).toBe("Where is the main valve?");
        expect(compact.closest(".prose")).toBeNull();
      }
    });
  }

  it("a page with no takeaways draws it after the short answer, and the answer stays the first content", () => {
    const site = SITES["a local plumber with phone, book and quote"]!;
    const doc = parsed(article(site, { fit: 3, bodyMd: BODY.replace(/:::takeaways[\s\S]*?:::\n/, "") }));
    const [compact] = compactBlocks(doc, site);
    expect(follows(compact!, boxLabelled(doc, "The short answer"))).toBe(true);
    expect(doc.querySelector("article .prose")?.firstElementChild?.textContent).toMatch(/^The short answer/);
  });

  it("the headline asks in the market's category and place, else names the business", () => {
    const plumber = SITES["a local plumber with phone, book and quote"]!;
    expect(compactBlocks(parsed(article(plumber, { fit: 3 })), plumber)[0]?.textContent).toContain("Need emergency plumbing in Austin?");
    const unplaced = { ...plumber, business: { ...plumber.business, offer: { category: "drain cleaning", place: null } } };
    expect(compactBlocks(parsed(article(unplaced, { fit: 3 })), unplaced)[0]?.textContent).toContain("Need drain cleaning?");
    const unknown = { ...plumber, business: { ...plumber.business, offer: null } };
    expect(compactBlocks(parsed(article(unknown, { fit: 3 })), unknown)[0]?.textContent).toContain("Questions for Harbor Plumbing?");
  });
});

describe("condition 2 — the full block and the header follow their limits", () => {
  for (const [name, site] of Object.entries(SITES)) {
    for (const offering of [false, true]) {
      it(`${name}, ${offering ? "an offering page" : "a guide"}: no quiet link in the header or the compact block, and at most 1 + 2 in a full block`, () => {
        const doc = parsed(article(site, { fit: 3, offering }));
        const header = doc.querySelector("header")!;
        expect([...header.querySelectorAll("a")].filter((a) => QUIET.test(a.getAttribute("href") ?? ""))).toEqual([]);
        expect(header.querySelectorAll("a.btn").length).toBe(site.stored ? 2 : 1);
        for (const compact of compactBlocks(doc, site)) expect(compact.querySelectorAll("a")).toHaveLength(1);
        for (const full of fullBlocks(doc, site)) {
          // One button is Visit; at most one more is the primary action.
          expect(full.querySelectorAll("a.btn").length).toBeLessThanOrEqual(2);
          expect(full.querySelectorAll("ul[role=list] a").length).toBeLessThanOrEqual(2);
          // Visit comes last.
          expect([...full.querySelectorAll("a")].at(-1)?.getAttribute("href")).toBe(site.business.mainSite?.home ?? `https://${site.business.domain}/`);
        }
      });
    }
  }

  it("the plumber's full block is the call, then Book a visit and Ask for a quote, then Visit", () => {
    const site = SITES["a local plumber with phone, book and quote"]!;
    const [full] = fullBlocks(parsed(article(site, { fit: 3 })), site);
    expect([...full!.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Call (512) 555-0142", "tel:5125550142"],
      ["Book a visit", "https://harborplumbing.example/book"],
      ["Ask for a quote", "https://harborplumbing.example/get-a-quote"],
      ["Visit Harbor Plumbing", "https://harborplumbing.example/"],
    ]);
  });

  it("a guide carries the full block at its foot only", () => {
    const site = SITES["a local plumber with phone, book and quote"]!;
    const doc = parsed(article(site, { fit: 3 }));
    const [full, ...more] = fullBlocks(doc, site);
    expect(more).toEqual([]);
    expect(follows(full!, [...doc.querySelectorAll("article .prose")].at(-1)!)).toBe(true);
  });

  it("an offering page carries it directly under the short answer, and again at the foot", () => {
    const site = SITES["a local plumber with phone, book and quote"]!;
    const doc = parsed(article(site, { fit: 3, offering: true }));
    const [under, foot, ...more] = fullBlocks(doc, site);
    expect(more).toEqual([]);
    expect(under!.previousElementSibling?.lastElementChild?.textContent).toMatch(/^The short answer/);
    expect(follows(foot!, [...doc.querySelectorAll("article .prose")].at(-1)!)).toBe(true);
  });

  it("a site with nothing stored shows Visit only, and the page is the render it had before", async () => {
    const site = SITES["a site with nothing stored"]!;
    for (const offering of [false, true]) {
      const html = article(site, { fit: 3, offering });
      const blocks = fullBlocks(parsed(html), site);
      expect(blocks).toHaveLength(1);
      expect([...blocks[0]!.querySelectorAll("a")].map((a) => a.textContent)).toEqual(["Visit Nothing Stored"]);
      await expect(html).toMatchFileSnapshot(`./__goldens__/nothing-stored-${offering ? "offering" : "guide"}.html`);
    }
  });
});

/** Every value under every `telephone` key, and whether a forbidden type or key appears. */
function telephones(html: string): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object" || node === null) return;
    for (const [key, value] of Object.entries(node)) {
      if (key === "telephone") out.push(String(value));
      walk(value);
    }
  };
  for (const match of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) walk(JSON.parse(match[1] ?? ""));
  return out;
}

describe("condition 3 — the markup tells the truth", () => {
  for (const [name, site] of Object.entries(SITES)) {
    for (const offering of [false, true]) {
      it(`${name}, ${offering ? "an offering page" : "a guide"}: telephone is the visible tel: text, or absent; no potentialAction, Review or AggregateRating`, () => {
        const html = article(site, { fit: 3, offering });
        const shown = parsed(html).querySelector('header a[href^="tel:"]')?.textContent ?? null;
        expect(shown).toBe(site.phone);
        const stated = telephones(html);
        if (shown === null) expect(stated).toEqual([]);
        else {
          expect(stated.length).toBeGreaterThan(0);
          for (const phone of stated) expect(phone).toBe(shown);
        }
        expect(html).not.toMatch(/potentialAction|"Review"|AggregateRating/);
      });
    }
  }

  it("the German Handwerker's blocks are labelled in German", () => {
    const site = SITES["a German Handwerker"]!;
    const doc = parsed(article(site, { fit: 3 }));
    expect(compactBlocks(doc, site)[0]?.textContent).toBe("Sie suchen Sanitär-Notdienst in Düsseldorf?0211 123456 anrufen");
    expect([...fullBlocks(doc, site)[0]!.querySelectorAll("a")].map((a) => a.textContent)).toEqual([
      "0211 123456 anrufen",
      "Termin vereinbaren",
      "Müller Sanitär besuchen",
    ]);
  });
});

describe("the index: the header phone, and the compact block where a phone is stored", () => {
  const index = (site: Site): Document => {
    const pages = [pageFor(site.business, { fit: null })];
    return parsed(
      renderIn(site.language, () => (
        <HostedIndex business={site.business} canonical={`https://content.${site.business.domain}/`} pages={pages} query="" page={1} />
      ))
    );
  };

  for (const [name, site] of Object.entries(SITES)) {
    const phone = site.phone;
    it(`${name}: ${phone === null ? "no call and no compact block" : "the call in the header and once in a compact block"}`, () => {
      const doc = index(site);
      expect(doc.querySelector('header a[href^="tel:"]')?.textContent ?? null).toBe(phone);
      const compact = [...doc.querySelectorAll("main aside")];
      expect(compact).toHaveLength(phone === null ? 0 : 1);
      for (const block of compact) expect([...block.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual([`tel:${phone!.replace(/[^\d+]/g, "")}`]);
    });
  }

  it("a site whose only stored action is a page draws no compact block on its index", () => {
    const site = SITES["a German Handwerker"]!;
    const bookOnly = { ...site, business: { ...site.business, mainSite: { ...site.business.mainSite!, phone: null } } };
    expect(index(bookOnly).querySelectorAll("main aside")).toHaveLength(0);
  });
});

describe("a book button says what it books", () => {
  const SAAS = SITES["a SaaS site with no phone and a demo link"]!;
  const PLUMBER = SITES["a local plumber with phone, book and quote"]!;
  /** The site as the scan reads `link` in its home's header, stored and read back, with no phone. */
  const reading = (site: Site, link: string): Site => {
    const read = readMainSite({ domain: site.business.domain, homeUrl: `https://${site.business.domain}/`, homeHtml: `<header>${link}</header>`, pages: [], ours: null });
    return { ...site, business: { ...site.business, mainSite: mainSiteOf(JSON.parse(JSON.stringify(read))) } };
  };
  const primary = (site: Site): [string | null, string | null] => {
    const button = parsed(article(site, { fit: 3 })).querySelector("header a.btn")!;
    return [button.textContent, button.getAttribute("href")];
  };

  it("book sub-kinds: a demo, a call, and a local visit, from the link the scan stored", () => {
    expect(primary(reading(SAAS, '<a href="/demo">Book a demo</a>'))).toEqual(["Book a demo", "https://tallyhq.example/demo"]);
    expect(primary(reading(SAAS, '<a href="/book-a-call">Schedule a call</a>'))).toEqual(["Book a call", "https://tallyhq.example/book-a-call"]);
    expect(primary(reading(PLUMBER, '<a href="/booking">Book now</a>'))).toEqual(["Book a visit", "https://harborplumbing.example/booking"]);
    expect(primary(reading(SAAS, '<a href="/booking">Book now</a>'))).toEqual(["Book online", "https://tallyhq.example/booking"]);
  });

  it("a SaaS site with no phone leads its header with Book a demo, and nothing on the page says Book a visit", () => {
    const html = article(SAAS, { fit: 3, offering: true });
    expect(primary(SAAS)).toEqual(["Book a demo", "https://www.tallyhq.example/demo"]);
    expect(html).not.toContain("Book a visit");
  });

  it("a book row stored before sub-kinds reads Book online, unless the business serves a place", () => {
    const before = { home: "https://www.tallyhq.example/", actions: [{ kind: "book", url: "https://www.tallyhq.example/book" }] };
    const saas = { ...SAAS, business: { ...SAAS.business, mainSite: mainSiteOf(before) } };
    const html = article(saas, { fit: 3, offering: true });
    expect(primary(saas)).toEqual(["Book online", "https://www.tallyhq.example/book"]);
    expect(html).not.toContain("Book a visit");
    const placed = { ...saas, business: { ...saas.business, offer: { category: "plumbing", place: "Austin" } } };
    expect(primary(placed)[0]).toBe("Book a visit");
  });
});
