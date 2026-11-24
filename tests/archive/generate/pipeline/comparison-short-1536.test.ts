// Issue 1536: a comparison answered as a Q&A whose own search holds too few
// answerable buyer questions writes no row — for three kinds of business.
import "../env";
import { describe, expect, it, vi } from "vitest";
import { buildPack } from "../../../src/lib/generate/pipeline/pack";
import { AT, SITE_ID, fakeCost, memoryStore, opportunity, report } from "../fixtures";

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
const { generateDraft } = await import("../../../src/lib/generate/pipeline");
const { setGenerateStore } = await import("../../../src/lib/generate/store");

const CASES = [
  ["SaaS", "tasklane.example", "boardly vs planhub", ["boardly.example", "planhub.example"], "Tasklane is one flat fee for the whole team.", ["Is Boardly free?"]],
  ["local business", "leedsplumbing.example", "pipefix alternatives", ["pipefix.example", "drainco.example"], "We cover every postcode in Leeds.", ["Who owns Pipefix?"]],
  ["ecommerce", "strideshoes.example", "fleetfoot vs trailmax", ["fleetfoot.example", "trailmax.example"], "Free returns within 30 days.", ["Is Trailmax a good brand?"]],
] as const;

describe("issue 1536: a comparison its pack cannot fill as a Q&A writes no row", () => {
  it.each(CASES)("%s", async (_kind, domain, target, rivals, passage, asked) => {
    const store = memoryStore();
    setGenerateStore(store);
    const fact = { fact: { url: `https://${domain}/`, readAt: AT, passage }, sourceText: passage };
    const site = { businessName: null, domain, doNotClaim: [], rivals: [...rivals] };
    const one = rivals[0];
    const pack = buildPack({
      type: "qa", opportunity: opportunity({ targetQuery: target, title: null }), site, category: "", byline: null, voice: null, profile: null,
      facts: [fact], report: report(), sitePages: [], links: [], now: AT,
      research: { facts: [{ url: `https://${one}/pricing`, title: one, readAt: AT, passage: "Plans start at $20 a month.", kind: "rival_pricing", product: one }], products: [{ domain: one, pages: [`https://${one}/pricing`] }], asked: { peopleAlsoAsk: [...asked], related: [] } },
    });
    expect(pack.missing).toContain("buyer_questions");
    const outcome = await generateDraft(fakeCost(), { siteId: SITE_ID, opportunity: opportunity({ targetQuery: target }), scheduledFor: "2026-10-18", site, pack, facts: [fact], links: [] });
    expect(outcome).toEqual({ ok: false, reason: "step_failed", draftId: null, step: "pack", missing: pack.missing });
    expect([llmMock.mock.calls.length, store.rows.size]).toEqual([0, 0]);
    setGenerateStore(null);
  });
});
