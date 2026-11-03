// A stored report whose market was read off a home page that held none of
// the site's words — a protection's page, or a page of the site's that says
// nothing — has that market withdrawn by the 0¢ re-score, through a store
// that stands in for the database.
import "../../generate/env";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { rescoreStored } from "../../../src/lib/scan/rescore-run";
import { awaitsMarketFromSearch } from "../../../src/lib/scan/pass/market";
import type { StoredReport } from "../../../src/lib/scan/report";
import { apply, fixture, storeOf, type FixtureScan } from "./rescore-store";

describe("a market read off a home page that held none of the site's words is withdrawn at 0¢", () => {
  const imperva = readFileSync(join(__dirname, "../../measure/domain/fixtures/challenge/imperva-challenge.bettys.co.uk.html"), "utf8");
  /** gusto.com's stored scan, its market read from the home page, over another stored home read. */
  const over = (html: string, report: Record<string, unknown> = {}): FixtureScan => {
    const s = fixture("gusto.com");
    const home = s.home!;
    const payload = { ...(home.payload as Record<string, unknown>), status: 200, headers: {}, html, bytes: html.length };
    return { ...s, report: { ...s.report, ...report }, home: { ...home, payload } };
  };
  const written = (db: ReturnType<typeof storeOf>, s: FixtureScan) => db.rows.get(s.id)!.report as unknown as StoredReport;

  it("Imperva's empty challenge, served with a 200: unscored, the market withdrawn, the next scan reads it from the listing, and nothing is bought", async () => {
    const fetched = vi.fn();
    vi.stubGlobal("fetch", fetched);
    try {
      const s = over(imperva);
      const db = storeOf([s]);
      const answer = await rescoreStored(db.store, apply);
      const report = written(db, s);
      expect(report.verdict.scoreAndBand.kind).toBe("unmeasured");
      expect(report.onPage).toMatchObject({ kind: "unmeasured", because: "bot_protection" });
      expect(report.market).toMatchObject({ kind: "unmeasured", because: "bot_protection" });
      expect(report.freePage).toBeNull();
      expect(awaitsMarketFromSearch(report, new Date())).toBe(true);
      expect(answer.summary).toContain("- Market withdrawn, read off no words of the site's: 1 (a protection's page: 1; a home page that says nothing: 0): gusto.com");
      expect(fetched).not.toHaveBeenCalled();
      expect(await rescoreStored(db.store, apply)).toMatchObject({ scansChanged: 0, scansWritten: 0 });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps a market read from the listing, and still states no score", async () => {
    const s = over(imperva, { marketFrom: "search" });
    const db = storeOf([s]);
    const answer = await rescoreStored(db.store, apply);
    expect(written(db, s).market.kind).toBe("measured");
    expect(written(db, s).verdict.scoreAndBand.kind).toBe("unmeasured");
    expect(answer.summary).toContain("- Market withdrawn, read off no words of the site's: 0 (");
  });

  it("a home page of the site's own that says nothing: the market withdrawn, its measured facts kept", async () => {
    const shell = '<html lang="en"><head><title>Gusto</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
    const s = over(shell);
    const db = storeOf([s]);
    const answer = await rescoreStored(db.store, apply);
    const report = written(db, s);
    expect(report.market).toMatchObject({ kind: "unmeasured", because: "home_wordless" });
    expect(report.onPage.kind).toBe("measured");
    expect(awaitsMarketFromSearch(report, new Date())).toBe(true);
    expect(answer.summary).toContain("(a protection's page: 0; a home page that says nothing: 1): gusto.com");
  });
});
