import { describe, expect, test } from "vitest";
import { factSheetTtlMs } from "./fact-sheets";

const DAY_MS = 24 * 3600 * 1000;

describe("factSheetTtlMs", () => {
  test("keyword_data TTL is 30 days", () => {
    expect(factSheetTtlMs("keyword_data")).toBe(30 * DAY_MS);
  });

  test("review_themes TTL is 14 days", () => {
    expect(factSheetTtlMs("review_themes")).toBe(14 * DAY_MS);
  });

  test("positioning TTL is 14 days", () => {
    expect(factSheetTtlMs("positioning")).toBe(14 * DAY_MS);
  });

  test("competitor_gap TTL is 14 days", () => {
    expect(factSheetTtlMs("competitor_gap")).toBe(14 * DAY_MS);
  });
});
