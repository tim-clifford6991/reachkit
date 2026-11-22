// SPEC §4 — the words two screens key a search by, and what Plan's week holds for one.

/** The four a search ReachKit is going after can be in. */
export type SearchStatus = "live" | "your_review" | "up_next" | "too_big";

/** What ReachKit is doing about one search this week: its page or its update on a day of Plan's week, or a live page left alone while it climbs. */
export type Doing = { kind: "today" } | { kind: "page"; day: string } | { kind: "update"; day: string } | { kind: "climbing" };

/** A page on a day of Plan's week, by the search it targets. `day` is the day as the cell names it ("Tue 20"). */
export interface Planned {
  day: string;
  today: boolean;
  update: boolean;
}

/** The key two readers of one search agree on. */
export function searchKey(search: string): string {
  return search.trim().toLowerCase().replace(/\s+/g, " ");
}
