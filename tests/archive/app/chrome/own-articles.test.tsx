// Issue 1512 — reachkit.app links the articles it publishes: the footer
// links the content host's index, and the landing its newest three by
// title, each a plain link in the server's HTML. The addresses are the
// stored rows' — the site's host and each page's slug — and with no row
// there is no link.
import "../../generate/env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COPY, copy } from "@/lib/presentation/copy";
import { settledMarkup } from "../shell/settled";

type Page = { title: string; liveUrl: string; firstPublishedAt: Date };

let site: { siteId: string; domain: string; host: string } | null = null;
let host: string | null = null;
let pages: Page[] = [];
const asked: string[] = [];

vi.mock("@/lib/publish/destinations/hosted/store", () => ({
  hostedSiteForDomain: async (domain: string) => {
    asked.push(domain);
    return site;
  },
  hostedHostOfSite: async () => host,
  livePagesForSite: async () => pages,
}));

const { Footer } = await import("@/app/(public)/_chrome/Footer");
const { LatestArticles } = await import("@/app/(public)/_landing/LatestArticles");

const page = (slug: string, title: string, day: number): Page => ({
  title,
  liveUrl: `https://content.reachkit.app/${slug}`,
  firstPublishedAt: new Date(Date.UTC(2026, 9, day)),
});

async function landing(): Promise<string> {
  return settledMarkup(<LatestArticles />);
}

const hrefs = (html: string): string[] => [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1] as string);

beforeEach(() => {
  site = { siteId: "site-1", domain: "reachkit.app", host: "blog.reachkit.app" };
  host = "content.reachkit.app";
  // Stored newest version first, as the store returns them; the fourth is
  // the oldest article, refreshed most recently.
  pages = [
    page("refreshed-old", "An old article, refreshed", 1),
    page("third", "Third newest", 10),
    page("newest", "The newest article", 17),
    page("second", "Second newest", 14),
  ];
  asked.length = 0;
});

describe("the footer links ReachKit's articles (issue 1512)", () => {
  it("a plain link to the content host's index, labelled as the articles", async () => {
    const html = await settledMarkup(<Footer />);
    expect(html).toMatch(new RegExp(`<a href="https://content.reachkit.app/" class="link link-hover[^"]*">${COPY["chrome.nav.articles"]}</a>`));
    expect(asked).toEqual(["reachkit.app"]);
  });

  it("no stored site, no link", async () => {
    site = null;
    const html = await settledMarkup(<Footer />);
    expect(html).not.toContain("content.reachkit.app");
    expect(html).not.toContain(`>${COPY["chrome.nav.articles"]}<`);
  });
});

describe("the footer's last line", () => {
  it("reads the rights and the removal sentence, its address the one registry value and a mail link", async () => {
    const html = await settledMarkup(<Footer />);
    const line = html.slice(html.lastIndexOf("<p"), html.lastIndexOf("</p>"));
    const text = line.replace(/<[^>]*>/g, "").replace(/&#x27;/g, "'");
    expect(text).toBe(`${COPY["chrome.footer.rights"]} · ${copy("chrome.footer.opt-out", { address: COPY["removal.address"] })}`);
    expect(line).toContain(`href="mailto:${COPY["removal.address"]}"`);
  });
});

describe("the landing links the newest three articles (issue 1512)", () => {
  it("by title, newest first by the day each went live, with the index beside them", async () => {
    const html = await landing();
    expect(html).toContain(COPY["landing.articles.heading"]);
    expect(hrefs(html)).toEqual([
      "https://content.reachkit.app/",
      "https://content.reachkit.app/newest",
      "https://content.reachkit.app/second",
      "https://content.reachkit.app/third",
    ]);
    expect(html).toContain("The newest article");
    expect(html).not.toContain("An old article, refreshed");
  });

  it("the host is the site's stored one", async () => {
    host = "articles.reachkit.app";
    pages = [{ ...page("one", "One", 1), liveUrl: "https://articles.reachkit.app/one" }];
    expect(hrefs(await landing())).toEqual(["https://articles.reachkit.app/", "https://articles.reachkit.app/one"]);
  });

  it("no live article, no band; no stored site, no band", async () => {
    pages = [];
    expect(await landing()).toBe("");
    site = null;
    expect(await landing()).toBe("");
  });
});
