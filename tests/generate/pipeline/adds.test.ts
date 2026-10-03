// tests/generate/pipeline/adds.test.ts — SPEC §7 (2026-09-29, D12; issue
// 1143): what a page adds is a list of its own sentences, checked in code.
import "../env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AT, fakeCost } from "../fixtures";

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

import { addsEnough, admittedAdds, listAdds, plansNewPage } from "../../../src/lib/generate/pipeline/adds";

const PAGE = [
  "## Which CRM suits a team of five?",
  "",
  "A fixed-price migration is quoted **before** any work starts, so the cost is known on day one.",
  "",
  "> The Starter plan costs €15 per seat a month.",
  "",
  "Most CRMs charge per seat, billed annually. Ask each vendor whether an export is “included” — it often is not.",
].join("\n");
const TOP_RESULT = "Our guide to CRMs. Most CRMs charge per seat, billed annually. Compare plans below.";
const SITE = "Pricing. The Starter plan costs €15 per seat a month. Talk to us.";

beforeEach(() => llmMock.mockReset());

describe("admittedAdds", () => {
  const compared = [TOP_RESULT, SITE];

  it("keeps a sentence of the page, through its Markdown, and drops one the page does not have", () => {
    const kept = admittedAdds(
      [
        { quote: "A fixed-price migration is quoted before any work starts, so the cost is known on day one.", business: true },
        { quote: "Migrations usually take two weeks for a team of five.", business: true },
      ],
      { markdown: PAGE, compared }
    );
    expect(kept).toEqual([
      { claim: "A fixed-price migration is quoted before any work starts, so the cost is known on day one.", business: true },
    ]);
  });

  it("drops a sentence a top result or the customer's own page already has, whatever the model made of it", () => {
    const kept = admittedAdds(
      [
        { quote: "Most CRMs charge per seat, billed annually.", business: false },
        { quote: "The Starter plan costs €15 per seat a month.", business: true },
      ],
      { markdown: PAGE, compared }
    );
    expect(kept).toEqual([]);
  });

  it("reads straightened quotation marks as the page's own, and lists a sentence once", () => {
    const quote = 'Ask each vendor whether an export is "included" - it often is not.';
    const kept = admittedAdds(
      [
        { quote, business: false },
        { quote, business: false },
      ],
      { markdown: PAGE, compared }
    );
    expect(kept).toHaveLength(1);
  });
});

describe("the bar", () => {
  const claim = (business: boolean, n: number) => ({ claim: `Claim number ${n} of the page.`, business });

  it("is three claims, one of them about the business, and a new page's alone", () => {
    expect(addsEnough([claim(true, 1), claim(false, 2), claim(false, 3)])).toBe(true);
    expect(addsEnough([claim(true, 1), claim(false, 2)])).toBe(false);
    expect(addsEnough([claim(false, 1), claim(false, 2), claim(false, 3)])).toBe(false);
    expect(plansNewPage({ family: "write" })).toBe(true);
    expect(plansNewPage({ family: "improve" })).toBe(false);
  });
});

describe("listAdds", () => {
  it("shows the model the top results and the site, and keeps only what the code check admits", async () => {
    llmMock.mockResolvedValueOnce({
      kind: "measured",
      at: AT,
      value: {
        claims: [
          { quote: "A fixed-price migration is quoted before any work starts, so the cost is known on day one.", business: true },
          { quote: "Most CRMs charge per seat, billed annually.", business: false },
        ],
      },
    });
    const listed = await listAdds(fakeCost(), {
      search: "crm for small teams",
      markdown: PAGE,
      topResults: [{ url: "https://rival.example/guide", text: TOP_RESULT }],
      sitePages: [{ url: "https://example.com/pricing", text: SITE }],
    });
    expect(listed.kind === "unmeasured" ? null : listed.value).toHaveLength(1);
    const input = llmMock.mock.calls[0]![1].input;
    expect(input.topResults[0].text).toBe(TOP_RESULT);
    expect(input.site[0].text).toBe(SITE);
    expect(llmMock.mock.calls[0]![1].site).toBe("generate.adds");
  });
});
