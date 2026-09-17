// BUILD §7 — banding, and which counts may satisfy a bar.
import "../env";
import { describe, expect, it } from "vitest";
import { PRICE_BOOK } from "../../../src/lib/config/constants";
import { measured, measuredZero, unmeasured } from "../../../src/lib/measure/measured";
import { assess, bandWinnability, qualifies, rightSizedBand } from "../../../src/lib/opportunities/winnability/band";
import {
  rankedCountFrom,
  rankedCountsFor,
  rankedCountsFromSizes,
} from "../../../src/lib/opportunities/winnability/counts";
import { bandRivalSize } from "../../../src/lib/market/rivals/band";
import type { RivalSize } from "../../../src/lib/market/rivals/size";
import { BAND_LABELS } from "../../../src/lib/presentation/bands";

const AT = new Date("2026-09-05T10:00:00.000Z");

describe('§7, quoted: "Bands (Winnable/Reach/Not-yet)"', () => {
  it("the smallest readable count decides which of the three", () => {
    // ownRanked 0: winnable bar 100, qualifying bar 500.
    const band = (rows: number[]) =>
      bandWinnability({ top10RankedCounts: rows.map((n) => measured(n, AT)), ownRanked: 0 });
    expect(band([90, 4000])).toBe("winnable");
    expect(band([100, 4000])).toBe("winnable"); // the bar is inclusive
    expect(band([101, 4000])).toBe("reach");
    expect(band([500, 4000])).toBe("reach");
    expect(band([501, 4000])).toBe("not-yet");
  });

  it("a domain that ranks for nothing is the smallest count there is", () => {
    expect(
      bandWinnability({ top10RankedCounts: [measuredZero(0, AT)], ownRanked: 0 })
    ).toBe("winnable");
  });

  it("the three handles are exactly the three the band-label registry words", () => {
    // ADR-001: the words are `BAND_LABELS`'; this engine emits handles.
    // The two sets agreeing is what makes a rendered band possible at all.
    const handles = new Set(["winnable", "reach", "not-yet"]);
    expect(new Set(Object.keys(BAND_LABELS.winnability))).toEqual(handles);
  });
});

describe("an unmeasured ranked count is never read as a small one", () => {
  it("a top ten we could not size does not qualify", () => {
    const counts = [unmeasured<number>("undeterminable", AT), unmeasured<number>("not_attempted", AT)];
    expect(qualifies({ top10RankedCounts: counts, ownRanked: 0 })).toBe(false);
    expect(bandWinnability({ top10RankedCounts: counts, ownRanked: 0 })).toBe("not-yet");
  });

  it("an unreadable count beside a readable one does not mask it", () => {
    const counts = [unmeasured<number>("undeterminable", AT), measured(40, AT)];
    expect(qualifies({ top10RankedCounts: counts, ownRanked: 0 })).toBe(true);
    expect(bandWinnability({ top10RankedCounts: counts, ownRanked: 0 })).toBe("winnable");
  });

  it("an empty top ten qualifies nothing — there is no vacuous pass", () => {
    expect(qualifies({ top10RankedCounts: [], ownRanked: 0 })).toBe(false);
  });
});

describe("a row count at the cap is a floor, not a count", () => {
  it("`ranked_keywords` returning the cap with no total is coerced to unmeasured", () => {
    const cap = PRICE_BOOK.RANKED_RIVAL_ROWS;
    expect(rankedCountFrom({ count: cap, countIs: "rows", at: AT }, AT)).toEqual(
      unmeasured<number>("undeterminable", AT)
    );
    expect(rankedCountFrom({ count: cap - 1, countIs: "rows", at: AT }, AT)).toEqual(
      measured(cap - 1, AT)
    );
  });

  it("a vendor total is a measurement at any size (#768)", () => {
    expect(rankedCountFrom({ count: 50_000, countIs: "total", at: AT }, AT)).toEqual(
      measured(50_000, AT)
    );
  });

  it("a domain we bought no rows for is undeterminable, never zero", () => {
    const count = rankedCountFrom(null, AT);
    expect(count.kind).toBe("unmeasured");
    // The distinction that matters: `zero` would satisfy every bar and
    // manufacture a target the customer cannot win.
    expect(count).not.toEqual(measuredZero(0, AT));
  });

  it("a row count at the cap therefore cannot satisfy a bar", () => {
    const atCap = rankedCountFrom({ count: PRICE_BOOK.RANKED_RIVAL_ROWS, countIs: "rows", at: AT }, AT);
    // 100 is under the 500 qualifying bar; read as a count it would pass.
    expect(qualifies({ top10RankedCounts: [atCap], ownRanked: 0 })).toBe(false);
  });
});

describe("rankedCountsFor keeps a missing domain visible", () => {
  it("a domain the lookup does not carry contributes an unmeasured count, not a dropped row", () => {
    const counts = rankedCountsFor(["a.com", "b.com"], new Map([["a.com", measured(7, AT)]]), AT);
    expect(counts).toHaveLength(2);
    expect(counts[1]?.kind).toBe("unmeasured");
  });
});

describe("assess tells the two rejections apart", () => {
  it("a market we could not read is `unmeasured_top10`, not `not_yet`", () => {
    expect(
      assess({ top10RankedCounts: [unmeasured<number>("undeterminable", AT)], ownRanked: 0, volume: 20 })
    ).toEqual({ qualified: false, because: "unmeasured_top10" });
  });

  it("a market of large rivals is `not_yet`", () => {
    expect(assess({ top10RankedCounts: [measured(9000, AT)], ownRanked: 0, volume: 20 })).toEqual({
      qualified: false,
      because: "not_yet",
    });
  });

  it("a search outsized for the site is refused before its top ten is read", () => {
    expect(assess({ top10RankedCounts: [measured(40, AT)], ownRanked: 3, volume: 50_000 })).toEqual({
      qualified: false,
      because: "outsized",
    });
  });

  it("the band is the lower of competition and demand — a small top ten does not make a mid-size search winnable", () => {
    expect(assess({ top10RankedCounts: [measured(40, AT)], ownRanked: 0, volume: 250 })).toEqual({
      qualified: true,
      band: "reach",
    });
  });

  it("a qualified target carries the band it qualified into", () => {
    expect(assess({ top10RankedCounts: [measured(40, AT)], ownRanked: 0, volume: 20 })).toEqual({
      qualified: true,
      band: "winnable",
    });
  });
});

describe("#37's rival sizing is where the counts come from, and it is not re-done here", () => {
  const sizes: RivalSize[] = [
    {
      domain: "appcues.com",
      state: "sized",
      rankedCount: 40,
      band: bandRivalSize({ rivalRanked: 40, ownRanked: 0 }),
      at: AT,
      current: true,
    },
    { domain: "userpilot.com", state: "unsized", because: "awaiting_deep_pass" },
  ];

  it("a sized rival contributes its count with the date it was measured on", () => {
    const counts = rankedCountsFromSizes(sizes, new Date("2026-09-06T00:00:00.000Z"));
    expect(counts.get("appcues.com")).toEqual(measured(40, AT));
  });

  it("an unsized rival contributes undeterminable, never a zero", () => {
    const later = new Date("2026-09-06T00:00:00.000Z");
    const counts = rankedCountsFromSizes(sizes, later);
    expect(counts.get("userpilot.com")).toEqual(unmeasured<number>("undeterminable", later));
    expect(counts.get("userpilot.com")).not.toEqual(measuredZero(0, later));
  });

  it("a rival sized from capped rows with no total is not a count — a target is not made winnable by it", () => {
    const atCap: RivalSize[] = [
      {
        domain: "big.com",
        state: "sized",
        rankedCount: PRICE_BOOK.RANKED_RIVAL_ROWS,
        countIs: "rows",
        band: bandRivalSize({ rivalRanked: PRICE_BOOK.RANKED_RIVAL_ROWS, ownRanked: 0 }),
        at: AT,
        current: true,
      },
    ];
    const counts = rankedCountsFromSizes(atCap, AT);
    expect(counts.get("big.com")!.kind).toBe("unmeasured");
    expect(qualifies({ top10RankedCounts: [counts.get("big.com")!], ownRanked: 0 })).toBe(false);
  });

  it("a top ten holding a rival with a large vendor total is judged, not `unmeasured_top10` (#768)", () => {
    const big: RivalSize[] = [
      {
        domain: "semrush.com",
        state: "sized",
        rankedCount: 50_000,
        countIs: "total",
        band: bandRivalSize({ rivalRanked: 50_000, ownRanked: 0 }),
        at: AT,
        current: true,
      },
    ];
    const counts = rankedCountsFor(["semrush.com"], rankedCountsFromSizes(big, AT), AT);
    expect(assess({ top10RankedCounts: counts, ownRanked: 0, volume: 20 })).toEqual({
      qualified: false,
      because: "not_yet",
    });
  });

  it("a rival's size band is never read as a target's winnability band", () => {
    // Two band sets, two meanings, six distinct words (ADR-001). The
    // projection carries counts and drops the rival band entirely.
    const counts = rankedCountsFromSizes(sizes, AT);
    for (const count of counts.values()) {
      expect(Object.keys(count)).not.toContain("band");
    }
    expect(bandWinnability({ top10RankedCounts: [...counts.values()], ownRanked: 0 })).toBe(
      "winnable"
    );
  });
});

describe("difficulty bands the competition a long-tail top ten's counts cannot (issue 858)", () => {
  const unread = [unmeasured<number>("undeterminable", AT)];

  it("a search harder than the site's ceiling is outsized, whatever its volume or top ten", () => {
    expect(assess({ top10RankedCounts: [measured(40, AT)], ownRanked: 3, volume: 40, difficulty: 78 })).toEqual({
      qualified: false,
      because: "outsized",
    });
  });

  it("an easy search whose top ten nobody sized qualifies on its difficulty, not as an unmeasured top ten", () => {
    expect(assess({ top10RankedCounts: unread, ownRanked: 3, volume: 40, difficulty: 8 })).toEqual({
      qualified: true,
      band: "winnable",
    });
    expect(assess({ top10RankedCounts: unread, ownRanked: 3, volume: 40 })).toEqual({
      qualified: false,
      because: "unmeasured_top10",
    });
  });

  it("a top ten of giants over a search of middling difficulty is reach, not not-yet", () => {
    expect(assess({ top10RankedCounts: [measured(218_224, AT)], ownRanked: 3, volume: 40, difficulty: 30 })).toEqual({
      qualified: true,
      band: "reach",
    });
  });

  it("demand still caps the band", () => {
    expect(rightSizedBand({ top10RankedCounts: unread, ownRanked: 3, volume: 250, difficulty: 5 })).toBe("reach");
  });
});
