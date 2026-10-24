// `/about` against board `PubAbout`: the board's sections in its order, and
// each section's strings on the page with the parity check's matcher. The
// board file is read here; no board string is copied into this test.
import "../../generate/env";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "node-html-parser";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { boardFile, compare, readAllow, segments } from "../../../scripts/design/parity.mjs";
import type { LiveExamples } from "@/app/(public)/_how/examples";

const live = vi.hoisted(() => ({ now: { report: null, page: null, founder: null } as unknown }));
vi.mock("@/app/(public)/_how/examples", () => ({ readLiveExamples: async () => live.now }));

const { default: AboutPage } = await import("@/app/(public)/about/page");
const { copy } = await import("@/lib/presentation/copy");

const STORED: LiveExamples = {
  report: "podia.com",
  page: { title: "A page that is live", url: "https://content.example.com/a-page" },
  founder: { name: "Ada", place: "Lisbon" },
};
const NOTHING: LiveExamples = { report: null, page: null, founder: null };

async function render(examples: LiveExamples) {
  live.now = examples;
  return parse(renderToStaticMarkup(await AboutPage()));
}

const board = parse(readFileSync(boardFile("PubAbout"), "utf8"));
/** The board's main sections, by the id each one carries. */
const BOARD_SECTIONS = board.querySelectorAll("main section[id]").map((s) => s.getAttribute("id")!);

let page: ReturnType<typeof parse>;
beforeAll(async () => {
  page = await render(STORED);
});

describe("/about follows board PubAbout", () => {
  it("draws the board's sections in the board's order", () => {
    expect(BOARD_SECTIONS.length).toBeGreaterThanOrEqual(6);
    const shipped = page.querySelectorAll("section[id]").map((s) => s.getAttribute("id"));
    expect(shipped.filter((id) => BOARD_SECTIONS.includes(id!))).toEqual(BOARD_SECTIONS);
  });

  // `start` is the Learn pages' shared closing block (tests/app/library/learn-close.test.tsx).
  for (const id of BOARD_SECTIONS.filter((s) => s !== "start")) {
    it(`#${id}: every board string is on the page, sample data aside`, () => {
      const section = page.querySelector(`section#${id}`);
      expect(section, `no section #${id}`).not.toBeNull();
      const result = compare(board.querySelector(`section#${id}`)!.toString(), segments(section!.toString()), readAllow("PubAbout"));
      expect(result.missing).toEqual([]);
    });
  }

  it("each section is headed by the board's heading", () => {
    for (const id of BOARD_SECTIONS.filter((s) => s !== "start")) {
      const want = board.querySelector(`#${id}-h`)!.text.trim();
      expect(page.querySelector(`#${id}-h`)?.text.trim(), id).toBe(want);
    }
  });

  it("the four steps open How it works at the section that tells each one", () => {
    const hrefs = page.querySelectorAll("section#does ol a").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/how-it-works#research", "/how-it-works#questions", "/how-it-works#pages", "/how-it-works#found"]);
  });

  it("contact and the who-builds-it card reach the same address", () => {
    expect(page.querySelector("section#contact a")?.getAttribute("href")).toBe(`mailto:${copy("about.contact.address")}`);
    expect(page.querySelector('section#top a[href="#contact"]')).not.toBeNull();
  });
});

describe("/about draws stored rows only where they are stored", () => {
  it("names the founder, the newest own page and the listed report when stored", () => {
    const text = page.text;
    expect(text).toContain(copy("about.who.founder.place", { name: "Ada", place: "Lisbon" }));
    expect(page.querySelector('section#proof a[href="https://content.example.com/a-page"]')).not.toBeNull();
    expect(page.querySelector('section#proof a[href="/scan/podia.com"]')).not.toBeNull();
  });

  it("names no one and links nothing when nothing is stored, and still names the imprint", async () => {
    const empty = await render(NOTHING);
    expect(empty.text).not.toContain("built by");
    expect(empty.querySelectorAll("section#proof a")).toHaveLength(0);
    expect(empty.querySelector('section#top a[href="/imprint"]')?.text).toBe(copy("about.who.imprint"));
  });
});
