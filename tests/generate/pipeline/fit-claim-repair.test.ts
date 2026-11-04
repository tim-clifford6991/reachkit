// Issue 2375: a page stopped by an unsupported fit claim drops the sentences the fit verdict named, at 0¢ and with no
// word written, and the whole battery reads it again. The short answer and a sentence a required block needs stay.
// On 0f95686d's stored row (11-04) and the October drafts stopped on fit_claim. Model doubled.
import "../env";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import row from "../fixtures/q4-0f95686d-2026-11.json";
import october from "../fixtures/fit-claim-stopped-2026-10.json";
import { FACTS, SITE_ID, emptyComparison, fakeCost, memoryStore, opportunity } from "../fixtures";

const { llmMock, runSpy } = vi.hoisted(() => ({ llmMock: vi.fn(), runSpy: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
vi.mock("../../../src/lib/generate/rules", async (original) => {
  const actual = await original<typeof import("../../../src/lib/generate/rules")>();
  runSpy.mockImplementation(actual.runHardRules);
  return { ...actual, runHardRules: runSpy };
});

const { batteryBasis, blockInputs, checkPage } = await import("../../../src/lib/generate/pipeline/battery");
const { repairRecorded, withoutUnfit } = await import("../../../src/lib/generate/pipeline/repair");
const { answerBoxOf, missingBlock } = await import("../../../src/lib/generate/rules/blocks");
const { sentencesOf } = await import("../../../src/lib/generate/rules/text");
const { setGenerateStore } = await import("../../../src/lib/generate/store");
type ContextPack = import("../../../src/lib/generate/pipeline/pack").ContextPack;
type FitVerdict = import("../../../src/lib/generate/claims/fit").FitVerdict;

const BODY = readFileSync(new URL("../fixtures/stopped-0f95686d-2026-11.md", import.meta.url), "utf8");
const PACK = row.meta.pack as unknown as ContextPack;
const NAMED = (row.rule_failures.find((failure) => failure.rule === "fit_claim")!.detail as { sentences: string[] }).sentences;
const SITE = { businessName: "ReachKit", domain: "reachkit.app", doNotClaim: [], rivals: PACK.business.rivals ?? [] };
const BASIS = batteryBasis({ pack: PACK, opportunity: opportunity({ type: "comparison_page", targetQuery: PACK.target.searches[0]!, pageType: null }), site: SITE, facts: FACTS, grounding: FACTS[0]! });
const PAGE = { title: row.title, heading: row.title, description: row.meta.description, sections: row.meta.sections, faq: row.meta.faq };
const KEPT = { title: PAGE.title, blocks: blockInputs(BASIS, PAGE) };
const ANSWERED = "ReachKit costs €49 a month and adds up to 7 new or updated pages a week, so you see the gap and close it instead of watching it.";
const TAKEAWAYS = ["Tracking-only tools like Otterly and Peec AI show where you stand in AI answers but leave the fix to you.", "Pick a tool for your actual job: watching visibility, or getting found and fixing it."];

const texts = (markdown: string) => sentencesOf(markdown).map((sentence) => sentence.text);
const failedRules = (outcome: { passed: boolean; failed?: { rule: string }[] }) => (outcome.passed ? [] : outcome.failed!.map((failure) => failure.rule));
const check = (markdown: string, fit?: FitVerdict) => checkPage(fakeCost(), BASIS, PAGE, markdown, { siteId: SITE_ID, draftId: "0f95686d", comparison: emptyComparison(), ...(fit === undefined ? {} : { fit }) });

/** The fit check doubled: it names the sentences of `named` it is handed. Any other call fails the test. */
function fitAnswers(named: readonly string[]): void {
  llmMock.mockImplementation(async (_c: unknown, call: { site: string; input: { sentences: { index: number; sentence: string }[] } }) => {
    if (call.site !== "generate.fit_check") throw new Error(`no ${call.site} call is made`);
    return { kind: "measured", at: new Date(), value: { unsupported: call.input.sentences.filter((each) => named.includes(each.sentence)).map((each) => ({ index: each.index, claims: "a use" })) } };
  });
}

beforeEach(() => {
  llmMock.mockReset();
  runSpy.mockClear();
  setGenerateStore(memoryStore());
});
afterEach(() => setGenerateStore(null));

describe("the fit repair drops exactly the sentences the verdict named", () => {
  it("on 0f95686d's stored body, the two named sentences go and every other sentence stays as written", () => {
    const repaired = repairRecorded(BODY, ["fit_claim"], { brief: BASIS.brief, sources: [], fit: NAMED, kept: KEPT });
    expect(repaired.dropped).toEqual({ fit_claim: NAMED });
    expect(texts(repaired.markdown)).toEqual(texts(BODY).filter((text) => !NAMED.includes(text)));
    expect(missingBlock({ markdown: repaired.markdown, ...KEPT })).toBeNull();
  });

  it("the October drafts' verdicts named their links' labels, which the fit check no longer reads: no line is dropped", async () => {
    for (const draft of october.drafts) {
      const named = (draft.rule_failures[0]!.detail as { sentences: string[] }).sentences;
      const linked = draft.links.filter((link) => named.includes(link.label)).map((link) => `- [${link.label}](${link.url})`);
      const markdown = BODY.replace("## What does Profound offer?", `${linked.join("\n")}\n\n## What does Profound offer?`);
      const checked = await check(markdown, { state: "failed", sentences: named });
      expect(linked.every((line) => checked.markdown.includes(line))).toBe(true);
      expect(checked.repairs.find((repair) => repair.rule === "fit_claim")?.dropped).toBeUndefined();
    }
  });
});

describe("protected text is never dropped", () => {
  it("a named sentence in the short answer stays, and fit_claim with it", async () => {
    expect(answerBoxOf(BODY)).toContain(ANSWERED);
    expect(withoutUnfit(BODY, [ANSWERED], KEPT)).toEqual({ markdown: BODY, dropped: [] });
    const checked = await check(BODY, { state: "failed", sentences: [ANSWERED] });
    expect(checked.markdown).toContain(ANSWERED);
    expect(failedRules(checked.outcome)).toContain("fit_claim");
  });

  it("a named sentence whose drop would leave the takeaways under their least stays", () => {
    const out = withoutUnfit(BODY, TAKEAWAYS, KEPT);
    expect(out.dropped).toEqual([TAKEAWAYS[0]]);
    expect(out.markdown).toContain(TAKEAWAYS[1]);
    expect(missingBlock({ markdown: out.markdown, ...KEPT })).toBeNull();
    // Unguarded, the same drop would have stopped the page on its blocks.
    expect(missingBlock({ markdown: withoutUnfit(BODY, TAKEAWAYS).markdown, ...KEPT })).toBe("takeaways");
  });
});

describe("the battery runs again after the drop, and no fit call is bought twice", () => {
  it("one fit call names the two sentences; the repaired page is read by every rule again with no model call", async () => {
    fitAnswers(NAMED);
    const checked = await check(BODY);
    expect(runSpy).toHaveBeenCalledTimes(2);
    expect(llmMock.mock.calls.map((call) => call[1].site)).toEqual(["generate.fit_check"]);
    const [first, again] = await Promise.all(runSpy.mock.results.map((result) => result.value as Promise<{ asked: string[] }>));
    expect(again!.asked).toEqual(first!.asked);
    expect(again!.asked).toEqual(expect.arrayContaining(["required_blocks", "fit_claim"]));
    expect(failedRules(checked.outcome)).not.toContain("fit_claim");
    expect(NAMED.some((sentence) => checked.markdown.includes(sentence))).toBe(false);
    // Recorded as the row's `meta.repairs` records it.
    expect(checked.repairs).toContainEqual({ rule: "fit_claim", cleared: true, dropped: NAMED });
  });
});
