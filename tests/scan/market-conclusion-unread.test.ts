// A pass concludes no market from a page with none of the site's words, and a withdrawn site's next pass
// adopts its listing's. The crawl, measurement and conclusion are real; the database, model and vendors are doubles.
import "../generate/env";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CostContext } from "@/lib/costs";
import { measureDomain } from "@/lib/measure";
import { measured } from "@/lib/measure/measured";
import { inferMarketFields } from "@/lib/market/infer/infer";
import { concludeMarketForPass } from "@/lib/scan/market-conclusion";
import { marketReadingOf } from "@/lib/scan/pass/market";
import type { StageArgs } from "@/lib/scan/pass/sections";
import { crawlSite } from "@/lib/site-profile/crawl";

const db = vi.hoisted(() => ({ site: {} as Record<string, unknown> }));
/** `sites` answers the one row and takes its updates; every other table answers none. */
vi.mock("@/lib/db", () => {
  const from = (table: string, patch: Record<string, unknown> | null = null): object => {
    const then = (done: (r: unknown) => unknown) => (patch !== null && Object.assign(db.site, patch), done({ data: table === "sites" ? [db.site] : [], error: null }));
    return new Proxy({}, { get: (_, key) => (key === "then" ? then : key === "update" ? (values: Record<string, unknown>) => from(table, values) : () => from(table, patch)) });
  };
  return { dbAdmin: () => ({ from }), db: () => ({ from }) };
});
vi.mock("@/lib/market/infer/infer", async (actual) => ({ ...(await actual<object>()), inferMarketFields: vi.fn() }));

const DOMAIN = "bettys.co.uk";
const AT = new Date("2026-11-03T09:00:00.000Z");
const IMPERVA = readFileSync(join(__dirname, "../measure/domain/fixtures/challenge/imperva-challenge.bettys.co.uk.html"), "utf8");
const WORDS = "Bettys Café Tea Rooms serve afternoon tea in Harrogate and York, and send fat rascals, cakes and loose leaf tea across Britain. ".repeat(12);
/** A page of the site's own, carrying Imperva's script as a page it lets through does. */
const OWN = `<html><head><title>Bettys</title><script src="/_Incapsula_Resource?x=1"></script></head><body><p>${WORDS}</p><a href="/shop">Shop</a></body></html>`;
const FRESH = { buyer: "tea lovers", job: "buy afternoon tea", category: "afternoon tea", synonyms: [], differentiators: [], notOurMarket: [], categoryReason: "", terms: [], searchTerm: null, termsAt: AT.toISOString() };
const run = async (call: { run: () => Promise<unknown>; costCents: number }) => ({ payload: await call.run(), fresh: true, costCents: call.costCents });
const cost = { recordFetch: run, capHit: () => false, spentCents: () => 0, degraded: () => false } as unknown as CostContext;
const infer = vi.mocked(inferMarketFields);
const evidence = () => infer.mock.calls[0]![1];
const doc = (url: string, html: string) => ({ ok: true as const, status: 200, url, html, bytes: html.length, readAt: AT, headers: {} });
const robots = async () => ({ ok: false as const, reason: "not read here" });

/** The crawl of a home and, behind it, `/shop`, as the pass hands it on. */
async function crawl(home: string) {
  const fetchDocument = async (url: string) => (url.endsWith("/shop") ? doc(url, OWN) : { ok: false as const, reason: "status" as const, status: 404, url, readAt: AT });
  return (await crawlSite(cost, { domain: DOMAIN, homeUrl: `https://${DOMAIN}/`, homeHtml: home, sitemaps: [] }, { fetchDocument, readRobots: robots })).pages;
}

/** The pass's own measurement of `home`: its ranked purchases, and the listing it reads its market from. */
async function measure(home: string) {
  const bought: (boolean | undefined)[] = [];
  const rows = ["harrogate", "york", "gift box", "voucher", "delivery", "ilkley", "near me", "for two", "london", "online"].map((place, i) => ({ keyword: `afternoon tea ${place}`, position: i + 1, searchVolume: 100, url: `https://${DOMAIN}/`, title: "Bettys Café Tea Rooms" }));
  const rankedKeywords = async (_c: unknown, a: { listing?: boolean }) => (bought.push(a.listing), measured({ rows, total: rows.length }, AT));
  const measurement = await measureDomain(cost, { domain: DOMAIN, at: AT, tier: "free" }, { fetchDocument: async (url) => doc(url, home), readRobots: robots, rankedKeywords });
  const reading = marketReadingOf({ domain: DOMAIN, sections: { marketThin: null } } as unknown as StageArgs, measurement);
  return { bought, listing: reading !== null && "search" in reading ? reading.search : undefined };
}

const conclude = async (pages: Awaited<ReturnType<typeof crawl>>, listing?: string) =>
  concludeMarketForPass({ siteId: "site-1", domain: DOMAIN, scanId: "scan-2", cost, pages, at: AT, ...(listing === undefined ? {} : { listing }) });
const standing = { current: { ...FRESH, category: "tea rooms", rivals: [] }, adoptedAt: "2026-10-01T00:00:00.000Z", pending: null };

beforeEach(() => {
  infer.mockReset().mockResolvedValue(measured(FRESH, AT));
  db.site = { domain: DOMAIN, category: "tea rooms", competitors: [], country: "GB", language: "en", market: structuredClone(standing) };
});

describe("a pass concludes a market only from pages of the site's own, and a withdrawn site's next pass reads it again", () => {
  it("a crawl whose only page is Imperva's empty challenge adopts no market and asks the model nothing", async () => {
    const log = vi.spyOn(console, "log");
    const pages = await crawl(IMPERVA);
    expect(pages.map((p) => p.unread)).toEqual(["bot_protection"]);
    expect(await conclude(pages, (await measure(IMPERVA)).listing)).toBeNull();
    expect([infer.mock.calls.length, db.site]).toMatchObject([0, { category: "tea rooms", market: standing }]);
    expect(log.mock.calls.map(([line]) => String(line))).toContainEqual(expect.stringContaining('"event":"market_conclusion_unmeasured","siteId":"site-1","because":"bot_protection"'));
  });

  it("a crawl whose home says nothing and whose other pages are the site's concludes from those pages only", async () => {
    const pages = await crawl('<html><head><title>Bettys</title></head><body><div id="root"></div><a href="/shop">x</a></body></html>');
    expect(pages.map((p) => p.unread)).toEqual(["home_wordless", undefined]);
    await conclude(pages);
    expect([evidence().pages.map((p) => p.url), evidence().headline]).toEqual([[`https://${DOMAIN}/shop`], null]);
  });

  it("a crawl of the site's own pages carrying Imperva's script with normal text concludes as today", async () => {
    const pages = await crawl(OWN);
    await conclude(pages);
    expect([pages.map((p) => p.unread), evidence().pages.length]).toEqual([[undefined, undefined], 2]);
  });

  it("a withdrawn site's next pass adopts the market read from its listing, with one ranked purchase carrying listing", async () => {
    const withdrawn = { previous: { category: "tea rooms" }, because: "bot_protection" };
    db.site = { ...db.site, category: null, market: { ...standing, current: null, withdrawn } };
    const read = await measure(IMPERVA);
    expect(await conclude(await crawl(IMPERVA), read.listing)).toMatchObject({ category: "afternoon tea" });
    expect(evidence().pages.map((p) => p.text)).toEqual([expect.stringContaining(`Site: ${DOMAIN}`)]);
    expect(db.site).toMatchObject({ category: "afternoon tea", market: { current: { category: "afternoon tea" }, withdrawn } });
    const buys = [{ ranked: read.bought, market: infer.mock.calls.length }];
    // The same pass on a site with a standing market, over its own pages.
    infer.mockClear();
    db.site = { ...db.site, market: structuredClone(standing) };
    const own = await measure(OWN);
    await conclude(await crawl(OWN), own.listing);
    buys.push({ ranked: own.bought, market: infer.mock.calls.length });
    expect(buys).toEqual([{ ranked: [true], market: 1 }, { ranked: [undefined], market: 1 }]);
  });
});
