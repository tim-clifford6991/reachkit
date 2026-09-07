// tests/market/rivals/size.test.ts — BUILD §6.6
//
// One entry per rival, in input order, over every arm — including the arms
// where nothing could be measured. `rankedKeywords` is stubbed at the
// vendor seam and every date is injected, so nothing here reads a clock or
// a network.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CACHE_WINDOWS_D, PRICE_BOOK, RIVAL_SIZE_BANDS } from "../../../src/lib/config/constants.ts";
import type { CostContext } from "../../../src/lib/costs/index.ts";
import type { Measured } from "../../../src/lib/measure/measured.ts";
import type { RankedResult } from "../../../src/lib/vendors/dataforseo/types.ts";
import { bandRivalSize } from "../../../src/lib/market/rivals/band.ts";
import { swapOffer } from "../../../src/lib/market/rivals/offer.ts";
import { codeOf, importsOf } from "./source.ts";

const { rankedMock } = vi.hoisted(() => ({ rankedMock: vi.fn() }));
vi.mock("@/lib/vendors/dataforseo", () => ({ rankedKeywords: rankedMock }));

let sizeRivals: typeof import("../../../src/lib/market/rivals/size.ts").sizeRivals;
let dueForResizing: typeof import("../../../src/lib/market/rivals/size.ts").dueForResizing;
type RivalSize = import("../../../src/lib/market/rivals/size.ts").RivalSize;

const AT = new Date("2026-09-06T00:00:00.000Z");
const EARLIER = new Date("2026-08-01T00:00:00.000Z");
const MS_PER_DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  rankedMock.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  ({ sizeRivals, dueForResizing } = await import("../../../src/lib/market/rivals/size.ts"));
});

/** One `ranked_keywords` answer: `n` rows, and the vendor's own total.
 *
 *  `total` defaults to `null` — the vendor reported none — which is the
 *  case that falls back to the row count, so every assertion written
 *  before #117 still says what it said. A case about the total passes one.
 */
function rows(n: number, total: number | null = null): Measured<RankedResult> {
  const value: RankedResult = {
    rows: Array.from({ length: n }, (_, i) => ({
      keyword: `k${i}`,
      position: 1,
      searchVolume: 10,
      url: "https://rival.com/",
    })),
    total,
  };
  return n === 0 ? { kind: "zero", value, at: AT } : { kind: "measured", value, at: AT };
}

function failed(): Measured<RankedResult> {
  return { kind: "unmeasured", reason: "undeterminable", at: AT };
}

function fakeCostContext(a: { capHit?: boolean } = {}): CostContext {
  return {
    cap: "DEEP",
    async recordFetch() {
      throw new Error("sizeRivals must reach the vendor through rankedKeywords(), never recordFetch directly");
    },
    capHit: () => a.capHit ?? false,
    spentCents: () => 0,
    degraded: () => false,
  };
}

describe('REQ-096 c1 — "each tracked rival carries a measured size … held beside the customer\'s own measured count from the same pass"', () => {
  it("size/one-at-per-call — every sized entry carries the identical date, and one customer count bands them all", async () => {
    rankedMock.mockResolvedValueOnce(rows(3)).mockResolvedValueOnce(rows(7));
    const out = await sizeRivals(fakeCostContext(), {
      rivals: ["a.com", "b.com"],
      ownRanked: 40,
      at: AT,
    });

    expect(out.kind).toBe("measured");
    const entries = out.kind === "unmeasured" ? [] : out.value;
    for (const entry of entries) {
      expect(entry.state).toBe("sized");
      if (entry.state === "sized") expect(entry.at).toBe(AT);
    }
  });

  it("size/rows-is-the-pin — every call asks for the rival row count and no other endpoint is reached", async () => {
    rankedMock.mockResolvedValue(rows(2));
    await sizeRivals(fakeCostContext(), { rivals: ["a.com"], ownRanked: 0, at: AT });

    expect(rankedMock).toHaveBeenCalledWith(expect.anything(), {
      domain: "a.com",
      rows: PRICE_BOOK.RANKED_RIVAL_ROWS,
    });
    expect(codeOf("size.ts")).not.toContain("competitorsDomain");
    expect(codeOf("size.ts")).not.toContain("serpOrganic");
  });

  it("size/before-the-pass-there-is-no-band — a rival never measured is unsized, and the arm carries no band and no count", async () => {
    rankedMock.mockResolvedValue(failed());
    const out = await sizeRivals(fakeCostContext(), { rivals: ["a.com"], ownRanked: 0, at: AT });

    const entry = out.kind === "unmeasured" ? undefined : out.value[0];
    expect(entry?.state).toBe("unsized");
    expect(entry).not.toHaveProperty("band");
    expect(entry).not.toHaveProperty("rankedCount");
    if (entry?.state === "unsized") expect(entry.because).toBe("awaiting_deep_pass");
  });
});

describe('REQ-096 c2 — the storage limb: "the band travels with its counts"', () => {
  it("size/band-re-derives-from-the-stored-counts", async () => {
    rankedMock.mockResolvedValueOnce(rows(4)).mockResolvedValueOnce(rows(90));
    const ownRanked = 12;
    const out = await sizeRivals(fakeCostContext(), {
      rivals: ["a.com", "b.com"],
      ownRanked,
      at: AT,
    });

    const entries = out.kind === "unmeasured" ? [] : out.value;
    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      if (entry.state !== "sized") throw new Error("expected a sized entry");
      expect(bandRivalSize({ rivalRanked: entry.rankedCount, ownRanked })).toBe(entry.band);
    }
  });
});

describe('REQ-096 c3 — "last measured a month ago or longer … is measured again"', () => {
  it("dueForResizing/at-the-cache-window — the window is the pin, read and not restated", () => {
    const window = CACHE_WINDOWS_D.rival;
    expect(dueForResizing({ lastMeasuredAt: new Date(AT.getTime() - window * MS_PER_DAY), now: AT })).toBe(true);
    expect(dueForResizing({ lastMeasuredAt: new Date(AT.getTime() - (window - 1) * MS_PER_DAY), now: AT })).toBe(false);
    expect(dueForResizing({ now: AT })).toBe(true);
    expect(codeOf("size.ts")).not.toMatch(new RegExp(`[^\\w.]${window}[^\\w]`));
  });

  it("size/added-since-last-sizing-is-sized-next-pass — a rival added after the pass is sized at the next one, with that call's date", async () => {
    rankedMock.mockResolvedValue(failed());
    const first = await sizeRivals(fakeCostContext(), {
      rivals: ["new.com"],
      ownRanked: 5,
      at: EARLIER,
      previous: [],
    });
    const carried = first.kind === "unmeasured" ? [] : first.value;
    expect(carried[0]).toEqual({ domain: "new.com", state: "unsized", because: "added_since_last_sizing" });

    rankedMock.mockReset();
    rankedMock.mockResolvedValue(rows(6));
    const second = await sizeRivals(fakeCostContext(), {
      rivals: ["new.com"],
      ownRanked: 5,
      at: AT,
      previous: carried,
    });
    const entry = second.kind === "unmeasured" ? undefined : second.value[0];
    expect(entry?.state).toBe("sized");
    if (entry?.state === "sized") {
      expect(entry.at).toBe(AT);
      expect(entry.current).toBe(true);
    }
  });
});

describe('REQ-096 c4 — "the last measured band is shown with that earlier date and is never presented as a current measurement"', () => {
  const previous: RivalSize[] = [
    { domain: "stale.com", state: "sized", rankedCount: 40, band: "near", at: EARLIER, current: true },
  ];

  it("size/stale-carries-current-false — the failing rival keeps its earlier date; the others carry the new one", async () => {
    rankedMock.mockImplementation(async (_c: unknown, a: { domain: string }) =>
      a.domain === "stale.com" ? failed() : rows(9)
    );

    const out = await sizeRivals(fakeCostContext(), {
      rivals: ["stale.com", "fresh.com"],
      ownRanked: 30,
      at: AT,
      previous,
    });
    const entries = out.kind === "unmeasured" ? [] : out.value;

    expect(entries[0]).toEqual({ ...previous[0], current: false });
    expect(entries[1]).toMatchObject({ domain: "fresh.com", state: "sized", at: AT, current: true });
  });

  it("size/stale-never-becomes-unsized — a rival we have measured never reads as one we never have", async () => {
    rankedMock.mockResolvedValue(failed());
    const out = await sizeRivals(fakeCostContext(), {
      rivals: ["stale.com"],
      ownRanked: 30,
      at: AT,
      previous,
    });
    const entry = out.kind === "unmeasured" ? undefined : out.value[0];
    expect(entry?.state).toBe("sized");
  });

  it("size/cap-carries-forward-too — a ceiling reached mid-pass degrades, it does not drop or throw", async () => {
    rankedMock.mockResolvedValue(rows(5));
    const out = await sizeRivals(fakeCostContext({ capHit: true }), {
      rivals: ["stale.com", "never.com"],
      ownRanked: 30,
      at: AT,
      previous,
    });
    const entries = out.kind === "unmeasured" ? [] : out.value;

    expect(rankedMock).not.toHaveBeenCalled();
    expect(entries[0]).toEqual({ ...previous[0], current: false });
    expect(entries[1]).toEqual({ domain: "never.com", state: "unsized", because: "added_since_last_sizing" });
  });
});

describe('REQ-096 c5 and c7 — "no band ever removes a rival, hides it, drops it from a comparison, or stops it being measured"', () => {
  it("size/unsized-is-a-state-not-a-blank — both reasons come back as discriminated arms, never null or a hole", async () => {
    rankedMock.mockResolvedValue(failed());
    const noPass = await sizeRivals(fakeCostContext(), { rivals: ["a.com"], ownRanked: 0, at: AT });
    const afterPass = await sizeRivals(fakeCostContext(), {
      rivals: ["a.com"],
      ownRanked: 0,
      at: AT,
      previous: [],
    });

    const first = noPass.kind === "unmeasured" ? undefined : noPass.value[0];
    const second = afterPass.kind === "unmeasured" ? undefined : afterPass.value[0];
    expect(first).toEqual({ domain: "a.com", state: "unsized", because: "awaiting_deep_pass" });
    expect(second).toEqual({ domain: "a.com", state: "unsized", because: "added_since_last_sizing" });
  });

  it("size/one-entry-per-input-in-input-order — over lists of 0…20 rivals and arbitrary outcomes", async () => {
    for (let length = 0; length <= 20; length += 1) {
      const rivals = Array.from({ length }, (_, i) => `r${i}.com`);
      rankedMock.mockReset();
      rankedMock.mockImplementation(async (_c: unknown, a: { domain: string }) => {
        const index = rivals.indexOf(a.domain);
        return index % 3 === 0 ? failed() : rows(index * 7);
      });

      const out = await sizeRivals(fakeCostContext(), {
        rivals,
        ownRanked: index0(length),
        at: AT,
        previous: [],
      });
      const entries = out.kind === "unmeasured" ? [] : out.value;
      expect(entries).toHaveLength(length);
      expect(entries.map((e) => e.domain)).toEqual(rivals);
    }
  });

  it("size/exports-no-filter — nothing here narrows a rival list, and `far` controls no inclusion", () => {
    const code = codeOf("size.ts");
    expect(code).not.toMatch(/\.filter\(/);
    expect(code).not.toMatch(/\.slice\(/);
    expect(code).not.toMatch(/"far"/);
  });
});

describe("§6.4 — per-rival ranked_keywords never reaches the free path", () => {
  it("size/not-reachable-from-the-free-report — the free card's two modules import no sizing module, and sizing imports neither of them", () => {
    for (const free of ["derive.ts", "presence.ts"]) {
      const imported = importsOf(free);
      expect(imported.filter((i) => /\/(size|band|offer|suggest|settle)$/.test(i))).toEqual([]);
      expect(imported.filter((i) => i.includes("vendors") || i.includes("costs"))).toEqual([]);
    }
    expect(importsOf("size.ts").filter((i) => /derive|presence/.test(i))).toEqual([]);
  });
});

describe("cold start — a customer who ranks for nothing still sizes every rival", () => {
  it("size/zero-own-count-is-ordinary", async () => {
    rankedMock.mockResolvedValue(rows(80));
    const out = await sizeRivals(fakeCostContext(), {
      rivals: ["a.com", "b.com"],
      ownRanked: 0,
      at: AT,
    });
    const entries = out.kind === "unmeasured" ? [] : out.value;
    expect(entries).toHaveLength(2);
    for (const entry of entries) expect(entry.state).toBe("sized");
  });

  it("size/an-empty-set-is-zero-not-a-failure", async () => {
    const out = await sizeRivals(fakeCostContext(), { rivals: [], ownRanked: 0, at: AT });
    expect(out).toEqual({ kind: "zero", value: [], at: AT });
    expect(rankedMock).not.toHaveBeenCalled();
  });
});

/** A customer count that varies with the list length, so the property test
 *  is not run at one band boundary throughout. */
function index0(length: number): number {
  return length * 3;
}

// ── issue #117: the count is the vendor's total, so `far` is reachable ─────
//
// Before this, a rival's count was the number of rows the call returned and
// was therefore capped at `PRICE_BOOK.RANKED_RIVAL_ROWS` (100). `far` needs
// a count above `max(RIVAL_SIZE_BANDS.middleFloor, middleMultiple × C)` —
// 500 at the floor — so no live rival could ever be banded `far` and
// `swapOffer` could never fire in production. These are the assertions that
// fail if `rankedCount` goes back to reading `rows.length`.
describe("REQ-096 c2 · BUILD §7 — a rival's size is the vendor's own total, not the page of rows bought", () => {
  it("size/count-is-the-total — the rows bought do not bound the count", async () => {
    rankedMock.mockResolvedValueOnce(rows(PRICE_BOOK.RANKED_RIVAL_ROWS, 4231));
    const out = await sizeRivals(fakeCostContext(), { rivals: ["big.com"], ownRanked: 40, at: AT });

    const entry = (out.kind === "unmeasured" ? [] : out.value)[0] as Extract<RivalSize, { state: "sized" }>;
    expect(entry.rankedCount).toBe(4231);
    // The ceiling this issue is about: the count is not the rows, and it is
    // far above the most rows this product ever buys for a rival.
    expect(entry.rankedCount).toBeGreaterThan(PRICE_BOOK.RANKED_RIVAL_ROWS);
  });

  it("size/far-is-reachable — a rival above the middle bar bands `far` and the swap offer fires", async () => {
    rankedMock.mockResolvedValueOnce(rows(PRICE_BOOK.RANKED_RIVAL_ROWS, 4231));
    const out = await sizeRivals(fakeCostContext(), { rivals: ["big.com"], ownRanked: 40, at: AT });

    const entry = (out.kind === "unmeasured" ? [] : out.value)[0] as Extract<RivalSize, { state: "sized" }>;
    expect(entry.band).toBe("far");
    expect(swapOffer(entry)).toEqual({
      offered: true,
      rival: "big.com",
      destination: "settings.competitors",
    });
  });

  it("size/far-was-unreachable-from-rows — the same rival read as rows is not `far`", async () => {
    // The defect, stated as a test: at the row ceiling the count can never
    // pass the middle floor, so the band this rival deserves is out of
    // reach and the offer never fires.
    expect(PRICE_BOOK.RANKED_RIVAL_ROWS).toBeLessThan(RIVAL_SIZE_BANDS.middleFloor);
    const asRows = bandRivalSize({ rivalRanked: PRICE_BOOK.RANKED_RIVAL_ROWS, ownRanked: 40 });
    expect(asRows).not.toBe("far");
    expect(swapOffer({ domain: "big.com", state: "sized", rankedCount: 100, band: asRows, at: AT, current: true })).toEqual({
      offered: false,
    });
  });

  it("size/no-total-bands-nearer — the error direction is fewer opportunities, never more", async () => {
    // A vendor answer with no `total_count`: the count falls back to the
    // rows, which understates a large rival and bands it nearer. Fewer
    // `far` rivals and fewer swap offers — never a swap offered against a
    // rival we cannot show is out of reach.
    rankedMock.mockResolvedValueOnce(rows(PRICE_BOOK.RANKED_RIVAL_ROWS));
    const out = await sizeRivals(fakeCostContext(), { rivals: ["big.com"], ownRanked: 40, at: AT });

    const entry = (out.kind === "unmeasured" ? [] : out.value)[0] as Extract<RivalSize, { state: "sized" }>;
    expect(entry.rankedCount).toBe(PRICE_BOOK.RANKED_RIVAL_ROWS);
    expect(entry.band).not.toBe("far");
    expect(swapOffer(entry).offered).toBe(false);
  });

  it("size/total-of-zero-is-a-count — a domain that ranks for nothing is measured, not unknown", async () => {
    rankedMock.mockResolvedValueOnce(rows(0, 0));
    const out = await sizeRivals(fakeCostContext(), { rivals: ["nothing.com"], ownRanked: 40, at: AT });

    const entry = (out.kind === "unmeasured" ? [] : out.value)[0] as Extract<RivalSize, { state: "sized" }>;
    expect(entry.state).toBe("sized");
    expect(entry.rankedCount).toBe(0);
    expect(entry.band).toBe("near");
  });

  it("size/no-extra-rows-bought — the total costs nothing: one call, at the pinned row count", async () => {
    rankedMock.mockResolvedValueOnce(rows(PRICE_BOOK.RANKED_RIVAL_ROWS, 4231));
    await sizeRivals(fakeCostContext(), { rivals: ["big.com"], ownRanked: 40, at: AT });

    expect(rankedMock).toHaveBeenCalledTimes(1);
    expect(rankedMock.mock.calls[0]?.[1]).toEqual({
      domain: "big.com",
      rows: PRICE_BOOK.RANKED_RIVAL_ROWS,
    });
  });

  it("size/band-still-re-derives-from-the-stored-counts — now over the total", async () => {
    rankedMock.mockResolvedValueOnce(rows(PRICE_BOOK.RANKED_RIVAL_ROWS, 4231));
    const out = await sizeRivals(fakeCostContext(), { rivals: ["big.com"], ownRanked: 40, at: AT });

    const entry = (out.kind === "unmeasured" ? [] : out.value)[0] as Extract<RivalSize, { state: "sized" }>;
    expect(entry.band).toBe(bandRivalSize({ rivalRanked: entry.rankedCount, ownRanked: 40 }));
  });
});
