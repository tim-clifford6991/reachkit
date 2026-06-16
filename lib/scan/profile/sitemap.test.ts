import { describe, it, expect } from "vitest";
import {
  sitemapsFromRobots,
  parseSitemap,
  defaultSitemapCandidates,
  looksLikeBlogPost,
} from "./sitemap";

describe("looksLikeBlogPost", () => {
  it("accepts post-shaped URLs", () => {
    expect(looksLikeBlogPost("https://x.com/blog/how-we-grew")).toBe(true);
    expect(looksLikeBlogPost("https://x.com/news/launch")).toBe(true);
    expect(looksLikeBlogPost("https://x.com/2026/06/update")).toBe(true);
    expect(looksLikeBlogPost("https://x.com/2026-06-16-release")).toBe(true);
  });
  it("rejects programmatic/entity pages (the inflation source)", () => {
    expect(looksLikeBlogPost("https://trustmrr.com/company/acme-inc")).toBe(false);
    expect(looksLikeBlogPost("https://x.com/pricing")).toBe(false);
    expect(looksLikeBlogPost("https://x.com/")).toBe(false);
  });
});

describe("sitemapsFromRobots", () => {
  it("extracts Sitemap: directives (case-insensitive)", () => {
    const robots = `User-agent: *\nDisallow: /admin\nSitemap: https://x.com/sitemap.xml\nsitemap: https://x.com/news.xml`;
    expect(sitemapsFromRobots(robots)).toEqual([
      "https://x.com/sitemap.xml",
      "https://x.com/news.xml",
    ]);
  });
  it("returns [] when none declared", () => {
    expect(sitemapsFromRobots("User-agent: *")).toEqual([]);
  });
});

describe("parseSitemap", () => {
  it("parses a urlset into entries with lastmod", () => {
    const xml = `<urlset>
      <url><loc>https://x.com/a</loc><lastmod>2026-05-01</lastmod></url>
      <url><loc>https://x.com/b</loc></url>
    </urlset>`;
    const { entries, childSitemaps } = parseSitemap(xml);
    expect(childSitemaps).toEqual([]);
    expect(entries).toEqual([
      { loc: "https://x.com/a", lastmod: "2026-05-01" },
      { loc: "https://x.com/b", lastmod: null },
    ]);
  });

  it("parses a sitemapindex into child sitemaps", () => {
    const xml = `<sitemapindex>
      <sitemap><loc>https://x.com/posts.xml</loc></sitemap>
      <sitemap><loc>https://x.com/pages.xml</loc></sitemap>
    </sitemapindex>`;
    const { entries, childSitemaps } = parseSitemap(xml);
    expect(entries).toEqual([]);
    expect(childSitemaps).toEqual(["https://x.com/posts.xml", "https://x.com/pages.xml"]);
  });
});

describe("defaultSitemapCandidates", () => {
  it("returns the conventional locations", () => {
    expect(defaultSitemapCandidates("x.com")).toEqual([
      "https://x.com/sitemap.xml",
      "https://x.com/sitemap_index.xml",
    ]);
  });
});
