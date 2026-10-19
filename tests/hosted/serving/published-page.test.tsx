/** @vitest-environment jsdom */
// tests/hosted/serving/published-page.test.tsx — UI-SPEC S19, REQ-059, issue #375
//
// **What the customer's own page looks like**, which until now nothing
// asserted: the head and the schema are `tests/hosted/indexing/head.test.tsx`'s
// and are not re-tested here. This file is the set's own structure — their
// mark and name, the category they chose, the title, the byline, the body
// with §8's passage marked and its source under it, the canonical note, and
// their footer line — plus the two properties that make it *theirs*: every
// value on the surface is the customer's, and nothing on it is the
// product's colour.
//
// The page is called directly and rendered to static markup, the same
// convention `head.test.tsx` uses, so there is no browser here and no
// second renderer: what is asserted is the HTML a visitor's first byte
// carries.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { MARK_CLASS } from "@/app/(account)/app/draft/[draftId]/present";

applyEnvFixture();

const state: { host: string; page: unknown; others: unknown[]; identity: Record<string, unknown> } = {
  host: "content.example.com",
  page: null,
  others: [],
  identity: {},
};

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: state.host }),
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
    hostedSiteForDomain: async (domain: string) =>
      domain === "example.com"
        ? { siteId: "site-1", domain, host: `content.${domain}` }
        : null,
    // SPEC §5 (2026-09-12): the Host is matched whole against the host on
    // the destination row. These suites describe a site whose row predates
    // the label being a choice, so the whole-host lookup finds nothing and
    // the default-label lookup beside it is what serves them.
    hostedSiteForHostname: async () => null,
    livePageBySlug: async () => state.page,
    livePagesForSite: async () => (state.page === null ? [] : [state.page, ...state.others]),
    hostedIdentity: async (a: { domain: string }) => ({
      name: a.domain,
      logoType: null,
      line: null,
      ...state.identity,
    }),
    hostedAddress: async () => ({ state: "none", publicationId: null }),
  };
});

const Page = (await import("@/app/(hosted)/hosted-page/[[...slug]]/page")).default;
const { COPY } = await import("@/lib/presentation/copy");
const { readMainSite } = await import("@/lib/site-profile/main-site");
const { mainSiteOf } = await import("@/lib/site-profile/main-site-row");

const PASSAGE = "a non-engineer can ship a change";

/** One live page, with everything S19 draws: a category, a stated zone, a
 *  recorded grounding whose passage occurs in the body verbatim. */
function livePage(over: Record<string, unknown> = {}): unknown {
  const page = {
    publicationId: "pub-1",
    siteId: "site-1",
    slug: "a-page",
    title: "The best onboarding tools",
    bodyMd: `Teams pick a tool on one question: whether ${PASSAGE}.\n\n## What to look for\n\nTime to the first flow.`,
    description: "What teams look for in an onboarding tool.",
    faq: [],
    made: null,
    grounded: {
      passage: PASSAGE,
      url: "https://example.org/onboarding-tools-compared",
      readAt: new Date("2026-08-28T00:00:00.000Z"),
    },
    publisher: {
      name: "example.com",
      category: "user onboarding software",
      timeZone: "America/New_York",
    },
    publishedAt: new Date("2026-09-04T11:00:00.000Z"),
    liveUrl: "https://content.example.com/a-page",
    record: {
      opportunityId: "opp-1",
      targetQuery: "best onboarding tools",
      measuredOn: new Date("2026-08-28T00:00:00.000Z"),
      mode: "autopilot",
      liveUrl: "https://content.example.com/a-page",
    },
    ...over,
  };
  // A page never refreshed: the day it went live is the day it was published.
  return { byline: null, firstPublishedAt: page.publishedAt, ...page };
}

async function render(): Promise<string> {
  const tree = await Page({ params: Promise.resolve({ slug: ["a-page"] }) });
  return renderToStaticMarkup(tree);
}

beforeEach(() => {
  state.host = "content.example.com";
  state.page = livePage();
  state.others = [];
  state.identity = {};
});

describe("D51 — the H1 is the longer form, and the title stays the search form", () => {
  it("prints the heading generation wrote as the page's one h1", async () => {
    state.page = livePage({ heading: "Which onboarding tool should a small product team pick?" });
    const html = await render();
    expect(html.match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1]).toBe("Which onboarding tool should a small product team pick?");
    expect(html.match(/<h1/g)).toHaveLength(1);
  });
});

describe("S19 — the customer is the publisher, and the page says so", () => {
  it("the header is theirs: a first-letter tile and their name linking to the index, and a button to their site", async () => {
    state.identity = { name: "Example Co" };
    const html = await render();
    const bar = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    expect(bar).toMatch(/<a href="\/"[^>]*>.*>E<\/span>.*Example Co/s);
    expect(bar).toMatch(/<a href="https:\/\/example\.com\/"[^>]*>.*Visit Example Co/s);
    expect(bar).not.toContain("<img");
    expect(bar).not.toContain("primary");
  });

  it("a site with a kept logo draws it from its own host, not from ours or the main site", async () => {
    state.identity = { logoType: "image/png" };
    const html = await render();
    expect(html).toContain('<img src="/logo.img" alt=""');
  });

  it("the category they chose is the eyebrow, and a site that chose none draws none", async () => {
    expect(await render()).toContain(">user onboarding software</span>");

    state.page = livePage({
      publisher: { name: "example.com", category: null, timeZone: "America/New_York" },
    });
    const html = await render();
    expect(html).not.toContain("user onboarding software");
    // And the page still renders: an unstated category withholds an
    // eyebrow, never the page.
    expect(html).toContain("The best onboarding tools");
  });

  it("the byline is the set's own line, in the zone the customer publishes in", async () => {
    // 11:00 UTC on 4 Sep is 07:00 in New York, so the day is the same one
    // either way — and the zone is still read, which the next case proves.
    expect(await render()).toContain("published 4 Sep 2026 · by example.com");
  });

  it("the byline setup recorded replaces the domain, and a refreshed page states both dates (SPEC §7, 2026-09-29)", async () => {
    state.page = livePage({
      byline: "Ada Lovelace · Founder, Example",
      firstPublishedAt: new Date("2026-09-04T11:00:00.000Z"),
      publishedAt: new Date("2026-09-20T11:00:00.000Z"),
    });
    const html = await render();
    expect(html).toContain("published 4 Sep 2026 · updated 20 Sep 2026 · by Ada Lovelace · Founder, Example");
    expect(html).toContain('"datePublished":"2026-09-04T11:00:00.000Z","dateModified":"2026-09-20T11:00:00.000Z"');
  });

  it("a moment that falls on a different day in the customer's zone is written in theirs", async () => {
    // 01:00 UTC on 5 Sep is 21:00 on the 4th in New York. The page states
    // the customer's day, not the server's.
    state.page = livePage({ publishedAt: new Date("2026-09-05T01:00:00.000Z") });
    expect(await render()).toContain("published 4 Sep 2026");
  });

  it("a site with no stated zone still states its date, in UTC rather than in one nobody chose", async () => {
    // REQ-073 c1 forbids inventing a zone. A page that withheld its own
    // publication date because a setting was blank would be worse than one
    // that states the day it is in UTC.
    state.page = livePage({
      publishedAt: new Date("2026-09-05T01:00:00.000Z"),
      publisher: { name: "example.com", category: null, timeZone: null },
    });
    expect(await render()).toContain("published 5 Sep 2026");
  });

  it("§8's recorded passage is marked in the body, and its source stated under it", async () => {
    const html = await render();
    // The map, not a second copy of its string: S16 and S19 draw the mark
    // from one shared class, and a hosted page that dressed it its own way
    // is what issue #414 found. Spelling the string here would let the two
    // drift again and still pass.
    expect(html).toContain(`<mark class="${MARK_CLASS}">${PASSAGE}</mark>`);
    // 00:00 UTC on the 28th is 20:00 on the 27th in New York: the source's
    // date is written in the customer's zone too, so the two dates on the
    // page are read the same way.
    expect(html).toContain(
      "source: example.org/onboarding-tools-compared · retrieved 27 Aug 2026"
    );
  });

  it("a passage the body no longer carries marks nothing, and says nothing about a source", async () => {
    // REQ-045 c8's rule, on the published side: a fact that did not survive
    // the edit is a fact the page is no longer grounded in. The body renders
    // whole and unmarked — never the nearest thing to the passage.
    state.page = livePage({ bodyMd: "A body the recorded passage is not in." });
    const html = await render();
    expect(html).not.toContain("<mark");
    expect(html).toContain("A body the recorded passage is not in.");
  });

  it("a page with no recorded grounding draws no source line at all", async () => {
    state.page = livePage({ grounded: null });
    const html = await render();
    expect(html).not.toContain("source:");
    expect(html).not.toContain("<mark");
  });

  it("a body that opens with the title prints it once, and its headings sit under it", async () => {
    state.page = livePage({ bodyMd: "# The Best Onboarding Tools\n\nIntro.\n\n## What to look for\n\nText." });
    const html = await render();
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain("<h2");
    expect(html).not.toContain("The Best Onboarding Tools");
  });

  it("headings carry ids minted from their text, and two or more make a table of contents that links to them", async () => {
    state.page = livePage({ bodyMd: "Intro.\n\n## What to look for\n\nText.\n\n## What it costs\n\nText." });
    const html = await render();
    expect(html).toContain('<h2 id="what-to-look-for">');
    expect(html).toContain('href="#what-it-costs"');
    // Sticky beside the article from `lg`, a block that opens below it.
    expect(html).toMatch(/<details[^>]*lg:hidden/);
    expect(html).toMatch(/<nav[^>]*sticky[^>]*lg:block/);
    expect(html).toContain("On this page");
  });

  it("a page with one section draws no table of contents", async () => {
    expect(await render()).not.toContain("On this page");
  });

  it("the metadata carries the reading time", async () => {
    expect(await render()).toContain("1 min read");
  });

  it("the article ends with the about card: one line of theirs and the way to their site", async () => {
    state.identity = { name: "Example Co", line: "Onboarding a non-engineer can run." };
    const html = await render();
    const card = html.slice(html.indexOf("<aside"), html.indexOf("</aside>"));
    expect(card).toContain("About Example Co");
    expect(card).toContain("Onboarding a non-engineer can run.");
    expect(card).toContain('href="https://example.com/"');
  });

  it("related guides are the site's other live pages, closest topic first, three at most", async () => {
    const other = (slug: string, title: string): unknown =>
      livePage({ publicationId: `pub-${slug}`, slug, title, liveUrl: `https://content.example.com/${slug}` });
    state.others = [
      other("invoicing", "How to send an invoice"),
      other("payroll", "Payroll for small teams"),
      other("holidays", "Holiday policies"),
      other("onboarding-checklist", "An onboarding tools checklist"),
    ];
    const html = await render();
    const guides = html.slice(html.indexOf("More guides from"));
    const links = [...guides.matchAll(/<li class="card[^>]*><a[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    expect(links).toHaveLength(3);
    expect(links[0]).toBe("https://content.example.com/onboarding-checklist");
    expect(guides).not.toContain('href="https://content.example.com/a-page"');
  });

  it("a site with one page draws no related guides", async () => {
    expect(await render()).not.toContain("More guides from");
  });

  it("the breadcrumb names the site, the blog and the page", async () => {
    const html = await render();
    const crumbs = html.slice(html.indexOf('aria-label="Breadcrumb"'));
    expect(crumbs).toMatch(
      /href="https:\/\/example\.com\/">example\.com<.*href="\/">Articles<.*aria-current="page"[^>]*>The best onboarding tools/s
    );
  });

  it("the footer is theirs", async () => {
    expect(await render()).toContain("© example.com");
  });

  it("every sentence on the page is a key, and every one of the three is written", async () => {
    // Rule 6 of UI-SPEC §4, on the one surface that had no key at all
    // before this issue. Written, not owed: the set spells all three
    // unbracketed (11a).
    for (const key of [
      "hosted.published",
      "hosted.source",
      "hosted.footer",
    ] as const) {
      expect(COPY[key]).not.toBe("");
      expect(COPY[key]).not.toContain("TODO(copy)");
    }
  });
});

describe("issue 1397 — the page says how it was made", () => {
  const SOURCED = `A body.\n\n## What to look for\n\nTime to the first flow.\n\n## Sources\n\n- [A study](https://study.example/a), read 1 Oct 2026`;

  it("under the byline, inside the article, with the row's two numbers and a link to the page's own sources", async () => {
    state.page = livePage({ made: { facts: 6, rules: 19 }, bodyMd: SOURCED });
    const html = await render();
    const article = html.slice(html.indexOf("<article"), html.indexOf("</article>"));
    expect(article).toContain("Written with AI from 6 facts on example.com, checked against 19 rules before publishing.");
    expect(article).toMatch(/<a href="#sources"[^>]*>Sources are listed below\.<\/a>/);
    expect(article).toContain('id="sources"');
    // The data block is untouched by it: still one parseable `BlogPosting`.
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]!) as Record<string, unknown>);
    expect(blocks.filter((block) => block["@type"] === "BlogPosting")).toHaveLength(1);
  });

  it("a body with no sources list offers no link to one, and a row with no numbers prints no note", async () => {
    state.page = livePage({ made: { facts: 1, rules: 19 } });
    const single = await render();
    expect(single).toContain("Written with AI from one fact on example.com");
    expect(single).not.toContain("Sources are listed below");

    state.page = livePage({ made: null });
    expect(await render()).not.toContain("Written with AI");
  });
});

describe("nothing of ours is on a domain that is not ours", () => {
  it("no accent: the product's colour appears nowhere on the customer's page", async () => {
    // `--color-primary` is the product and the customer's own series (§2.1). On a
    // stranger's domain it would be our branding, so the mark is `--color-base-content`
    // and no class this page spends resolves to the accent.
    const html = await render();
    expect(html).not.toContain("--color-primary");
    expect(html).not.toContain("rk-wordmark");
    expect(html).not.toContain("btn-primary");
  });

  it("no measure, size or colour is written as a literal on this surface", async () => {
    // The token gate (#349) sweeps inline styles; this asserts the shape
    // that keeps it satisfied — the page carries classes and no `style`
    // attribute of its own.
    expect(await render()).not.toContain("style=");
  });

  it("the whole document is in the HTML at first byte, with no script but the data blocks", async () => {
    // REQ-062 c1's property, at the source. The FAQ arm is off here, so
    // the script elements are the page's `BlogPosting` and `BreadcrumbList`
    // data blocks (issues 697 and 1141) — data, never behaviour.
    const html = await render();
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts).toEqual([
      '<script type="application/ld+json">',
      '<script type="application/ld+json">',
    ]);
  });
});

describe("the about card links the main site's own book and quote pages, and nothing else", () => {
  /** The main site as the scan reads its home and the hosted page reads it back from the stored row. */
  const stored = (nav: string): unknown =>
    mainSiteOf(
      JSON.parse(
        JSON.stringify(
          readMainSite({ domain: "example.com", homeUrl: "https://example.com/", homeHtml: `<html><body>${nav}</body></html>`, pages: [], ours: null })
        )
      )
    );
  const PLUMBER = '<header><nav><a href="tel:+15125550142">Call us</a><a href="/book?utm_source=nav">Book online</a><a href="/get-a-quote">Free estimate</a></nav></header>';
  const SAAS = '<header><a href="/pricing">Pricing</a><a href="https://calendly.com/example/demo">Book a demo</a><a href="/signup">Start free</a></header>';
  const parsed = (html: string): Document => new DOMParser().parseFromString(html, "text/html");

  it("a local business that links both draws two plain links in the card, and none in the header or footer", async () => {
    state.identity = { mainSite: stored(PLUMBER) };
    const doc = parsed(await render());
    const links = [...doc.querySelectorAll("aside ul[role=list] a")];
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Book an appointment", "https://example.com/book"],
      ["Ask for a quote", "https://example.com/get-a-quote"],
    ]);
    for (const a of links) expect(a.getAttributeNames().sort()).toEqual(["class", "href"]);
    for (const part of ["header", "footer"]) {
      expect(doc.querySelector(`${part} a[href$="/book"], ${part} a[href$="/get-a-quote"]`)).toBeNull();
    }
  });

  it("the links add no script: the page still carries only its data blocks", async () => {
    state.identity = { mainSite: stored(PLUMBER) };
    const scripts = [...parsed(await render()).querySelectorAll("script")].map((script) => script.getAttribute("type"));
    expect(scripts).toEqual(["application/ld+json", "application/ld+json"]);
  });

  it("a SaaS whose demo is booked elsewhere, and a site with no reading, draw no link and no empty list", async () => {
    for (const mainSite of [stored(SAAS), undefined]) {
      state.identity = mainSite === undefined ? {} : { mainSite };
      const html = await render();
      expect(parsed(html).querySelector("aside ul")).toBeNull();
      expect(html).not.toContain("Book an appointment");
      expect(html).not.toContain("Ask for a quote");
    }
  });
});

describe("lists in the body are styled, and nothing is drawn that the body does not say", () => {
  it("a list in the body, in the short answer and in the takeaways each keeps its markers, and the body holds no picture", async () => {
    state.page = livePage({
      bodyMd: [
        ":::answer\nShut the main valve first.\n\n- Turn it clockwise.\n- Open the lowest tap.\n:::",
        ":::takeaways\n1. Find the valve.\n2. Drain the pipes.\n:::",
        "## Where is the valve?\n\nIn one of three places.\n\n- In the garage.\n- Beside the water heater.\n\n1. Look indoors.\n2. Then outside.",
      ].join("\n\n"),
    });
    const body = new DOMParser().parseFromString(await render(), "text/html").querySelector(".prose")!;
    const lists = [...body.querySelectorAll("ul, ol")];
    expect(lists.length).toBe(4);
    for (const list of lists) {
      const box = list.closest(".not-prose");
      // Outside a box `prose` sets the marker; inside one the box must name it.
      if (box !== null) expect(box.classList).toContain(list.tagName === "OL" ? "[&_ol]:list-decimal" : "[&_ul]:list-disc");
    }
    expect(body.querySelectorAll("img, svg, picture, canvas")).toHaveLength(0);
  });
});
