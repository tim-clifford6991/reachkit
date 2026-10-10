// SPEC §2 2026-10-10 (issue 1377) — a placeholder is never a category where
// the market inference answers one: the free scan's profile and the deep
// pass's market call. gusto.com's scan stored `<UNKNOWN>`. `llm()` is stubbed.
import "../../generate/env";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { CostContext } from "@/lib/costs";
import { MARKET_SCHEMA } from "@/lib/market/infer/infer";
import { deriveProfile } from "@/lib/market/questions/profile";
import { isPlaceholder } from "@/lib/measure/placeholder";

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

const COST = { cap: "FREE" } as unknown as CostContext;
const profile = (category: string) => ({
  kind: "measured" as const,
  at: new Date("2026-10-08T00:00:00.000Z"),
  value: { category, job: "run payroll", offeringType: "saas", audienceTerms: [], namedRivals: [], vocabulary: ["payroll"], brandTokens: ["gusto"] },
});
const ANSWER = {
  buyer: "Small business owners",
  job: "Pay staff on time",
  category: "Payroll software",
  synonyms: ["payroll service", "online payroll"],
  differentiators: ["built-in benefits"],
  notOurMarket: ["accounting software"],
  categoryReason: "The headline sells payroll.",
  kind: MARKET_SCHEMA.shape.kind.options[0],
  servesCity: "",
};

describe("a placeholder is never a category", () => {
  it("reads a stand-in as none and a real category as one", () => {
    for (const text of ["<UNKNOWN>", "Unknown", "N/A", "none", "", "  ", "<not stated>"]) expect(isPlaceholder(text), text).toBe(true);
    for (const text of ["Payroll software", "Unknown Pleasures merchandise", "B2B <-> B2C marketplaces"]) expect(isPlaceholder(text), text).toBe(false);
  });

  it("the free scan's profile stores one as no category, keeps the rest, and leaves a real category untouched", async () => {
    llmMock.mockResolvedValueOnce(profile("<UNKNOWN>"));
    expect(await deriveProfile(COST, { home: "x" })).toEqual(profile(""));
    const answered = profile("Payroll software");
    llmMock.mockResolvedValueOnce(answered);
    expect(await deriveProfile(COST, { home: "x" })).toBe(answered);
  });

  it("the deep pass's market call refuses one as it refuses an empty category, and can still be put to the model", () => {
    expect(MARKET_SCHEMA.safeParse(ANSWER).success).toBe(true);
    for (const category of ["<UNKNOWN>", "unknown", "N/A", ""]) expect(MARKET_SCHEMA.safeParse({ ...ANSWER, category }).success).toBe(false);
    expect(() => z.toJSONSchema(MARKET_SCHEMA)).not.toThrow();
  });
});
