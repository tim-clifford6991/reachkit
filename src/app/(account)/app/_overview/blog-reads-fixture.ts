// SPEC §6 (2026-09-20, #908) measure (d) — the *AI engines on your blog*
// card's facts, as a fixture.
//
// **This is the reserved fixture account's card, and nobody else's.**
// `blog-reads-provider.ts` answers `isReservedFixtureAccount` from here and
// reads every other account's counts live, so what this file holds is one
// account's data rather than a placeholder for a missing read.
//
// **The frame it shows is the dense one**: a hosted blog with pages live,
// every engine represented, two of them silent so a zero row is drawn, a
// four-figure total so the widest number the card can hold is laid out, and
// a referral count far below the fetch count — which is what real traffic
// looks like and what the "at least" line is about.
import type { BlogReadRow } from "@/lib/publish/reads/store";
import type { BlogReadsFacts } from "@/lib/publish/reads/model";

/** Two of the fixture account's own live pages. The ids are opaque to the
 *  card — it counts rows, it does not link to a page — so they are spelled
 *  as plain handles rather than borrowed from another fixture. */
const PAGE_A = "fixture-publication-a";
const PAGE_B = "fixture-publication-b";

/** The seven days `search-fixture.ts` measures its Monday on and the six
 *  before it. */
const DAYS = [
  "2026-08-25",
  "2026-08-26",
  "2026-08-27",
  "2026-08-28",
  "2026-08-29",
  "2026-08-30",
  "2026-08-31",
] as const;

function row(
  publicationId: string,
  day: string,
  engine: BlogReadRow["engine"],
  kind: BlogReadRow["kind"],
  hits: number
): BlogReadRow {
  return { publicationId, day, engine, kind, hits };
}

/** Four engines fetch, three refer, `gemini` and `copilot` are silent on
 *  the fetch side — so the card draws a zero row and a reader can see which
 *  engines have not come. */
const ROWS: readonly BlogReadRow[] = Object.freeze([
  row(PAGE_A, DAYS[0], "chatgpt", "answer_fetch", 214),
  row(PAGE_A, DAYS[1], "chatgpt", "answer_fetch", 198),
  row(PAGE_A, DAYS[2], "chatgpt", "answer_fetch", 176),
  row(PAGE_B, DAYS[3], "chatgpt", "answer_fetch", 143),
  row(PAGE_B, DAYS[4], "chatgpt", "answer_fetch", 121),
  row(PAGE_A, DAYS[5], "chatgpt", "answer_fetch", 109),
  row(PAGE_B, DAYS[6], "chatgpt", "answer_fetch", 97),
  row(PAGE_A, DAYS[1], "perplexity", "answer_fetch", 88),
  row(PAGE_B, DAYS[3], "perplexity", "answer_fetch", 64),
  row(PAGE_A, DAYS[6], "perplexity", "answer_fetch", 51),
  row(PAGE_A, DAYS[2], "claude", "answer_fetch", 37),
  row(PAGE_B, DAYS[5], "claude", "answer_fetch", 24),
  // A search indexer: counted, and deliberately not drawn on the card.
  row(PAGE_A, DAYS[2], "chatgpt", "index_fetch", 12),
  row(PAGE_B, DAYS[4], "perplexity", "index_fetch", 9),
  // The visitors. A floor, always — most AI apps send neither a referrer
  // nor a tagged link.
  row(PAGE_A, DAYS[1], "chatgpt", "referral", 6),
  row(PAGE_B, DAYS[4], "chatgpt", "referral", 4),
  row(PAGE_A, DAYS[5], "perplexity", "referral", 2),
  row(PAGE_B, DAYS[6], "gemini", "referral", 1),
  // The week before, which the card reads its change against and counts
  // nowhere else.
  row(PAGE_A, "2026-08-19", "chatgpt", "answer_fetch", 640),
  row(PAGE_A, "2026-08-22", "perplexity", "answer_fetch", 180),
  row(PAGE_B, "2026-08-23", "chatgpt", "referral", 5),
]);

export const FIXTURE_BLOG_READS_FACTS: BlogReadsFacts = Object.freeze({
  hosted: true,
  livePages: 2,
  rows: ROWS,
});
