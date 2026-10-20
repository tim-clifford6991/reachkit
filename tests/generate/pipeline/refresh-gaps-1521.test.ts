// SPEC §7 (owner 2026-10-18, issue 1521; amends D42 #7): a refresh closes
// the gap to the pages above it — heading gaps, up to three new sections at
// +40%, the answer box and the dates moving only with what the page says.
import "../env";
import { describe, expect, it } from "vitest";
import { layoutPage, withClosing } from "../../../src/lib/generate/pipeline/compose";
import { lengthRangeFor } from "../../../src/lib/generate/length";
import { buildPack, grows, headingGaps, type PackInputs } from "../../../src/lib/generate/pipeline/pack";
import { headingsOf } from "../../../src/lib/generate/pipeline/research";
import { missingBlock } from "../../../src/lib/generate/rules/blocks";
import { TEMPLATES } from "../../../src/lib/generate/templates";
import type { PageParts } from "../../../src/lib/generate/pipeline/write";
import { refreshCandidates, type OwnLivePage } from "../../../src/lib/opportunities/refresh";
import type { Opportunity } from "../../../src/lib/opportunities/types";
import { AT, CLEAN_ANSWER, GROUNDED, opportunity, prose, report } from "../fixtures";

const STORED_HTML = [
  `<html><body><nav><h2>Products</h2><h3>Pricing</h3></nav><main><h1>Best CRM for small teams</h1>
    <h2>What does a CRM cost a small team?</h2><h2>Integrations with accounting tools</h2><h3>Data import from spreadsheets</h3>
    <h2>Frequently asked questions</h2></main><footer><h2>Contact us</h2></footer></body></html>`,
  `<html><body><header><h2>Menu</h2></header><article><h2>1. Accounting integrations</h2><h2>Mobile app &amp; offline use</h2>
    <h3>Importing data from a spreadsheet</h3><h2>Conclusion</h2></article><aside><h2>Newsletter</h2></aside></body></html>`,
  `<html><body><main><h2>Kosten im Überblick</h2><h2>Mobile app for field teams</h2><h2>Fazit</h2></main></body></html>`,
];

const LIVE = "## What does a CRM cost a small team?\n\nIt depends on seats.\n\n## How do you import data from a spreadsheet?\n\nUpload a CSV.";
const CLAIMS = [
  { passage: "Every plan connects to QuickBooks and Xero for accounting sync.", url: "https://rival.example.net/integrations" },
  { passage: "The mobile app works offline and syncs when back online.", url: "https://other.example.org/mobile" },
  { passage: "Plans start at $12 per seat.", url: "https://rival.example.net/pricing" },
];

describe("what the pages above a refresh cover and it does not", () => {
  const topResults = STORED_HTML.map((html, index) => ({ url: `https://result${index}.example.com/`, headings: headingsOf(html) }));

  it("reads each result's H2 and H3 headings off its main content, never its navigation, header, footer or sidebar", () => {
    expect(topResults[1]!.headings).toEqual(["1. Accounting integrations", "Mobile app & offline use", "Importing data from a spreadsheet", "Conclusion"]);
    expect(topResults[0]!.headings).toEqual([
      "What does a CRM cost a small team?",
      "Integrations with accounting tools",
      "Data import from spreadsheets",
      "Frequently asked questions",
    ]);
  });

  it("a gap is a subtopic two of them head that the live page does not, carried with the claims that speak to it", () => {
    const gaps = headingGaps({ topResults, live: LIVE, target: "best crm for small teams", claims: CLAIMS });
    expect(gaps).toEqual([
      { heading: "Integrations with accounting tools", coveredBy: 2, claims: ["https://rival.example.net/integrations"] },
      { heading: "Mobile app & offline use", coveredBy: 2, claims: ["https://other.example.org/mobile"] },
    ]);
  });

  it("no gap without a claim, and none on a refresh that may not grow", () => {
    expect(headingGaps({ topResults, live: LIVE, target: "best crm for small teams", claims: CLAIMS.slice(2) })).toEqual([]);
    expect(grows({ cause: "close", place: 15 })).toBe(true);
    expect(grows({ cause: "aged", place: 15 })).toBe(false);
    expect(grows({ cause: "close", place: 15, linkTo: { url: "https://example.com/new", title: "New" } })).toBe(false);
  });
});

describe("only a page near page one grows on the gaps (owner 2026-10-19)", () => {
  const target = "best crm for small teams";
  const url = "https://content.example.com/best-crm";
  const written = { ...opportunity({ targetQuery: target, targetRef: "best-crm" }), family: "write" } as Opportunity;
  const page = (over: Partial<OwnLivePage>): OwnLivePage => ({
    url,
    publishedAt: new Date(AT.getTime() - 40 * 86_400_000),
    row: written,
    declined: false,
    facts: [],
    marketFacts: [],
    ...over,
  });
  const research = {
    facts: CLAIMS.map((claim) => ({ ...claim, title: "Integrations", readAt: AT, kind: "rival_features" as const })),
    products: [],
    topResults: STORED_HTML.map((html, index) => ({ url: `https://result${index}.example.com/`, text: "", headings: headingsOf(html) })),
  };
  /** The pack of the refresh planned for `planned`, as the writer reads the row. */
  function packOf(planned: OwnLivePage, ranked: { keyword: string; url: string; position: number }[]) {
    const [row] = refreshCandidates([planned], { siteText: [], market: [], ranked }, AT);
    const shortfall = (row!.evidence as { shortfall: { cause: string; place?: number } }).shortfall;
    const inputs: PackInputs = {
      type: "update",
      opportunity: { ...opportunity({ targetQuery: target, targetRef: url }), family: "improve" },
      site: { businessName: "Example", domain: "example.com", doNotClaim: [], rivals: [] },
      category: "crm software",
      byline: null,
      voice: null,
      profile: null,
      facts: [],
      research,
      report: report(),
      sitePages: [],
      links: [],
      live: { url, title: "Best CRM", markdown: LIVE, why: "due", cause: shortfall.cause, ...(shortfall.place === undefined ? {} : { place: shortfall.place }) },
      now: AT,
    };
    return { cause: shortfall.cause, place: shortfall.place, pack: buildPack(inputs) };
  }

  it("a page at place 12 gets the gap sections and the +40% ceiling", () => {
    const gaps = ["Integrations with accounting tools", "Mobile app & offline use"];
    const read = packOf(page({ declined: true, readPlace: 12 }), []);
    expect({ cause: read.cause, place: read.place }).toEqual({ cause: "lost_position", place: 12 });
    expect(read.pack.gaps?.map((gap) => gap.heading)).toEqual(gaps);
    // With no reading stored yet, its own address in the ranked rows places it.
    const ranked = packOf(page({}), [{ keyword: target, url, position: 12 }]);
    expect({ cause: ranked.cause, place: ranked.place }).toEqual({ cause: "close", place: 12 });
    expect(ranked.pack.gaps?.map((gap) => gap.heading)).toEqual(gaps);
  });

  it("a page at place 45 keeps today's refresh: no gaps, so no new sections and no growth", () => {
    const { cause, place, pack } = packOf(page({ declined: true, readPlace: 45 }), []);
    expect({ cause, place }).toEqual({ cause: "lost_position", place: 45 });
    expect(pack.gaps).toBeUndefined();
    // A page with no place read is not near page one either.
    expect(packOf(page({ declined: true }), []).pack.gaps).toBeUndefined();
  });

  it("a close page at place 8, above the near-page-one band, keeps today's refresh: no gaps and no +40%", () => {
    for (const position of [8, 10]) {
      const { cause, place, pack } = packOf(page({}), [{ keyword: target, url, position }]);
      expect({ cause, place }).toEqual({ cause: "close", place: position });
      expect(pack.gaps).toBeUndefined();
      expect(lengthRangeFor(TEMPLATES.update, { liveWords: 1000, grown: pack.gaps !== undefined })).toMatchObject({ floor: 800, ceiling: 1200 });
    }
  });
});

const TIDY = { facts: [GROUNDED.passage], promises: [], queries: ["best crm for small teams"], names: ["Acme"] };

function parts(over: Partial<PageParts> = {}, extra: PageParts["sections"] = []): PageParts {
  return {
    titles: ["Best CRM for small teams (2025)"],
    slug: "best-crm",
    description: "A small team picks a CRM by seat count and the tools it connects to, then compares what each plan costs for that many seats over a year.",
    answer: CLEAN_ANSWER,
    takeaways: [prose("seats", 0, 1), prose("seats", 1, 1), prose("seats", 2, 1)],
    sections: [
      { key: "live", heading: "What does a CRM cost a small team?", body: prose("seats", 3, 30) },
      { key: "live", heading: "How do you import data from a spreadsheet?", body: prose("seats", 40, 30) },
      ...extra,
      { key: "live", heading: "How is it handled here?", body: `${prose("seats", 80, 10)} See [the plans](${GROUNDED.url}).` },
    ],
    closing: "Count your seats before you choose a plan.",
    faq: [1, 2, 3].map((n) => ({ question: `Question ${n}?`, answer: prose("seats", n, 2) })),
    updated: "",
    ...over,
  };
}

const LIVE_PAGE = (() => {
  const laid = layoutPage(parts(), TEMPLATES.update, TIDY);
  return { title: "Best CRM for small teams (2025)", markdown: withClosing(laid.body.bodyMarkdown, laid.closing, "https://example.com/"), year: 2026 };
})();

describe("the answer box and the dates move only with what the page says", () => {
  it("an update whose sections all read as live keeps its short answer, takeaways and closing line, and says nothing changed", () => {
    const again = layoutPage(parts({ answer: `${CLEAN_ANSWER} Reworded anyway.`, takeaways: ["Another.", "Takeaway.", "Set."], closing: "A new closing." }), TEMPLATES.update, { ...TIDY, live: LIVE_PAGE });
    expect(again.kept).toBe(true);
    expect(again.body.bodyMarkdown).toContain(`:::answer\n${CLEAN_ANSWER}\n:::`);
    expect(again.body.bodyMarkdown).not.toContain("Another.");
    expect(again.closing).toBe("[Count your seats before you choose a plan.](https://example.com/)");
    expect(again.body.title).toBe(LIVE_PAGE.title);
  });

  it("an update that adds or changes a section takes the writer's answer, and its dates move", () => {
    const answer = `${CLEAN_ANSWER} Accounting sync now comes with every plan.`;
    const grown = layoutPage(parts({ answer }, [{ key: "live", heading: "Integrations with accounting tools", body: "It syncs." }]), TEMPLATES.update, { ...TIDY, live: LIVE_PAGE });
    expect(grown.kept).toBe(false);
    expect(grown.body.bodyMarkdown).toContain("Accounting sync now comes with every plan.");
    expect(grown.body.title).toBe("Best CRM for small teams (2026)");
  });
});

describe("a growing refresh adds at most three sections, each on a gap and its claim, and grows up to 40%", () => {
  const gaps = [
    { heading: "Integrations with accounting tools", claims: ["https://rival.example.net/integrations"] },
    { heading: "Mobile app and offline use", claims: ["https://other.example.org/mobile"] },
  ];
  const check = (extra: PageParts["sections"]) => {
    const laid = layoutPage(parts({}, extra), TEMPLATES.update, TIDY);
    const markdown = withClosing(laid.body.bodyMarkdown, laid.closing, "https://example.com/");
    return missingBlock({
      markdown,
      title: LIVE_PAGE.title,
      blocks: { template: TEMPLATES.update, sections: laid.sections, length: null, faq: laid.faq, domain: "example.com", growth: { live: LIVE_PAGE.markdown, gaps } },
    });
  };
  const section = (heading: string, url: string | null) => ({
    key: "live",
    heading,
    body: `${prose("sync", 5, 4)}${url === null ? "" : ` [The vendor says so](${url}).`}`,
  });

  it("a section on a gap that links one of its claims stands; one that links none of them, or stands on no gap, is stopped", () => {
    expect(check([section("How do integrations with accounting tools work?", "https://rival.example.net/integrations")])).toBeNull();
    expect(check([section("How do integrations with accounting tools work?", null)])).toBe("new_sections");
    expect(check([section("How do integrations with accounting tools work?", "https://other.example.org/mobile")])).toBe("new_sections");
    expect(check([section("Why does a team need dashboards?", "https://rival.example.net/integrations")])).toBe("new_sections");
  });

  it("a fourth new section is stopped", () => {
    const one = section("How do integrations with accounting tools work?", "https://rival.example.net/integrations");
    const added = ["Accounting tool integrations?", "Which accounting integrations?", "Integrations for accounting?", "Accounting integrations compared?"].map((heading) => ({ ...one, heading }));
    expect(check(added.slice(0, 3))).toBeNull();
    expect(check(added)).toBe("new_sections");
  });

  it("its sections may grow to 40% over the live page's; every other update keeps 20%", () => {
    expect(lengthRangeFor(TEMPLATES.update, { liveWords: 1000, grown: true })).toMatchObject({ floor: 800, ceiling: 1400 });
    expect(lengthRangeFor(TEMPLATES.update, { liveWords: 1000 })).toMatchObject({ floor: 800, ceiling: 1200 });
  });
});
