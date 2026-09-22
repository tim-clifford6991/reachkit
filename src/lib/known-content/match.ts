// SPEC §7 (2026-09-20, #928) — "Known content": is this topic already
// covered, and by which page?
//
// Pure. The shortlist is read out of Postgres (`store.ts`), the score is
// `topicSimilarity`'s, and the decision is here — which is what lets the
// whole of the net-new rule be asserted without a database.
//
// **A topic is matched by its words, not by its address.** A planned page
// has a target search and, once typed, a proposed title; a known page has a
// title and its own headings. Every candidate text is compared against
// every page text and the best pair wins, so a post whose *heading* is the
// topic is found even where its title is a house style ("Notes from the
// studio"). Each comparison is short against short, which is what the
// threshold was measured on: folding a page's headings into one string
// would dilute every score by the length of the page.
import { KNOWN_CONTENT } from "@/lib/config/constants";
import { topicSimilarity } from "./similarity";
import type { KnownMatch, KnownPage } from "./types";

/** The words a planned page is about: its target search, and its proposed
 *  title where the typing step has given it one. */
export interface PlannedTopic {
  query: string | null;
  title?: string | null;
}

function textsOf(topic: PlannedTopic): string[] {
  return [topic.query, topic.title].filter((text): text is string => (text ?? "").trim() !== "");
}

function pageTexts(page: KnownPage): string[] {
  return [page.title, ...page.headings.slice(0, KNOWN_CONTENT.HEADINGS_COMPARED)]
    .map((text) => text.trim())
    .filter((text) => text !== "");
}

/** How close one known page is to one planned topic: the best pair of
 *  texts, either side. */
export function pageScore(topic: PlannedTopic, page: KnownPage): number {
  let best = 0;
  for (const mine of textsOf(topic)) {
    for (const theirs of pageTexts(page)) {
      const score = topicSimilarity(mine, theirs);
      if (score > best) best = score;
    }
  }
  return best;
}

/**
 * The closest page the site already has, or `null` where none is close at
 * all. Ties break on the page a reader can open, then on the newest — a
 * live page is the better answer to both questions this index is asked.
 */
export function closestKnown(topic: PlannedTopic, pages: readonly KnownPage[]): KnownMatch | null {
  let best: KnownMatch | null = null;
  for (const page of pages) {
    const score = pageScore(topic, page);
    if (score <= 0) continue;
    if (best === null || score > best.score || (score === best.score && better(page, best.page))) {
      best = { page, score };
    }
  }
  return best;
}

function better(page: KnownPage, than: KnownPage): boolean {
  if (page.live !== than.live) return page.live;
  return (page.publishedAt?.getTime() ?? 0) > (than.publishedAt?.getTime() ?? 0);
}

/**
 * Whether the site already covers this topic.
 *
 * One threshold, `KNOWN_CONTENT.COVERED_MIN`, read here and nowhere else:
 * the rule is "never write the same page twice", not a per-customer
 * setting, and there is no argument through which one could arrive.
 */
export function alreadyCovered(
  topic: PlannedTopic,
  pages: readonly KnownPage[]
): KnownMatch | null {
  const closest = closestKnown(topic, pages);
  return closest !== null && closest.score >= KNOWN_CONTENT.COVERED_MIN ? closest : null;
}
