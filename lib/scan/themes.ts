import type { ReviewItem, ThemeCount } from "@/lib/scan/types";

const STOP = new Set("the a an and or but is are was were be been to of in on for it its this that i you me my we app".split(" "));

export function extractThemes(reviews: ReviewItem[], top = 12): ThemeCount[] {
  const counts = new Map<string, number>();
  for (const r of reviews) {
    for (const tok of `${r.title} ${r.body}`.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []) {
      if (STOP.has(tok)) continue;
      counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top);
}
