import { expect, test } from "vitest";
import { anthropicCostCents, MODEL_PRICES } from "./pipeline-runs";

test("cost = tokens × published rate", () => {
  const c = anthropicCostCents("claude-sonnet-4-6", 1000, 500);
  const expected = (1000 / 1e6) * MODEL_PRICES["claude-sonnet-4-6"].inPerMTokUsd * 100
                 + (500 / 1e6) * MODEL_PRICES["claude-sonnet-4-6"].outPerMTokUsd * 100;
  expect(c).toBeCloseTo(expected, 6);
});
test("Haiku is cheaper than Sonnet for identical tokens", () => {
  expect(anthropicCostCents("claude-haiku-4-5-20251001", 1000, 1000))
    .toBeLessThan(anthropicCostCents("claude-sonnet-4-6", 1000, 1000));
});
