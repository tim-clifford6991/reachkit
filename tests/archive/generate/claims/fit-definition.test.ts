// Issue 2375, owner 2026-11-04 ("only generate content that complies"): the fit check and the writer read one
// definition of an unsupported claim, so a page is written to the rule it is checked against. Model doubled.
import "../env";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { TEMPLATES } from "../../../src/lib/generate/templates";
import type { PromptKnowledge } from "../../../src/lib/generate/voice/profile-block";
import { AT, fakeCost, pack, pageParts } from "../fixtures";

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
const { UNSUPPORTED_CLAIM, fitCheck } = await import("../../../src/lib/generate/claims/fit");
const { writePage } = await import("../../../src/lib/generate/pipeline/write");

const KNOWLEDGE = { offerings: [], differentiators: [], byline: null, audience: [], problems: [], proof: [], questions: [], integrations: [], places: [] } satisfies PromptKnowledge;

describe("one definition of an unsupported claim", () => {
  it("the fit call's task carries it verbatim", async () => {
    llmMock.mockResolvedValue({ kind: "measured", value: { unsupported: [] }, at: AT });
    await fitCheck(fakeCost(), { title: "Acme for teams", markdown: "Acme plans boards for teams.", businessName: "Acme", domain: "acme.example", knowledge: KNOWLEDGE });
    expect((llmMock.mock.calls[0]?.[1].input as { task: string }).task).toContain(UNSUPPORTED_CLAIM);
  });

  it("the writer's rules carry it verbatim, and write.ts says it in no other words", async () => {
    llmMock.mockReset();
    llmMock.mockResolvedValue({ kind: "measured", value: pageParts(), at: AT });
    await writePage(fakeCost(), { template: TEMPLATES.listicle, pack: pack({ type: "listicle" }), pageType: "product", length: { floor: 900, ceiling: 1400 } });
    const rules = (llmMock.mock.calls[0]?.[1].input as { rules: string[] }).rules;
    expect(rules.filter((rule) => rule.includes(UNSUPPORTED_CLAIM))).toHaveLength(1);
    const source = readFileSync(new URL("../../../src/lib/generate/pipeline/write.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/a use, an audience or a market/);
  });
});
