import { expect, test } from "vitest";
import { parseTavily } from "./tavily";
test("parseTavily maps results to competitors, excludes self", () => {
  const body = { results: [
    { title: "Top Nudgi alternatives", url: "https://habitify.me", content: "..." },
    { title: "Nudgi homepage", url: "https://nudgi.app", content: "..." },
  ] };
  const out = parseTavily(body, "nudgi");
  expect(out[0]?.url).toBe("https://habitify.me");
  expect(out.find((c) => c.url.includes("nudgi.app"))).toBeUndefined();
});
