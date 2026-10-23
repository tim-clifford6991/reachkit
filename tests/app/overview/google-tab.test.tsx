/** @vitest-environment jsdom */
// SPEC §4 (board AppGoogle): the Google tab, driven through the real
// `/app/search` page for the reserved fixture account the layout sweep reads,
// and its pure readers over stored readings.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";
import type { PageReading } from "@/lib/measure/page-reading";
import type { PublishedPage } from "@/lib/measure/published";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/app/search",
  redirect: vi.fn(),
}));

const { default: SearchPage } = await import("@/app/(account)/app/(tabs)/search/page");
const { GooglePages } = await import("@/app/(account)/app/_overview/GooglePages");
const { SearchTiles } = await import("@/app/(account)/app/_overview/SearchTiles");
const { googlePagesOf, plannedOf } = await import("@/app/(account)/app/_overview/google-pages");
const { doingOf, assembleSearch } = await import("@/app/(account)/app/_overview/search-model");
const { FIXTURE_SEARCH_FACTS } = await import("@/app/(account)/app/_overview/search-fixture");
const { readShell } = await import("@/app/(account)/app/_shell/provider");
const { readPublished } = await import("@/app/(account)/app/_overview/content-provider");
const { formatDay } = await import("@/app/(account)/app/_shell/format");
const { copy } = await import("@/lib/presentation/copy");
const { resetAccount, signedInAs } = await import("../account-door");

const text = (el: Element | null | undefined): string => (el?.textContent ?? "").replace(/\s+/gu, " ").trim();
const NOW = new Date("2026-10-19T06:00:00.000Z");
const WEEK = 7 * 86_400_000;

async function render(): Promise<{ html: string; dom: Document }> {
  const html = renderToStaticMarkup(<NuqsTestingAdapter>{await SearchPage()}</NuqsTestingAdapter>);
  return { html, dom: new DOMParser().parseFromString(html, "text/html") };
}

function reading(over: Partial<PageReading> = {}): PageReading {
  return {
    at: NOW.toISOString(),
    crawled: true,
    place: null,
    first: null,
    best: null,
    prev: null,
    linkedBy: [],
    aiReads: null,
    variants: [],
    reached: {},
    google: null,
    bing: null,
    ...over,
  };
}

function page(id: string, r: PageReading | null): PublishedPage {
  return { id, title: `Page ${id}`, url: `https://example.com/${id}`, publishedAt: new Date(NOW.getTime() - 20 * WEEK), draftId: `d-${id}`, reading: r };
}

const ago = (weeks: number): string => new Date(NOW.getTime() - weeks * WEEK).toISOString();
const placed = (value: number, query: string, over: Partial<PageReading> = {}): PageReading =>
  reading({ place: { value, source: "serp", query }, reached: { found: ago(9), showing: ago(9), ...(value <= 10 ? { firstPage: ago(1) } : {}) }, ...over });

describe("board AppGoogle, on the account the layout sweep reads", () => {
  beforeEach(() => signedInAs());
  afterEach(() => resetAccount());

  it("the head is the week, the name and the day its places were read", async () => {
    const [{ dom }, shell] = await Promise.all([render(), readShell()]);
    const head = dom.querySelector("header");
    expect(shell.weeks.kind).toBe("counted");
    const n = shell.weeks.kind === "counted" ? String(shell.weeks.weeks) : "";
    expect(text(head?.querySelector('[data-testid="search-eyebrow"]'))).toBe(copy("overview.tab.eyebrow", { n }));
    expect(text(head?.querySelector("h1"))).toBe(copy("overview.tab.search"));
    expect(text(head?.querySelector('[data-testid="search-measured"]'))).toBe(
      copy("overview.search.measured", { on: formatDay(FIXTURE_SEARCH_FACTS.measuredAt!, shell.timeZone) })
    );
  });

  it("three tiles, each with its figure and What this means closed under it", async () => {
    const [{ dom }, published] = await Promise.all([render(), readPublished()]);
    const pages = googlePagesOf(published.pages!, published.now);
    const tiles = [...dom.querySelectorAll('[data-testid="search-tiles"] > section')];
    expect(tiles.map((tile) => tile.getAttribute("data-testid"))).toEqual(["search-tile-pages", "search-tile-visits", "search-tile-market"]);
    for (const tile of tiles) {
      expect(text(tile.querySelector("summary"))).toContain(copy("overview.means"));
      expect(tile.querySelector("details")?.hasAttribute("open")).toBe(false);
    }
    const pagesTile = dom.querySelector('[data-testid="search-tile-pages"]');
    expect(text(pagesTile?.querySelector('[data-testid="search-tile-pages-value"]'))).toBe(String(pages.showing));
    expect(text(pagesTile)).toContain(copy("overview.search.tile.your-pages.of", { of: String(pages.live) }));
    expect(text(pagesTile)).toContain(
      copy("overview.search.tile.your-pages.split", {
        first: String(pages.firstPage),
        further: String(pages.showing - pages.firstPage),
        unseen: String(pages.read - pages.showing),
      })
    );
    expect(text(dom.querySelector('[data-testid="search-tile-visits"]'))).toContain(copy("overview.search.visits.of"));
    expect(text(dom.querySelector('[data-testid="search-tile-market-value"]'))).toBe("3");
    expect(text(dom.querySelector('[data-testid="search-tile-market-means"]'))).toBe(copy("overview.search.tile.market.means"));
  });

  it("each page in Google: the chart's well, then the pages by label, six at first and the rest behind Show all", async () => {
    const [{ dom }, published] = await Promise.all([render(), readPublished()]);
    const pages = googlePagesOf(published.pages!, published.now);
    const card = dom.querySelector('[data-testid="search-pages"]');
    expect(text(card?.querySelector("h2"))).toBe(copy("overview.search.pages.title"));
    expect(text(card)).toContain(copy("overview.search.pages.caption"));
    expect(text(card)).toContain(copy("overview.search.pages.where"));
    expect(card?.querySelector("figure")?.getAttribute("aria-label")).toBe(copy("overview.search.pages.chart"));
    const rows = [...(card?.querySelectorAll('[data-testid="search-page"]') ?? [])];
    expect(rows.map((row) => text(row.querySelector('[data-testid="search-page-title"]')))).toEqual(pages.rows.map((row) => row.title));
    const labels = rows.map((row) => text(row.querySelector('[data-testid="search-page-label"]')));
    const order = (["working", "climbing", "not_moving", "too_early"] as const).map((l) => copy(`review.label.${l}`));
    // A page no reading reached wears no label and comes last.
    const ranks = labels.map((label) => (label === "" ? order.length : order.indexOf(label)));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(labels)).toEqual(new Set([order[0], order[1], order[3], ""]));
    expect(text(card?.querySelector('[data-testid="search-pages-shown"]'))).toBe(
      copy("overview.search.pages.shown", { shown: "6", total: String(pages.live) })
    );
    expect(text(card?.querySelector("details > summary"))).toBe(copy("overview.search.show-all", { total: String(pages.live) }));
  });

  it("your market's searches: the name and lead, the board's columns and what is done about each", async () => {
    const { dom } = await render();
    const table = dom.querySelector('[data-testid="search-table"]');
    expect(text(table?.querySelector("h2"))).toBe(copy("overview.search.table.title"));
    expect(text(table?.querySelector('[data-testid="search-lead"]'))).toBe(copy("overview.search.table.lead.anywhere"));
    expect([...(table?.querySelectorAll("thead th") ?? [])].map(text)).toEqual(
      (["search", "volume", "you", "rival", "status"] as const).map((c) => copy(`overview.search.column.${c}`))
    );
    expect(text(table)).toContain(copy("overview.search.showing", { shown: "9", total: String(FIXTURE_SEARCH_FACTS.targets.length) }));
  });

  it("every board string is on the screen but for sample data, rulings and the shell's own chrome", async () => {
    const { html } = await render();
    const { missing } = compare(readFileSync(boardFile("AppGoogle"), "utf8"), segments(html), readAllow("AppGoogle"));
    // The sidebar and the tab bar are the layouts', which this render does not draw.
    const chrome = ["ReachKit", "Overview", "Plan", "Settings", "Publishing on", "AI", "Competitors"];
    expect(missing.filter((s: string) => !chrome.includes(s))).toEqual([]);
  });
});

describe("a page with no reading", () => {
  const pages = googlePagesOf([page("a", placed(8, "boiler repair")), page("b", null)], NOW);

  it("says not measured, wears no label and draws no dot, and the tile counts only read pages", () => {
    const dom = new DOMParser().parseFromString(
      renderToStaticMarkup(<GooglePages pages={pages} planned={new Map()} timeZone="UTC" />),
      "text/html"
    );
    const unread = [...dom.querySelectorAll('[data-testid="search-page"]')].find((row) => text(row).includes("Page b"));
    expect(text(unread?.querySelector('[data-testid="search-page-line"]'))).toBe(copy("draft.ladder.unmeasured"));
    expect(unread?.querySelector('[data-testid="search-page-label"]')).toBeNull();
    expect(text(unread)).not.toMatch(/\b0\b/);
    expect([...dom.querySelectorAll("figure li")].map(text)).toEqual(["8"]);

    const tiles = new DOMParser().parseFromString(
      renderToStaticMarkup(<SearchTiles pages={pages} visits={null} market={null} />),
      "text/html"
    );
    expect(text(tiles.querySelector('[data-testid="search-tile-pages-split"]'))).toBe(
      copy("overview.search.tile.your-pages.split", { first: "1", further: "0", unseen: "0" })
    );
    for (const id of ["visits", "market"]) {
      expect(text(tiles.querySelector(`[data-testid="search-tile-${id}-value"]`))).toBe(copy("draft.ladder.unmeasured"));
    }
  });

  it("no page read at all leaves the pages figure not measured, never 0", () => {
    const tiles = new DOMParser().parseFromString(
      renderToStaticMarkup(<SearchTiles pages={googlePagesOf([page("b", null)], NOW)} visits={0} market={null} />),
      "text/html"
    );
    expect(text(tiles.querySelector('[data-testid="search-tile-pages-value"]'))).toBe(copy("draft.ladder.unmeasured"));
    expect(text(tiles.querySelector('[data-testid="search-tile-visits-value"]'))).toBe(copy("overview.search.visits.none"));
  });

  it("no page live: the board's line in place of the list", () => {
    const html = renderToStaticMarkup(<GooglePages pages={googlePagesOf([], NOW)} planned={new Map()} timeZone="UTC" />);
    expect(html).toContain(copy("overview.search.pages.none"));
  });
});

describe("each page's place line, read from its stored reading", () => {
  const rows = googlePagesOf(
    [
      page("up", placed(11, "shut off water", { first: { at: "2026-10-05T06:00:00.000Z", place: 41 }, best: { at: ago(0), place: 11 }, prev: 20 })),
      page("flat", placed(48, "sewer camera", { first: { at: ago(9), place: 48 }, best: { at: ago(3), place: 48 } })),
      page("found", reading({ reached: { found: "2026-10-14T06:00:00.000Z" } })),
      page("estimate", placed(30, "water softener", { place: { value: 30, source: "labs", query: "water softener" } })),
    ],
    NOW
  ).rows;
  const line = (id: string) => rows.find((row) => row.id === id)!;

  it("up since it was first seen, no gain in whole weeks, found and not shown yet", () => {
    expect(line("up").line).toEqual({ kind: "up", place: 11, search: "shut off water", gain: 30, since: "2026-10-05T06:00:00.000Z" });
    expect(line("flat").line).toEqual({ kind: "flat", place: 48, search: "sewer camera", weeks: 3 });
    expect(line("found").line).toEqual({ kind: "found", at: "2026-10-14T06:00:00.000Z" });
    expect(line("estimate").estimate).toBe(true);
  });

  it("speaks them in the board's words, with the update Plan holds for the search", () => {
    const planned = new Map([["sewer camera", { day: "Sun 25", today: false, update: true }]]);
    const html = renderToStaticMarkup(
      <GooglePages pages={googlePagesOf([page("up", placed(11, "shut off water", { first: { at: "2026-10-05T06:00:00.000Z", place: 41 }, best: { at: ago(0), place: 11 } })), page("flat", placed(48, "sewer camera", { first: { at: ago(9), place: 48 }, best: { at: ago(3), place: 48 } })), page("found", reading({ reached: { found: "2026-10-14T06:00:00.000Z" } }))], NOW)} planned={planned} timeZone="UTC" />
    );
    const dom = new DOMParser().parseFromString(html, "text/html");
    const lines = [...dom.querySelectorAll('[data-testid="search-page-line"]')].map(text);
    expect(lines).toContain("Place 11 for “shut off water”, up 30 since Oct 5.");
    expect(lines).toContain("Place 48 for “sewer camera”, no gain in 3 weeks. An update goes live Sun 25.");
    expect(lines).toContain("Found by Google on Oct 14. Not in results yet.");
  });
});

describe("what ReachKit is doing about a search this week", () => {
  const model = assembleSearch(FIXTURE_SEARCH_FACTS, NOW);
  const live = model.rows.find((row) => row.status === "live")!;
  const next = model.rows.find((row) => row.status === "up_next")!;
  const key = (s: string) => s.toLowerCase();

  it("a page or update on a day of Plan's week, a climbing page left alone, else the status word", () => {
    expect(doingOf(next, new Map([[key(next.target.search), { day: "Wed 21", today: false, update: false }]]), new Set())).toEqual({ kind: "page", day: "Wed 21" });
    expect(doingOf(live, new Map([[key(live.target.search), { day: "Tue 20", today: false, update: true }]]), new Set())).toEqual({ kind: "update", day: "Tue 20" });
    expect(doingOf(next, new Map([[key(next.target.search), { day: "Mon 19", today: true, update: false }]]), new Set())).toEqual({ kind: "today" });
    expect(doingOf(live, new Map(), new Set([key(live.target.search)]))).toEqual({ kind: "climbing" });
    expect(doingOf(next, new Map(), new Set([key(next.target.search)]))).toEqual({ kind: "status" });
  });

  it("Plan's week names each page still to go live by its day, and leaves out what is live or past", () => {
    const cell = (day: string, search: string, stage: string, update = false) =>
      ({ day, page: { why: { search }, stage, update } }) as never;
    const planned = plannedOf({
      today: "2026-10-20",
      cells: [cell("2026-10-19", "past", "scheduled"), cell("2026-10-20", "Today Search", "scheduled"), cell("2026-10-21", "live one", "live"), cell("2026-10-25", "later", "planned", true)],
    });
    expect([...planned.entries()]).toEqual([
      ["today search", { day: "Tue 20", today: true, update: false }],
      ["later", { day: "Sun 25", today: false, update: true }],
    ]);
  });
});
