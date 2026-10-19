// SPEC §4 (2026-09-20, #908), #916 — what the Search tab states, decided
// without a browser.
//
// The model is pure over its facts, so the four rules worth holding are
// held here rather than read off a render: the screen's one order, the
// chips' counts, the two position tiles' arithmetic, and REQ-004 — a
// reading nobody took never becomes a zero.
import { describe, expect, it } from "vitest";
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
import {
  assembleSearch,
  rowsFor,
  type SearchFacts,
  type SearchStatus,
  type SearchTargetFacts,
} from "@/app/(account)/app/_overview/search-model";
import { PLAN_DEPTH } from "@/lib/config/constants";

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
    livePages: measured(0, AT),
    liveSearches: [],
    ready: measured(0, AT),
    ownRanked: measured(81, AT),
    previousPositions: null,
    ceiling: 49,
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

describe("the four tiles carry a denominator or a goal, never a bare number", () => {
  it("counts the live pages inside the first two pages and inside the first page", () => {
    const model = assembleSearch(
      facts({
        targets: [
          target("a", "top-ten", "live"),
          target("b", "top-twenty", "live"),
          target("c", "page-five", "live"),
        ],
        liveSearches: ["top-ten", "top-twenty", "page-five"],
        livePages: measured(3, AT),
        positions: new Map([
          ["top-ten", measured(4, AT)],
          ["top-twenty", measured(17, AT)],
          ["page-five", measured(48, AT)],
        ]),
      }),
      AT
    );
    expect(model.tiles.firstPage.value).toMatchObject({ value: 1 });
    expect(model.tiles.firstTwoPages.value).toMatchObject({ value: 2 });
    expect(model.tiles.firstPage.of).toMatchObject({ value: 3 });
  });

  it("a live page whose search this pass never reached is not counted as fallen off", () => {
    const model = assembleSearch(
      facts({
        targets: [target("a", "unmeasured-this-week", "live")],
        liveSearches: ["unmeasured-this-week"],
        livePages: measured(1, AT),
        positions: new Map(),
      }),
      AT
    );
    // Zero *counted*, not zero *claimed*: the arm is `zero`, which is a
    // measurement, and the denominator still says one live page.
    expect(model.tiles.firstTwoPages.value.kind).toBe("zero");
  });

  it("a live-page count that could not be taken leaves the top-20 tile unmeasured, never at zero", () => {
    const model = assembleSearch(
      facts({ livePages: unmeasured<number>("undeterminable", AT) }),
      AT
    );
    expect(model.tiles.firstTwoPages.value.kind).toBe("unmeasured");
  });

  it("with no scan the first-page count is unmeasured, never a zero (issue 1457)", () => {
    const model = assembleSearch(facts({ targets: [target("a", "x", "up_next")], measuredAt: null }), AT);
    expect(model.tiles.firstPage.value.kind).toBe("unmeasured");
  });

  it("the queue is read against the depth §7 keeps ready, and the footprint against its goal", () => {
    const model = assembleSearch(facts({ ready: measuredZero(0, AT) }), AT);
    expect(model.tiles.goingAfter.of).toMatchObject({ value: PLAN_DEPTH });
    expect(model.tiles.goingAfter.value.kind).toBe("zero");
    expect(model.tiles.appearFor.of.kind).not.toBe("unmeasured");
  });
});

describe("two tiles state this site's own reading (#1039)", () => {
  it("the queue lasts whole weeks at one page a day, never rounded up", () => {
    const at = (n: number) => assembleSearch(facts({ ready: measured(n, AT) }), AT).tiles.goingAfter.reading;
    expect(at(35)).toEqual({ kind: "queue", weeks: 5, days: 35 });
    expect(at(13)).toEqual({ kind: "queue", weeks: 1, days: 13 });
  });

  it("the first page names the best-placed search and how many more stand beside it", () => {
    const model = assembleSearch(
      facts({
        targets: [
          target("a", "brake pads when to replace", "live"),
          target("b", "rotor noise", "up_next"),
          target("c", "page-five", "live"),
        ],
        positions: new Map([
          ["rotor noise", measured(9, AT)],
          ["brake pads when to replace", measured(4, AT)],
          ["page-five", measured(48, AT)],
        ]),
      }),
      AT
    );
    expect(model.tiles.firstPage.reading).toEqual({
      kind: "first-page",
      search: "brake pads when to replace",
      position: 4,
      others: 1,
    });
  });

  it("with none on the first page it names the closest, and with no place at all it says so", () => {
    const closest = assembleSearch(
      facts({
        targets: [target("a", "near", "live"), target("b", "far", "up_next")],
        positions: new Map([
          ["far", measured(60, AT)],
          ["near", measured(11, AT)],
        ]),
      }),
      AT
    );
    expect(closest.tiles.firstPage.reading).toEqual({ kind: "closest", search: "near", position: 11 });
    const nowhere = assembleSearch(facts({ targets: [target("a", "x", "live")] }), AT);
    expect(nowhere.tiles.firstPage.reading).toEqual({ kind: "no-place" });
  });

  it("an unmeasured count carries no reading, so the dash says why rather than a guess", () => {
    const model = assembleSearch(
      facts({ ready: unmeasured<number>("not_attempted", AT), livePages: unmeasured<number>("undeterminable", AT) }),
      AT
    );
    expect(model.tiles.goingAfter.reading).toBeUndefined();
  });
});

describe("issue 1457 — the first-page tile counts exactly the rows its chip shows", () => {
  const rows = facts({
    targets: [
      target("a", "one", "live"),
      target("b", "two", "up_next"),
      target("c", "three", "too_big"),
      target("d", "four", "your_review"),
    ],
    positions: new Map([
      ["one", measured(3, AT)],
      ["two", measured(10, AT)],
      ["three", measured(11, AT)],
    ]),
    previousPositions: new Map([
      ["one", measured(12, AT)],
      ["three", measured(7, AT)],
      ["four", measured(9, AT)],
    ]),
  });

  it("the tile's count is the chip's count and the chip's rows, out of every search tracked", () => {
    const model = assembleSearch(rows, AT);
    const shown = rowsFor(model.rows, "first_page");
    expect(shown.map((row) => row.target.search).sort()).toEqual(["one", "two"]);
    expect(model.tiles.firstPage.value).toMatchObject({ value: shown.length });
    expect(model.counts.first_page).toBe(shown.length);
    expect(model.tiles.firstPage.of).toMatchObject({ value: model.rows.length });
  });

  it("the change is over the same searches on the scan before, and absent with no scan before", () => {
    expect(assembleSearch(rows, AT).tiles.firstPage.change).toBe(0);
    expect(assembleSearch({ ...rows, previousPositions: new Map() }, AT).tiles.firstPage.change).toBe(2);
    expect(assembleSearch({ ...rows, previousPositions: null }, AT).tiles.firstPage.change).toBeUndefined();
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
