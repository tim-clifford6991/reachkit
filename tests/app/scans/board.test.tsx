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
    // The board's own sample reports' initials; this render's reports are other businesses.
    const sample = ["C", "P"].map((string) => ({ string }));
    const { missing } = compare(boardSection(id, drop), segments(await render()), [...readAllow("PubScans"), ...sample]);
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

/** The board's icon for each kind of business, by lucide name. */
const KIND_ICON: Readonly<Record<string, string>> = {
  "local-service": "wrench",
  shop: "store",
  hospitality: "utensils",
  "professional-services": "briefcase",
  software: "laptop",
  creator: "video",
};

describe("the board's rings and icons", () => {
  it("a scored card has a ring, an unscored card none", async () => {
    const cards = parse(await render()).querySelectorAll('[data-testid="gallery-cards"] > li');
    const ring = cards[0]!.querySelector(".radial-progress");
    expect(ring?.getAttribute("role")).toBe("img");
    expect(ring?.getAttribute("aria-label")).toBe(copy("gallery.card.score", { score: "27", max: "100" }));
    expect(ring?.getAttribute("style")).toContain("--value:27");
    expect(cards[2]!.querySelector(".radial-progress")).toBeNull();
  });

  it("each kind's pill and card carry its icon", async () => {
    const { BUSINESS_KIND_NAMES } = await import("@/lib/market/kinds");
    const page = parse(await render());
    expect(page.querySelector('nav[aria-label] a[href="/scans"] svg.lucide-layout-grid')).not.toBeNull();
    for (const kind of BUSINESS_KIND_NAMES) {
      const icon = `svg.lucide-${KIND_ICON[kind]}`;
      expect(page.querySelector(`nav[aria-label] a[href="/scans?kind=${kind}"] ${icon}`), kind).not.toBeNull();
      const card = parse(await render({ kind })).querySelector('[data-testid="gallery-cards"] > li');
      if (ENTRIES.some((e) => e.kind === kind)) expect(card?.querySelector(icon), kind).not.toBeNull();
    }
    // A report with no kind names none, so it draws none.
    const kindless = page.querySelectorAll('[data-testid="gallery-cards"] > li')[2]!;
    expect(Object.values(KIND_ICON).some((name) => kindless.querySelector(`svg.lucide-${name}`) !== null)).toBe(false);
  });

  it("the inside mockup draws a score ring and its AI bar", async () => {
    const inside = parse(await render()).querySelector('section[aria-labelledby="inside-h"] .mockup-browser');
    const { EXAMPLES } = await import("@/app/(public)/_how/specimen");
    expect(inside?.querySelector(".radial-progress")?.getAttribute("style")).toContain(`--value:${EXAMPLES.plumber.report.score}`);
    const bar = inside?.querySelector("progress.progress-primary");
    expect([bar?.getAttribute("value"), bar?.getAttribute("max")]).toEqual(
      [EXAMPLES.plumber.tally.n, EXAMPLES.plumber.tally.total].map(String)
    );
  });

  it("at-a-glance tiles carry their icons", async () => {
    const glance = parse(await render()).querySelector('[data-variant="scans"] #start figure');
    const stats = glance?.querySelectorAll(".stat") ?? [];
    expect(stats).toHaveLength(3);
    expect(stats[0]!.querySelector(".radial-progress")).not.toBeNull();
    expect(stats[1]!.querySelector(".rounded-field svg.lucide-sparkles")).not.toBeNull();
    expect(stats[2]!.querySelector(".rounded-field svg.lucide-file-text")).not.toBeNull();
  });

  it("after the report carries its icons", async () => {
    const close = parse(await render()).querySelector('[data-variant="scans"]')!;
    const steps = close.querySelectorAll('[data-testid="learn-loop"] ol > li');
    expect(steps.map((li) => li.querySelector(".rounded-field svg")?.getAttribute("class"))).toEqual(
      ["search", "calendar", "file-text", "mail"].map((name) => `lucide lucide-${name}`)
    );
    const rows = close.querySelectorAll("ul.divide-y > li");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.querySelector("svg.lucide-user")).not.toBeNull();
      expect(row.querySelector("svg.lucide-sparkles")).not.toBeNull();
    }
  });
});
