// Overview's tiles compare like with like: a week where nothing changed reads "Same", and the tile and the Google card state one count.
import { describe, expect, it } from "vitest";
import { tilesOf, type TilePass, type Tile } from "@/app/(account)/app/_overview/tiles";
import { googlePagesOf } from "@/app/(account)/app/_overview/google-pages";
import { contentOf, type PublishedPage } from "@/lib/measure/published";
import type { PageReading, PlaceReport } from "@/lib/measure/page-reading";

const NOW = new Date("2026-11-21T10:00:00Z");
const WEEKS = ["2026-11-09", "2026-11-16"];
const reading = (place: PageReading["place"]): PageReading => ({ at: "2026-11-16T06:00:00Z", place, first: null, best: null, prev: place?.value ?? null, linkedBy: null, variants: [], reached: {}, google: null }) as unknown as PageReading;
const page = (id: string, url: string, place: PageReading["place"] = null, read = true): PublishedPage => ({ id, title: id, url, publishedAt: new Date("2026-10-01T09:00:00Z"), reading: read ? reading(place) : null });
const EMPTY = { questions: { kind: "unmeasured" }, serps: [], ownRanked: { kind: "unmeasured" }, ownRankedRows: [], pageQuestions: { rows: [] }, verdict: { measuredAt: NOW } } as unknown as PlaceReport;
const passes: TilePass[] = WEEKS.map((weekStart) => ({ weekStart, at: `${weekStart}T06:00:00Z`, healthy: true, report: EMPTY, firstPage: null }));

function tiles(pages: PublishedPage[]): { pages: Tile; google: Tile; card: ReturnType<typeof googlePagesOf> } {
  const content = contentOf({ pages, now: NOW })!;
  const card = googlePagesOf(content.pages, NOW);
  const rows = pages.map((p) => ({ id: p.id, liveUrl: p.url, publishedAt: p.publishedAt.toISOString(), unpublishedAt: null, search: p.reading?.place?.query ?? null }));
  const model = tilesOf({
    passes,
    pages: rows,
    rivals: null,
    lists: { live: content.pages.length, firstLive: null, google: { live: card.live, placed: card.placed } },
    now: NOW,
    week: WEEKS[1]!,
    coming: 0,
    goLive: false,
  });
  return { pages: model.tiles[0]!, google: model.tiles[1]!, card };
}

describe("Overview's tiles", () => {
  it("two publications on one address, nothing published or taken down: Same, and the line ends on the figure", () => {
    const { pages } = tiles([page("a", "https://ex.com/a"), page("b", "https://ex.com/a")]);
    expect(pages.change).toEqual({ kind: "same" });
    expect([pages.n, pages.of]).toEqual([2, { kind: "count", m: 2 }]);
    expect(pages.series?.at(-1)).toBe(pages.n);
  });

  it("a page only Search Console places, two healthy weeks running: Same, and the line ends on the figure", () => {
    const { google } = tiles([page("a", "https://ex.com/a", { value: 30, source: "gsc", query: "fix a" })]);
    expect(google.change).toEqual({ kind: "same" });
    expect(google.series?.at(-1)).toBe(google.n);
  });

  it("the On Google tile and the Google card state one count of one total", () => {
    const { google, card } = tiles([
      page("a", "https://ex.com/a", { value: 7, source: "serp", query: "fix a" }),
      page("b", "https://ex.com/b", { value: 30, source: "gsc", query: "fix b" }),
      page("c", "https://ex.com/c", null, false),
    ]);
    expect([google.n, google.of]).toEqual([card.placed, { kind: "count", m: card.live }]);
    expect([card.placed, card.live, card.unseen]).toEqual([1, 3, 0]);
  });
});
