// SPEC §6 (2026-09-22, #1004) — the Monday pass's mentions read, and the
// four different sentences a week can be.
//
// The distinction this file exists to hold is SPEC §6's own: "a week with
// no rows is a measured zero (a written line), not a blank card; a site
// never queried draws no card." Four statuses, and each one is a different
// thing to say to a founder:
//
//   measured     the engines answered these questions with your site
//   zero         the engines answered nobody with your site this week
//   skipped_cap  we did not look this week
//   failed       we looked and could not read the answer
//
// Collapsing any two of them puts a claim on the screen that was never
// measured, which is the one thing `Measured`'s trichotomy exists to stop.
//
// The store is a double: what is proved here is which row the pass asks for,
// not that Postgres can hold it (the migration's own shape is proved
// against a live database by the `schema · RLS` gate).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MentionWeekWrite } from "../../src/lib/mentions/store.ts";
import type { MentionRow } from "../../src/lib/vendors/dataforseo/types.ts";
import type { Measured } from "../../src/lib/measure/measured.ts";
import type { CostContext } from "../../src/lib/costs/index.ts";

const writes: MentionWeekWrite[] = [];
let answer: Measured<{ rows: readonly MentionRow[]; total: number | null }> = {
  kind: "unmeasured",
  reason: "not_attempted",
  at: new Date(0),
};

vi.mock("../../src/lib/mentions/store.ts", () => ({
  storeMentionWeek: async (write: MentionWeekWrite) => {
    writes.push(write);
    return { stored: true };
  },
}));

vi.mock("../../src/lib/vendors/dataforseo/index.ts", () => ({
  llmMentions: async () => answer,
}));

const { readWeeklyMentions, normalise } = await import("../../src/lib/mentions/pass.ts");

const AT = new Date("2026-09-21T06:00:00Z");
const WHERE = { siteId: "site-1", domain: "example.com", weekStart: "2026-09-21", scanId: "scan-1" };

/** A `CostContext` whose running total the caller moves, so the pass's own
 *  "what did this call settle at" delta is exercised rather than assumed.
 *  Only `spentCents` is reached: the vendor call itself is the double
 *  above. */
function spendingContext(settled: number): CostContext {
  let spent = 12.5; // what the rest of the Monday pass had already spent
  return {
    cap: "WEEKLY",
    recordFetch: (() => {
      throw new Error("the vendor call is doubled; recordFetch is not reached");
    }) as unknown as CostContext["recordFetch"],
    capHit: () => false,
    spentCents: () => {
      const now = spent;
      spent += settled;
      return now;
    },
    degraded: () => false,
  };
}

function row(a: Partial<MentionRow> & { question: string }): MentionRow {
  return {
    engine: "google_ai_overview",
    model: null,
    citedUrls: [],
    aiSearchVolume: null,
    monthlySearches: null,
    firstSeenAt: null,
    lastSeenAt: null,
    ...a,
  };
}

beforeEach(() => {
  writes.length = 0;
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("the four sentences a week can be", () => {
  it("rows the engines gave are a measured week, with the vendor's own breadth beside them", async () => {
    answer = {
      kind: "measured",
      at: AT,
      value: { rows: [row({ question: "pex versus copper pipes" })], total: 933 },
    };
    const outcome = await readWeeklyMentions(spendingContext(10.1), WHERE);

    expect(outcome).toEqual({ status: "measured", stored: 1, totalCount: 933 });
    expect(writes[0]).toMatchObject({ status: "measured", totalCount: 933, weekStart: "2026-09-21" });
  });

  it("a vendor answer with no rows is a measured zero — a row is still written, and it says zero", async () => {
    answer = { kind: "zero", at: AT, value: { rows: [], total: 0 } };
    const outcome = await readWeeklyMentions(spendingContext(10), WHERE);

    expect(outcome.status).toBe("zero");
    // The row is the whole point: with no row the card is not drawn at all,
    // and "the engines named nobody this week" would be indistinguishable
    // from "we never asked".
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ status: "zero", mentions: [] });
  });

  it("a week the weekly cap refused is skipped_cap, and is stored as such", async () => {
    answer = { kind: "unmeasured", reason: "not_attempted", at: AT };
    const outcome = await readWeeklyMentions(spendingContext(0), WHERE);

    expect(outcome.status).toBe("skipped_cap");
    expect(writes[0]).toMatchObject({ status: "skipped_cap", mentions: [], totalCount: null });
    // Nothing was asked, so nothing was spent — and the row says so, which
    // is what keeps this week out of the pass's own cost.
    expect(writes[0]?.costCents).toBe(0);
  });

  it("a vendor that could not be read is failed, and never a zero", async () => {
    answer = { kind: "unmeasured", reason: "undeterminable", at: AT };
    const outcome = await readWeeklyMentions(spendingContext(20), WHERE);

    expect(outcome.status).toBe("failed");
    expect(writes[0]).toMatchObject({ status: "failed", mentions: [] });
  });
});

describe("what the week's row records about the money", () => {
  it("stores what this one call settled at, not what it reserved and not the pass's running total", async () => {
    answer = { kind: "measured", at: AT, value: { rows: [row({ question: "q" })], total: 1 } };
    await readWeeklyMentions(spendingContext(10.1), WHERE);

    // 12.5c was already spent by the rest of the pass; this call settled at
    // 10.1c. The row carries 10.1, so it and `fetches.cost_cents` agree.
    expect(writes[0]?.costCents).toBeCloseTo(10.1, 6);
  });
});

describe("one row per question and cited page — what the two cards group by", () => {
  it("a mention citing two of the site's pages becomes two rows carrying the same question", () => {
    const rows = normalise([
      row({
        question: "best plumber in seattle",
        citedUrls: ["https://example.com/a", "https://example.com/b"],
        aiSearchVolume: 320,
      }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.citedUrl)).toEqual(["https://example.com/a", "https://example.com/b"]);
    expect(new Set(rows.map((r) => r.question))).toEqual(new Set(["best plumber in seattle"]));
    expect(new Set(rows.map((r) => r.aiSearchVolume))).toEqual(new Set([320]));
  });

  it("a mention citing no page of ours is still one row — the question survives its decoration", () => {
    const rows = normalise([row({ question: "replace wax seal toilet", citedUrls: [] })]);

    expect(rows).toEqual([
      {
        question: "replace wax seal toilet",
        engine: "google_ai_overview",
        model: null,
        citedUrl: null,
        aiSearchVolume: null,
        monthlySearches: null,
        firstSeenAt: null,
        lastSeenAt: null,
      },
    ]);
  });

  it("reads the vendor's dates as instants, and a date it will not parse as null rather than as today", () => {
    const rows = normalise([
      row({ question: "q", firstSeenAt: "2026-08-03T00:00:00Z", lastSeenAt: "not a date" }),
    ]);

    expect(rows[0]?.firstSeenAt?.toISOString()).toBe("2026-08-03T00:00:00.000Z");
    // A question "first seen" today because its date would not parse is a
    // new question that is not new.
    expect(rows[0]?.lastSeenAt).toBeNull();
  });
});
