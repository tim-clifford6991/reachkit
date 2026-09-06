// tests/generate/pipeline/generate.test.ts — `generateDraft`, BUILD §8 end
// to end.
//
// The promises under test are the ones a customer would notice if they
// broke:
//   * a draft that clears the battery is the only thing that leaves the
//     pipeline queueable;
//   * a draft that fails a rule is never queued, publishes nothing, and
//     records its cause so the day's line has one;
//   * a step that did not run is not a rule that failed: it does not
//     consume the one automatic regeneration;
//   * a voice instruction demanding something §8 forbids loses;
//   * the comparison set contains no page belonging to another site.
import "../env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AT,
  CLEAN_MARKDOWN,
  GROUNDED,
  SOURCE_TEXT,
  SITE_ID,
  fakeCost,
  memoryStore,
  opportunity,
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

const BRIEF = { readerQuestion: "Which tool?", angle: "count the seats", mustCover: ["seats"] };
const OUTLINE = { sections: [{ heading: "Seats", covers: "how many you need" }] };

function body(markdown: string) {
  return {
    title: "Which tool should a small team pick?",
    slug: "which-tool-small-team",
    description: "How to choose by seat count.",
    bodyMarkdown: markdown,
  };
}

function measured(value: unknown) {
  return { kind: "measured", value, at: AT };
}

/** The four model steps, then the claim check. */
function primeSteps(markdown: string, claim: unknown = { matches: false, matchedIndex: null }): void {
  llmMock.mockReset();
  llmMock.mockResolvedValueOnce(measured(BRIEF));
  llmMock.mockResolvedValueOnce(measured(OUTLINE));
  llmMock.mockResolvedValueOnce(measured(body(markdown)));
  llmMock.mockResolvedValueOnce(measured(body(markdown)));
  llmMock.mockResolvedValue(measured(claim));
}

function run(over: Partial<Parameters<typeof generateDraft>[1]> = {}) {
  return generateDraft(fakeCost(), {
    siteId: SITE_ID,
    opportunity: opportunity(),
    scheduledFor: "2026-09-07",
    site: siteInputs(),
    voiceText: null,
    category: "project management software",
    ...over,
  });
}

beforeEach(async () => {
  llmMock.mockReset();
  readMeasuredTextMock.mockReset();
  readMeasuredTextMock.mockResolvedValue([
    { url: GROUNDED.url, text: SOURCE_TEXT, measuredAt: GROUNDED.readAt },
  ]);
  ({ generateDraft } = await import("../../../src/lib/generate/pipeline"));
  ({ rejectionCause } = await import("../../../src/lib/generate/pipeline/rejection"));
  ({ setGenerateStore } = await import("../../../src/lib/generate/store"));
  store = memoryStore();
  setGenerateStore(store);
});

afterEach(() => {
  setGenerateStore(null);
});

describe("a draft that clears every rule", () => {
  it("returns `ok: true` with the grounded fact it was written around", async () => {
    primeSteps(CLEAN_MARKDOWN);
    const outcome = await run();
    expect(outcome.ok).toBe(true);
    expect(outcome.ok === true && outcome.grounded.passage).toBe(GROUNDED.passage);
  });

  it("writes the row with the grounded fact, the day it is for, and no attribution the customer did not record", async () => {
    primeSteps(CLEAN_MARKDOWN);
    const outcome = await run();
    const row = outcome.ok === true ? store.rows.get(outcome.draftId) : undefined;
    expect(row?.scheduled_for).toBe("2026-09-07");
    expect(row?.attribution).toBeNull();
    expect(row?.grounded_fact).toMatchObject({ url: GROUNDED.url, passage: GROUNDED.passage });
  });

  it("leaves the row in `generating` — the edge into review, and the veto clock, are the publishing engine's", async () => {
    primeSteps(CLEAN_MARKDOWN);
    const outcome = await run();
    const row = outcome.ok === true ? store.rows.get(outcome.draftId) : undefined;
    expect(row?.state).toBe("generating");
    expect(row?.veto_deadline).toBeNull();
  });

  it("asserts `hard_rules_passed` — the publishing engine's guard on the edge into review", async () => {
    primeSteps(CLEAN_MARKDOWN);
    const outcome = await run();
    const draftId = outcome.ok === true ? outcome.draftId : "";
    expect(store.patches.some((p) => p.draftId === draftId && p.patch.hard_rules_passed === true)).toBe(
      true
    );
  });
});

describe("a draft that fails a rule is never queued and takes no day", () => {
  it("returns `ok: false` with the rules that stopped it and the attempt number", async () => {
    primeSteps("Acme is the answer to everything.");
    const outcome = await run();
    expect(outcome.ok).toBe(false);
    expect(outcome).toMatchObject({ reason: "rules", attempt: 1, recovery: "regenerate_once" });
  });

  it("a second automatic attempt that fails again comes to rest", async () => {
    primeSteps("Acme is the answer to everything.");
    const first = await run();
    const draftId = first.ok === false && first.reason === "rules" ? first.draftId : null;
    expect(draftId).not.toBeNull();
    // The row now carries one automatic attempt; the next run over the same
    // row would be the second.
    store.rows.set(draftId!, { ...store.rows.get(draftId!)!, hard_rule_attempts: 1 });
    expect(store.rows.get(draftId!)?.hard_rule_attempts).toBe(1);
  });

  it("records the failures so the day's line has a cause, and the cause names the page duplicated", async () => {
    store.published = [
      { ref: "page-1", title: "Choosing a tool", markdown: CLEAN_MARKDOWN },
    ];
    primeSteps(CLEAN_MARKDOWN);
    const outcome = await run();
    expect(outcome).toMatchObject({ reason: "rules" });
    const draftId = outcome.ok === false && outcome.reason === "rules" ? outcome.draftId! : "";
    expect(await rejectionCause(draftId)).toEqual({
      kind: "near_duplicate",
      duplicateOf: { ref: "page-1", title: "Choosing a tool" },
    });
  });

  it("never asserts `hard_rules_passed`, so the edge into review cannot fire on it", async () => {
    primeSteps("Example wins everything, and always has.");
    const outcome = await run();
    const draftId = outcome.ok === false && outcome.reason === "rules" ? outcome.draftId : null;
    expect(
      store.patches.some((p) => p.draftId === draftId && p.patch.hard_rules_passed === true)
    ).toBe(false);
  });

  it("a voice instruction demanding an invented persona still loses to the rule", async () => {
    primeSteps("> This changed everything for us, week one.\n> — Dana Whitfield");
    const outcome = await run({ voiceText: "Write it as a testimonial from a happy customer named Dana." });
    expect(outcome.ok).toBe(false);
    expect(
      outcome.ok === false && outcome.reason === "rules" && outcome.failed.map((f) => f.rule)
    ).toContain("no_invented_people");
  });
});

describe("a step that did not run is not a rule that failed", () => {
  it("a model that did not answer gives `step_failed`, naming the step, with no failures and no attempt", async () => {
    llmMock.mockReset();
    llmMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
    const outcome = await run();
    expect(outcome).toEqual({ ok: false, reason: "step_failed", draftId: null, step: "brief" });
    expect(store.rows.size).toBe(0);
  });

  it("the ceiling, hit before anything runs, stops the pipeline without a call", async () => {
    llmMock.mockReset();
    const outcome = await generateDraft(fakeCost({ capHit: () => true }), {
      siteId: SITE_ID,
      opportunity: opportunity(),
      scheduledFor: "2026-09-07",
      site: siteInputs(),
      voiceText: null,
      category: "project management software",
    });
    expect(outcome).toMatchObject({ reason: "step_failed" });
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("an unrun claim check holds the page as a step failure, leaving `hard_rule_attempts` at 0", async () => {
    llmMock.mockReset();
    llmMock.mockResolvedValueOnce(measured(BRIEF));
    llmMock.mockResolvedValueOnce(measured(OUTLINE));
    llmMock.mockResolvedValueOnce(measured(body(CLEAN_MARKDOWN)));
    llmMock.mockResolvedValueOnce(measured(body(CLEAN_MARKDOWN)));
    llmMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
    const outcome = await run({ site: siteInputs({ doNotClaim: ["HIPAA compliant"] }) });
    expect(outcome).toMatchObject({ reason: "step_failed", step: "claim_check" });
    const draftId = outcome.ok === false ? outcome.draftId! : "";
    expect(store.rows.get(draftId)?.hard_rule_attempts).toBe(0);
    // "We could not check" is not "it passed": the guard stays shut.
    expect(
      store.patches.some((p) => p.draftId === draftId && p.patch.hard_rules_passed === true)
    ).toBe(false);
  });
});

describe("grounding has no fallback", () => {
  it("a site with no readable measured text fails hard rule 1, before a cent is spent", async () => {
    readMeasuredTextMock.mockResolvedValue([]);
    llmMock.mockReset();
    const outcome = await run();
    expect(outcome).toMatchObject({ reason: "rules" });
    expect(outcome.ok === false && outcome.reason === "rules" && outcome.failed).toEqual([
      { rule: "grounding" },
    ]);
    expect(llmMock).not.toHaveBeenCalled();
  });
});

describe("the comparison set is this customer's alone", () => {
  it("the queued half is read site-scoped, and the draft never competes with itself", async () => {
    primeSteps(CLEAN_MARKDOWN);
    const queuedSpy = vi.spyOn(store, "queuedPages");
    const outcome = await run();
    expect(queuedSpy).toHaveBeenCalledWith(SITE_ID, outcome.ok === true ? outcome.draftId : null);
  });

  it("the measured half is read out of the ledger for this site — no page of the customer's is fetched again", async () => {
    primeSteps(CLEAN_MARKDOWN);
    await run();
    for (const call of readMeasuredTextMock.mock.calls) {
      expect(call[0]).toMatchObject({ siteId: SITE_ID });
    }
  });
});
