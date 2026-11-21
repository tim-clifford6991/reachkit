// Overview's four tiles: each tile and its detail are counted once, from the same rows, over every fixture.
import { describe, expect, it } from "vitest";
import { buildTiles, type TilesView } from "@/app/(account)/app/_overview/tiles-build";
import { fixturePasses, tilePageOf } from "@/app/(account)/app/_overview/tiles-fixture";
import { AI_WINDOW_WEEKS, marketOf, type TilePass, type Tile } from "@/app/(account)/app/_overview/tiles";
import { CONTENT_FIXTURE_NOW, FIXTURE_PUBLISHED } from "@/app/(account)/app/_overview/content-fixture";
import { FIXTURE_ANSWERS_FACTS } from "@/app/(account)/app/_overview/answers-fixture";
import { assembleAnswers } from "@/app/(account)/app/_overview/answers-model";
import { FIXTURE_RIVALS_FACTS } from "@/app/(account)/app/_overview/rivals-fixture";
import { assembleRivals } from "@/app/(account)/app/_overview/rivals-model";
import type { PublishedPage } from "@/lib/measure/published";
import type { PageReading, PlaceReport } from "@/lib/measure/page-reading";
import { weekStartFor } from "@/lib/scan/weekly/week";

const NOW = new Date("2026-11-21T10:00:00Z");
const WEEK = "2026-11-16";
const reading = (place: PageReading["place"], linkedBy: string[] | null = null): PageReading =>
  ({ at: "2026-11-16T06:00:00Z", place, first: null, best: null, prev: place?.value ?? null, linkedBy, variants: [], reached: {}, google: null }) as unknown as PageReading;
const page = (id: string, url: string, place: PageReading["place"] = null, read = true): PublishedPage => ({
  id,
  title: id,
  url,
  publishedAt: new Date("2026-10-01T09:00:00Z"),
  reading: read ? reading(place) : null,
});
type Cell = { kind: "answered"; ownUrls: string[]; citedDomains: string[]; named?: true; namesCustomer: boolean };
type Row = { id: string; cell: Cell; organic?: { url: string; position: number }[] };
const report = (rows: Row[]): PlaceReport =>
  ({
    questions: { kind: "unmeasured" },
    serps: [],
    ownRanked: { kind: "unmeasured" },
    ownRankedRows: [],
    pageQuestions: { rows: rows.map((r) => ({ publicationId: r.id, question: { search: r.id }, cell: r.cell, engines: [], organic: r.organic ?? [] })) },
    verdict: { measuredAt: NOW },
  }) as unknown as PlaceReport;
const pass = (weekStart: string, rows: Row[] = []): TilePass => ({ weekStart, at: `${weekStart}T06:00:00Z`, healthy: true, report: report(rows), firstPage: null });
const answered = (urls: string[], named = false): Cell => ({ kind: "answered", ownUrls: urls, citedDomains: [], namesCustomer: named, ...(named ? { named: true as const } : {}) });

function site(pages: PublishedPage[], passes: TilePass[]): TilesView {
  return buildTiles({
    published: { pages, now: NOW },
    passes,
    rows: pages.map(tilePageOf),
    rivals: { you: 3, of: 12, rivals: [{ domain: "rival.com", count: 5 }], measuredAt: NOW },
    pageQuestions: [],
    domain: "ex.com",
    week: WEEK,
    coming: 0,
    goLive: false,
  })!;
}

const fixtureWeek = weekStartFor({ at: CONTENT_FIXTURE_NOW, zone: "UTC" });
const firstPage = assembleRivals(FIXTURE_RIVALS_FACTS).firstPage;
const fixtureQuestions = assembleAnswers(FIXTURE_ANSWERS_FACTS).pageQuestions;
const FIXTURES: Record<string, TilesView> = {
  "the reserved account": buildTiles({
    published: { pages: FIXTURE_PUBLISHED, now: CONTENT_FIXTURE_NOW },
    passes: fixturePasses(FIXTURE_PUBLISHED, fixtureWeek, fixtureQuestions),
    rows: FIXTURE_PUBLISHED.map(tilePageOf),
    rivals: { you: firstPage.you.count, of: firstPage.of, rivals: firstPage.rivals, measuredAt: null },
    pageQuestions: fixtureQuestions,
    domain: "example.com",
    week: fixtureWeek,
    coming: 0,
    goLive: true,
  })!,
  "two publications on one address": site([page("a", "https://ex.com/a"), page("b", "https://ex.com/a")], [pass("2026-11-09"), pass(WEEK)]),
  "a Search Console place, a stored place and an unread page": site(
    [page("a", "https://ex.com/a", { value: 7, source: "serp", query: "a" }), page("b", "https://ex.com/b", { value: 30, source: "gsc", query: "b" }), page("c", "https://ex.com/c", null, false)],
    ["2026-11-09", WEEK].map((w) => pass(w, [{ id: "a", cell: answered([]), organic: [{ url: "https://ex.com/a", position: 7 }] }]))
  ),
  "AI: linked three weeks back, mentioned, asked and neither": site(
    [page("a", "https://ex.com/a"), page("b", "https://ex.com/b"), page("c", "https://ex.com/c")],
    [pass("2026-10-26", [{ id: "a", cell: answered(["https://ex.com/a"]) }]), pass(WEEK, [{ id: "b", cell: answered([], true) }, { id: "c", cell: answered([]) }])]
  ),
};
const tile = (view: TilesView, key: Tile["key"]): Tile => view.tiles.find((t) => t.key === key)!;
const total = (t: Tile): number | null => (t.of.kind === "count" ? t.of.m : null);

describe.each(Object.entries(FIXTURES))("%s", (_, view) => {
  it("Pages Live: the figure is the live list's rows, and the line ends on it", () => {
    const t = tile(view, "pages");
    expect(t.n).toBe(view.pages.pages.length);
    if (t.n! > 0) expect(total(t)).toBeGreaterThanOrEqual(t.n!);
    if (t.series !== null) expect(t.series.at(-1)).toBe(t.n);
  });

  it("On Google: the figure and total are the list's rows, and every row is in exactly one count its label agrees with", () => {
    const t = tile(view, "google");
    const rows = view.google.rows;
    if (t.n !== null) {
      expect(t.n).toBe(rows.filter((r) => r.bucket === "first" || r.bucket === "further").length);
      expect(total(t)).toBe(rows.length);
      if (t.series !== null) expect(t.series.at(-1)).toBe(t.n);
    }
    expect(Object.values(view.google.counts).reduce((a, b) => a + b, 0)).toBe(rows.length);
    for (const row of rows) {
      const placed = ["first", "further", "console"].includes(row.bucket);
      expect(placed, `${row.title}: a row with a place is in a placed count`).toBe(row.place !== null);
      expect(["up", "flat", "now"].includes(row.line.kind), `${row.title}: its line says a place`).toBe(row.place !== null);
    }
  });

  it("Linked by AI: the tile, the lead and the list count the same rows over the same window", () => {
    const t = tile(view, "ai");
    const ai = view.ai;
    if (ai === null) return expect(t.n).toBeNull();
    expect(ai.weeks).toBe(AI_WINDOW_WEEKS);
    expect([t.n, total(t)]).toEqual([ai.rows.filter((r) => r.mark === "links").length, ai.rows.length]);
    expect([ai.linked, ai.asked, ai.mentioned]).toEqual([t.n, ai.rows.length, ai.rows.filter((r) => r.mark === "mentions").length]);
    if (t.series !== null) expect(t.series.at(-1)).toBe(t.n);
  });

  it("Against Competitors: the tile, its bars and the Google screen's market card state one count", () => {
    const t = tile(view, "rivals");
    if (t.n === null) return;
    expect(view.bars?.you).toBe(t.n);
    expect(marketOf(view)).toEqual({ top10: t.n, of: total(t) });
  });
});

describe("weeks compare like with like", () => {
  it("the reserved account's passes carry the mentions its answers record: 2 named without a link", () => {
    const namedOnly = fixtureQuestions.filter((q) => q.marks.includes("names_you") && !q.marks.includes("links_to_you")).length;
    expect([FIXTURES["the reserved account"]!.ai?.mentioned, namedOnly]).toEqual([2, 2]);
  });

  it("two publications on one address, nothing changed: Same, 2 of 2", () => {
    const t = tile(FIXTURES["two publications on one address"]!, "pages");
    expect([t.n, t.of, t.change]).toEqual([2, { kind: "count", m: 2 }, { kind: "same" }]);
  });

  it("a page placed only by Search Console is its own count, never 'not showing yet', and two weeks running read Same", () => {
    const view = FIXTURES["a Search Console place, a stored place and an unread page"]!;
    expect(view.google.counts).toEqual({ first: 1, further: 0, console: 1, unseen: 0, unread: 1 });
    expect(tile(view, "google").change).toEqual({ kind: "same" });
  });

  it("a link three weeks back still counts in the 4-week window, and a mention is not a link", () => {
    const view = FIXTURES["AI: linked three weeks back, mentioned, asked and neither"]!;
    expect(view.ai?.rows.map((r) => [r.id, r.mark])).toEqual([["a", "links"], ["b", "mentions"], ["c", "none"]]);
  });
});
