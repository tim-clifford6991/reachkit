import { expect, test } from "vitest";
import { parseTavily, parseTavilyContent } from "./tavily";
test("parseTavily maps all results to competitors (no self-exclusion)", () => {
  const body = { results: [
    { title: "Top Nudgi alternatives", url: "https://habitify.me", content: "..." },
    { title: "Nudgi homepage", url: "https://nudgi.app", content: "..." },
  ] };
  const out = parseTavily(body);
  expect(out[0]?.url).toBe("https://habitify.me");
  expect(out[1]?.url).toBe("https://nudgi.app");
  expect(out).toHaveLength(2);
});

test("parseTavilyContent prefers the synthesized answer, then result content", () => {
  const body = {
    answer: "Top Acquire alternatives are Flippa, Empire Flippers, and MicroAcquire.",
    results: [{ title: "Flippa", url: "https://flippa.com", content: "Marketplace to buy/sell sites." }],
  };
  const text = parseTavilyContent(body);
  expect(text).toContain("Flippa, Empire Flippers, and MicroAcquire");
  expect(text).toContain("buy/sell sites");
});

test("parseTavilyContent tolerates null/empty body (DB body can be null)", () => {
  expect(parseTavilyContent(null)).toBe("");
  expect(parseTavilyContent({})).toBe("");
});
