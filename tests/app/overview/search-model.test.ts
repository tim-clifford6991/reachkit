// SPEC §4 (2026-09-20, #908), #916 — what the Search tab states, decided
// without a browser.
//
// The model is pure over its facts, so the four rules worth holding are
// held here rather than read off a render: the screen's one order, the
// chips' counts, the market's count, and REQ-004 — a
// reading nobody took never becomes a zero.
import { describe, expect, it } from "vitest";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import {
  assembleSearch,
  rowsFor,
  type SearchFacts,
  type SearchStatus,
  type SearchTargetFacts,
} from "@/app/(account)/app/_overview/search-model";

const AT = new Date("2026-08-31T06:00:00.000Z");

function target(
  id: string,
  search: string,
  status: SearchStatus,
  over: { difficulty?: number | null; volume?: number } = {}
): SearchTargetFacts {
  return {
    id,
    target: {
      search,
      volume: measured(over.volume ?? 100, AT),
      difficulty:
        over.difficulty === null
          ? unmeasured<number>("undeterminable", AT)
          : measured(over.difficulty ?? 20, AT),
      ceiling: 49,
      winnability: "winnable",
    },
    status,
    rival: { domain: "rival.example", position: measured(3, AT) },
    change: { kind: "none" },
  };
}

function facts(over: Partial<SearchFacts> = {}): SearchFacts {
  return {
    targets: [],
    positions: new Map<string, Measured<number>>(),
    market: null,
    measuredAt: AT,
    ...over,
  };
}

describe("the one order — closest to the first page", () => {
  it("a search the site already holds a place for sorts by that place", () => {
    const model = assembleSearch(
      facts({
        targets: [target("a", "deep", "live"), target("b", "shallow", "live")],
        positions: new Map([
          ["deep", measured(44, AT)],
          ["shallow", measured(8, AT)],
        ]),
      }),
      AT
    );
    expect(model.rows.map((row) => row.target.search)).toEqual(["shallow", "deep"]);
  });

  it("every search with no place sorts after every search that has one", () => {
    const model = assembleSearch(
      facts({
        targets: [target("a", "unplaced", "up_next"), target("b", "placed", "live")],
        positions: new Map([["placed", measured(97, AT)]]),
      }),
      AT
    );
    expect(model.rows.map((row) => row.target.search)).toEqual(["placed", "unplaced"]);
  });

  it("among searches with no place, a page already written comes before one that is not, and an easier search before a harder one", () => {
    const model = assembleSearch(
      facts({
        targets: [
          target("a", "hard", "up_next", { difficulty: 40 }),
          target("b", "outsized", "too_big", { difficulty: 5 }),
          target("c", "easy", "up_next", { difficulty: 5 }),
          target("d", "waiting", "your_review", { difficulty: 90 }),
        ],
      }),
      AT
    );
    expect(model.rows.map((row) => row.target.search)).toEqual(["waiting", "easy", "hard", "outsized"]);
  });

  it("is stable: two searches alike in every key still come back in one order", () => {
    const twice = [0, 1].map(
      () =>
        assembleSearch(
          facts({ targets: [target("b", "second", "up_next"), target("a", "first", "up_next")] }),
          AT
        ).rows
    );
    expect(twice[0]?.map((row) => row.id)).toEqual(twice[1]?.map((row) => row.id));
  });
});

describe("the chips count the rows they stand for", () => {
  const model = assembleSearch(
    facts({
      targets: [
        target("a", "one", "live"),
        target("b", "two", "live"),
        target("c", "three", "your_review"),
        target("d", "four", "up_next"),
        target("e", "five", "too_big"),
      ],
    }),
    AT
  );

  it("counts every status, and `all` counts the whole table", () => {
    expect(model.counts).toMatchObject({ all: 5, live: 2, your_review: 1, up_next: 1, too_big: 1 });
  });

  it("and the rows one chip stands for are exactly the ones it counted", () => {
    for (const filter of ["live", "your_review", "up_next", "too_big"] as const) {
      expect(rowsFor(model.rows, filter)).toHaveLength(model.counts[filter]);
    }
    expect(rowsFor(model.rows, "all")).toHaveLength(5);
  });
});

describe("your market is the report's own count, apart from the pages", () => {
  it("reads the presence card's twelve, and with no card it is not measured rather than 0", () => {
    const rows = facts({ targets: [target("a", "x", "live")], market: { top10: 1, measured: 12 } });
    expect(assembleSearch(rows, AT).market).toEqual({ top10: 1, of: 12 });
    expect(assembleSearch({ ...rows, market: null }, AT).market).toBeNull();
  });
});

describe("REQ-004 — a reading nobody took is not a place the site holds", () => {
  it("a search absent from the report's own ranked rows is unmeasured, never 0", () => {
    const model = assembleSearch(facts({ targets: [target("a", "nowhere", "up_next")] }), AT);
    expect(model.rows[0]?.position.kind).toBe("unmeasured");
  });

  it("and a difficulty the vendor never gave stays unmeasured on the row", () => {
    const model = assembleSearch(
      facts({ targets: [target("a", "no-difficulty", "up_next", { difficulty: null })] }),
      AT
    );
    expect(model.rows[0]?.target.difficulty.kind).toBe("unmeasured");
  });
});
