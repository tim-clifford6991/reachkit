import { expect, test } from "vitest";
import { extractThemes } from "./themes";
import type { ReviewItem } from "@/lib/scan/types";

test("extractThemes returns top terms by frequency, stopwords removed", () => {
  const reviews: ReviewItem[] = [
    { rating: 5, title: "", body: "onboarding is confusing" },
    { rating: 2, title: "", body: "the onboarding confused me, onboarding flow" },
  ];
  const themes = extractThemes(reviews, 3);
  expect(themes[0]?.term).toBe("onboarding");
  expect(themes[0]?.count).toBe(3);
  expect(themes.map((t) => t.term)).not.toContain("the");
});
