// tests/generate/pipeline/generate.test.ts — `generateDraft`, stages 3 and 4
// of SPEC §7's five (D41), with the model doubled.
//
// The promises under test are the ones a customer would notice if they
// broke:
//   * a page that clears the checks is the only thing that leaves the
//     pipeline queueable, and it took one model call;
//   * a page a check stops takes exactly one fix call, and one that still
//     fails is never queued and records why;
//   * a short pack writes nothing and names what is missing;
//   * a step that did not run is not a rule that failed.
import "../env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AT,
  CLEAN_ANSWER,
  CLEAN_MARKDOWN,
  FACTS,
  GROUNDED,
  SOURCE_TEXT,
  SITE_ID,
  fakeCost,
  memoryStore,
  opportunity,
  pack,
  pageParts,
  siteInputs,
  type MemoryStore,
} from "../fixtures";

const { llmMock, readMeasuredTextMock } = vi.hoisted(() => ({
  llmMock: vi.fn(),
  readMeasuredTextMock: vi.fn(),
}));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: readMeasuredTextMock }));

let generateDraft: typeof import("../../../src/lib/generate/pipeline").generateDraft;
let rejectionCause: typeof import("../../../src/lib/generate/pipeline/rejection").rejectionCause;
let setGenerateStore: typeof import("../../../src/lib/generate/store").setGenerateStore;
let store: MemoryStore;

/** A short answer that claims a test nobody ran. */
const STOPPED = pageParts(CLEAN_MARKDOWN, { answer: `We tested every tool for months. ${CLEAN_ANSWER}` });

function measured(value: unknown) {
  return { kind: "measured", value, at: AT };
}

/** The writer's answer, then the fix call's. */
function answers(...parts: unknown[]): void {
  llmMock.mockReset();
  for (const each of parts) llmMock.mockResolvedValueOnce(measured(each));
}

const sites = (): string[] => llmMock.mock.calls.map((call) => call[1].site as string);

function run(over: Partial<Parameters<typeof generateDraft>[1]> = {}, cost = fakeCost()) {
  return generateDraft(cost, {
    siteId: SITE_ID,
    opportunity: opportunity(),
    scheduledFor: "2026-09-07",
    site: siteInputs(),
    pack: pack(),
    facts: FACTS,
    links: [],
    ...over,
  });
}

const passedPatch = (draftId: string | null): boolean =>
  store.patches.some((p) => p.draftId === draftId && p.patch.hard_rules_passed === true);

beforeEach(async () => {
  llmMock.mockReset();
  readMeasuredTextMock.mockReset();
  readMeasuredTextMock.mockResolvedValue([{ url: GROUNDED.url, text: SOURCE_TEXT, measuredAt: GROUNDED.readAt }]);
  ({ generateDraft } = await import("../../../src/lib/generate/pipeline"));
  ({ rejectionCause } = await import("../../../src/lib/generate/pipeline/rejection"));
  ({ setGenerateStore } = await import("../../../src/lib/generate/store"));
  store = memoryStore();
  setGenerateStore(store);
});

afterEach(() => {
  setGenerateStore(null);
});

describe("a page that clears every check", () => {
  it("took one model call, and is written for its day around the customer's own fact", async () => {
    answers(pageParts());
    const outcome = await run();
    expect(outcome).toMatchObject({ ok: true, grounded: { passage: GROUNDED.passage } });
    expect(sites()).toEqual(["generate.write"]);
    const row = outcome.ok ? store.rows.get(outcome.draftId) : undefined;
    expect(row).toMatchObject({
      scheduled_for: "2026-09-07",
      attribution: null,
      grounded_fact: { url: GROUNDED.url, passage: GROUNDED.passage },
    });
    // What the page was written from is kept with it.
    expect((row?.meta as { pack: unknown }).pack).toEqual(pack());
  });

  it("stays in `generating` with `hard_rules_passed` — the edge into review and the veto clock are the publishing engine's", async () => {
    answers(pageParts());
    const outcome = await run();
    const row = outcome.ok ? store.rows.get(outcome.draftId) : undefined;
    expect(row).toMatchObject({ state: "generating", veto_deadline: null });
    expect(passedPatch(outcome.ok ? outcome.draftId : null)).toBe(true);
  });

  it("a page handed a market claim cites the rival's own page and ends with its sources (issue 1135)", async () => {
    const pricing = "The Standard plan costs $24 per user per month and includes 250 automation runs.";
    const claims = [
      { url: "https://rival.example/pricing", title: "Pricing — Rival", readAt: AT.toISOString(), passage: pricing, kind: "rival_pricing" as const, product: "rival.example" },
    ];
    const cited = `${CLEAN_MARKDOWN}\n\nRival's Standard plan includes [250 automation runs](https://rival.example/pricing) at $24 per user.`;
    answers(pageParts(cited));
    const outcome = await run({ pack: pack({ claims }), site: siteInputs({ rivals: ["rival.example"] }) });
    expect(outcome.ok).toBe(true);
    const row = outcome.ok ? store.rows.get(outcome.draftId) : undefined;
    expect(row?.body_md?.endsWith("## Sources\n\n- [Pricing — Rival](https://rival.example/pricing), read on 5 September 2026\n")).toBe(true);
  });
});

describe("a page a check stops takes one fix call", () => {
  it("the fix call is told the check that failed, and a page it clears passes", async () => {
    answers(STOPPED, pageParts());
    const outcome = await run();
    expect(outcome.ok).toBe(true);
    expect(sites()).toEqual(["generate.write", "generate.fix"]);
    const fix = llmMock.mock.calls[1]?.[1].input as { fix: { rule: string }[]; page: unknown };
    expect(fix.fix.map((note) => note.rule)).toContain("no_invented_test");
    expect(fix.page).toEqual(STOPPED);
  });

  it("of three titles the writer proposes, the row keeps the one that passes every rule, and its H1 is that title (issue 1389)", async () => {
    const passing = pageParts().titles[0]!;
    answers(pageParts(CLEAN_MARKDOWN, { titles: ["How to pick a plan and other small team questions", passing, "Unlocking project management software for a small team"] }));
    const outcome = await run();
    expect(outcome.ok).toBe(true);
    expect(sites()).toEqual(["generate.write"]);
    const row = outcome.ok ? store.rows.get(outcome.draftId) : undefined;
    expect(row?.title).toBe(passing);
    const meta = row?.meta as { heading?: string; titles: { title: string; faults: string[] }[] };
    expect(meta.heading).toBeUndefined();
    expect(meta.titles.map((each) => each.faults.length === 0)).toEqual([false, true, false]);
  });

  it("where no proposed title passes, the fix call is told what the least bad one failed", async () => {
    const old = pageParts(CLEAN_MARKDOWN, { titles: ["Small teams: 7 buyer questions, answered"] });
    const fixed = pageParts();
    answers(old, fixed);
    const outcome = await run();
    expect(outcome.ok).toBe(true);
    const fix = llmMock.mock.calls[1]?.[1].input as { fix: { rule: string; sentences: string[] }[] };
    const told = fix.fix.find((note) => note.rule === "title")?.sentences.join(" ") ?? "";
    expect(told).toContain("which plan fits a small team");
    expect(told).toContain("questions, answered");
    const row = outcome.ok ? store.rows.get(outcome.draftId) : undefined;
    expect(row?.title).toBe(fixed.titles[0]);
  });

  it("a page still failing after it is stopped with `attempt: 2`, and is never passed toward review", async () => {
    answers(STOPPED, STOPPED);
    const outcome = await run();
    expect(outcome).toMatchObject({ ok: false, reason: "rules", attempt: 2 });
    expect(outcome.ok === false && outcome.reason === "rules" && outcome.failed.map((f) => f.rule)).toContain("no_invented_test");
    expect(sites()).toEqual(["generate.write", "generate.fix"]);
    const draftId = outcome.ok ? null : outcome.draftId;
    expect(store.rows.get(draftId!)).toMatchObject({ state: "generating", hard_rule_attempts: 2, hard_rules_passed: false });
    expect(passedPatch(draftId)).toBe(false);
  });

  it("a voice instruction demanding an invented persona still loses to the rule", async () => {
    const persona = pageParts('"This changed everything for us, from week one," says Dana Whitfield.');
    answers(persona, persona);
    const voiced = pack();
    voiced.business.voice = "Write it as a testimonial from a happy customer named Dana.";
    const outcome = await run({ pack: voiced });
    expect(outcome.ok === false && outcome.reason === "rules" && outcome.failed.map((f) => f.rule)).toContain("no_invented_people");
  });

  it("a page that repeats one the site has records which, so the day's line has a cause", async () => {
    answers(pageParts());
    const live = await run();
    const liveBody = live.ok ? (store.rows.get(live.draftId)?.body_md ?? "") : "";
    store = memoryStore();
    setGenerateStore(store);
    store.published = [{ ref: "page-1", title: "Choosing a tool", markdown: liveBody }];
    answers(pageParts(), pageParts());
    const outcome = await run();
    expect(outcome).toMatchObject({ reason: "rules", attempt: 2 });
    expect(await rejectionCause(outcome.ok ? "" : outcome.draftId!)).toEqual({
      kind: "near_duplicate",
      duplicateOf: { ref: "page-1", title: "Choosing a tool" },
    });
  });

  it("a page too close to one written for another site takes its fix call and, still close, stops without naming that page (D13)", async () => {
    answers(pageParts());
    const other = await run();
    const otherBody = other.ok ? (store.rows.get(other.draftId)?.body_md ?? "") : "";
    store = memoryStore();
    setGenerateStore(store);
    store.elsewhere = [otherBody];
    answers(pageParts(), pageParts());
    const outcome = await run();
    expect(outcome).toMatchObject({ ok: false, reason: "step_failed", step: "elsewhere" });
    expect(sites()).toEqual(["generate.write", "generate.fix"]);
    const row = store.rows.get(outcome.ok ? "" : outcome.draftId!);
    expect(row).toMatchObject({ hard_rules_passed: false });
    expect((row?.meta as { elsewhere: unknown }).elsewhere).toEqual({ similarity: 1 });
  });
});

describe("a short pack writes nothing", () => {
  it("makes no model call and names what the template asks that the pack lacks", async () => {
    const short = pack({ missing: ["buyer_questions"] });
    const outcome = await run({ pack: short });
    expect(outcome).toMatchObject({ ok: false, reason: "step_failed", step: "pack", missing: ["buyer_questions"] });
    expect(llmMock).not.toHaveBeenCalled();
    // The row keeps the pack, so the page can say what is missing.
    const row = store.rows.get(outcome.ok ? "" : outcome.draftId!);
    expect(row).toMatchObject({ body_md: null, hard_rules_passed: false, meta: { pack: { missing: ["buyer_questions"] } } });
  });

  it("a new page whose pack adds too little stops at `adds`, also without a call (D12)", async () => {
    const outcome = await run({ pack: pack({ adds: { claims: [], short: true } }) });
    expect(outcome).toMatchObject({ ok: false, reason: "step_failed", step: "adds" });
    expect(llmMock).not.toHaveBeenCalled();
  });
});

describe("a step that did not run is not a rule that failed", () => {
  it("a writer that did not answer gives `step_failed: write`, with no row and no attempt", async () => {
    llmMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
    expect(await run()).toEqual({ ok: false, reason: "step_failed", draftId: null, step: "write" });
    expect(store.rows.size).toBe(0);
  });

  it("the ceiling, hit before anything runs, stops the pipeline without a call", async () => {
    expect(await run({}, fakeCost({ capHit: () => true }))).toMatchObject({ reason: "step_failed" });
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("a site with no passage of its own fails hard rule 1, before a cent is spent", async () => {
    const outcome = await run({ facts: [], pack: pack({ facts: [] }) });
    expect(outcome.ok === false && outcome.reason === "rules" && outcome.failed).toEqual([{ rule: "grounding" }]);
    expect(llmMock).not.toHaveBeenCalled();
  });
});

describe("the comparison set is this customer's alone", () => {
  it("the queued half is read site-scoped, and the draft never competes with itself", async () => {
    answers(pageParts());
    const queuedSpy = vi.spyOn(store, "queuedPages");
    const outcome = await run();
    expect(queuedSpy).toHaveBeenCalledWith(SITE_ID, outcome.ok ? outcome.draftId : null);
    for (const call of readMeasuredTextMock.mock.calls) expect(call[0]).toMatchObject({ siteId: SITE_ID });
  });
});
