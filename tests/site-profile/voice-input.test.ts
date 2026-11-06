// The voice is read off the pages the knowledge read reads, and a reading of
// a failed read is never one. The bakery replay is the stored panel read of
// a site that serves an empty JavaScript shell: no network, no model.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();

const { parseRobotsTxt } = await import("@/lib/egress/robots");
const { readsAsUnread } = await import("@/lib/locale/language");
const { crawlSite } = await import("@/lib/site-profile/crawl");
const { voicePages } = await import("@/lib/site-profile/summary");

const BAKERY = JSON.parse(readFileSync(new URL("./fixtures/baeckerei-hinkel.de.json", import.meta.url), "utf8")) as {
  homeUrl: string;
  servedHome: string;
  rendered: { url: string; text: string }[];
  storedVoice: string;
};
const READ_AT = new Date("2026-11-06T00:25:00.000Z");

/** The served shell, read by the crawl itself; every other address is a 404. */
async function servedBakery() {
  const cost = {
    cap: "DEEP",
    recordFetch: async (call: { run: () => Promise<unknown>; costCents: number }) => ({ payload: await call.run(), fresh: true, costCents: call.costCents }),
    capHit: () => false,
    spentCents: () => 0,
    degraded: () => false,
  };
  const crawl = await crawlSite(cost as never, { domain: "baeckerei-hinkel.de", homeUrl: BAKERY.homeUrl, homeHtml: BAKERY.servedHome, sitemaps: [] }, {
    fetchDocument: async (url) => ({ ok: false, reason: "status", status: 404, url, readAt: READ_AT }),
    readRobots: async (origin) => ({ ok: true, origin, readAt: READ_AT, absent: true, ...parseRobotsTxt("") }),
  });
  return crawl.pages;
}

describe("the voice reads the knowledge read's documents", () => {
  it("bakery replay: the served shell is no voice input, so no reading is asked for and the voice stays null", async () => {
    const served = await servedBakery();
    expect(served.map((page) => page.url)).toEqual([BAKERY.homeUrl]);
    expect(voicePages(served, [])).toEqual([]);
  });

  it("bakery replay: with the rendered reads held, the voice reads the rendered text only", async () => {
    const served = await servedBakery();
    const pages = voicePages(served, BAKERY.rendered);
    expect(pages.map((page) => page.url)).toEqual(BAKERY.rendered.map((page) => page.url));
    for (const page of pages) expect(BAKERY.rendered.find((read) => read.url === page.url)?.text.startsWith(page.text)).toBe(true);
    expect(pages.every((page) => page.text.length > 0)).toBe(true);
  });

  it("a page marked unread is never voice input, and a served site is not swapped for rendered reads", () => {
    const words = "Wir backen jeden Morgen von Hand, mit Zeit und den besten Zutaten aus der Region. ".repeat(4);
    const served = [
      { url: "https://example.de/", title: "Home", h1: "Home", text: words },
      { url: "https://example.de/shop", title: "Just a moment", h1: "", text: "Checking your browser before you access the site.", unread: "bot_protection" as const },
    ];
    expect(voicePages(served, BAKERY.rendered).map((page) => page.url)).toEqual(["https://example.de/"]);
  });
});

describe("a voice that describes the failed read is never stored", () => {
  it("reads the stored bakery voice, and the same failure in English, as a failed read", () => {
    expect(readsAsUnread(BAKERY.storedVoice)).toBe(true);
    expect(readsAsUnread("The pages could not be read because no content was provided.")).toBe(true);
    expect(readsAsUnread("Unable to determine", "No content available")).toBe(true);
  });

  it("leaves a voice that describes the site alone", () => {
    expect(readsAsUnread("Plain and direct, second person, short sentences.", "plain")).toBe(false);
    expect(readsAsUnread("Herzlich und nah, in der Wir-Form, mit Liebe zum Bäckerhandwerk.", "herzlich")).toBe(false);
  });
});
