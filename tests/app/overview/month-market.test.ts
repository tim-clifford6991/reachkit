// SPEC §4 (board Main): Overview's months-scale figures are the first
// Monday's weekly pass against the customer's own scan, read from stored
// rows; a pass that measured fewer searches than it selected gives no market.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type FakeDb, type Row } from "../../publish/harness";
import { REPORT_VERSION } from "@/lib/scan/report";

const db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/opportunities", () => ({
  supplyDepth: async () => ({ unused: 9, total: 12 }),
  supplyMeasured: async () => true,
  supplyState: async () => "measured",
  readWeek: async () => [],
}));

const { readOverviewFacts } = await import("@/app/(account)/app/_overview/store");

const SITE_ID = "site-1";
const SITE = { siteId: SITE_ID, timeZone: "UTC", domain: "example.com" };
const WEEKS = { aug24: "2026-08-24", aug31: "2026-08-31", sep07: "2026-09-07" } as const;
/** Wednesday of the week of Monday 7 September 2026, in UTC. */
const NOW = new Date(Date.UTC(2026, 8, 9, 10, 0, 0));

/** A stored pass: its score, its presence card, and one slot per search it selected. */
function scored(at: string, score: number, top10: number, measuredSearches = 12): Row {
  const measuredAt = `${at}T09:00:00.000Z`;
  return {
    version: REPORT_VERSION,
    ownRanked: { kind: "measured", value: 40, at: measuredAt },
    aiAnswers: { customerCitations: 1 },
    rivalSizes: { kind: "measured", value: [], at: measuredAt },
    verdict: { measuredAt, scoreAndBand: { kind: "measured", value: { score, band: "hard-to-find" }, at: measuredAt } },
    presence: { measuredSearches, you: { domain: "example.com", top10Count: top10 }, rivals: [], absentFrom: [], framing: "shown" },
    serps: Array.from({ length: 12 }, () => ({ kind: "unmeasured", reason: "not_attempted", at: measuredAt })),
  };
}

function weekly(week: string, report: Row): Row {
  return { id: `scan-${week}`, site_id: SITE_ID, domain: "example.com", tier: "weekly", status: "done", week_start: week, created_at: `${week}T09:00:00.000Z`, report };
}

const deep = (at: string, score: number, top10: number, measuredSearches = 12): Row => ({
  ...weekly(at, scored(at, score, top10, measuredSearches)),
  id: "scan-deep",
  tier: "deep",
  week_start: null,
});

async function months() {
  vi.setSystemTime(NOW);
  return (await readOverviewFacts(SITE)).months;
}

beforeEach(() => {
  db.reset();
  vi.useFakeTimers();
  db.seed("sites", [{ id: SITE_ID, user_id: "user-1", domain: "example.com", timezone: "UTC" }]);
  db.seed("publications", []);
  db.seed("drafts", []);
  db.seed("scans", []);
});

describe("the months-scale figures are the first Monday's weekly pass, against the scan", () => {
  it("reads the month's first Monday, never the newest week, and the scan's own figures", async () => {
    db.seed("scans", [deep("2026-08-12", 27, 0), weekly(WEEKS.aug31, scored(WEEKS.aug31, 50, 3)), weekly(WEEKS.sep07, scored(WEEKS.sep07, 31, 1))]);
    expect(await months()).toEqual({
      reading: { week: WEEKS.sep07, score: 31, market: { top10: 1, of: 12 } },
      scan: { score: 27, market: { top10: 0, of: 12 } },
      next: "2026-10-05",
    });
  });

  it("before any first Monday is measured there is no reading, and the next is named", async () => {
    db.seed("scans", [weekly(WEEKS.aug24, scored(WEEKS.aug24, 50, 3)), weekly(WEEKS.aug31, scored(WEEKS.aug31, 50, 3))]);
    const read = await months();
    expect(read?.reading).toBeNull();
    expect(read?.scan).toEqual({ score: null, market: null });
    expect(read?.next).toBe("2026-10-05");
  });

  it("a first Monday or a scan that measured fewer searches than it selected gives no market, and keeps its score", async () => {
    db.seed("scans", [deep("2026-08-12", 27, 3, 11), weekly(WEEKS.sep07, scored(WEEKS.sep07, 31, 0, 2))]);
    expect(await months()).toEqual({
      reading: { week: WEEKS.sep07, score: 31, market: null },
      scan: { score: 27, market: null },
      next: "2026-10-05",
    });
  });
});
