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
function report(a: {
  ownRanked: number | null;
  citations: number | null;
  at: string;
  /** §6.6's sizing, as the week stored it. `null` is a pass that did not
   *  size rivals at all — a free tier or a ceiling — which is a different
   *  fact from a rival it could not size. */
  sizes?: readonly { domain: string; rankedCount: number; band: string }[] | null;
}): Row {
  const measuredAt = `${a.at}T09:00:00.000Z`;
  const sizes = a.sizes === undefined ? [] : a.sizes;
  return {
    version: REPORT_VERSION,
    verdict: { measuredAt },
    ownRanked:
      a.ownRanked === null
        ? { kind: "unmeasured", reason: "not_attempted", at: measuredAt }
        : { kind: a.ownRanked === 0 ? "zero" : "measured", value: a.ownRanked, at: measuredAt },
    aiAnswers: a.citations === null ? null : { customerCitations: a.citations },
    rivalSizes:
      sizes === null
        ? { kind: "unmeasured", reason: "not_attempted", at: measuredAt }
        : {
            kind: "measured",
            value: sizes.map((size) => ({
              domain: size.domain,
              state: "sized",
              rankedCount: size.rankedCount,
              band: size.band,
              at: measuredAt,
              current: true,
            })),
            at: measuredAt,
          },
  };
}

/** The set the customer tracks — `sites.competitors`, in their own order. */
function tracking(...domains: readonly string[]): void {
  const site = db.rows("sites")[0];
  if (site !== undefined) site.competitors = [...domains];
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


// ── §6.6's rival rows, read from the same stored week (issue #223) ──────
//
// The rows that discriminate are about *which* rivals get a row and *what
// an unmeasured one says*. A screen that quietly drops a rival, or shows a
// zero for one nobody sized, breaks REQ-096 c5 and c7 in a way no customer
// would report as a bug — they would simply believe the number.

describe("the rival rows are the customer's own set, in their own order", () => {
  it("one row per tracked rival, in the order they chose them", async () => {
    tracking("bigcompetitor.com", "similar.io");
    db.seed("scans", [
      weeklyScan(WEEKS.sep07, {
        report: report({
          ownRanked: 81,
          citations: 1,
          at: WEEKS.sep07,
          sizes: [
            { domain: "similar.io", rankedCount: 140, band: "near" },
            { domain: "bigcompetitor.com", rankedCount: 6318, band: "far" },
          ],
        }),
      }),
    ]);
    const read = await facts();
    // The *tracked* order, not the sizing's.
    expect(read.rivals.rivals.map((r) => r.domain)).toEqual(["bigcompetitor.com", "similar.io"]);
    expect(read.rivals.rivals.every((r) => r.confirmed)).toBe(true);
  });

  it("a rival the customer removed since the pass is not drawn from the stored entry", async () => {
    tracking("similar.io");
    db.seed("scans", [
      weeklyScan(WEEKS.sep07, {
        report: report({
          ownRanked: 81,
          citations: 1,
          at: WEEKS.sep07,
          sizes: [
            { domain: "similar.io", rankedCount: 140, band: "near" },
            { domain: "removed-rival.net", rankedCount: 6318, band: "far" },
          ],
        }),
      }),
    ]);
    const read = await facts();
    expect(read.rivals.rivals.map((r) => r.domain)).toEqual(["similar.io"]);
  });

  it("a rival added since the pass gets a row with nothing measured in it, never no row", async () => {
    tracking("similar.io", "newcomer.dev");
    db.seed("scans", [
      weeklyScan(WEEKS.sep07, {
        report: report({
          ownRanked: 81,
          citations: 1,
          at: WEEKS.sep07,
          sizes: [{ domain: "similar.io", rankedCount: 140, band: "near" }],
        }),
      }),
    ]);
    const read = await facts();
    expect(read.rivals.rivals.map((r) => r.domain)).toEqual(["similar.io", "newcomer.dev"]);
    expect(read.rivals.rivals[1]?.ranked.kind).toBe("unmeasured");
  });

  it("a site tracking nobody has no rows, and the read does not throw", async () => {
    tracking();
    db.seed("scans", [weeklyScan(WEEKS.sep07)]);
    const read = await facts();
    expect(read.rivals.rivals).toEqual([]);
  });
});

describe("**a week that did not size rivals leaves the rows unmeasured, never zero**", () => {
  it("a pass with no sizing at all — a free tier, or a ceiling", async () => {
    tracking("similar.io");
    db.seed("scans", [
      weeklyScan(WEEKS.sep07, {
        report: report({ ownRanked: 81, citations: 1, at: WEEKS.sep07, sizes: null }),
      }),
    ]);
    const read = await facts();
    expect(read.rivals.rivals[0]?.ranked.kind).toBe("unmeasured");
    expect(read.rivals.rivals[0]?.ranked).not.toMatchObject({ value: 0 });
    // And no band, so no offer can be composed for it.
    expect(read.rivals.rivals[0]).not.toHaveProperty("size");
  });

  it("the customer's own count is still read — one section missing is not the whole week", async () => {
    tracking("similar.io");
    db.seed("scans", [
      weeklyScan(WEEKS.sep07, {
        report: report({ ownRanked: 81, citations: 1, at: WEEKS.sep07, sizes: null }),
      }),
    ]);
    const read = await facts();
    expect(read.rivals.own).toMatchObject({ kind: "measured", value: 81 });
  });

  it("a week that sized one rival and not another says so per row", async () => {
    tracking("sizedrival.com", "unsizedrival.com");
    db.seed("scans", [
      weeklyScan(WEEKS.sep07, {
        report: report({
          ownRanked: 81,
          citations: 1,
          at: WEEKS.sep07,
          sizes: [{ domain: "sizedrival.com", rankedCount: 140, band: "near" }],
        }),
      }),
    ]);
    const read = await facts();
    expect(read.rivals.rivals[0]?.ranked).toMatchObject({ kind: "measured", value: 140 });
    expect(read.rivals.rivals[1]?.ranked.kind).toBe("unmeasured");
  });
});

describe("the band rides through, and with it REQ-096 c6's offer", () => {
  it("a far rival's stored entry reaches the facts whole", async () => {
    tracking("bigcompetitor.com");
    db.seed("scans", [
      weeklyScan(WEEKS.sep07, {
        report: report({
          ownRanked: 81,
          citations: 1,
          at: WEEKS.sep07,
          sizes: [{ domain: "bigcompetitor.com", rankedCount: 6318, band: "far" }],
        }),
      }),
    ]);
    const read = await facts();
    expect(read.rivals.rivals[0]?.size).toMatchObject({ state: "sized", band: "far" });
  });

  it("the counts a delta is taken against come from the previous measured week", async () => {
    tracking("bigcompetitor.com");
    db.seed("scans", [
      weeklyScan(WEEKS.aug31, {
        report: report({
          ownRanked: 36,
          citations: 1,
          at: WEEKS.aug31,
          sizes: [{ domain: "bigcompetitor.com", rankedCount: 9936, band: "far" }],
        }),
      }),
      weeklyScan(WEEKS.sep07, {
        report: report({
          ownRanked: 81,
          citations: 1,
          at: WEEKS.sep07,
          sizes: [{ domain: "bigcompetitor.com", rankedCount: 6318, band: "far" }],
        }),
      }),
    ]);
    const read = await facts();
    expect(read.rivals.own).toMatchObject({ value: 81 });
    expect(read.rivals.previousOwn).toMatchObject({ value: 36 });
    expect(read.rivals.rivals[0]?.previousRanked).toMatchObject({ value: 9936 });
  });
});

describe("the series carries the units of the arm the module will take", () => {
  const twoWeeks = (own: [number, number], rival: [number, number]) => [
    weeklyScan(WEEKS.aug31, {
      report: report({
        ownRanked: own[0],
        citations: 1,
        at: WEEKS.aug31,
        sizes: [{ domain: "bigcompetitor.com", rankedCount: rival[0], band: "far" }],
      }),
    }),
    weeklyScan(WEEKS.sep07, {
      report: report({
        ownRanked: own[1],
        citations: 1,
        at: WEEKS.sep07,
        sizes: [{ domain: "bigcompetitor.com", rankedCount: rival[1], band: "far" }],
      }),
    }),
  ];

  it("above the unlock it is the ratio, week by week", async () => {
    tracking("bigcompetitor.com");
    db.seed("scans", twoWeeks([36, 81], [9936, 6318]));
    const read = await facts();
    // 9936/36 = 276, 6318/81 = 78 — §4.5's own two figures.
    expect(read.rivals.rivals[0]?.series).toEqual([276, 78]);
  });

  it("below it, the rival's own count — never a ratio against a count of nothing", async () => {
    tracking("bigcompetitor.com");
    db.seed("scans", twoWeeks([0, 0], [9936, 6318]));
    const read = await facts();
    expect(read.rivals.rivals[0]?.series).toEqual([9936, 6318]);
  });

  it("a week that sized nobody contributes no point rather than a null", async () => {
    // A `null` in this series is a *break* the row has to account for
    // beside the plot; using it for "we did not measure that week" would
    // state a discontinuity that did not happen.
    tracking("bigcompetitor.com");
    db.seed("scans", [
      ...twoWeeks([36, 81], [9936, 6318]),
      weeklyScan(WEEKS.aug24, {
        report: report({ ownRanked: 30, citations: 1, at: WEEKS.aug24, sizes: null }),
      }),
    ]);
    const read = await facts();
    expect(read.rivals.rivals[0]?.series).toEqual([276, 78]);
    expect(read.rivals.rivals[0]?.series).not.toContain(null);
  });
});
