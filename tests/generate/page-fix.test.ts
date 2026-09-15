// tests/generate/page-fix.test.ts — SPEC §9, issue #690: the day's page for
// a Fix is the page's own metadata, rewritten — the named fields only, from
// that page, with no body — and the customer's do-not-claim list still holds.
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_ID, fakeCost, memoryStore, opportunity, type MemoryStore } from "./fixtures";

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

const PAGE = "https://example.com/pricing";
const HTML =
  `<html><head><title>Pricing</title><meta name="description" content="Plans."></head>` +
  `<body><h1>Plans for teams</h1><p>Three plans, billed monthly.</p></body></html>`;

let store: MemoryStore;
let generatePageFix: typeof import("../../src/lib/generate/pipeline/page-fix").generatePageFix;
let setGenerateStore: typeof import("../../src/lib/generate/store").setGenerateStore;

function fix(issues: ("page_titles" | "meta_descriptions")[]) {
  return opportunity({
    type: "fix_page",
    family: "fix",
    targetQuery: null,
    targetRef: PAGE,
    evidence: { family: "fix", issues, pageUrl: PAGE },
    acceptance: { form: "issues_cleared", issues, pageUrl: PAGE },
  });
}

const cost = fakeCost({
  recordFetch: (async () => ({
    payload: { url: PAGE, status: 200, html: HTML, bytes: HTML.length, readAt: "2026-09-14T08:00:00.000Z" },
    fresh: false,
    costCents: 0,
  })) as never,
});

function run(issues: ("page_titles" | "meta_descriptions")[], doNotClaim: string[] = []) {
  return generatePageFix(cost, {
    siteId: SITE_ID,
    opportunity: fix(issues),
    scheduledFor: "2026-09-15",
    domain: "example.com",
    doNotClaim,
    voiceText: null,
    otherTitles: ["Pricing"],
  });
}

beforeEach(async () => {
  llmMock.mockReset();
  ({ generatePageFix } = await import("../../src/lib/generate/pipeline/page-fix"));
  ({ setGenerateStore } = await import("../../src/lib/generate/store"));
  store = memoryStore();
  setGenerateStore(store);
});
afterEach(() => setGenerateStore(null));

describe("a page fix", () => {
  it("records only the field it fixes, keeps what the page carried, and writes no body", async () => {
    llmMock.mockResolvedValueOnce({ kind: "measured", value: { title: "Team plans and prices", description: "ignored" }, at: new Date() });

    const outcome = await run(["page_titles"]);

    expect(outcome.ok).toBe(true);
    const [row] = [...store.rows.values()];
    expect(row?.body_md).toBe("");
    expect(row?.title).toBe("Team plans and prices");
    expect(row?.meta).toMatchObject({
      fix: { pageUrl: PAGE, title: "Team plans and prices", description: null, before: { title: "Pricing", description: "Plans." } },
    });
    // The model was shown the page's own words and the other pages' titles.
    const input = llmMock.mock.calls[0]![1].input as Record<string, unknown>;
    expect(input.text).toContain("Three plans, billed monthly.");
    expect(input.otherTitles).toEqual(["Pricing"]);
    expect(store.patches.at(-1)?.patch.hard_rules_passed).toBe(true);
  });

  it("is held when what it wrote says something the customer's do-not-claim list forbids", async () => {
    llmMock.mockResolvedValueOnce({ kind: "measured", value: { title: "The cheapest plans", description: "The cheapest plans." }, at: new Date() });

    const outcome = await run(["page_titles", "meta_descriptions"], ["cheapest"]);

    expect(outcome).toMatchObject({ ok: false, reason: "rules", failed: [{ rule: "do_not_claim" }] });
    expect(store.patches.at(-1)?.patch.hard_rules_passed).toBe(false);
  });
});
