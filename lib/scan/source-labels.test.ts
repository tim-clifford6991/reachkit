import { expect, test } from "vitest";
import { competitorSourceLabel } from "./source-labels";

test.each([
  ["itunes_search", "ranks in your App Store category"],
  ["dataforseo_serp", "appears when buyers search for alternatives"],
  ["product_hunt", "launched in your Product Hunt category"],
  ["tavily", "mentioned alongside you in search results"],
  ["llm_extracted", "named as a top alternative to you"],
  ["unknown_x", "found in your category"],
])("competitorSourceLabel(%s) -> %s", (source, expected) => {
  expect(competitorSourceLabel(source)).toBe(expected);
});
