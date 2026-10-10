// SPEC §2 2026-10-10 (owner, issue 1377) — a placeholder is never a
// category, where the market inference answers one: the free scan's
// profile and the deep pass's market call. gusto.com's scan of 2026-10-08
// stored `<UNKNOWN>` and `/scans` listed it. No network: `llm()` is stubbed.
import "../../generate/env";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { CostContext } from "@/lib/costs";
import { MARKET_SCHEMA } from "@/lib/market/infer/infer";
import { deriveProfile } from "@/lib/market/questions/profile";
import { isPlaceholder } from "@/lib/measure/placeholder";

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

const PLACEHOLDERS = ["<UNKNOWN>", "unknown", "Unknown", "N/A", "n/a", "none", "", "  ", "<category>", "<not stated>"];
const CATEGORIES = ["Payroll software", "Unknown Pleasures merchandise", "Nonet sheet music", "B2B <-> B2C marketplaces"];

const COST = { cap: "FREE" } as unknown as CostContext;
const AT = new Date("2026-10-08T00:00:00.000Z");

function profile(category: string) {
  return {
    kind: "measured" as const,
    at: AT,
    value: { category, job: "run payroll", offeringType: "saas", audienceTerms: [], namedRivals: [], vocabulary: ["payroll"], brandTokens: ["gusto"] },
  };
}

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
  it.each(PLACEHOLDERS)("%j says there is none", (text) => {
    expect(isPlaceholder(text)).toBe(true);
  });

  it.each(CATEGORIES)("%j is a category", (text) => {
    expect(isPlaceholder(text)).toBe(false);
  });

  it.each(["<UNKNOWN>", "n/a"])("the free scan's profile stores %j as no category, and keeps the rest of the answer", async (category) => {
    llmMock.mockResolvedValueOnce(profile(category));
    const result = await deriveProfile(COST, { home: "x" });
    expect(result).toEqual(profile(""));
  });

  it("the free scan's profile hands a real category back untouched", async () => {
    const answered = profile("Payroll software");
    llmMock.mockResolvedValueOnce(answered);
    expect(await deriveProfile(COST, { home: "x" })).toBe(answered);
  });

  it("the deep pass's market call refuses a placeholder as it refuses an empty category, and can still be put to the model", () => {
    expect(MARKET_SCHEMA.safeParse(ANSWER).success).toBe(true);
    for (const category of ["<UNKNOWN>", "unknown", "N/A", "none", ""]) {
      expect(MARKET_SCHEMA.safeParse({ ...ANSWER, category }).success).toBe(false);
    }
    expect(() => z.toJSONSchema(MARKET_SCHEMA)).not.toThrow();
  });
});
