import { expect, test } from "vitest";
import { parseSerp, serpAuthHeader } from "./dataforseo";

test("serpAuthHeader builds Basic auth from login:password", () => {
  expect(serpAuthHeader("user", "pass")).toBe(`Basic ${Buffer.from("user:pass").toString("base64")}`);
});

test("parseSerp extracts all organic competitors + result count (no self-exclusion)", () => {
  const body = { tasks: [{ result: [{ se_results_count: 1234000, items: [
    { type: "organic", title: "Best Nudgi alternatives", url: "https://habitify.me", domain: "habitify.me" },
    { type: "people_also_ask" },
    { type: "organic", title: "Nudgi vs Streaks", url: "https://streaksapp.com", domain: "streaksapp.com" },
    { type: "organic", title: "Nudgi official", url: "https://nudgi.app", domain: "nudgi.app" },
  ] }] }] };
  const r = parseSerp(body);
  expect(r.serpResultCount).toBe(1234000);
  expect(r.competitors.map((c) => c.url)).toEqual(["https://habitify.me", "https://streaksapp.com", "https://nudgi.app"]);
});
