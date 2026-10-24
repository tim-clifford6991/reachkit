// Visits from Google, week by week: one reader over the stored daily counts
// that the Google tab's chart and the Monday mail both draw from.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

interface Row {
  site_id: string;
  day: string;
  engine: string;
  kind: string;
  hits: number;
}

const state: { rows: Row[]; error: string | null } = { rows: [], error: null };

/** A client that applies the read's own filters to the stored rows, so the window is the query's, not the test's. */
function query(): unknown {
  const tests: ((row: Row) => boolean)[] = [];
  const self = {
    select: () => self,
    eq: (column: keyof Row, value: unknown) => {
      tests.push((row) => row[column] === value);
      return self;
    },
    gte: (column: keyof Row, value: string) => {
      tests.push((row) => String(row[column]) >= value);
      return self;
    },
    then: (resolve: (r: unknown) => unknown) =>
      Promise.resolve(
        state.error === null
          ? { data: state.rows.filter((row) => tests.every((t) => t(row))), error: null }
          : { data: null, error: { message: state.error } }
      ).then(resolve),
  };
  return self;
}

vi.mock("@/lib/db", () => ({ dbAdmin: () => ({ from: () => query() }) }));

const { readSearchVisitsWeekly } = await import("@/lib/publish/reads/store");
const { windowStartDay } = await import("@/lib/publish/reads/model");
const { BLOG_READS_WINDOW_D } = await import("@/lib/config/constants");

const SITE = "00000000-0000-0000-0000-00000000aaaa";
const NOW = new Date("2026-10-19T06:00:00.000Z");
const dayAgo = (n: number): string => new Date(NOW.getTime() - n * 86_400_000).toISOString().slice(0, 10);
const visit = (ago: number, hits: number, over: Partial<Row> = {}): Row => ({
  site_id: SITE,
  day: dayAgo(ago),
  engine: "google",
  kind: "referral",
  hits,
  ...over,
});

beforeEach(() => {
  state.rows = [];
  state.error = null;
});

describe("readSearchVisitsWeekly", () => {
  it("buckets the days into seven-day weeks ending today, oldest first, and keeps 28 days", async () => {
    state.rows = [
      visit(0, 1),
      visit(6, 2),
      visit(7, 4),
      visit(13, 8),
      visit(20, 16),
      visit(27, 32),
      visit(28, 64),
      visit(1, 100, { engine: "chatgpt" }),
      visit(1, 100, { kind: "answer_fetch" }),
      visit(1, 100, { site_id: "00000000-0000-0000-0000-00000000bbbb" }),
    ];
    const weeks = await readSearchVisitsWeekly({ siteId: SITE, now: NOW });
    expect(weeks?.map((w) => w.visits)).toEqual([32, 16, 12, 3]);
    expect(weeks?.map((w) => w.start)).toEqual([dayAgo(27), dayAgo(20), dayAgo(13), dayAgo(6)]);
  });

  it("leaves out the weeks before the first visit rather than drawing them as 0", async () => {
    state.rows = [visit(10, 3), visit(2, 5)];
    expect((await readSearchVisitsWeekly({ siteId: SITE, now: NOW }))?.map((w) => w.visits)).toEqual([3, 5]);
  });

  it("keeps a quiet week after the first visit, and returns no week before any visit", async () => {
    state.rows = [visit(10, 3)];
    expect((await readSearchVisitsWeekly({ siteId: SITE, now: NOW }))?.map((w) => w.visits)).toEqual([3, 0]);
    state.rows = [];
    expect(await readSearchVisitsWeekly({ siteId: SITE, now: NOW })).toEqual([]);
  });

  it("is null when the counts cannot be read", async () => {
    state.error = "connection reset";
    expect(await readSearchVisitsWeekly({ siteId: SITE, now: NOW })).toBeNull();
  });

  it("its last week is this week's figure: every visit since the window the tab and the mail state", async () => {
    state.rows = [visit(0, 2), visit(3, 5), visit(6, 1), visit(7, 9), visit(15, 4)];
    const since = windowStartDay(NOW, BLOG_READS_WINDOW_D);
    const thisWeek = state.rows.filter((row) => row.day >= since).reduce((sum, row) => sum + row.hits, 0);
    expect((await readSearchVisitsWeekly({ siteId: SITE, now: NOW }))?.at(-1)?.visits).toBe(thisWeek);
    expect(thisWeek).toBe(8);
  });
});
