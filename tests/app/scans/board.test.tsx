// `/scans` against board `PubScans`: each of the board's sections is read from
// the board file and held against the page as it renders, with the parity
// check's matcher, in the board's order; no board string is copied here.
import "../../generate/env";
import { readFileSync } from "node:fs";
import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "node-html-parser";
import { describe, expect, it, vi } from "vitest";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";
import type { GalleryEntry } from "@/lib/scan/gallery";

/** A local trade, a software product, a report a ceiling cut off before it
 *  was scored, and older reports enough to fill the strip. */
const ENTRIES: readonly GalleryEntry[] = [
  { domain: "harborplumbing.example", company: "Harbor Plumbing", score: 27, category: "emergency plumbing", kind: "local-service", scannedAt: new Date("2026-10-19T09:00:00Z"), hasLogo: false },
  { domain: "tidyslot.example", company: "Tidyslot", score: 56, category: "booking software", kind: "software", scannedAt: new Date("2026-10-19T08:00:00Z"), hasLogo: false },
  { domain: "cedar-yoga.example", company: "cedar-yoga.example", score: null, category: null, kind: null, scannedAt: new Date("2026-10-18T08:00:00Z"), hasLogo: false },
  ...Array.from({ length: 9 }, (_, i) => ({
    domain: `older-${i}.example`,
    company: `Older ${i}`,
    score: 40 + 2 * i,
    category: "bike repair",
    kind: null,
    scannedAt: new Date(Date.UTC(2026, 9, 17 - i, 8)),
    hasLogo: false,
  })),
];
/** More reports are listed than one page shows. */
const MORE = 100;

vi.mock("@/app/(public)/_how/examples", () => ({
  readLiveExamples: async () => ({ report: null, page: null, founder: null }),
}));
vi.mock("@/lib/scan/gallery", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readGallery: async (view: { search: string; kind: string | null }) => {
    const entries = ENTRIES.filter((e) => (view.kind === null || e.kind === view.kind) && e.domain.includes(view.search));
    return { entries, total: entries.length === 0 ? 0 : entries.length + MORE };
  },
}));

const { copy } = await import("@/lib/presentation/copy");
const { default: ScansPage } = await import("@/app/(public)/scans/page");

async function render(searchParams: Record<string, string> = {}): Promise<string> {
  return renderToStaticMarkup((await ScansPage({ searchParams: Promise.resolve(searchParams) })) as React.ReactElement);
}

const BOARD = readFileSync(boardFile("PubScans"), "utf8");
/** One section of the board, by the heading it is labelled with. */
function boardSection(id: string, drop?: string): string {
  const section = parse(BOARD).querySelector(`section[aria-labelledby="${id}"]`);
  if (section === null) throw new Error(`board PubScans has no section ${id}`);
  if (drop !== undefined) section.querySelector(`section[aria-labelledby="${drop}"]`)?.remove();
  return section.outerHTML;
}

describe("/scans matches board PubScans", () => {
  it.each([
    ["the heading, the count, the scan field and the score strip", "top-h", undefined],
    ["the reports: kind of business, search, sort, the cards and the removal line", "list", "empty"],
    ["what every free report shows", "inside-h", undefined],
  ])("carries every string of %s", async (_name, id, drop) => {
    const { missing } = compare(boardSection(id, drop), segments(await render()), readAllow("PubScans"));
    expect(missing).toEqual([]);
  });

  it("carries the empty arm's strings when a search finds nothing", async () => {
    const page = await render({ q: "nothing-listed" });
    expect(parse(page).querySelector('[data-testid="gallery-cards"]')).toBeNull();
    // Only the board's caption over the arm is excused; the arm's own lines are read here.
    const caption = readAllow("PubScans").filter((line: { reason: string }) => line.reason.startsWith("#1110"));
    const { missing } = compare(boardSection("empty"), segments(page), caption);
    expect(missing).toEqual([]);
  });

  it("draws its sections in the board's order", async () => {
    const text = segments(await render()).join("\n");
    const at = [
      copy("gallery.heading"),
      copy("gallery.strip.title", { n: String(ENTRIES.length) }),
      copy("gallery.list.heading"),
      copy("gallery.inside.heading"),
      copy("library.close.scans.title"),
    ].map((heading) => text.indexOf(heading));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
  });

  it("counts every listed report in the lead, whatever is filtered", async () => {
    const lead = copy("gallery.subline", { count: String(ENTRIES.length + MORE) });
    expect(segments(await render())).toContain(lead);
    expect(segments(await render({ kind: "software" }))).toContain(lead);
  });
});

describe("the kind of business", () => {
  it("offers All and the six kinds as links, and lists only the kind asked for", async () => {
    const links = parse(await render()).querySelectorAll('nav[aria-label] a');
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/scans",
      ...["local-service", "shop", "hospitality", "professional-services", "software", "creator"].map((kind) => `/scans?kind=${kind}`),
    ]);
    const software = parse(await render({ kind: "software" }));
    const cards = software.querySelectorAll('[data-testid="gallery-cards"] a').map((a) => a.getAttribute("href"));
    expect(cards).toEqual(["/scan/tidyslot.example"]);
    expect(software.querySelector('a[aria-current="true"]')?.getAttribute("href")).toBe("/scans?kind=software");
  });

  it("writes a card's score and band, its kind, its stored category and its day; a report with no kind names none", async () => {
    const cards = parse(await render()).querySelectorAll('[data-testid="gallery-cards"] > li').map((li) => segments(li.outerHTML));
    expect(cards[0]).toContain(`${copy("gallery.card.score", { score: "27", max: "100" })} ${copy("band.score.hard-to-find")}`);
    expect(cards[0]).toContain(`${copy("gallery.kind.local-service")} · emergency plumbing · Oct 19`);
    expect(cards[2]).toContain("Oct 18");
    expect(cards[3]).toContain("bike repair · Oct 17");
  });
});

describe("a report with no score", () => {
  it("reads Not scored on its card, never 0, and the strip names it rather than drawing it", async () => {
    const page = await render();
    const card = parse(page).querySelectorAll('[data-testid="gallery-cards"] > li')[2]!;
    expect(segments(card.outerHTML)).toContain(copy("gallery.card.no-score"));
    expect(card.text).not.toMatch(/\b0\b/);
    const strip = parse(page).querySelector('[data-testid="gallery-strip"] figcaption')?.text ?? "";
    expect(strip).toContain(copy("gallery.strip.unscored.one", { n: "12", domain: "cedar-yoga.example" }));
    expect(strip).toContain(copy("gallery.strip.range", { low: "25", high: "60" }));
  });
});
