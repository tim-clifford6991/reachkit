// tests/app/calendar/month.test.ts — BUILD §4.6, REQ-043 criteria 1, 2, 6, 7
//
// WO-164 `## Test plan`: one page per date, weekends, the counts, the
// site-local day boundary, and that nothing here creates a page.
import { describe, expect, it } from "vitest";
import { measured } from "@/lib/measure/measured";
import {
  TwoPagesOnOneDateError,
  assembleMonth,
  cellFor,
  type CalendarFacts,
  type DraftOnDay,
} from "@/app/(account)/app/calendar/month";
import { weekdayIndex, monthGrid } from "@/app/(account)/app/calendar/dates";
import { STAGE_OF } from "@/app/(account)/app/calendar/stages";
import {
  FIXTURE_CALENDAR_FACTS,
  FIXTURE_MONTH,
} from "@/app/(account)/app/calendar/fixture";

const AT = new Date(Date.UTC(2026, 8, 14, 6, 0, 0));

function draft(day: string, state: DraftOnDay["state"]): DraftOnDay {
  return {
    draftId: `d-${day}`,
    title: `page for ${day}`,
    state,
    scheduledFor: day,
    why: {
      search: "a search",
      askedAs: "a question",
      answeredTodayBy: ["rival.example"],
      youStand: measured(3, AT),
      doneWhen: "an acceptance test",
      winnability: "winnable",
    },
    measuredAt: AT,
    liveUrl: state === "published" ? "https://content.example.com/p" : null,
    vetoDeadline: null,
    publishAt: null,
  };
}

const BARE: CalendarFacts = {
  timeZone: "America/New_York",
  now: new Date(Date.UTC(2026, 8, 15, 14, 0, 0)),
  drafts: [],
  instructions: {},
  stoppedDays: [],
  customerChangeHoldsPages: null,
  unusedSupply: null,
};

describe("BUILD §4.6 — the grid is Mon–Sun and weekends are ordinary dates", () => {
  it("the grid starts on a Monday column and ends on a Sunday one", () => {
    for (const month of ["2026-01", "2026-02", "2026-09", "2027-08"]) {
      const cells = monthGrid(month);
      expect(cells.length % 7, month).toBe(0);
      expect(weekdayIndex(cells[0]!.day), month).toBe(0);
      expect(weekdayIndex(cells[cells.length - 1]!.day), month).toBe(6);
    }
  });

  it("a weekend date carries a page like any other", () => {
    // 2026-09-05 is a Saturday and 2026-09-06 a Sunday.
    const model = assembleMonth(
      { ...BARE, drafts: [draft("2026-09-05", "published"), draft("2026-09-06", "planned")] },
      "2026-09"
    );
    expect(cellFor(model, "2026-09-05")?.page?.stage).toBe("live");
    expect(cellFor(model, "2026-09-06")?.page?.stage).toBe("planned");
    expect(weekdayIndex("2026-09-05")).toBe(5);
    expect(weekdayIndex("2026-09-06")).toBe(6);
  });

  it("an out-of-month cell holds a column position and nothing else — it is not padding", () => {
    const model = assembleMonth(BARE, "2026-09");
    const outside = model.cells.filter((c) => !c.inMonth);
    expect(outside.length).toBeGreaterThan(0);
    for (const cell of outside) {
      expect(cell.page).toBeNull();
      expect(cell.empty).toBeNull();
    }
  });
});

describe("REQ-043 c1 — one page per date, and no page invented to fill one", () => {
  it("every in-month cell carries exactly one of a page or an account", () => {
    const model = assembleMonth(FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH);
    for (const cell of model.cells.filter((c) => c.inMonth)) {
      expect([cell.page === null, cell.empty === null].filter((x) => !x), cell.day).toHaveLength(1);
    }
  });

  it("two drafts on one date is a data defect, surfaced and not rendered", () => {
    expect(() =>
      assembleMonth(
        { ...BARE, drafts: [draft("2026-09-10", "planned"), draft("2026-09-10", "approved")] },
        "2026-09"
      )
    ).toThrow(TwoPagesOnOneDateError);
  });

  it("assembleMonth creates nothing: the same drafts in, the same pages out", () => {
    const drafts = [draft("2026-09-02", "planned")];
    const model = assembleMonth({ ...BARE, drafts, unusedSupply: 0 }, "2026-09");
    const pages = model.cells.filter((c) => c.page !== null);
    expect(pages).toHaveLength(1);
    expect(drafts).toHaveLength(1);
    // Every other in-month date is empty with an account — never a page
    // the read produced to fill it (§4.6: "the calendar is never padded").
    expect(model.cells.filter((c) => c.inMonth && c.empty !== null).length).toBe(29);
  });

  it("a draft outside the assembled month is not drawn into it", () => {
    const model = assembleMonth({ ...BARE, drafts: [draft("2026-10-01", "planned")] }, "2026-09");
    expect(model.cells.filter((c) => c.page !== null)).toHaveLength(0);
  });
});

describe("REQ-043 c2 — a state that occupies no date empties it instead", () => {
  it("a skipped or unpublished draft leaves its date to the resolver", () => {
    for (const state of ["skipped", "unpublished"] as const) {
      expect(STAGE_OF[state]).toBeNull();
      const model = assembleMonth({ ...BARE, drafts: [draft("2026-09-08", state)] }, "2026-09");
      const cell = cellFor(model, "2026-09-08");
      expect(cell?.page).toBeNull();
      expect(cell?.empty).toEqual({ cause: "page_cannot_go_live", state });
    }
  });

  it("every cell carrying a page carries a stage", () => {
    const model = assembleMonth(FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH);
    for (const cell of model.cells) {
      if (cell.page !== null) expect(cell.page.stage, cell.day).toBeTruthy();
    }
  });
});

describe("REQ-043 c6 — the counts come from the same result as the grid", () => {
  it("All is the number of pages drawn, and each stage's count is its own", () => {
    const model = assembleMonth(FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH);
    const drawn = model.cells.filter((c) => c.page !== null);
    expect(model.counts.all).toBe(drawn.length);
    for (const stage of ["live", "your_review", "scheduled", "planned", "needs_you"] as const) {
      expect(model.counts[stage], stage).toBe(drawn.filter((c) => c.page?.stage === stage).length);
    }
    // And they add up: no page is counted twice and none is missed.
    const sum =
      model.counts.live +
      model.counts.your_review +
      model.counts.scheduled +
      model.counts.planned +
      model.counts.needs_you;
    expect(sum).toBe(model.counts.all);
  });
});

describe("REQ-043 c7 — today is the site-local day, not the server's", () => {
  it("a site in UTC+13 opening at 01:00 local sees its own today", () => {
    // 2026-09-15T12:00Z is 2026-09-16 01:00 in Pacific/Auckland (UTC+12
    // in September) — the case REQ-043's own rests-on row names. Auckland
    // is UTC+12 in September, so the boundary case is stated with the zone
    // the product would really carry.
    const at = new Date(Date.UTC(2026, 8, 15, 12, 0, 0));
    const nz = assembleMonth({ ...BARE, timeZone: "Pacific/Auckland", now: at }, "2026-09");
    const ny = assembleMonth({ ...BARE, timeZone: "America/New_York", now: at }, "2026-09");
    expect(nz.today).toBe("2026-09-16");
    expect(ny.today).toBe("2026-09-15");
    expect(nz.cells.find((c) => c.today)?.day).toBe("2026-09-16");
  });

  it("exactly one in-month cell is today, when today is in the month", () => {
    const model = assembleMonth(FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH);
    expect(model.cells.filter((c) => c.inMonth && c.today)).toHaveLength(1);
  });

  it("no cell is today in a month today is not in", () => {
    const model = assembleMonth(FIXTURE_CALENDAR_FACTS, "2026-11");
    expect(model.cells.filter((c) => c.today)).toHaveLength(0);
  });
});

describe("the fixture states every arm the screen can draw", () => {
  it("carries all five stages and four of the six empty causes", () => {
    const model = assembleMonth(FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH);
    const stages = new Set(model.cells.map((c) => c.page?.stage).filter(Boolean));
    expect([...stages].sort()).toEqual(["live", "needs_you", "planned", "scheduled", "your_review"]);
    const causes = new Set(model.cells.map((c) => c.empty?.cause).filter(Boolean));
    expect([...causes].sort()).toEqual([
      "instruction",
      "page_cannot_go_live",
      "reachkit_stopped",
      "supply_exhausted",
    ]);
  });
});
