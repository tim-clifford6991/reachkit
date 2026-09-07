// tests/app/overview/store.test.ts — BUILD §4.5, §11 (issue #213): what a
// real account's Overview reads.
//
// `readOverviewFacts` answered `points: []` and `aiPresence: []` for every
// account that was not the reserved fixture, on the grounds that the reader
// for stored weekly reports had not landed. It had — long ago — so the two
// measurement tiles drew their unmeasured arm for every paying customer,
// whatever had been measured for them. That is a defect no unit test could
// have caught, because the stub *was* the unit; so this file drives the
// read from **rows**, and every case below is a database state rather than
// a shape.
//
// The rows that discriminate:
//
//   · **a week with no scan is `unmeasured`, never a zero** — the break in
//     the chart, and the one substitution REQ-004 exists to forbid;
//   · **the window does not start before the customer did** — a site
//     measured once gets one point, not one point and eleven gaps;
//   · **`false` and `null` are different AI-answer weeks** — measured and
//     not named, against not measured at all;
//   · **the empty arm survives** — a site with no weekly scan still reads
//     `points: []`, which is what makes the screen open on the arm it was
//     designed for rather than on a fabricated line.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type FakeDb, type Row } from "../../publish/harness";
import { REPORT_VERSION } from "@/lib/scan/report";

const db: FakeDb = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const supplyDepth = vi.fn(async () => ({ unused: 9, total: 12 }));
vi.mock("@/lib/opportunities", () => ({ supplyDepth: (...a: unknown[]) => supplyDepth(...(a as [])) }));

const { readOverviewFacts } = await import("@/app/(account)/app/_overview/store");

const SITE_ID = "site-1";
const ZONE = "UTC";
const SITE = { siteId: SITE_ID, timeZone: ZONE };

/** A Monday in 2026, as `scans.week_start` spells it. The clock below sits
 *  inside the week of the 7th of September, so these are the last four
 *  Mondays of the trailing window. */
const WEEKS = {
  aug17: "2026-08-17",
  aug24: "2026-08-24",
  aug31: "2026-08-31",
  sep07: "2026-09-07",
} as const;

/** Wednesday of the week of Monday 7 September 2026, in UTC. */
const NOW = new Date(Date.UTC(2026, 8, 9, 10, 0, 0));

/** The two figures Overview reads off a week, in a blob `readStoredReport`
 *  accepts. Everything else on the report is elided: this suite is about
 *  the projection, and a field the projection does not touch would be
 *  scenery. */
function report(a: { ownRanked: number | null; citations: number | null; at: string }): Row {
  const measuredAt = `${a.at}T09:00:00.000Z`;
  return {
    version: REPORT_VERSION,
    verdict: { measuredAt },
    ownRanked:
      a.ownRanked === null
        ? { kind: "unmeasured", reason: "not_attempted", at: measuredAt }
        : { kind: a.ownRanked === 0 ? "zero" : "measured", value: a.ownRanked, at: measuredAt },
    aiAnswers: a.citations === null ? null : { customerCitations: a.citations },
  };
}

function weeklyScan(weekStart: string, over: Row = {}): Row {
  return {
    id: `scan-${weekStart}`,
    site_id: SITE_ID,
    domain: "example.com",
    tier: "weekly",
    status: "done",
    week_start: weekStart,
    created_at: `${weekStart}T09:00:00.000Z`,
    report: report({ ownRanked: 40, citations: 1, at: weekStart }),
    ...over,
  };
}

function seedSite(): void {
  db.seed("sites", [{ id: SITE_ID, user_id: "user-1", domain: "example.com", timezone: ZONE }]);
}

async function facts() {
  vi.setSystemTime(NOW);
  return readOverviewFacts(SITE);
}

beforeEach(() => {
  db.reset();
  vi.useFakeTimers();
  seedSite();
  db.seed("publications", []);
  db.seed("drafts", []);
  db.seed("scans", []);
});

describe("the weekly series is read from the stored weekly scans", () => {
  it("one point per measured week, carrying the week's own ranked count", async () => {
    db.seed("scans", [
      weeklyScan(WEEKS.aug31, { report: report({ ownRanked: 36, citations: 0, at: WEEKS.aug31 }) }),
      weeklyScan(WEEKS.sep07, { report: report({ ownRanked: 81, citations: 2, at: WEEKS.sep07 }) }),
    ]);
    const read = await facts();
    expect(read.points).toHaveLength(2);
    expect(read.points[0]?.value).toMatchObject({ kind: "measured", value: 36 });
    expect(read.points[1]?.value).toMatchObject({ kind: "measured", value: 81 });
  });

  it("a measured zero is carried as a measurement — §6.6's cold-start law", async () => {
    db.seed("scans", [
      weeklyScan(WEEKS.sep07, { report: report({ ownRanked: 0, citations: 0, at: WEEKS.sep07 }) }),
    ]);
    const read = await facts();
    expect(read.points[0]?.value).toMatchObject({ kind: "zero", value: 0 });
  });

  it("**a week with no scan is unmeasured, never a zero** — the break in the chart", async () => {
    db.seed("scans", [
      weeklyScan(WEEKS.aug17),
      // no row for the 24th
      weeklyScan(WEEKS.aug31),
      weeklyScan(WEEKS.sep07),
    ]);
    const read = await facts();
    expect(read.points).toHaveLength(4);
    expect(read.points[1]?.value.kind).toBe("unmeasured");
    expect(read.points[1]?.value).not.toMatchObject({ value: 0 });
  });

  it("**the window does not start before the customer did** — one measured week is one point", async () => {
    db.seed("scans", [weeklyScan(WEEKS.sep07)]);
    const read = await facts();
    expect(read.points).toHaveLength(1);
    expect(read.points[0]?.value).toMatchObject({ kind: "measured", value: 40 });
  });

  it("a week whose pass did not reach the ranked count says so, rather than reading as none", async () => {
    db.seed("scans", [
      weeklyScan(WEEKS.sep07, { report: report({ ownRanked: null, citations: null, at: WEEKS.sep07 }) }),
    ]);
    const read = await facts();
    expect(read.points[0]?.value.kind).toBe("unmeasured");
  });

  it("it costs one read for the whole window, not one per week", async () => {
    db.seed("scans", [weeklyScan(WEEKS.aug31), weeklyScan(WEEKS.sep07)]);
    await facts();
    const weekReads = db.queries.filter(
      (q) => q.table === "scans" && q.filters.some((f) => f.column === "week_start")
    );
    expect(weekReads).toHaveLength(1);
  });
});

describe("the AI-answers series says measured-and-absent apart from not-measured", () => {
  it("a week the customer was named in is true, one they were not is false", async () => {
    db.seed("scans", [
      weeklyScan(WEEKS.aug31, { report: report({ ownRanked: 36, citations: 0, at: WEEKS.aug31 }) }),
      weeklyScan(WEEKS.sep07, { report: report({ ownRanked: 81, citations: 3, at: WEEKS.sep07 }) }),
    ]);
    const read = await facts();
    expect(read.aiPresence).toEqual([false, true]);
  });

  it("**a week that was not measured is null, never a miss**", async () => {
    // Rows for the 17th and the 7th, nothing for the 24th or the 31st: the
    // two middle entries are weeks nobody measured, and a `false` there
    // would tell the customer an AI answer passed them over.
    db.seed("scans", [weeklyScan(WEEKS.aug17), weeklyScan(WEEKS.sep07)]);
    const read = await facts();
    expect(read.aiPresence).toEqual([true, null, null, true]);
  });

  it("a week measured with no AI answers read at all is null, not false", async () => {
    db.seed("scans", [
      weeklyScan(WEEKS.sep07, { report: report({ ownRanked: 40, citations: null, at: WEEKS.sep07 }) }),
    ]);
    const read = await facts();
    expect(read.aiPresence).toEqual([null]);
  });

  it("it is aligned with the series, one entry per point", async () => {
    db.seed("scans", [weeklyScan(WEEKS.aug17), weeklyScan(WEEKS.aug31), weeklyScan(WEEKS.sep07)]);
    const read = await facts();
    expect(read.aiPresence).toHaveLength(read.points.length);
  });
});

describe("**the unmeasured arm, only where nothing has been measured**", () => {
  it("a site with no weekly scan reads an empty series and an empty presence", async () => {
    const read = await facts();
    expect(read.points).toEqual([]);
    expect(read.aiPresence).toEqual([]);
    expect(read.changes).toEqual([]);
  });

  it("a free or deep scan is not a measured week — the series is the weekly tier's", async () => {
    db.seed("scans", [
      {
        id: "scan-free",
        site_id: SITE_ID,
        domain: "example.com",
        tier: "free",
        status: "done",
        week_start: WEEKS.sep07,
        created_at: `${WEEKS.sep07}T09:00:00.000Z`,
        report: report({ ownRanked: 99, citations: 9, at: WEEKS.sep07 }),
      },
    ]);
    const read = await facts();
    expect(read.points).toEqual([]);
  });

  it("another site's weeks are not this site's", async () => {
    db.seed("scans", [weeklyScan(WEEKS.sep07, { site_id: "site-2" })]);
    const read = await facts();
    expect(read.points).toEqual([]);
  });
});

describe("the dates the series breaks at (REQ-071 c12/c13)", () => {
  it("a domain change inside the window is carried as a marker", async () => {
    db.seed("scans", [
      weeklyScan(WEEKS.aug31, { domain: "old.example.com" }),
      weeklyScan(WEEKS.sep07, { domain: "new.example.com" }),
    ]);
    const read = await facts();
    expect(read.changes).toHaveLength(1);
    expect(read.changes[0]?.kind).toBe("domain");
  });

  it("a site whose answers have not changed carries none", async () => {
    db.seed("scans", [weeklyScan(WEEKS.aug31), weeklyScan(WEEKS.sep07)]);
    const read = await facts();
    expect(read.changes).toEqual([]);
  });
});
