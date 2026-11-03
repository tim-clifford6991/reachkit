// A home page of the site's own with no words is never profiled: its market
// is read from the listing its one ranked purchase carries, and a listing too
// thin to name a market from reads none and keeps why. The measurement is the
// real one; only its ports and the cost seam are doubles.
import "../generate/env";
import { describe, expect, it } from "vitest";
import type { CostContext } from "@/lib/costs";
import { measureDomain, type MeasurePorts } from "@/lib/measure";
import { measured } from "@/lib/measure/measured";
import { marketReadingOf } from "@/lib/scan/pass/market";
import type { StageArgs } from "@/lib/scan/pass/sections";
import type { RankedResult, RankedRow } from "@/lib/vendors/dataforseo/types";

const DOMAIN = "bettys.co.uk";
const AT = new Date("2026-11-03T09:00:00.000Z");
const SHELL = '<!doctype html><html><head><title>Bettys</title></head><body><div id="root"></div></body></html>';
const READABLE = `<html><head><title>Bettys</title></head><body><h1>Afternoon tea and cakes</h1><p>${"Tea rooms and a bakery in Yorkshire. ".repeat(3)}</p></body></html>`;
const SEARCHES = ["afternoon tea harrogate", "tea rooms york", "yorkshire fat rascal", "afternoon tea gift box", "loose leaf tea online", "fruit cake delivery", "christmas cake yorkshire", "tea room ilkley", "bakery harrogate", "afternoon tea voucher", "yorkshire tea gift", "cake shop york"];
const rows = (n: number): RankedRow[] =>
  SEARCHES.slice(0, n).map((keyword, i) => ({ keyword, position: i + 1, searchVolume: 100, url: `https://${DOMAIN}/`, title: "Bettys Café Tea Rooms" }));

const cost = {
  recordFetch: async (call: { run: () => Promise<unknown>; costCents: number }) => ({ payload: await call.run(), fresh: true, costCents: call.costCents }),
  capHit: () => false,
  spentCents: () => 0,
  degraded: () => false,
} as unknown as CostContext;

async function readingOf(html: string, ranked: readonly RankedRow[]) {
  const bought: (boolean | undefined)[] = [];
  const ports: MeasurePorts = {
    fetchDocument: async (url) => ({ ok: true, status: 200, url, html, bytes: html.length, readAt: AT, headers: {} }),
    readRobots: async () => ({ ok: false, reason: "not read here" }),
    rankedKeywords: async (_c, a) => (bought.push(a.listing), measured<RankedResult>({ rows: [...ranked], total: ranked.length }, AT)),
  };
  const measurement = await measureDomain(cost, { domain: DOMAIN, at: AT, tier: "free" }, ports);
  const args = { domain: DOMAIN, sections: { marketThin: null } } as unknown as StageArgs;
  return { read: marketReadingOf(args, measurement), bought, thin: args.sections.marketThin, measurement };
}

describe("what the profile call reads of a home page", () => {
  it("one of the site's own with no words: the listing its one ranked purchase carries, never the page", async () => {
    const { read, bought, measurement } = await readingOf(SHELL, rows(12));
    expect(read).not.toHaveProperty("home");
    expect(read).toMatchObject({ search: expect.stringContaining(`Site: ${DOMAIN}`) });
    expect(bought).toEqual([true]);
    // The page is the site's: it is measured as it is.
    expect(measurement.onPage.kind).not.toBe("unmeasured");
  });

  it("one with no words and a listing too thin: no market, and why is kept", async () => {
    const { read, thin } = await readingOf(SHELL, rows(3));
    expect(read).toBeNull();
    expect(thin).toBe("few_ranked_searches");
  });

  it("one with words: the page, and rows bought as ever", async () => {
    const { read, bought } = await readingOf(READABLE, rows(12));
    expect(read).toMatchObject({ home: expect.stringContaining("Afternoon tea and cakes") });
    expect(bought).toEqual([undefined]);
  });
});
