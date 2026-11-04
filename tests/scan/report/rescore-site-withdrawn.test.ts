// The 0¢ re-score withdraws a paid site's market adopted off a home read with none of the site's words, through
// a store standing in for the database; the founder's category and a market read from the listing stand.
import "../../generate/env";
import { describe, expect, it, vi } from "vitest";
import { rescoreStored, type StoredSiteRow } from "../../../src/lib/scan/rescore-run";
import { apply, at, dry, fixture, IMPERVA, over, storeOf, type FixtureScan } from "./rescore-store";

const ledger = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ dbAdmin: ledger, db: ledger }));

const SHELL = '<html lang="en"><head><title>Zapier</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
const OWN = `<html lang="en"><head><title>Gusto</title></head><body><p>${"Payroll, benefits and HR software for small businesses. ".repeat(10)}</p></body></html>`;

/** A paid site whose market the scan `s` adopted. */
const siteOf = (s: FixtureScan, market: Record<string, unknown> = {}): StoredSiteRow => {
  const lastChange = { scanId: s.id, category: { from: null, to: "payroll software" } };
  return { id: `site-${s.id}`, domain: String(s.report.domain), category: "payroll software", competitors: ["adp.com"], market: { current: { category: "payroll software", rivals: [{ domain: "adp.com" }] }, pending: null, rivalsOverridden: true, lastChange, ...market } };
};

/** The re-score over these scans and sites, its site writes landing on the rows. */
async function run(scans: readonly FixtureScan[], sites: StoredSiteRow[], o = apply) {
  const db = storeOf(scans, sites);
  for (const s of scans) Object.assign(db.rows.get(s.id)!, { siteId: sites.find((site) => site.domain === s.report.domain)?.id ?? null, isCurrent: true });
  db.store.writeSite = async (w) => void (db.sitesWritten.push(w), Object.assign(sites.find((site) => site.id === w.id)!, w));
  return { answer: await rescoreStored(db.store, o), written: db.sitesWritten };
}

describe("a paid site's market read off no words of the site's is withdrawn at 0¢; the founder's or the listing's stands", () => {
  it("a paid site whose market was adopted from Imperva's challenge home: category and current withdrawn, the previous value kept, nothing bought", async () => {
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    const s = over("gusto.com", IMPERVA);
    const site = siteOf(s);
    const { written } = await run([s], [site]);
    vi.unstubAllGlobals();
    expect(site).toMatchObject({ category: null, competitors: ["adp.com"], market: { current: null, pending: null, rivalsOverridden: true } });
    expect(site.market!.withdrawn).toEqual({ previous: { category: "payroll software", current: siteOf(s).market!.current, competitors: ["adp.com"] }, because: "bot_protection", at: at.toISOString(), by: "abc1234" });
    expect([written.length, fetched.mock.calls.length, ledger.mock.calls.length]).toEqual([1, 0, 0]);
    expect((await run([s], [site])).written).toEqual([]);
  });

  it("the summary names each withdrawn site under its rule, dry and applied alike; a home that says nothing is home_wordless", async () => {
    const scans = [over("gusto.com", IMPERVA), over("zapier.com", SHELL)];
    const sites = scans.map((s) => siteOf(s));
    const line = "- Paid sites' market withdrawn, read off no words of the site's: 2 (a protection's page: 1; a home page that says nothing: 1): gusto.com, zapier.com\n";
    const dryRun = await run(scans, sites, dry);
    expect([dryRun.answer.summary.includes(line), dryRun.written, (await run(scans, sites)).answer.summary.includes(line)]).toEqual([true, [], true]);
    expect(sites.map((s) => s.market!.withdrawn)).toMatchObject([{ because: "bot_protection" }, { because: "home_wordless" }]);
    expect((await run([over("gusto.com", OWN)], [siteOf(over("gusto.com", OWN))], dry)).answer.summary).toContain("- Paid sites' market withdrawn, read off no words of the site's: 0 (a protection's page: 0; a home page that says nothing: 0)\n");
  });

  const stands = async (s: FixtureScan, market: Record<string, unknown> = {}) => {
    const site = siteOf(s, market);
    const before = structuredClone(site);
    expect([(await run([s], [site])).written, site]).toEqual([[], before]);
  };
  const drawn = { ...(fixture("gusto.com").home!.payload as Record<string, unknown>), status: 200, html: OWN, bytes: OWN.length };
  it("the founder's category stands over a challenge home", () => stands(over("gusto.com", IMPERVA), { categoryOverridden: true }));
  it("a market read from the listing stands", () => stands(over("gusto.com", IMPERVA, { marketFrom: "search" })));
  it("a rendered read that drew the site keeps the market", () => stands(over("gusto.com", SHELL, {}, [{ created_at: "2026-10-08T13:53:00+00:00", payload: [drawn] }])));
  it("a home read of the site's own with words is untouched", () => stands(over("gusto.com", OWN)));

  it("gusto.com's stored rows: the site is untouched unless it has a sites row", async () => {
    expect((await run([fixture("gusto.com")], [])).written).toEqual([]);
    const site = siteOf(fixture("gusto.com"));
    await run([fixture("gusto.com")], [site]);
    expect(site.market).toMatchObject({ current: null, withdrawn: { because: "bot_protection" } });
  });
});
