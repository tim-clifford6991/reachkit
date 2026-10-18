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
