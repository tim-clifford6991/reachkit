// Issue 1536: the writer is told which products the pack holds no price for
// (a FAQ said "Peec AI's own pricing page does not state a plan price"), and
// a fix call told only of lines the writer did not write is not made.
import "../env";
import { describe, expect, it, vi } from "vitest";
import { TEMPLATES } from "../../../src/lib/generate/templates";
import { AT, fakeCost, pack, pageParts } from "../fixtures";

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
const { writePage } = await import("../../../src/lib/generate/pipeline/write");
const { notWritersToFix } = await import("../../../src/lib/generate/pipeline");

const claim = (product: string, kind: "rival_pricing" | "rival_features") => ({ url: `https://${product}/p`, title: product, readAt: AT.toISOString(), passage: "From £85.", kind, product });

describe("issue 1536: comparisons the writer can get right", () => {
  it("names the unpriced products to the writer, with the rule to say nothing of their price", async () => {
    llmMock.mockResolvedValue({ kind: "measured", value: pageParts(), at: AT });
    const rivals = [{ name: "Fleetfoot", domain: "fleetfoot.example" }, { name: "Trailmax", domain: "trailmax.example" }];
    const claims = [claim("fleetfoot.example", "rival_pricing"), claim("trailmax.example", "rival_features")];
    const written = pack({ type: "listicle", business: { ...pack().business, market: { rivals } }, claims, products: claims.map((one) => ({ domain: one.product, pages: [one.url] })) });
    await writePage(fakeCost(), { template: TEMPLATES.listicle, pack: written, pageType: "product", length: { floor: 900, ceiling: 1400 } });
    const input = llmMock.mock.calls[0]?.[1].input as { unpriced?: string[]; rules: string[] };
    expect([input.unpriced, input.rules.filter((rule) => rule.startsWith("`unpriced`")).length]).toEqual([["Trailmax"], 1]);
  });

  it("skips the fix call only when every failed rule names sentences the writer did not write", () => {
    const parts = pageParts(undefined, { faq: [{ question: "Which is cheaper?", answer: "Otterly is $29 a month." }] });
    const code = { rule: "traceable_numerals" as const, sentences: ["Prices last checked 17 October 2026."] };
    const own = { rule: "rival_negative" as const, sentences: ["Otterly is $29 a month."] };
    expect([[code], [own], [code, own], [{ rule: "plain_prose" as const, sentences: ["dashes"] }], []].map((notes) => notWritersToFix(notes, parts))).toEqual([true, false, false, false, false]);
  });
});
