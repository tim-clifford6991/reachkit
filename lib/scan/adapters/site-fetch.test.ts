import { describe, it, expect } from "vitest";
import { parseListingHtml } from "./site-fetch";

const html = (opts: { title?: string; ogSite?: string; ogTitle?: string }) =>
  `<html><head>
    ${opts.title ? `<title>${opts.title}</title>` : ""}
    ${opts.ogSite ? `<meta property="og:site_name" content="${opts.ogSite}">` : ""}
    ${opts.ogTitle ? `<meta property="og:title" content="${opts.ogTitle}">` : ""}
  </head><body><h1>Hi</h1></body></html>`;

describe("parseListingHtml — brand name (not the full title)", () => {
  it("reduces a 'Tagline — Brand' title to the domain-matching segment", () => {
    const l = parseListingHtml(html({ title: "The distribution system for solo founders — ReachKit" }), "https://reachkit.app/");
    expect(l.name).toBe("ReachKit");
  });

  it("prefers og:site_name when present", () => {
    const l = parseListingHtml(html({ title: "Warp — The Agentic Development Environment", ogSite: "Warp" }), "https://warp.dev/");
    expect(l.name).toBe("Warp");
  });

  it("picks the domain segment for 'Brand | Tagline' too", () => {
    const l = parseListingHtml(html({ title: "Linear | Streamline issues, projects, and product roadmaps" }), "https://linear.app/");
    expect(l.name).toBe("Linear");
  });

  it("ignores an og:site_name that is itself a long title, falling back to the cleaned title", () => {
    const l = parseListingHtml(html({ title: "Acme — The best widget for teams", ogSite: "Acme — The best widget for teams everywhere in the whole world" }), "https://acme.com/");
    expect(l.name).toBe("Acme");
  });

  it("leaves a single-segment title as-is", () => {
    const l = parseListingHtml(html({ title: "Stripe" }), "https://stripe.com/");
    expect(l.name).toBe("Stripe");
  });
});
