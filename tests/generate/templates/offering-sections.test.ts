// E10 (2026-10-24, #1715): an offering page carries, in the fixed order, only
// the sections its stored facts support. Through `generateDraft` on stored
// packs, the model doubled by one answer that returns every section: what the
// writer is asked for, and what the row stores. 0¢.
import "../env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContextPack } from "../../../src/lib/generate/pipeline/pack";
import { FACTS, GROUNDED, SITE_ID, SOURCE_TEXT, fakeCost, memoryStore, opportunity, siteInputs, type MemoryStore } from "../fixtures";
import { OFFERING_FIXTURES, type OfferingFixture } from "../offering-packs";

const { llmMock, readMeasuredTextMock } = vi.hoisted(() => ({ llmMock: vi.fn(), readMeasuredTextMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: readMeasuredTextMock }));

const { generateDraft } = await import("../../../src/lib/generate/pipeline");
const { setGenerateStore } = await import("../../../src/lib/generate/store");

const ORDER = ["what", "included", "price", "where_when", "how_it_works", "why"];

let store: MemoryStore;

beforeEach(() => {
  llmMock.mockReset();
  readMeasuredTextMock.mockResolvedValue([{ url: GROUNDED.url, text: SOURCE_TEXT, measuredAt: GROUNDED.readAt }]);
  store = memoryStore();
  setGenerateStore(store);
});

afterEach(() => setGenerateStore(null));

interface Written {
  /** The sections the writer was asked for, by key. */
  asked: string[];
  /** Each asked section's task, by key. */
  tasks: Record<string, string>;
  /** How many questions the writer was asked for, at most. */
  faqAsked: number;
  /** The sections the row records, by key, and the questions it stores. */
  sections: string[];
  faq: unknown[];
  bodyMd: string;
}

async function write({ pack, parts }: OfferingFixture): Promise<Written> {
  // The writer's answer, and the same again for a fix call.
  llmMock.mockResolvedValue({ kind: "measured", value: parts, at: GROUNDED.readAt });
  await generateDraft(fakeCost(), {
    siteId: SITE_ID,
    opportunity: opportunity({ targetQuery: pack.target.question }),
    scheduledFor: "2026-10-26",
    site: siteInputs({ domain: pack.business.domain }),
    pack,
    facts: FACTS,
    links: [],
  });
  const input = llmMock.mock.calls[0]![1].input as { template: { sections: { key: string; task: string }[]; blocks: { faq: { max: number } } } };
  const row = [...store.rows.values()][0]!;
  const meta = row.meta as { sections: { key: string }[]; faq: unknown[] };
  return {
    asked: input.template.sections.map((section) => section.key),
    tasks: Object.fromEntries(input.template.sections.map((section) => [section.key, section.task])),
    faqAsked: input.template.blocks.faq.max,
    sections: meta.sections.map((section) => section.key),
    faq: meta.faq,
    bodyMd: row.body_md ?? "",
  };
}

const without = (...keys: string[]): string[] => ORDER.filter((key) => !keys.includes(key));

describe("E10: an offering page draws only the sections its stored facts support, in the fixed order", () => {
  it("(a) a plumber with every fact: the short answer, all six sections in order, and its four questions", async () => {
    const page = await write(OFFERING_FIXTURES["(a) a local plumber with every fact"]);
    expect(page.asked).toEqual(ORDER);
    expect(page.sections).toEqual(ORDER);
    expect(page.bodyMd.trimStart().startsWith(":::answer")).toBe(true);
    expect(page.faq).toHaveLength(4);
  });

  it("(b) a SaaS: no where and when, even where the writer returns one", async () => {
    const page = await write(OFFERING_FIXTURES["(b) a SaaS with no place"]);
    expect(page.asked).toEqual(without("where_when"));
    expect(page.sections).toEqual(without("where_when"));
  });

  it("(c) no differentiator or promise: no why", async () => {
    const page = await write(OFFERING_FIXTURES["(c) a plumber with no differentiator or promise"]);
    expect(page.asked).toEqual(without("why"));
    expect(page.sections).toEqual(without("why"));
  });

  it("(d) fewer than three steps: no how it works", async () => {
    const page = await write(OFFERING_FIXTURES["(d) a plumber whose facts give two steps"]);
    expect(page.sections).toEqual(without("how_it_works"));
    expect(page.bodyMd).not.toMatch(/^\d+\. /m);
  });

  it("(e) fewer than three questions buyers asked: no question is asked for or stored", async () => {
    const page = await write(OFFERING_FIXTURES["(e) a plumber with two questions buyers asked"]);
    expect(page.faqAsked).toBe(0);
    expect(page.faq).toEqual([]);
  });

  it("a place only the founder gave is no place the business's own pages state", async () => {
    expect((await write(OFFERING_FIXTURES["a plumber whose one place only the founder gave"])).sections).toEqual(without("where_when"));
  });

  it("where and when asks for the places only, never hours, days or times no stored fact traces", async () => {
    const task = (await write(OFFERING_FIXTURES["(a) a local plumber with every fact"])).tasks.where_when!;
    expect(task).toContain("profile.knowledge.places");
    expect(task.match(/\b(hours?|days?|times?|when|open(ing)? (hours|times))\b/gi)).toBeNull();
  });

  it("hours the pages state, with no place, open no where and when", async () => {
    const page = await write(OFFERING_FIXTURES["a plumber whose pages state its hours but no place"]);
    expect(page.asked).toEqual(without("where_when"));
    expect(page.sections).toEqual(without("where_when"));
  });

  it("one inclusion is no list of what is included", async () => {
    expect((await write(OFFERING_FIXTURES["a plumber whose offering lists one inclusion"])).sections).toEqual(without("included"));
  });

  /** The fact each conditional section is written from, read off the stored pack. */
  const SOURCE: Record<string, (pack: ContextPack, bodyMd: string) => boolean> = {
    included: (pack) => new Set(pack.profile?.knowledge?.offerings.flatMap((offering) => offering.features)).size >= 2,
    where_when: (pack) => (pack.profile?.knowledge?.places ?? []).some((place) => place.from !== "founder"),
    how_it_works: (_pack, bodyMd) => (bodyMd.match(/^\d+\. /gm) ?? []).length >= 3,
    why: (pack) => (pack.profile?.knowledge?.differentiators.length ?? 0) + (pack.profile?.promises.length ?? 0) > 0,
  };

  it.each(Object.entries(OFFERING_FIXTURES))("(g) %s: no section without its source fact, and no question without three asked", async (_name, fixture) => {
    const page = await write(fixture);
    for (const key of page.sections) expect([key, SOURCE[key]?.(fixture.pack, page.bodyMd) ?? true]).toEqual([key, true]);
    if (page.faq.length > 0) expect(fixture.pack.questions.length).toBeGreaterThanOrEqual(3);
    // In the fixed order, whatever is left.
    expect(page.sections).toEqual(ORDER.filter((key) => page.sections.includes(key)));
  });
});
