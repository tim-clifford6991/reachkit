// SPEC §4 (2026-09-20, #908), #917 — what the Rivals tab states, decided
// without a browser.
//
// The model is pure over its facts, so the rules worth holding are held
// here rather than read off a render: the screen's one order, the chips'
// counts, both counting cards' denominators, and REQ-004 — a reading nobody
// took never becomes a zero, and a card the pass never reached draws no
// bars at all.
import { describe, expect, it } from "vitest";
import { measured, unmeasured } from "@/lib/measure/measured";
import {
  ALL_RIVALS,
  assembleRivals,
  rowsFor,
  type RivalPoolFacts,
  type RivalSearchStatus,
  type RivalsFacts,
} from "@/app/(account)/app/_overview/rivals-model";

const AT = new Date("2026-08-31T06:00:00.000Z");
const BIG = "big.example";
const SMALL = "small.example";
const OWN = "you.example";

function row(
  search: string,
  rival: string,
  status: RivalSearchStatus,
  volume = 100,
): RivalPoolFacts {
  return {
    search,
    volume: measured(volume, AT),
    rival,
    position: unmeasured<number>("not_attempted", AT),
    status,
  };
}

function facts(over: Partial<RivalsFacts> = {}): RivalsFacts {
  return {
    rivals: [BIG, SMALL],
    ownDomain: OWN,
    firstPage: new Map([
      [BIG, 9],
      [SMALL, 7],
      [OWN, 2],
    ]),
    firstPageOf: 12,
    named: new Map([
      [BIG, 14],
      [SMALL, 9],
      [OWN, 3],
    ]),
    namedOf: 36,
    firstPageAtStart: 1,
    firstPageHolders: [],
    pool: [],
    measuredAt: AT,
    ...over,
  };
}

describe("the two counting cards", () => {
  it("draws the rivals in the customer's own order, then the customer", () => {
    const model = assembleRivals(facts());
    expect(model.firstPage.rivals.map((r) => r.domain)).toEqual([BIG, SMALL]);
    expect(model.firstPage.you.domain).toBe(OWN);
    expect(model.firstPage.you.count).toBe(2);
  });

  it("counts each card over what was measured, not over what was asked for", () => {
    // Nine of the twelve could be read; the bars are drawn against nine.
    const model = assembleRivals(facts({ firstPageOf: 9, namedOf: 27 }));
    expect(model.firstPage.of).toBe(9);
    expect(model.named.of).toBe(27);
  });

  it("gives a domain the pass never saw a counted zero, not a gap", () => {
    // `of` already says what could be read, so a domain missing from the
    // map appeared on none of those — which is a measurement.
    const model = assembleRivals(facts({ firstPage: new Map([[BIG, 4]]) }));
    expect(model.firstPage.you.count).toBe(0);
    expect(model.firstPage.rivals.find((r) => r.domain === SMALL)?.count).toBe(
      0,
    );
  });

  it("a card the pass never reached has no denominator, and the screen draws no bars", () => {
    const model = assembleRivals(
      facts({ firstPageOf: 0, firstPage: new Map() }),
    );
    expect(model.firstPage.of).toBe(0);
  });
});

// SPEC §4 (2026-10-09, issue 1365).
describe("a rival counted nowhere", () => {
  it("a measured card on which no rival was counted says so, and names who holds those first pages", () => {
    const model = assembleRivals(
      facts({ firstPage: new Map([[OWN, 1]]), firstPageHolders: ["holder.example", "other.example"] }),
    );
    expect(model.firstPage.noRival).toBe(true);
    expect(model.firstPageHolders).toEqual(["holder.example", "other.example"]);
    // The other card counted them, so it draws its bars and nobody is unseen.
    expect(model.named.noRival).toBe(false);
    expect(model.unseen).toEqual([]);
  });

  it("names the holders only where no rival is on a first page", () => {
    expect(assembleRivals(facts({ firstPageHolders: ["holder.example"] })).firstPageHolders).toEqual([]);
  });

  it("names the rival neither card counted, beside one that was", () => {
    const model = assembleRivals(facts({ firstPage: new Map([[BIG, 4]]), named: new Map([[BIG, 2]]) }));
    expect(model.firstPage.noRival).toBe(false);
    expect(model.unseen).toEqual([SMALL]);
  });

  it("leaves that line out where both cards already say it of every rival", () => {
    const model = assembleRivals(facts({ firstPage: new Map(), named: new Map() }));
    expect(model.firstPage.noRival && model.named.noRival).toBe(true);
    expect(model.unseen).toEqual([]);
  });

  it("a card that was not measured says nothing of a rival", () => {
    const model = assembleRivals(facts({ firstPageOf: 0, firstPage: new Map(), named: new Map([[BIG, 2]]) }));
    expect(model.firstPage.noRival).toBe(false);
    expect(model.unseen).toEqual([SMALL]);
  });
});

describe("the searches rivals win", () => {
  it("orders by what the plan reaches first, then by the bigger search", () => {
    const model = assembleRivals(
      facts({
        pool: [
          row("small and outsized", BIG, "too_big", 9000),
          row("needs a page, big", SMALL, "needs_page", 800),
          row("next, small", BIG, "up_next", 100),
          row("needs a page, small", SMALL, "needs_page", 200),
          row("waiting for you", BIG, "in_review", 50),
          row("next, big", SMALL, "up_next", 700),
        ],
      }),
    );
    expect(model.rows.map((r) => r.search)).toEqual([
      // A page already written comes first, whatever its volume.
      "waiting for you",
      "next, big",
      "next, small",
      "needs a page, big",
      "needs a page, small",
      "small and outsized",
    ]);
  });

  it("counts every chip over the whole set, once", () => {
    const model = assembleRivals(
      facts({
        pool: [
          row("a", BIG, "up_next"),
          row("b", BIG, "too_big"),
          row("c", SMALL, "up_next"),
        ],
      }),
    );
    expect(model.counts[ALL_RIVALS]).toBe(3);
    expect(model.counts[BIG]).toBe(2);
    expect(model.counts[SMALL]).toBe(1);
    // The chip and the table cannot disagree: both are this one rule.
    expect(rowsFor(model.rows, BIG)).toHaveLength(model.counts[BIG] as number);
    expect(rowsFor(model.rows, ALL_RIVALS)).toHaveLength(
      model.counts[ALL_RIVALS] as number,
    );
  });

  it("keeps a search whose volume was never measured, and never floors it to zero", () => {
    const unmeasuredVolume: RivalPoolFacts = {
      ...row("no volume", BIG, "up_next"),
      volume: unmeasured<number>("undeterminable", AT),
    };
    const model = assembleRivals(facts({ pool: [unmeasuredVolume] }));
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]?.volume.kind).toBe("unmeasured");
  });

  it("states no position where the pass bought no top ten for the search", () => {
    // The pool is the rivals' whole ranked footprint and carries no place.
    const model = assembleRivals(facts({ pool: [row("a", BIG, "up_next")] }));
    expect(model.rows[0]?.position.kind).toBe("unmeasured");
  });
});

describe("where the customer started", () => {
  it("carries the earlier reading where the window has one", () => {
    expect(assembleRivals(facts()).firstPageAtStart).toBe(1);
  });

  it("carries none where there is no earlier week to have started from", () => {
    expect(
      assembleRivals(facts({ firstPageAtStart: null })).firstPageAtStart,
    ).toBeNull();
  });
});
