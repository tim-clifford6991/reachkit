// SPEC §4 · §6 (2026-09-22, #1004) — *Also appearing for* and *Cited pages*,
// in one shape.
//
// §6 of that date: "the questions AI answered with this site that are **not**
// among the tracked ones, the top 12 by AI search volume, each with the
// engine that answered and the week it was first seen" and "the site's own
// pages those answers cite, with how many questions each", "both read a
// rolling 4-week window, never one week".
//
// **This file is pure.** Facts in, model out — the same split
// `answers-model.ts` makes beside it, so every rule below is decided by a
// test with no database and no browser. Reading the facts is
// `mentions-provider.ts`'s.
//
// **Three things have no member here and never will**: a rank position,
// anything readable as sentiment, and the answer's own prose. §4's
// 2026-09-20 rule closes the tab on the first two and #1004 repeats it; the
// third is generated text with no labelled home (`CLAUDE.md`). A field that
// does not exist is the only way a later surface cannot render one.
//
// **What a week means, and why four states and not two.** A site that was
// never queried draws **no card at all** — there is nothing measured to
// show and a blank card is a claim. A window that was read and found
// nothing is a **measured zero**, stated in a written line: the engines
// answered nobody with this site, which is a measurement (§6.6's cold-start
// law). And a window in which every week was skipped for the cap or failed
// is neither — it says we did not look, which is the honest thing and is
// not the same sentence as "nobody named you".
import { ANSWER_RATE_WEEKS } from "@/lib/config/constants";
import type { MentionWeek, StoredMention } from "@/lib/mentions";
import type { AnswerEngine } from "@/lib/opportunities/types";

/** How many questions *Also appearing for* lists, at most (#1004: "the top
 *  12 by ai_search_volume"). The tracked twelve are what the grid above
 *  already draws; twelve more is the same shape of list again. */
export const ALSO_APPEARING_MAX = 12;

/** One question the engines answered with this site, that ReachKit does not
 *  already track. */
export interface AlsoAppearingRow {
  /** The buyer's question, as the vendor recorded it being asked.
   *
   *  **Measured text, not written and not generated.** It is the same kind
   *  of value as a search on the Search tab — something the market did,
   *  read off a vendor's database and shown inside a frame the registry
   *  wrote. It is not `GeneratedText`: no model of ours composed it, so
   *  there is nothing here for `renderQuestion`'s provenance gate to
   *  attach to. */
  question: string;
  /** The engines that answered it, in the product's own order — never the
   *  vendor's raw platform token. Empty where the vendor named an engine
   *  this product has no word for, which is a question we still show. */
  engines: readonly AnswerEngine[];
  /** When this question was first seen being answered this way. The
   *  vendor's own `first_response_at` where it gave one, else the first
   *  Monday we read it in — both are "first seen", and the second is the
   *  earliest date we can honestly claim. */
  firstSeenAt: Date;
  /** The vendor's demand figure, `null` where it gave none — never 0,
   *  which would read as a question nobody asks. */
  aiSearchVolume: number | null;
}

/** One of the site's own pages the answers cite. */
export interface CitedPageRow {
  /** Where the link goes: the address the answer actually cited. */
  url: string;
  /**
   * What the row **shows** — the page's path on the site, not the whole
   * address.
   *
   * The domain is the customer's own and is the same on every row, so
   * repeating it spends the width that tells the four pages apart. At 390
   * the proof showed exactly that: a 199px column held
   * `https://content.example.c` four times over and no reader could tell
   * which page was which.
   *
   * This is not the value being rewritten (`src/ui/type.css`'s law): the
   * path is a complete, accurate string in its own right, and the full
   * address is still what the link carries. A URL that will not parse
   * keeps its whole text, because then the path is not something we know.
   */
  label: string;
  /** How many **distinct** questions cite it over the window. A question
   *  answered by two engines in three of the four weeks is one question. */
  questions: number;
}

/** What the two cards are, over the window that was read. */
export type MentionsModel =
  /** No week in the window has a read row: this site has never been
   *  queried, and neither card is drawn. */
  | { readonly kind: "never_queried" }
  /** Every week in the window was skipped for the cap or failed. Nothing
   *  was measured, and the card says that rather than "nobody named you". */
  | { readonly kind: "unread"; readonly weeks: number }
  /** D32 (#1162): the site ranks for too few searches for the read to be
   *  bought. Its own sentence — "the next pass buys it" would be untrue. */
  | { readonly kind: "small_footprint" }
  /** The window was read and the engines answered nobody with this site. A
   *  measurement, stated in a written line. */
  | { readonly kind: "zero"; readonly weeks: number }
  | {
      readonly kind: "rows";
      /** How many weeks of the window actually carry a reading — the
       *  denominator of the line that says how far back this looks. */
      readonly weeks: number;
      readonly alsoAppearing: readonly AlsoAppearingRow[];
      /** How many un-tracked questions the window held in all, before the
       *  top-12 cut — so the card can say it is showing twelve *of* n
       *  rather than implying twelve is all there was. */
      readonly alsoAppearingTotal: number;
      readonly citedPages: readonly CitedPageRow[];
    };

/** The window's length, stated once. The same pin the four-week rate above
 *  it is read over, because SPEC §6 gives the tab one window and two
 *  readings of it — not two windows. */
export const MENTIONS_WINDOW_WEEKS = ANSWER_RATE_WEEKS;

/** Everything the two cards read, before they are a model. */
export interface MentionsFacts {
  /** The weeks in the window that have a read row, oldest first. A week
   *  with no row is **absent** rather than present-and-empty — that is what
   *  separates a site never queried from a week nobody was named in. */
  weeks: readonly MentionWeek[];
  /** The searches and wordings ReachKit already tracks, so *Also appearing
   *  for* can be what its name says: the questions **beyond** them. */
  tracked: readonly string[];
}

/**
 * The vendor's `platform` as one of the product's three engines.
 *
 * The pilot saw two — Google AI Overview on every domain with rows, and
 * ChatGPT on three of twenty — and the product already has a written word
 * for each. A token this product has no word for yields `null` and the
 * question is drawn without an engine chip: showing a founder
 * `some_new_platform` would be printing a vendor's internal name on a
 * customer's screen, and dropping the question would be losing a
 * measurement over its label.
 *
 * Matched on a normalised token rather than on equality, because the
 * vendor's spelling of a platform is its own and has changed before.
 */
export function engineOf(platform: string | null): AnswerEngine | null {
  if (platform === null) return null;
  const token = platform.toLowerCase().replace(/[^a-z]+/g, "_");
  // `ai_mode` first: it is the narrower name, and a vendor string carrying
  // both words should be read as the mode rather than the overview.
  if (token.includes("ai_mode")) return "ai_mode";
  if (token.includes("ai_overview") || token.includes("overview")) return "ai_overview";
  if (token.includes("chatgpt") || token.includes("gpt")) return "chatgpt";
  return null;
}

/** The product's own column order, reused so a question's engines read in
 *  the same order as the grid's columns above it. */
const ENGINE_ORDER: Readonly<Record<AnswerEngine, number>> = Object.freeze({
  ai_overview: 0,
  ai_mode: 1,
  chatgpt: 2,
});

/** One spelling a question is matched by, here and against the tracked set.
 *  Case and collapsed whitespace only — nothing else about a question is
 *  normalised anywhere in the product, and a second rule would silently
 *  join two different questions into one row. */
export function normaliseQuestion(question: string): string {
  return question.trim().toLowerCase().replace(/\s+/g, " ");
}

export function assembleMentions(facts: MentionsFacts): MentionsModel {
  if (facts.weeks.length === 0) return { kind: "never_queried" };

  // A week that was skipped or failed was not read. If none of the window's
  // weeks was read, nothing here is a measurement of the market.
  const read = facts.weeks.filter((week) => week.status === "measured" || week.status === "zero");
  if (read.length === 0) {
    return facts.weeks.at(-1)?.status === "skipped_footprint"
      ? { kind: "small_footprint" }
      : { kind: "unread", weeks: facts.weeks.length };
  }
  // D32: the read is bought once a month, and the weeks it was not bought
  // again in are weeks it still covers — the vendor's record is of every
  // mention it holds, not of one week's.
  const covered = read.length + facts.weeks.filter((week) => week.status === "skipped_monthly").length;

  const tracked = new Set(facts.tracked.map(normaliseQuestion));
  const mentions = read.flatMap((week) => week.mentions.map((mention) => ({ week, mention })));

  // The accumulator carries a `Set` where the row carries an ordered list:
  // one question is answered by several engines across several weeks, and a
  // list would hold the same engine three times.
  interface Building {
    question: string;
    engines: Set<AnswerEngine>;
    firstSeenAt: Date;
    aiSearchVolume: number | null;
  }
  const byQuestion = new Map<string, Building>();
  const byPage = new Map<string, Set<string>>();

  for (const { week, mention } of mentions) {
    const key = normaliseQuestion(mention.question);

    // *Cited pages* counts **every** question that cites a page, tracked or
    // not: the card's subject is the page, and a page cited by a question
    // ReachKit already asks is still a page the engines quote. Only *Also
    // appearing for* is defined by exclusion.
    if (mention.citedUrl !== null) {
      const questions = byPage.get(mention.citedUrl) ?? new Set<string>();
      questions.add(key);
      byPage.set(mention.citedUrl, questions);
    }

    if (tracked.has(key)) continue;
    const seenAt = firstSeenOf(mention, week.weekStart);
    let held = byQuestion.get(key);
    if (held === undefined) {
      held = {
        // The vendor's own spelling of the question, from the first row
        // that carried it — not the normalised key, which is a matching
        // device and was never meant to be read.
        question: mention.question,
        engines: new Set<AnswerEngine>(),
        firstSeenAt: seenAt,
        aiSearchVolume: mention.aiSearchVolume,
      };
      byQuestion.set(key, held);
    }

    const engine = engineOf(mention.engine);
    if (engine !== null) held.engines.add(engine);
    // The earliest date any row gave for this question, and the largest
    // demand figure any row gave: a question the vendor sized on one row
    // and not on another is a sized question.
    if (seenAt.getTime() < held.firstSeenAt.getTime()) held.firstSeenAt = seenAt;
    if (mention.aiSearchVolume !== null) {
      held.aiSearchVolume =
        held.aiSearchVolume === null
          ? mention.aiSearchVolume
          : Math.max(held.aiSearchVolume, mention.aiSearchVolume);
    }
  }

  const alsoAll = [...byQuestion.values()].map(
    (row): AlsoAppearingRow => ({
      question: row.question,
      engines: [...row.engines].sort((a, b) => ENGINE_ORDER[a] - ENGINE_ORDER[b]),
      firstSeenAt: row.firstSeenAt,
      aiSearchVolume: row.aiSearchVolume,
    })
  );
  // By demand, largest first. A question the vendor gave no figure for
  // sorts **last** rather than as a zero — it is a question we cannot size,
  // not one nobody asks — and ties break on the question itself so the
  // order is the same on every render.
  alsoAll.sort(
    (a, b) =>
      (b.aiSearchVolume ?? -1) - (a.aiSearchVolume ?? -1) || a.question.localeCompare(b.question)
  );

  const citedPages = [...byPage.entries()]
    .map(([url, questions]): CitedPageRow => ({ url, label: pathOf(url), questions: questions.size }))
    .sort((a, b) => b.questions - a.questions || a.url.localeCompare(b.url));

  if (alsoAll.length === 0 && citedPages.length === 0) return { kind: "zero", weeks: covered };

  return {
    kind: "rows",
    weeks: covered,
    alsoAppearing: alsoAll.slice(0, ALSO_APPEARING_MAX),
    alsoAppearingTotal: alsoAll.length,
    citedPages,
  };
}

/** A cited page's path, with its query and fragment where it has them —
 *  what identifies one of this customer's pages against the others. The
 *  home page reads as `/`. An address that will not parse keeps its whole
 *  text: we do not know its path, and inventing one would be worse than
 *  showing the address. */
export function pathOf(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

/** When a question was first seen answered this way: the vendor's own date
 *  where it gave one, else the Monday we read it in. Never today — a
 *  question "first seen" on the day the screen is rendered is a new
 *  question that is not new. */
function firstSeenOf(mention: StoredMention, weekStart: string): Date {
  return mention.firstSeenAt ?? new Date(`${weekStart}T12:00:00.000Z`);
}
