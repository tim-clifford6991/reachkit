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
vi.mock("@/lib/opportunities", () => ({ nextForDay: nextForDayMock }));
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
