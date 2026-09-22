// SPEC §7 (2026-09-20, #928) — "New pages link to known content where it
// helps the reader", and #928's own done-when for the link half: a
// candidate is never another site's page and never an unpublished draft.
//
// The three refusals are the subject here, because each of them is a way a
// link can be wrong rather than merely unhelpful: a link to somebody else's
// site, a link to a page no reader can open, and a page linking to itself.
import { describe, expect, it } from "vitest";
import { KNOWN_CONTENT } from "@/lib/config/constants";
import { knownLinkTargets } from "@/lib/known-content/links";
import type { KnownPage } from "@/lib/known-content/types";

const DOMAIN = "acme.example";

function page(over: Partial<KnownPage> = {}): KnownPage {
  return {
    source: "reachkit",
    ref: "1",
    url: "https://acme.example/guides/retainers",
    title: "How to price a retainer",
    headings: [],
    live: true,
    publishedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...over,
  };
}

const about = { domain: DOMAIN, about: "how to price a retainer" };

describe("#928 — a link candidate is vetted, published and this site's own", () => {
  it("another site's page is never a candidate", () => {
    const elsewhere = page({ ref: "2", url: "https://somebody-else.example/pricing" });
    expect(knownLinkTargets([elsewhere], about)).toEqual([]);
  });

  it("a page nobody can open yet is never a candidate — ours or theirs", () => {
    const ourDraft = page({ ref: "d", source: "reachkit", live: false, url: null });
    const theirDraft = page({ ref: "w", source: "wordpress", live: false, url: "https://acme.example/blog/x" });
    expect(knownLinkTargets([ourDraft, theirDraft], about)).toEqual([]);
  });

  it("a page does not link to itself", () => {
    const self = page();
    expect(knownLinkTargets([self], { ...about, selfUrl: "https://acme.example/guides/retainers/" })).toEqual([]);
  });

  it("a subdomain is this site's own — the hosted destination serves from one", () => {
    const hosted = page({ ref: "h", url: "https://content.acme.example/retainer-pricing" });
    expect(knownLinkTargets([hosted], about).map((link) => link.url)).toEqual([
      "https://content.acme.example/retainer-pricing",
    ]);
  });

  it("the page's own title is the link's words, and the nearest page comes first", () => {
    const far = page({ ref: "far", url: "https://acme.example/about", title: "About Northwind" });
    const near = page({ ref: "near", url: "https://acme.example/guides/retainers" });
    const links = knownLinkTargets([far, near], about);
    expect(links[0]).toEqual({
      url: "https://acme.example/guides/retainers",
      label: "How to price a retainer",
      source: "reachkit",
    });
  });

  it("the list is bounded, and one page is one link however many times the index holds it", () => {
    const many = Array.from({ length: KNOWN_CONTENT.LINKS_MAX + 4 }, (_, n) =>
      page({ ref: `p${n}`, url: `https://acme.example/guides/${n}`, title: `Pricing note ${n}` })
    );
    const twice = [...many, page({ ref: "dupe", url: "https://acme.example/guides/0/", title: "Pricing note 0" })];
    const links = knownLinkTargets(twice, about);
    expect(links).toHaveLength(KNOWN_CONTENT.LINKS_MAX);
    expect(new Set(links.map((link) => link.url)).size).toBe(links.length);
  });
});
