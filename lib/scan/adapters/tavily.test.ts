import { expect, test } from "vitest";
import { parseTavily } from "./tavily";
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
