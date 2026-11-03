// Issue 2341: a listicle stopped for a repeated phrase and two claims of fit is repaired in code, then takes its one
// fix call told only of the fit sentences. Where the budget refuses that call, the stop says so. Model doubled; 0¢.
import "../env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PromptKnowledge } from "../../../src/lib/generate/voice/profile-block";
import { AT, FACTS, GROUNDED, SITE_ID, SOURCE_TEXT, fakeCost, memoryStore, opportunity, pack, pageParts, prose, siteInputs } from "../fixtures";

const { llmMock, readMeasuredTextMock } = vi.hoisted(() => ({ llmMock: vi.fn(), readMeasuredTextMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: readMeasuredTextMock }));
const { generateDraft } = await import("../../../src/lib/generate/pipeline");
const { setGenerateStore } = await import("../../../src/lib/generate/store");

const KNOWLEDGE = { offerings: [{ name: "Team plan", features: ["Unlimited boards"], prices: ["€49 per month"], uses: [], from: GROUNDED.url }], differentiators: [], byline: null, audience: [], problems: [], proof: [], questions: [], integrations: [], places: [] } satisfies PromptKnowledge;
const PHRASE = "the plan covers every seat a growing team will need this year";
const SAYINGS = [`Look for a tool where ${PHRASE}.`, `Ask the vendor whether ${PHRASE}.`, `Renew only once ${PHRASE}.`];
const FITS = ["Acme is the best tool for hospitals.", "Acme suits every law firm in Europe."];
const RIVALS = [{ name: "Boardly", domain: "boardly.example" }, { name: "Planhub", domain: "planhub.example" }];
const RIVAL_CLAIMS = RIVALS.map((rival) => ({ url: `https://${rival.domain}/features`, title: rival.name, readAt: AT.toISOString(), passage: `${rival.name} syncs every board offline for growing teams.`, kind: "rival_features" as const, product: rival.domain }));
const KEYS = ["what_to_look_for", "how_we_compared", "option", "option", "option", "which_to_choose", "business"];
const FAQ = [
  { question: "Do viewers need a paid seat?", answer: "Most plans let a viewer read a board without a seat of their own." },
  { question: "Can a team switch plans mid-year?", answer: "Moving up a plan is usually billed from the day it changes." },
  { question: "What happens to boards after a trial ends?", answer: "Boards stay readable, and editing waits until a plan is chosen." },
];
const measured = (value: unknown) => ({ kind: "measured", value, at: AT });

/** The fixture's parts as a listicle that passes; `faulty` adds the phrase three times and the two fit claims. */
function listicleParts(faulty = false) {
  const parts = pageParts();
  const added = faulty ? [SAYINGS[0], `${SAYINGS[1]} ${FITS[0]}`, `${SAYINGS[2]} ${FITS[1]}`] : [];
  const sections = parts.sections.map((section, index) => ({
    ...section,
    key: KEYS[index] ?? section.key,
    body: [section.body.replace(/^## .*\n+/, ""), KEYS[index] === "which_to_choose" ? "Boardly is the better pick for a team that works offline." : "", added[index] ?? ""].filter(Boolean).join(" "),
  }));
  return { ...parts, faq: FAQ, sections: [sections[0]!, { key: "at_a_glance", heading: "Seats: how do the plans compare?", body: prose("plans", 200, 6) }, ...sections.slice(1)] };
}

let fitAnswered = false;
/** The write, a fit check naming the fit claims it is handed, and `fix`. */
function answers(fix: unknown): void {
  llmMock.mockImplementation(async (_c: unknown, call: { site: string; input: { sentences?: { index: number; sentence: string }[] } }) => {
    if (call.site === "generate.write") return measured(listicleParts(true));
    if (call.site === "generate.fix") return fix;
    fitAnswered = true;
    return measured({ unsupported: (call.input.sentences ?? []).filter((each) => FITS.includes(each.sentence)).map((each) => ({ index: each.index, claims: "an audience" })) });
  });
}
const run = (cost = fakeCost()) =>
  generateDraft(cost, {
    siteId: SITE_ID,
    opportunity: opportunity(),
    scheduledFor: "2026-11-04",
    site: siteInputs(),
    pack: pack({ type: "listicle", business: { ...pack().business, market: { rivals: RIVALS } }, claims: [...pack().claims, ...RIVAL_CLAIMS], products: RIVAL_CLAIMS.map((claim) => ({ domain: claim.product, pages: [claim.url] })), profile: { job: null, products: [], audience: [], promises: [], vocabulary: [], knowledge: KNOWLEDGE } }),
    facts: FACTS,
    links: [],
  });
const fixCalls = () => llmMock.mock.calls.filter((call) => call[1].site === "generate.fix").map((call) => (call[1] as { input: { fix: unknown } }).input.fix);

beforeEach(() => {
  llmMock.mockReset();
  fitAnswered = false;
  readMeasuredTextMock.mockReset();
  readMeasuredTextMock.mockResolvedValue([{ url: GROUNDED.url, text: SOURCE_TEXT, measuredAt: GROUNDED.readAt }]);
  setGenerateStore(memoryStore());
});
afterEach(() => setGenerateStore(null));

describe("a page left with only claims of fit after the repair", () => {
  it("is repaired in code, then its one fix call carries both fit sentences and no prose note", async () => {
    answers(measured(listicleParts()));
    expect(await run()).toMatchObject({ ok: true });
    expect(fixCalls()).toEqual([[{ rule: "fit_claim", sentences: FITS }]]);
  });

  it.each([
    ["the ledger refusing the fix call", false, 1],
    ["the cap reached after the checks", true, 0],
  ])("stops after one attempt with the budget as the reason, on %s", async (_, capAfterFit, calls) => {
    answers({ kind: "unmeasured", reason: "not_attempted", at: AT });
    const outcome = await run(fakeCost({ capHit: () => capAfterFit && fitAnswered }));
    expect(outcome).toMatchObject({ ok: false, reason: "rules", attempt: 1, stop: "budget", failed: [{ rule: "fit_claim" }] });
    expect(fixCalls()).toHaveLength(calls);
  });
});
