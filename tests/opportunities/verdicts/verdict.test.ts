// A page's label is a pure function of its own reading (owner, 2026-10-19,
// B1 · M-a). Each reading is folded week by week from stored weekly scans of
// a SaaS page and a local page on the customer panel, through the pass's own
// assembler, then read back from its stored JSON.
import { describe, expect, it } from "vitest";
import { assembleReading, readingOf, type PageReading } from "../../../src/lib/measure/page-reading";
import { readStoredReport } from "../../../src/lib/scan/report";
import { verdict, VERDICT_OF } from "../../../src/lib/opportunities/verdicts/verdict";
import { LOCAL, SAAS, stored, weekWith } from "../../measure/reading-fixture";

const DAY = 86_400_000;
const START = Date.UTC(2026, 7, 3, 6, 0, 0);
const week = (n: number) => new Date(START + n * 7 * DAY);

type Panel = typeof SAAS;

/** The reading after each stored week, where `places[n]` is week n's own
 *  place (`null` absent from its result) and `linked` the weeks its AI
 *  Overview linked it. */
function readingOver(panel: Panel, places: readonly (number | null)[], linked: readonly number[] = []): PageReading {
  let reading: PageReading | null = null;
  places.forEach((place, n) => {
    const report = readStoredReport(
      stored(weekWith({ domain: panel.domain, asked: [{ publicationId: "pub", liveUrl: panel.page, search: panel.search, place, linked: linked.includes(n) }] }))
    );
    const page = { id: "pub", liveUrl: panel.page, search: panel.search, crawled: false, aiReads: 0, aiVisits: 0, google: null, bing: null };
    reading = readingOf(stored(assembleReading({ before: reading, report, page, now: week(n) }) as never));
  });
  if (reading === null) throw new Error("no week folded");
  return reading;
}

const flat = (place: number | null, weeks: number) => Array<number | null>(weeks + 1).fill(place);

describe("condition 1 — the four labels, from the reading alone", () => {
  it("80 → 45 is climbing, and climbing is stored as working", () => {
    const label = verdict(readingOver(SAAS, [80, 60, 45]), week(2));
    expect(label).toBe("climbing");
    expect(VERDICT_OF[label]).toBe("working");
  });

  it("45 → 18 is working", () => {
    expect(verdict(readingOver(LOCAL, [45, 30, 18]), week(2))).toBe("working");
  });

  it("flat for 8 weeks is not moving, stored as not working; a week sooner it is too early", () => {
    expect(verdict(readingOver(SAAS, flat(50, 8)), week(8))).toBe("not_moving");
    expect(VERDICT_OF.not_moving).toBe("not_working");
    expect(verdict(readingOver(SAAS, flat(50, 7)), week(7))).toBe("too_early");
  });

  it("10 days live is too early", () => {
    expect(verdict(readingOver(LOCAL, [60]), new Date(START + 10 * DAY))).toBe("too_early");
  });

  it("a page its AI answer links is working at any place, and is never not moving", () => {
    expect(verdict(readingOver(LOCAL, flat(60, 9), [9]), week(9))).toBe("working");
  });

  it("a gain older than 8 weeks no longer counts: 80 → 45, then flat, is not moving", () => {
    expect(verdict(readingOver(SAAS, [80, ...flat(45, 7)]), week(8))).toBe("climbing");
    expect(verdict(readingOver(SAAS, [80, ...flat(45, 8)]), week(9))).toBe("not_moving");
  });

  it("working is this week's place: 18, then 45 for 8 weeks, is not moving", () => {
    expect(verdict(readingOver(SAAS, [18, ...flat(45, 7)]), week(8))).toBe("not_moving");
    expect(verdict(readingOver(LOCAL, [18, ...flat(45, 7)]), week(8))).toBe("not_moving");
  });

  it("a week its search was not read keeps a recent top-twenty best working", () => {
    expect(verdict(readingOver(LOCAL, [45, 18, null]), week(2))).toBe("working");
  });

  it("a gain short of ten places is too early, never climbing", () => {
    expect(verdict(readingOver(LOCAL, [60, 55, 51]), week(2))).toBe("too_early");
  });

  it("a page no result has ever held is too early, never not moving", () => {
    expect(verdict(readingOver(LOCAL, flat(null, 12)), week(12))).toBe("too_early");
  });
});
