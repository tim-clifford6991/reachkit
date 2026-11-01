// A stored free page on a job seeker's search, picked again by the 0¢
// re-score as the `scan/rescore` job runs it: the row whole, through a store
// that stands in for the database.
// The free-page fixtures assemble a report through the store, which parses env at load.
import "../../opportunities/env";
import { describe, expect, it } from "vitest";
import { freePageOf } from "../../../src/lib/opportunities/free-page";
import { measured } from "../../../src/lib/measure/measured";
import { marketSetOf } from "../../../src/lib/market/questions/market-set";
import { rescoreStored, type RescoreStore, type ScanWrite, type StoredScanRow } from "../../../src/lib/scan/rescore-run";
import { AT, PROFILE } from "./fixtures";
import { SCAN_ID, question, reportOf, search, serp } from "../../opportunities/fixtures";

// The AU "baker" top ten: careers pages, a jobs board and one bakery.
const baker = serp({
  organic: [
    ["www.yourcareer.gov.au", "Baker | Your Career"],
    ["bakingcareer.com.au", "Baking Career - Everything you need to know"],
    ["www.seek.com.au", "Baker Jobs in Australia - SEEK"],
    ["www.brumbys.com.au", "Brumby's Bakeries | Fresh bread"],
  ].map(([domain, title], i) => ({ position: i + 1, domain: domain!, url: `https://${domain}/`, title: title! })),
});
const market = (category: string) => ({ market: measured(marketSetOf({ profile: { ...PROFILE, category }, suggestions: [] }), AT) });
const bakerOnly = (category: string) => reportOf({ questions: [question({ search: search({ keyword: "baker" }) })], serps: [baker] }, market(category));
// Beside it a second search, so a pick stored as it stood is told from one picked again.
const reportFor = (category: string) =>
  reportOf({ questions: [question(), question({ id: "q2", search: search({ keyword: "baker" }) })], serps: [serp(), baker] }, market(category));
// The pick stored before a jobs search stopped being a page to write.
const stalePick = freePageOf(bakerOnly("recruitment agency"))!;
const json = (value: unknown): Record<string, unknown> => JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

/** One stored scan, and `rescore_scan`'s path-level rewrite applied to it. */
function storeFor(category: string) {
  const row: StoredScanRow = {
    id: SCAN_ID,
    domain: "example.com",
    createdAt: AT.toISOString(),
    status: "done",
    score: null,
    drivers: null,
    md5: "stored",
    report: json({ ...reportFor(category), freePage: stalePick }),
    siteId: null,
    isCurrent: false,
  };
  const written: ScanWrite[] = [];
  const store: RescoreStore = {
    scans: async () => [structuredClone(row)],
    homeReads: async () => [],
    ownReads: async () => ({ own: [], ours: [], oursReads: [] }),
    sites: async () => [],
    profiles: async () => [],
    answers: async () => [],
    async writeScan(w) {
      written.push(w);
      const report = row.report as Record<string, unknown>;
      for (const change of w.changes) {
        let at = report as Record<string | number, unknown>;
        for (const key of change.path.slice(0, -1)) at = at[key] as Record<string | number, unknown>;
        at[change.path[change.path.length - 1]!] = json({ value: change.value }).value;
      }
      Object.assign(row, { score: w.score, status: w.status, drivers: json(w.drivers) });
      return true;
    },
    writeSite: async () => {},
    writeProfileName: async () => false,
  };
  return { store, written, freePage: () => (row.report as { freePage: unknown }).freePage };
}

const apply = { apply: true, version: "abc1234", at: new Date("2026-10-14T12:00:00Z") };

describe("a stored free page on a job seeker's search is picked again at 0¢", () => {
  it('a bakery\'s stored page on "baker" is re-picked, counted, and a second apply writes nothing', async () => {
    expect(stalePick.target.keyword).toBe("baker");
    const db = storeFor("bakery");
    expect((await rescoreStored(db.store, apply)).summary).toContain("free page re-picked: 1");
    const repicked = freePageOf(reportFor("bakery"))!;
    expect(repicked.target.keyword).not.toBe("baker");
    expect(db.freePage()).toEqual(json(repicked));

    expect(await rescoreStored(db.store, apply)).toMatchObject({ scansChanged: 0, scansWritten: 0 });
    expect(db.written).toHaveLength(1);
  });

  it('a recruitment agency\'s stored page on "baker" is still a candidate, so it stands as stored', async () => {
    expect(freePageOf(reportFor("recruitment agency"))).not.toEqual(stalePick);
    const db = storeFor("recruitment agency");
    expect((await rescoreStored(db.store, apply)).summary).toContain("free page re-picked: 0");
    expect(db.written.flatMap((w) => w.changes).filter((c) => c.path[0] === "freePage")).toEqual([]);
    expect(db.freePage()).toEqual(json(stalePick));
  });
});
