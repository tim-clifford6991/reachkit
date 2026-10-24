// tests/site-profile/main-site.test.ts — issue 1511, SPEC §7 (2026-10-18).
//
// What the scan reads of the main site that ties the content host to it:
// the canonical home a `www.` or language-path site really answers at, the
// main site's own Organization, only the profiles it links, and whether its
// own pages — never ReachKit's — link the content host, followed or not.
import "../generate/env";
import { describe, expect, it } from "vitest";
import { canonicalHome, linkOf, readMainSite } from "@/lib/site-profile/main-site";
import { mainSiteOf } from "@/lib/site-profile/main-site-row";
import type { OurPages } from "@/lib/known-content/ours";

const OURS: OurPages = { addresses: new Set(["example.com/blog/our-post"]), hosts: new Set(["content.example.com"]) };

describe("the canonical home", () => {
  it("is the home's own canonical where it is on the site: a www. home with a language path", () => {
    const html = '<html><head><link rel="canonical" href="https://www.example.com/de/"></head></html>';
    expect(canonicalHome({ domain: "example.com", url: "https://www.example.com/de/", html })).toBe("https://www.example.com/de/");
    expect(canonicalHome({ domain: "example.com", url: "https://example.com/", html })).toBe("https://www.example.com/de/");
  });

  it("is the address the home was served at where it declares none, or one off the site", () => {
    expect(canonicalHome({ domain: "example.com", url: "https://www.example.com/", html: "<html></html>" })).toBe("https://www.example.com/");
    const elsewhere = '<link rel="canonical" href="https://stranger.net/">';
    expect(canonicalHome({ domain: "example.com", url: "https://example.com/?ref=x", html: elsewhere })).toBe("https://example.com/");
  });
});

describe("the main site's own Organization and profiles", () => {
  const YOAST = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": "https://www.example.com/#website", name: "Example" },
      {
        "@type": "Organization",
        "@id": "https://www.example.com/#organization",
        name: "Example",
        logo: { "@type": "ImageObject", url: "https://www.example.com/wp-content/logo.png" },
        sameAs: ["https://www.youtube.com/@example", "not a url"],
      },
    ],
  });
  const HOME = [
    "<html><head>",
    `<script type="application/ld+json">${YOAST}</script>`,
    "</head><body><footer>",
    '<a href="https://www.linkedin.com/company/example/">LinkedIn</a>',
    '<a href="https://www.instagram.com/example">Instagram</a>',
    '<a href="https://www.facebook.com/sharer/sharer.php?u=x">Share</a>',
    '<a href="https://twitter.com/intent/tweet?text=x">Tweet</a>',
    '<a href="https://www.rival.example.net/">A rival</a>',
    "</footer></body></html>",
  ].join("");

  it("reuses the declared @id, name and logo, and lists only the profiles the site links or declares", () => {
    const read = readMainSite({ domain: "example.com", homeUrl: "https://www.example.com/", homeHtml: HOME, pages: [], ours: OURS });
    expect(read.organization).toEqual({
      id: "https://www.example.com/#organization",
      name: "Example",
      logo: "https://www.example.com/wp-content/logo.png",
    });
    expect(read.sameAs).toEqual([
      "https://www.linkedin.com/company/example/",
      "https://www.instagram.com/example",
      "https://www.youtube.com/@example",
    ]);
  });

  it("invents nothing where the home declares and links nothing", () => {
    const read = readMainSite({ domain: "example.com", homeUrl: "https://example.com/", homeHtml: "<html><body>Hi</body></html>", pages: [], ours: OURS });
    expect(read.organization).toEqual({ id: null, name: null, logo: null });
    expect(read.sameAs).toEqual([]);
  });
});

describe("whether the main site links the content host", () => {
  const home = (links: string[], unfollowed: string[] = []) => ({ url: "https://example.com/", links, unfollowed });
  const ourPage = { url: "https://content.example.com/a-guide", links: ["https://content.example.com/"] };

  it("a content-host page linking itself is not the main site linking it", () => {
    expect(linkOf([home([]), ourPage], OURS, "content.example.com")).toBe("not_linked");
    // A WordPress post ReachKit published on the main site is ours too.
    expect(linkOf([{ url: "https://example.com/blog/our-post", links: ["https://content.example.com/"] }], OURS, "content.example.com")).toBe("not_linked");
  });

  it("a link whose every anchor is nofollow, sponsored or ugc is linked, not followed", () => {
    expect(linkOf([home(["https://content.example.com/"], ["https://content.example.com/"])], OURS, "content.example.com")).toBe("not_followed");
  });

  it("one followed link from a page of the site's own is linked", () => {
    const pricing = { url: "https://example.com/pricing", links: ["https://content.example.com/a-guide"] };
    expect(linkOf([home(["https://content.example.com/"], ["https://content.example.com/"]), pricing], OURS, "content.example.com")).toBe("linked");
  });

  it("is stored per host ReachKit serves, and not at all where ours could not be read", () => {
    const pages = [home(["https://content.example.com/"])];
    expect(readMainSite({ domain: "example.com", homeUrl: "https://example.com/", homeHtml: "", pages, ours: OURS }).links).toEqual([
      { host: "content.example.com", state: "linked" },
    ]);
    expect(readMainSite({ domain: "example.com", homeUrl: "https://example.com/", homeHtml: "", pages, ours: null }).links).toEqual([]);
  });

  it("reads back what it stored, and nothing that does not parse", () => {
    const read = readMainSite({ domain: "example.com", homeUrl: "https://example.com/", homeHtml: "", pages: [home([])], ours: OURS });
    expect(mainSiteOf(JSON.parse(JSON.stringify(read)))).toEqual(read);
    expect(mainSiteOf({ home: "javascript:alert(1)" })).toBeNull();
    expect(mainSiteOf(null)).toBeNull();
  });
});

describe("issue 1509 — the about and team pages, where a page's author may be named", () => {
  const about = (url: string, text: string, profiles: string[] = []) => ({ url, links: [], about: { text, profiles } });

  it("keeps the site's own about pages with their text and profiles, never one of ours, at most three", () => {
    const pages = [
      { url: "https://example.com/", links: [] },
      about("https://example.com/about", "Founded by Ada Park.", ["https://www.linkedin.com/in/ada-park/"]),
      about("https://example.com/blog/our-post", "A page ReachKit wrote that says about."),
      about("https://example.com/team", "The team."),
      about("https://example.com/careers", "Join us."),
      about("https://example.com/story", "Our story."),
    ];
    const read = readMainSite({ domain: "example.com", homeUrl: "https://example.com/", homeHtml: "", pages, ours: OURS });
    expect(read.aboutPages).toEqual([
      { url: "https://example.com/about", text: "Founded by Ada Park.", profiles: ["https://www.linkedin.com/in/ada-park/"] },
      { url: "https://example.com/team", text: "The team.", profiles: [] },
      { url: "https://example.com/careers", text: "Join us.", profiles: [] },
    ]);
    expect(mainSiteOf(JSON.parse(JSON.stringify(read)))).toEqual(read);
  });

  it("a reading stored before has none, and an entry that does not parse is dropped", () => {
    expect(mainSiteOf({ home: "https://example.com/", organization: {}, sameAs: [], links: [] })?.aboutPages).toEqual([]);
    expect(
      mainSiteOf({ home: "https://example.com/", aboutPages: [{ url: "javascript:x", text: "x" }, { url: "https://example.com/about", text: 3 }] })?.aboutPages
    ).toEqual([]);
  });
});


describe("the book and quote pages the main site's own header or nav links", () => {
  const actionsOf = (domain: string, homeUrl: string, body: string) =>
    readMainSite({ domain, homeUrl, homeHtml: `<html><body>${body}</body></html>`, pages: [], ours: OURS }).actions;

  it("a local plumber: its own book and estimate pages, book first, with no tracking parameter", () => {
    const nav = [
      "<header><nav>",
      '<a href="tel:+15125550142">Call (512) 555-0142</a>',
      '<a href="/get-a-quote">Free estimate</a>',
      '<a href="https://www.harborplumbing.com/schedule?utm_source=nav&amp;zip=78701#form">Book online</a>',
      "</nav></header>",
    ].join("");
    expect(actionsOf("harborplumbing.com", "https://www.harborplumbing.com/", nav)).toEqual([
      { kind: "book", url: "https://www.harborplumbing.com/schedule?zip=78701", book: "visit" },
      { kind: "quote", url: "https://www.harborplumbing.com/get-a-quote" },
    ]);
  });

  it("a German Handwerker: Termin and Kostenvoranschlag, by its own words", () => {
    const nav = '<nav><a href="/kontakt">Kontakt</a><a href="/termin">Jetzt Termin vereinbaren</a><a href="/anfrage">Angebot anfordern</a></nav>';
    expect(actionsOf("mueller-sanitaer.de", "https://mueller-sanitaer.de/", nav)).toEqual([
      { kind: "book", url: "https://mueller-sanitaer.de/termin", book: "visit" },
      { kind: "quote", url: "https://mueller-sanitaer.de/anfrage" },
    ]);
  });

  it("a SaaS whose demo is booked on a scheduling host links nothing: the page is not on its own site", () => {
    const nav = '<header><a href="/pricing">Pricing</a><a href="https://calendly.com/acme/demo">Book a demo</a><a href="/login">Log in</a></header>';
    expect(actionsOf("acmescheduling.io", "https://acmescheduling.io/", nav)).toEqual([]);
  });

  it("book sub-kinds: a demo, a call and a visit, each by its own address or words", () => {
    const book = (body: string) => actionsOf("example.com", "https://example.com/", `<header>${body}</header>`);
    expect(book('<a href="/demo">Book a demo</a>')).toEqual([{ kind: "book", url: "https://example.com/demo", book: "demo" }]);
    expect(book('<a href="/book-a-call">Schedule a call</a>')).toEqual([{ kind: "book", url: "https://example.com/book-a-call", book: "call" }]);
    expect(book('<a href="/booking">Book now</a>')).toEqual([{ kind: "book", url: "https://example.com/booking", book: "visit" }]);
    expect(book('<a href="/termin">Beratungstermin vereinbaren</a>')).toEqual([{ kind: "book", url: "https://example.com/termin", book: "call" }]);
  });

  it("a word that only starts like demo or call books a visit: a demolition contractor, a callout plumber", () => {
    const book = (body: string) => actionsOf("example.com", "https://example.com/", `<header>${body}</header>`);
    expect(book('<a href="/booking">Book demolition</a>')).toEqual([{ kind: "book", url: "https://example.com/booking", book: "visit" }]);
    expect(book('<a href="/booking">Book a callout</a>')).toEqual([{ kind: "book", url: "https://example.com/booking", book: "visit" }]);
  });

  it("a stored sub-kind reads back; a quote, or a sub-kind that does not parse, carries none", () => {
    const actions = mainSiteOf({
      home: "https://example.com/",
      actions: [
        { kind: "book", url: "https://example.com/demo", book: "demo" },
        { kind: "quote", url: "https://example.com/quote", book: "call" },
      ],
    })?.actions;
    expect(actions).toEqual([
      { kind: "book", url: "https://example.com/demo", book: "demo" },
      { kind: "quote", url: "https://example.com/quote" },
    ]);
    expect(mainSiteOf({ home: "https://example.com/", actions: [{ kind: "book", url: "https://example.com/book", book: "trial" }] })?.actions).toEqual([
      { kind: "book", url: "https://example.com/book" },
    ]);
  });

  it("an address is linked once, under the first kind that names it", () => {
    const nav = '<nav><a href="/contact">Book a visit</a><a href="/contact#quote">Get a quote</a></nav>';
    expect(actionsOf("example.com", "https://example.com/", nav)).toEqual([{ kind: "book", url: "https://example.com/contact", book: "visit" }]);
  });

  it("a link outside the header and nav, or a word inside another word, is none", () => {
    const body = '<nav><a href="https://www.facebook.com/example">Facebook</a><a href="/ebooks">Free eBook</a></nav><main><a href="/book">Book now</a></main>';
    expect(actionsOf("example.com", "https://example.com/", body)).toEqual([]);
  });

  it("reads back what it stored; a reading stored before, or an entry that does not parse, has none", () => {
    const read = readMainSite({
      domain: "example.com",
      homeUrl: "https://example.com/",
      homeHtml: '<nav><a href="/book">Book</a></nav>',
      pages: [],
      ours: OURS,
    });
    expect(mainSiteOf(JSON.parse(JSON.stringify(read)))).toEqual(read);
    expect(mainSiteOf({ home: "https://example.com/" })?.actions).toEqual([]);
    expect(
      mainSiteOf({ home: "https://example.com/", actions: [{ kind: "book", url: "javascript:x" }, { kind: "call", url: "https://example.com/" }] })?.actions
    ).toEqual([]);
  });
});

describe("the phone number the main site states", () => {
  const phoneOn = (body: string) =>
    readMainSite({ domain: "example.com", homeUrl: "https://example.com/", homeHtml: `<html><body>${body}</body></html>`, pages: [], ours: OURS }).phone;
  const ld = (node: Record<string, unknown>) => `<script type="application/ld+json">${JSON.stringify(node)}</script>`;

  it("a local plumber: its JSON-LD telephone, as written, before any tel: link", () => {
    expect(phoneOn(`${ld({ "@type": "Plumber", name: "Harbor", telephone: "(512) 555-0142" })}<a href="tel:+15125550199">Call</a>`)).toBe("(512) 555-0142");
  });

  it("a German Handwerker with no markup: its first tel: link", () => {
    expect(phoneOn('<header><a href="tel:+49%20211%20123456">Anrufen</a></header><a href="tel:0800">x</a>')).toBe("+49 211 123456");
  });

  it("a SaaS that states none, or states a word, has none", () => {
    expect(phoneOn('<a href="/signup">Start free</a>')).toBeNull();
    expect(phoneOn(`${ld({ "@type": "Organization", name: "Tally", telephone: "call us" })}`)).toBeNull();
  });

  it("third-party telephone: a review platform's Organization, an author or a venue never lends the business its number", () => {
    const platform = ld({ "@type": "Organization", name: "ReviewHub", url: "https://reviewhub.example.net/", telephone: "+1 800 555 0100" });
    const author = ld({ "@type": "Person", name: "Dana", url: "https://example.com/about/dana", telephone: "+1 512 555 0177" });
    const venue = ld({ "@type": "MusicEvent", name: "Open day", telephone: "+1 512 555 0188" });
    const plumber = ld({ "@type": "Plumber", name: "Harbor Plumbing", telephone: "(512) 555-0142" });
    expect(phoneOn(`${platform}${author}${venue}${plumber}`)).toBe("(512) 555-0142");
    expect(phoneOn(`${platform}${author}${venue}`)).toBeNull();
  });

  it("a SaaS's own Organization, named by its own @id, still gives its number", () => {
    const own = ld({ "@type": "Organization", "@id": "https://example.com/#organization", name: "Tally", telephone: "+1 415 555 0123" });
    expect(phoneOn(own)).toBe("+1 415 555 0123");
  });

  it("the tel: fallback reads the header or footer before a partner's link in a testimonial", () => {
    const testimonial = '<main><blockquote>Great work, call my office <a href="tel:+15125550999">(512) 555-0999</a></blockquote></main>';
    expect(phoneOn(`${testimonial}<footer><a href="tel:+15125550142">(512) 555-0142</a></footer>`)).toBe("+15125550142");
    expect(phoneOn(`<aside><a href="tel:+15125550999">Partner</a></aside><main><a href="tel:+15125550142">Call</a></main>`)).toBe("+15125550142");
  });

  it("reads back what it stored; a reading stored before has none", () => {
    expect(mainSiteOf({ home: "https://example.com/", phone: "(512) 555-0142" })?.phone).toBe("(512) 555-0142");
    expect(mainSiteOf({ home: "https://example.com/" })?.phone).toBeNull();
    expect(mainSiteOf({ home: "https://example.com/", phone: "<script>" })?.phone).toBeNull();
  });
});
