// A claims call that times out costs the page none of its top results: they are dealt across calls and the call is tried again in halves.
import "./env";
import { expect, it, vi } from "vitest";
import type { CostContext } from "../../src/lib/costs";
import { toolUseMessage } from "../llm/fixtures";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: createMock }; } }));
const { readClaims } = await import("../../src/lib/generate/pipeline/claims-read");

const cost = { recordFetch: async (call: { run: () => Promise<unknown> }) => ({ payload: await call.run(), fresh: true, costCents: 0, storedAt: null }), capHit: () => false, spentCents: () => 0, degraded: () => false } as unknown as CostContext;
const said = (at: number) => `Study ${at} finds that buyers compare three plans before they pay.`;
const pages = Array.from({ length: 13 }, (_, at) => ({ url: `https://source${at}.example/`, title: `Source ${at}`, text: said(at), readAt: "2026-11-21T00:00:00.000Z", ...(at < 3 ? { kind: "top_result" as const } : { kind: "rival_pricing" as const, product: `rival${at}.example` }) }));

it("the first claims call timing out still leaves claims from every top result", async () => {
  createMock.mockRejectedValueOnce(new Error("Request timed out."));
  createMock.mockImplementation(async (request: { messages: { content: string }[] }) => {
    const quotes = [...request.messages[0]!.content.matchAll(/Study \d+ finds that buyers compare three plans before they pay\./g)].map((match) => match[0]);
    return toolUseMessage({ claims: quotes.map((quote, at) => ({ page: at + 1, quote, year: null, about: "price", plan: null, rival: null })) });
  });
  const facts = await readClaims(cost, pages, { locale: { country: "US", language: "en" }, search: "plan pricing", rivals: [], today: new Date("2026-11-22") });
  expect(createMock).toHaveBeenCalledTimes(4);
  expect(new Set(facts.filter((fact) => fact.kind === "top_result").map((fact) => fact.url)).size).toBe(3);
});
