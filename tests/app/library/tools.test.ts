// Issue 1458 — the two free tools read one page and report what a search
// engine and a share card would see. A recorded page, never the network.
import "../../generate/env";
import { describe, expect, it } from "vitest";
import { onPageChecks } from "@/app/(public)/tools/_check/checks";
import { pageAddress, pageTags, takeCheck } from "@/app/(public)/tools/_check/read";
import { copy } from "@/lib/presentation/copy";

const PAGE = `<!doctype html><html lang="en"><head>
<title>Bike servicing in Leeds</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://shop.example.com/service">
<meta property="og:title" content="Bike servicing">
<meta property="og:image" content="https://shop.example.com/card.png">
<script type="application/ld+json">{"@type":"LocalBusiness"}</script>
</head><body><h1>Bike servicing</h1><h1>Prices</h1><img src="a.png"><img src="b.png" alt="Workshop"></body></html>`;

describe("the address a visitor types", () => {
  it("reads a bare host and path as https, and refuses what names no public host", () => {
    expect(pageAddress("example.com/pricing")).toBe("https://example.com/pricing");
    expect(pageAddress("http://example.com/#top")).toBe("http://example.com/");
    for (const bad of ["", "localhost", "127.0.0.1", "ftp://example.com", "https://user@example.com", "example"]) {
      expect(pageAddress(bad), bad).toBeNull();
    }
  });
});

describe("what the on-page check finds on a page", () => {
  const checks = onPageChecks(pageTags("https://shop.example.com/service", PAGE));
  const of = (name: string) => checks.find((c) => c.name === name)!;

  it("says each tag that is there is fine, with what it found", () => {
    expect(of("tools.check.title")).toMatchObject({ fine: true });
    expect(of("tools.check.title").line).toContain("Bike servicing in Leeds");
    expect(of("tools.check.canonical").fine).toBe(true);
    expect(of("tools.check.viewport").fine).toBe(true);
    expect(of("tools.check.lang").fine).toBe(true);
    expect(of("tools.check.index").fine).toBe(true);
  });

  it("says what is missing or doubled, and names it", () => {
    expect(of("tools.check.description").fine).toBe(false);
    expect(of("tools.check.h1").line).toContain("2");
    expect(of("tools.check.share").line).toContain("og:description");
    expect(of("tools.check.images").line).toContain("1 of 2");
  });

  it("a page kept out of search by its header is not indexable", () => {
    const tags = pageTags("https://shop.example.com/", PAGE, { "x-robots-tag": "noindex" });
    expect(onPageChecks(tags).find((c) => c.name === "tools.check.index")?.fine).toBe(false);
  });
});

describe("business details for Google: only a label that says who runs the site", () => {
  const schemaOf = (...types: string[]) =>
    onPageChecks(
      pageTags(
        "https://example.com/",
        `<html><head>${types.map((t) => `<script type="application/ld+json">{"@type":"${t}"}</script>`).join("")}</head></html>`
      )
    ).find((c) => c.name === "tools.check.schema")!;

  it("a local plumber says it is a plumber", () => {
    expect(schemaOf("WebSite", "Plumber", "LocalBusiness")).toEqual({
      name: "tools.check.schema",
      fine: true,
      line: copy("tools.check.schema.fine", { value: "a plumber" }),
    });
  });

  it("a SaaS says it is an organization, and a creator a person", () => {
    expect(schemaOf("Organization").line).toBe(copy("tools.check.schema.fine", { value: "an organization" }));
    expect(schemaOf("Person").fine).toBe(true);
  });

  it("labels that name no one are not business details", () => {
    expect(schemaOf("BreadcrumbList")).toMatchObject({ fine: false, line: copy("tools.check.schema.other") });
    expect(schemaOf("WebSite", "ImageObject")).toMatchObject({ fine: false, line: copy("tools.check.schema.other") });
    expect(schemaOf()).toMatchObject({ fine: false, line: copy("tools.check.schema.none") });
  });
});

describe("the hourly brake", () => {
  it("stops one network after thirty checks in an hour, and lets it go after", () => {
    const at = 1_000_000;
    for (let i = 0; i < 30; i++) expect(takeCheck(new Headers({ "x-forwarded-for": "203.0.113.9" }), at + i)).toBe(true);
    expect(takeCheck(new Headers({ "x-forwarded-for": "203.0.113.9" }), at + 31)).toBe(false);
    expect(takeCheck(new Headers({ "x-forwarded-for": "198.51.100.4" }), at + 31)).toBe(true);
    expect(takeCheck(new Headers({ "x-forwarded-for": "203.0.113.9" }), at + 60 * 60 * 1000 + 31)).toBe(true);
  });
});
