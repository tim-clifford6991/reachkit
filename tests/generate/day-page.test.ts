// tests/generate/day-page.test.ts — BUILD §8's timing and its one
// automatic regeneration, at the engine's public entry point.
//
// §8: "the day's page is generated the evening before its publish date from
// the freshest scan. `CAP_DRAFT` enforced before the pipeline runs."
// ADR-070: "one automatic regeneration; a draft that has entered review is
// never regenerated."
//
// §7's supply rule is the other half: `nextForDay` answering `null` is a
// day with no page, never an invented one.
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAPS } from "../../src/lib/config/constants";
import {
  AT,
  CLEAN_MARKDOWN,
  GROUNDED,
  SCAN_ID,
  SITE_ID,
  SOURCE_TEXT,
  memoryStore,
  opportunity,
  type MemoryStore,
} from "./fixtures";

const { llmMock, readMeasuredTextMock, nextForDayMock, withCostContextMock } = vi.hoisted(() => ({
  llmMock: vi.fn(),
  readMeasuredTextMock: vi.fn(),
  nextForDayMock: vi.fn(),
  withCostContextMock: vi.fn(),
}));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: readMeasuredTextMock }));
vi.mock("@/lib/opportunities", () => ({
  nextForDay: nextForDayMock,
  assessFixPages: async () => ({ done: 0, ready: 0 }),
}));
vi.mock("@/lib/costs", () => ({ withCostContext: withCostContextMock }));

let generateDayPage: typeof import("../../src/lib/generate").generateDayPage;
let setGenerateStore: typeof import("../../src/lib/generate/store").setGenerateStore;
let store: MemoryStore;

/** Every context this suite opens, so the cap and the roll-up choice can be
 *  asserted rather than assumed. */
const opened: Array<{ scanId: string; cap: string; rollUp?: string }> = [];

const BRIEF = { readerQuestion: "Which tool?", angle: "count seats", mustCover: ["seats"] };
const OUTLINE = { sections: [{ heading: "Seats", covers: "how many" }] };

function measured(value: unknown) {
  return { kind: "measured", value, at: AT };
}

function body(markdown: string) {
  return { title: "A title", slug: "a-title", description: "A description.", bodyMarkdown: markdown };
}

/** One pass of the four model steps plus the claim check. */
function queueAttempt(markdown: string): void {
  llmMock.mockResolvedValueOnce(measured(BRIEF));
  llmMock.mockResolvedValueOnce(measured(OUTLINE));
  llmMock.mockResolvedValueOnce(measured(body(markdown)));
  llmMock.mockResolvedValueOnce(measured(body(markdown)));
  llmMock.mockResolvedValueOnce(measured({ matches: false, matchedIndex: null }));
}

beforeEach(async () => {
  llmMock.mockReset();
  readMeasuredTextMock.mockReset();
  nextForDayMock.mockReset();
  withCostContextMock.mockReset();
  opened.length = 0;

  readMeasuredTextMock.mockResolvedValue([
    { url: GROUNDED.url, text: SOURCE_TEXT, measuredAt: GROUNDED.readAt },
  ]);
  nextForDayMock.mockResolvedValue(opportunity());
  withCostContextMock.mockImplementation(
    async (ctx: { scanId: string; cap: string; rollUp?: string }, run: (c: unknown) => Promise<unknown>) => {
      opened.push(ctx);
      return run({
        cap: ctx.cap,
        recordFetch: () => {
          throw new Error("the generation engine must reach a model through llm()");
        },
        capHit: () => false,
        spentCents: () => 0,
        degraded: () => false,
      });
    }
  );

  ({ generateDayPage } = await import("../../src/lib/generate"));
  ({ setGenerateStore } = await import("../../src/lib/generate/store"));
  store = memoryStore();
  setGenerateStore(store);
});

afterEach(() => {
  setGenerateStore(null);
});

describe("§8 — CAP_DRAFT, on the scan the day's page is generated from", () => {
  it("opens one context, under CAP_DRAFT, keyed to the freshest scan", async () => {
    queueAttempt(CLEAN_MARKDOWN);
    await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({ cap: "DRAFT", scanId: SCAN_ID });
  });

  it("does not roll the draft's spend into the scan's total — the draft's cost is the draft's", async () => {
    queueAttempt(CLEAN_MARKDOWN);
    await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(opened[0]?.rollUp).toBe("none");
  });

  it("CAP_DRAFT is §8's 45¢", () => {
    expect(CAPS.DRAFT_C).toBe(45);
  });
});

describe("§8 — the day's page is for the day after the evening it is generated", () => {
  it("the publish date the caller passes is the date the row is scheduled for", async () => {
    queueAttempt(CLEAN_MARKDOWN);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome.ok).toBe(true);
    const row = outcome.ok ? store.rows.get(outcome.draftId) : undefined;
    expect(row?.scheduled_for).toBe("2026-09-07");
  });
});

describe("ADR-070 — one automatic regeneration, and no more", () => {
  it("a first attempt stopped by a rule is regenerated once", async () => {
    queueAttempt("Example wins everything, and always has.");
    queueAttempt(CLEAN_MARKDOWN);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome.ok).toBe(true);
    expect(store.rows.size).toBe(2);
  });

  it("a second attempt stopped again comes to rest — never a third", async () => {
    queueAttempt("Example wins everything, and always has.");
    queueAttempt("Example wins everything, again, and always.");
    queueAttempt(CLEAN_MARKDOWN);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome).toMatchObject({ ok: false, because: "rules" });
    expect(store.rows.size).toBe(2);
  });

  it("a step that did not run consumes no attempt: it stops at once", async () => {
    llmMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome).toMatchObject({ ok: false, because: "step_failed", step: "brief" });
    expect(store.rows.size).toBe(0);
  });
});

describe("§7 — supply is the cap: the calendar is never padded", () => {
  it("no opportunity is a day with no page, and nothing is written", async () => {
    nextForDayMock.mockResolvedValue(null);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome).toEqual({ ok: false, because: "no_opportunity" });
    expect(store.rows.size).toBe(0);
    expect(opened).toHaveLength(0);
  });

  it("a site with no stored report has no measured page to ground on, and spends nothing finding out", async () => {
    store.storedReport = null;
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome).toEqual({ ok: false, because: "no_scan" });
    expect(opened).toHaveLength(0);
  });

  it("a site the store does not hold is not a site", async () => {
    store.site = null;
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome).toEqual({ ok: false, because: "no_site" });
  });
});

describe("§7 (2026-09-12) — the page links into the customer's own site and to its cluster", () => {
  const INVENTORY = [
    { url: "https://example.com/", title: "Acme", h1: "Acme", purpose: "other" as const },
    { url: "https://example.com/pricing", title: "Pricing", h1: "Plans for every team", purpose: "pricing" as const },
    { url: "https://example.com/about", title: "About", h1: "Who we are", purpose: "about" as const },
    { url: "https://example.com/features", title: "Features", h1: "Everything in one place", purpose: "features" as const },
    { url: "https://example.com/products/boards", title: "Boards", h1: "Project boards", purpose: "product" as const },
  ];
  const FIRST = {
    liveUrl: "https://content.example.com/how-many-seats",
    title: "How many seats does a team need?",
    publishedAt: AT,
  };

  async function publishedHtml(): Promise<string> {
    const { renderMarkdownHtml } = await import("../../src/lib/publish/render/markdown");
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome.ok).toBe(true);
    const row = outcome.ok ? store.rows.get(outcome.draftId) : undefined;
    return renderMarkdownHtml(row?.body_md ?? "");
  }

  it("the second page of a cluster links the inventory's real pages and the first page", async () => {
    store.inventory = INVENTORY;
    store.cluster.set("seats", [FIRST]);
    nextForDayMock.mockResolvedValue(opportunity({ clusterKey: "seats" }));
    queueAttempt(CLEAN_MARKDOWN);

    const html = await publishedHtml();
    for (const url of [
      "https://example.com/pricing",
      "https://example.com/about",
      "https://example.com/features",
      "https://example.com/products/boards",
      FIRST.liveUrl,
    ]) {
      expect(html).toContain(`href="${url}"`);
    }
    expect(html).not.toContain('href="https://example.com/"');
  });

  it("the prompt is told the same pages the stored body links", async () => {
    store.inventory = INVENTORY;
    queueAttempt(CLEAN_MARKDOWN);
    await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    const input = llmMock.mock.calls[2]?.[1].input as { links: Array<{ url: string }> };
    expect(input.links.map((link) => link.url)).toContain("https://example.com/pricing");
  });

  it("a site with no pricing page publishes with no pricing link, even where the model wrote one", async () => {
    store.inventory = INVENTORY.filter((row) => row.purpose !== "pricing");
    queueAttempt(`${CLEAN_MARKDOWN}\n\nCompare [the plans](https://example.com/plans).`);

    const html = await publishedHtml();
    // The grounded source is the one page the fixture's fact was read from,
    // and it stays sourced; no other pricing-shaped address is written.
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((href) => href !== GROUNDED.url);
    expect(hrefs.filter((href) => /pric|plans/.test(href ?? ""))).toEqual([]);
    expect(html).toContain('href="https://example.com/about"');
  });

  it("an opportunity outside any cluster, on a site with no profile, links nothing new", async () => {
    queueAttempt(CLEAN_MARKDOWN);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    const row = outcome.ok ? store.rows.get(outcome.draftId) : undefined;
    expect(row?.body_md).toBe(CLEAN_MARKDOWN);
  });
});
