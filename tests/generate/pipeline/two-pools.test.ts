// tests/generate/pipeline/two-pools.test.ts — SPEC §7 (2026-09-29, *Two
// pools of facts*; issue 1135).
//
// What a founder and a reader can observe: a page that compares products
// names real ones and cites the product's own page for what it says; a
// number that a cited page states does not stop the page; a quotation is
// somebody's actual words; the page ends with the list of what it cited; and
// a comparison table has no "not stated" in it.
import "../env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AT, SITE_ID } from "../fixtures";
import type { StoredReport } from "../../../src/lib/scan/report";
import type { CostContext } from "../../../src/lib/costs";

const { llmMock, safeFetchMock, serpMock } = vi.hoisted(() => ({
  llmMock: vi.fn(),
  safeFetchMock: vi.fn(),
  serpMock: vi.fn(),
}));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
vi.mock("@/lib/egress", () => ({ safeFetch: safeFetchMock }));
vi.mock("@/lib/vendors/dataforseo", () => ({ serpOrganic: serpMock }));

import { admittedClaims, linkedPage, researchMarket } from "../../../src/lib/generate/pipeline/research";
import { repairMechanical } from "../../../src/lib/generate/pipeline/repair";
import { completeTables, withSources } from "../../../src/lib/generate/pipeline/sources";
import { checkTraceableNumerals } from "../../../src/lib/generate/rules/brief";
import { checkUnsourcedTestimonial } from "../../../src/lib/generate/rules/people";
import { checkRivalSource } from "../../../src/lib/generate/rules/rivals";
import { withoutReferenceLists } from "../../../src/lib/generate/rules/text";

const TODAY = new Date("2026-10-03T08:00:00.000Z");
const measured = <T>(value: T) => ({ kind: "measured" as const, value, at: AT });
const filler = "This page explains how the product is priced and what each plan includes for a team. ".repeat(8);

const PRICING = "The Standard plan costs $24 per user per month and includes 250 automation runs.";
const LISTICLE = "Most small teams outgrow a free plan within a year of adopting a project tool.";
const html = (title: string, body: string) => `<html><head><title>${title}</title></head><body><main><p>${filler}</p><p>${body}</p></main></body></html>`;

/** Each read is ledgered free and served as read. */
function cost(): CostContext & { reads: string[] } {
  const reads: string[] = [];
  return {
    cap: "DRAFT",
    reads,
    async recordFetch<P>(call: { cacheKey: string; costCents: number; run: () => Promise<P> }) {
      reads.push(`${call.cacheKey} ${call.costCents}`);
      return { payload: await call.run(), fresh: true, costCents: call.costCents, storedAt: null };
    },
    capHit: () => false,
    spentCents: () => 0,
    degraded: () => false,
  } as CostContext & { reads: string[] };
}

const REPORT = {
  questions: measured([{ search: { keyword: "best project management software" } }]),
  serps: [
    measured({
      organic: [
        { position: 1, domain: "example.com", url: "https://example.com/blog/best", title: "Ours" },
        { position: 2, domain: "listicle.example", url: "https://listicle.example/best-pm-tools", title: "Best tools" },
      ],
    }),
  ],
} as unknown as StoredReport;

function answer(url: string, body: string, title = "A page") {
  return { ok: true, status: 200, url, html: html(title, body), bytes: 1, readAt: TODAY, headers: {} };
}

beforeEach(() => {
  llmMock.mockReset();
  safeFetchMock.mockReset();
  serpMock.mockReset();
  serpMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
});

describe("the research step reads the market's pages and keeps only what they say", () => {
  it("reads the top result and the rival's own pricing page, found through its home page when /pricing does not answer", async () => {
    safeFetchMock.mockImplementation(async (url: string) => {
      if (url === "https://listicle.example/best-pm-tools") return answer(url, LISTICLE, "Best PM tools");
      if (url === "https://rival.example/") {
        return { ...answer(url, "Welcome."), html: html("Rival", `<a href="/plans-and-pricing">Pricing</a>`) };
      }
      if (url === "https://rival.example/plans-and-pricing") return answer(url, PRICING, "Pricing — Rival");
      return { ok: false, reason: "status", status: 404, url, readAt: TODAY };
    });
    llmMock.mockResolvedValue(
      measured({
        claims: [
          { page: 1, quote: LISTICLE, year: null },
          { page: 2, quote: PRICING, year: null },
          { page: 2, quote: "The Standard plan costs $19 per user per month.", year: null },
        ],
      })
    );
    const c = cost();
    const found = await researchMarket(c, {
      siteId: SITE_ID,
      domain: "example.com",
      searches: ["best project management software"],
      report: REPORT,
      rivals: ["rival.example", "Northwind"],
      today: TODAY,
    });

    // The customer's own result is not market research, and the price the
    // model altered is not on the page, so neither is a fact.
    expect(found.facts.map((fact) => [fact.url, fact.passage])).toEqual([
      ["https://listicle.example/best-pm-tools", LISTICLE],
      ["https://rival.example/plans-and-pricing", PRICING],
    ]);
    expect(found.facts[1]).toMatchObject({ kind: "rival_pricing", product: "rival.example", title: "Pricing — Rival", readAt: TODAY });
    expect(found.products).toEqual([{ domain: "rival.example", pages: ["https://rival.example/plans-and-pricing"] }]);
    // Each page read is in the ledger, at no cost.
    expect(c.reads).toEqual(["https://listicle.example/best-pm-tools 0", "https://rival.example/plans-and-pricing 0"]);
  });

  it("a site whose market cannot be read is still written — research yields nothing and asks no model", async () => {
    safeFetchMock.mockResolvedValue({ ok: false, reason: "timeout", url: "x", readAt: TODAY });
    const found = await researchMarket(cost(), {
      siteId: SITE_ID,
      domain: "example.com",
      searches: ["best project management software"],
      report: REPORT,
      rivals: ["rival.example"],
      today: TODAY,
    });
    expect(found).toEqual({ facts: [], products: [], topResults: [] });
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("drops a statistic older than three years and keeps a dated claim that is not one", () => {
    const text = "In 2021, 41% of teams used a project tool. The company was founded in 2015 in Berlin by two engineers.";
    const page = { url: "https://study.example/r", title: "Study", text, readAt: TODAY.toISOString(), kind: "study" as const };
    const kept = admittedClaims(
      [
        { page: 1, quote: "In 2021, 41% of teams used a project tool.", year: null },
        { page: 1, quote: "The company was founded in 2015 in Berlin by two engineers.", year: null },
      ],
      [page],
      TODAY
    );
    expect(kept.map((fact) => fact.passage)).toEqual(["The company was founded in 2015 in Berlin by two engineers."]);
  });

  it("finds a rival's pricing page by its link, on the rival's own site only", () => {
    const home = `<a href="https://elsewhere.example/pricing">Pricing guide</a><a href="/plans">See plans</a>`;
    expect(linkedPage(home, "https://rival.example/", "rival_pricing")).toBe("https://rival.example/plans");
  });
});

describe("the rules follow the pools", () => {
  const brief = {
    facts: ["Teams on the starter plan get 25 seats and unlimited projects for a flat monthly fee."],
    headings: [],
    queries: ["best project management software"],
    marketFacts: [{ url: "https://rival.example/pricing", passage: PRICING }],
  };

  it("a number a market fact states, and a year, do not stop the page; a number no fact holds does", () => {
    const traced = "Rival's Standard plan includes 250 automation runs. The plan changed in 2024.";
    expect(checkTraceableNumerals({ markdown: traced, brief })).toBeNull();
    expect(checkTraceableNumerals({ markdown: "Most teams save 37 hours a month.", brief })?.rule).toBe("traceable_numerals");
  });

  it("a rival's figure passes beside the page it was read from, and not beside any other link", () => {
    const rivals = ["rival.example"];
    const factPages = ["https://rival.example/pricing"];
    const cited = "Rival charges [$24 per user](https://www.rival.example/pricing/) a month.";
    const elsewhere = "Rival charges [$24 per user](https://blog.example/rival-review) a month.";
    expect(checkRivalSource({ markdown: cited, rivals, factPages })).toBeNull();
    expect(checkRivalSource({ markdown: elsewhere, rivals, factPages })?.rule).toBe("rival_source");
  });

  it("a block quote passes word for word from a cited source, and fails when the words are not the source's", () => {
    const quotable = [PRICING];
    const exact = `> ${PRICING} — [Rival pricing](https://rival.example/pricing)`;
    const altered = `> The Standard plan is the best value on the market today. — [Rival pricing](https://rival.example/pricing)`;
    expect(checkUnsourcedTestimonial({ markdown: exact, quotable })).toBeNull();
    expect(checkUnsourcedTestimonial({ markdown: altered, quotable })?.rule).toBe("no_unsourced_testimonial");
  });

  it("the word review alone is not a testimonial", () => {
    expect(checkUnsourcedTestimonial({ markdown: "This is a review of the options a small team has." })).toBeNull();
  });
});

describe("the page ends with what it cited, and a table has no empty cell", () => {
  const sources = [
    { url: "https://rival.example/pricing", title: "Pricing — Rival", readAt: TODAY },
    { url: "https://study.example/report", title: "A study nobody cited", readAt: TODAY },
  ];

  it("lists each market page the body links, once, with the date it was read — and only those", () => {
    const body = "Rival's Standard plan costs [$24 per user](https://rival.example/pricing) a month.\n";
    const page = withSources(body, sources);
    expect(page.endsWith("## Sources\n\n- [Pricing — Rival](https://rival.example/pricing), read on 3 October 2026\n")).toBe(true);
    expect(page).not.toContain("study.example");
    // Run again after a repair, it is the same page.
    expect(withSources(page, sources)).toBe(page);
    // A body that cites no market page gets no list.
    expect(withSources("Nothing cited here.\n", sources)).toBe("Nothing cited here.\n");
  });

  it("a cited page's title in the sources list is not the page's own claim", () => {
    const body = [
      "Rival's Standard plan costs [$24 per user](https://rival.example/pricing) a month.",
      "",
      "## Sources",
      "",
      "- [We tested 15 best tools. Here is our favourite](https://rival.example/pricing), read on 3 October 2026",
    ].join("\n");
    const read = withoutReferenceLists(body);
    expect(read).toHaveLength(body.length);
    expect(read).not.toContain("We tested");
    expect(read).toContain("Rival's Standard plan costs");
    // A section that says something of its own is still read.
    const prose = "## Sources\n\nWe tested 15 tools ourselves.";
    expect(withoutReferenceLists(prose)).toBe(prose);
  });

  it("drops a product nothing is known about, then any column still missing a value", () => {
    const table = [
      "| Product | Price | Free plan | Support |",
      "| --- | --- | --- | --- |",
      "| Acme | $12 | Yes | Email |",
      "| Rival | $24 | Not stated in the fact read | Chat |",
      "| Ghost | Not stated | — | N/A |",
    ].join("\n");
    expect(completeTables(table).split("\n")).toEqual([
      "| Product | Price | Support |",
      "| --- | --- | --- |",
      "| Acme | $12 | Email |",
      "| Rival | $24 | Chat |",
    ]);
  });

  it("a table with its products across the top loses what is not known, whichever way it runs", () => {
    const head = ["| Feature | Semrush | Surfer | Athena | Acme |", "| --- | --- | --- | --- | --- |"];
    const bestFor = "| Best for | Analysis | Content | Tracking | Daily pages |";
    // Two products state no price: they go, and the prices stay.
    const two = [...head, bestFor, "| Pricing | Varies by plan. | Varies by plan. | $295/month | $49 a month |"].join("\n");
    expect(completeTables(two).split("\n")).toEqual([
      "| Feature | Athena | Acme |",
      "| --- | --- | --- |",
      "| Best for | Tracking | Daily pages |",
      "| Pricing | $295/month | $49 a month |",
    ]);
    // Most products state no price: the criterion goes, and the products stay.
    const three = [...head, bestFor, "| Pricing | Varies by plan. | Not stated | n/a | $49 a month |"].join("\n");
    expect(completeTables(three).split("\n")).toEqual([...head, bestFor]);
  });

  // Round 2 (issue 1250): the owner's "not stated" came back in new words.
  it("takes out a criterion whose cells only say that nothing was read, and keeps a cell that states a no", () => {
    const table = [
      "| Criterion | Acme | Semrush One | Rankability | Frase |",
      "| --- | --- | --- | --- | --- |",
      "| Price | [€49 a month](https://acme.example/pricing) | not linked to a stated figure | Not carried by a linked market fact here | No public pricing |",
      "| Free plan | No free plan | Not included | No | Unknown |",
    ].join("\n");
    expect(completeTables(table).split("\n")).toEqual([
      "| Criterion | Acme | Semrush One | Rankability |",
      "| --- | --- | --- | --- |",
      "| Free plan | No free plan | Not included | No |",
    ]);
  });

  it("a rival's price left without its page is linked in code to the fact's page that states it", () => {
    const markdown = "| Rival | The Standard plan costs $24 per user per month. |";
    const repaired = repairMechanical(markdown, ["rival_source"], {
      brief: { facts: [], headings: [], queries: [] },
      sources: [{ url: "https://rival.example/pricing", text: PRICING }],
      rivals: ["rival.example"],
    });
    expect(repaired).toBe("| Rival | The Standard plan costs [$24](https://rival.example/pricing) per user per month. |");
    expect(checkRivalSource({ markdown: repaired, rivals: ["rival.example"], factPages: ["https://rival.example/pricing"] })).toBeNull();
  });

  it("drops a price column that mixes currencies unless the page states the conversion", () => {
    const table = ["| Product | Price | Seats |", "| --- | --- | --- |", "| Acme | €49 | 5 |", "| Rival | $24 | 10 |"].join("\n");
    expect(completeTables(table)).not.toContain("Price");
    const stated = `${table}\n\nPrices converted at 1 EUR = 1.08 USD on 3 October 2026.`;
    expect(completeTables(stated)).toContain("| Acme | €49 | 5 |");
  });
});
