// tests/generate/pipeline/grounding.test.ts — SPEC §7 (2026-09-19, issue
// 900): "Grounding carries more than one page."
//
// The fault this suite exists for: the read walked the customer's pages
// freshest first and emptied one before opening the next, so a site whose
// most recently read page was dense enough handed the brief eight facts off
// that one page. On the owner's own dogfood that page was the price list,
// and a brief given eight sentences about the price can only write about the
// price.
//
// What this pins: the pages are taken in turn, the pages whose words the
// target search shares are offered first, and the uncapped read still finds
// a passage however deep it sits — which is how a rewrite finds the passage
// its row already pinned.
import "../env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_ID } from "../fixtures";

const { readMeasuredTextMock, readReportPageMock } = vi.hoisted(() => ({
  readMeasuredTextMock: vi.fn(),
  readReportPageMock: vi.fn(),
}));
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: readMeasuredTextMock }));
vi.mock("@/lib/generate/pipeline/report-facts", () => ({ readReportPage: readReportPageMock }));

let readFacts: typeof import("../../../src/lib/generate/pipeline/grounding").readFacts;
let readAllFacts: typeof import("../../../src/lib/generate/pipeline/grounding").readAllFacts;

const PRICING_URL = "https://example.com/pricing";
const GUIDE_URL = "https://example.com/guides/choosing";
const ABOUT_URL = "https://example.com/about";

/** Twelve passages, each long enough to quote — more than the brief's cap on
 *  its own, which is how one page came to supply every fact. */
function pricingText(): string {
  return Array.from(
    { length: 12 },
    (_, index) => `The starter plan includes seat number ${index + 1} and the projects that come with it.`
  ).join(" ");
}

/** The page that speaks to the target search: its words are the search's. */
function guideText(): string {
  return [
    "Choosing project management software starts with counting the people who open it daily.",
    "The software a small team picks is rarely the software a fifty-person team would pick.",
    "A trial that nobody uses tells you nothing about how the software behaves in a busy week.",
  ].join(" ");
}

function aboutText(): string {
  return [
    "The company was started by two people who had run projects on spreadsheets for years.",
    "Everyone here works from the same room on the same three problems each quarter.",
  ].join(" ");
}

/** As `readMeasuredText` returns them: ascending by read date, so the
 *  pricing page is the freshest and used to win outright. */
function pages() {
  return [
    { url: ABOUT_URL, text: aboutText(), measuredAt: new Date("2026-09-01T09:00:00.000Z") },
    { url: GUIDE_URL, text: guideText(), measuredAt: new Date("2026-09-01T09:01:00.000Z") },
    { url: PRICING_URL, text: pricingText(), measuredAt: new Date("2026-09-01T09:02:00.000Z") },
  ];
}

beforeEach(async () => {
  readMeasuredTextMock.mockReset();
  readMeasuredTextMock.mockResolvedValue(pages());
  readReportPageMock.mockReset();
  readReportPageMock.mockResolvedValue(null);
  ({ readFacts, readAllFacts } = await import("../../../src/lib/generate/pipeline/grounding"));
});

describe("the facts a brief chooses among come from more than one page", () => {
  it("draws from every page the site has, not from the densest one", async () => {
    const facts = await readFacts({ siteId: SITE_ID });
    const urls = new Set(facts.map((fact) => fact.fact.url));
    expect(urls).toEqual(new Set([PRICING_URL, GUIDE_URL, ABOUT_URL]));
  });

  it("takes one passage per page per round, so no page is emptied before the next is opened", async () => {
    const facts = await readFacts({ siteId: SITE_ID });
    // Three pages, so the first three facts are one from each.
    expect(new Set(facts.slice(0, 3).map((fact) => fact.fact.url)).size).toBe(3);
  });

  it("carries each passage with the page text the grounding rule re-verifies it against", async () => {
    const facts = await readFacts({ siteId: SITE_ID });
    for (const fact of facts) expect(fact.sourceText).toContain(fact.fact.passage);
  });
});

describe("a fact about the question is preferred to a fact about the seller", () => {
  it("offers the page whose words the target search shares first", async () => {
    const facts = await readFacts({
      siteId: SITE_ID,
      target: "best project management software for a small team",
    });
    expect(facts[0]?.fact.url).toBe(GUIDE_URL);
  });

  it("falls back to freshest first where no target is given", async () => {
    const facts = await readFacts({ siteId: SITE_ID });
    expect(facts[0]?.fact.url).toBe(PRICING_URL);
  });

  it("still offers a page that shares none of the search's words, after the ones that do", async () => {
    const facts = await readFacts({
      siteId: SITE_ID,
      target: "best project management software for a small team",
    });
    expect(facts.map((fact) => fact.fact.url)).toContain(ABOUT_URL);
  });
});

describe("the uncapped read is what finds a passage a row already pinned", () => {
  it("returns every passage, past the brief's cap", async () => {
    const all = await readAllFacts({ siteId: SITE_ID });
    expect(all.length).toBeGreaterThan((await readFacts({ siteId: SITE_ID })).length);
    expect(all.length).toBe(17);
  });

  it("holds each passage once, however many pages carry it", async () => {
    const all = await readAllFacts({ siteId: SITE_ID });
    expect(new Set(all.map((fact) => fact.fact.passage)).size).toBe(all.length);
  });
});

describe("#1130 — a fact is prose one page says, never a label or the site's chrome", () => {
  it("drops a label, a figure and a sentence the site repeats on three pages", async () => {
    const chrome = "Every plan comes with a thirty day refund and no questions asked.";
    readMeasuredTextMock.mockResolvedValue(
      [ABOUT_URL, GUIDE_URL, PRICING_URL].map((url, index) => ({
        url,
        text: [
          "Discoverability Score 62 out of a possible hundred points",
          "Searches you appear in this week across the market 128",
          `Page ${index + 1} explains how the team plans a busy week of work.`,
          chrome,
        ].join("\n"),
        measuredAt: new Date("2026-09-01T09:00:00.000Z"),
      }))
    );
    const passages = (await readAllFacts({ siteId: SITE_ID })).map((sourced) => sourced.fact.passage);
    expect(passages.sort()).toEqual([1, 2, 3].map((n) => `Page ${n} explains how the team plans a busy week of work.`));
  });
});

describe("issue 1163 — the knowledge base is the business speaking, and what ReachKit measured of it", () => {
  const at = new Date("2026-09-01T09:00:00.000Z");
  const page = (url: string, lines: string[], examples?: string[]) => ({ url, text: lines.join("\n"), measuredAt: at, examples });
  const passagesOf = async () => (await readAllFacts({ siteId: SITE_ID })).map((sourced) => sourced.fact.passage);

  it("reads no fact off a privacy, terms, imprint or cookies page", async () => {
    const clause = "We remove a report within thirty days of a written request from its owner.";
    readMeasuredTextMock.mockResolvedValue([
      page(ABOUT_URL, ["The company was started by two people who ran projects on spreadsheets."]),
      ...["privacy", "terms", "imprint", "cookies"].map((slug) =>
        page(`https://example.com/${slug}`, [`${clause} This applies to the ${slug} page as written here.`])
      ),
    ]);
    expect(await passagesOf()).toEqual(["The company was started by two people who ran projects on spreadsheets."]);
  });

  it("keeps a claim a six-page site makes on three of its pages, and still drops its chrome", async () => {
    const claim = "We write one page a day for your site and publish it on your domain.";
    const chrome = "Every plan comes with a thirty day refund and no questions asked.";
    readMeasuredTextMock.mockResolvedValue(
      [1, 2, 3, 4, 5, 6].map((n) => page(`https://example.com/page-${n}`, n <= 3 ? [claim, chrome] : [chrome]))
    );
    expect(await passagesOf()).toEqual([claim]);
  });

  it("drops a phrase one page shows inside an example wherever the site says it", async () => {
    const caption = "The empty slot in this answer is the place your business takes.";
    readMeasuredTextMock.mockResolvedValue([
      page(ABOUT_URL, ["The company was started by two people who ran projects on spreadsheets."], [caption]),
      page(GUIDE_URL, [caption]),
    ]);
    expect(await passagesOf()).toEqual(["The company was started by two people who ran projects on spreadsheets."]);
  });

  it("offers the report's measurements as facts sourced to the report, after the site's own pages", async () => {
    const measured = "ReachKit measured example.com on 1 September 2026 and gave it a Discoverability Score of 41 out of 100.";
    const reportUrl = "https://reachkit.app/scan/example.com";
    readReportPageMock.mockResolvedValue({ url: reportUrl, text: measured, measuredAt: at });
    const all = await readAllFacts({ siteId: SITE_ID });
    const fact = all.find((sourced) => sourced.fact.url === reportUrl);
    expect(fact).toEqual({ fact: { url: reportUrl, readAt: at, passage: measured }, sourceText: measured });
    expect(all[0]!.fact.url).not.toBe(reportUrl);
  });

  it("writes nothing from the measurements alone, where the site's own pages yield no fact", async () => {
    readMeasuredTextMock.mockResolvedValue([]);
    readReportPageMock.mockResolvedValue({
      url: "https://reachkit.app/scan/example.com",
      text: "ReachKit measured example.com on 1 September 2026 and gave it a Discoverability Score of 41 out of 100.",
      measuredAt: at,
    });
    expect(await readAllFacts({ siteId: SITE_ID })).toEqual([]);
  });
});
