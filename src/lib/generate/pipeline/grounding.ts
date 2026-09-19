// BUILD §8 hard rule 1 — the grounding read.
//
// "≥1 verifiable fact from the customer's own live pages, carried with its
// source URL + read date." The pages are the ones the measurement engine
// already read for this site, re-read out of the `fetches` ledger by
// `readMeasuredText` — **not** fetched again here. BUILD §6.4's never-pull
// list names "per-draft re-probing" outright, and the bytes are already in
// hand: a second read of the customer's own server for text the product
// holds is exactly what that rule forbids.
//
// **The passage is chosen by code, not by a prompt.** §8's rules are
// enforced in code, and grounding is the first of them: a model asked to
// pick a fact can pick one the page does not contain, and the check would
// then be a check of the model's honesty rather than of the page. So this
// module selects the passage deterministically out of the page's own
// rendered text, and the hard rule afterwards re-verifies that the recorded
// passage still occurs there word for word — which it does by construction,
// and would not if any later step rewrote it.
//
// **There is no fallback.** The stored report is not an admissible source,
// a rival's page is not, and the model's knowledge is not. A site with no
// readable measured text yields `no_fact`, and the day has no page.
//
// **One page may not be the whole grounding** (issue 900). The read used to
// walk pages freshest first and take every passage one page yielded before
// looking at the next, so a site whose most recently read page was dense
// enough handed the brief eight facts off that single page — on the owner's
// own dogfood, eight facts off the pricing page, from which the only page
// writable is a page about the price. The pages are now taken in turn, one
// passage each per round, so the facts a brief chooses among come from as
// many of the customer's pages as there are; and where a target search is
// known the pages that share its words are offered first, so the fact the
// page stands on is about the question rather than about the seller.
import { BRIEF_MAX_FACTS } from "@/lib/config/constants";
import { readMeasuredText, type MeasuredText } from "@/lib/measure/text";
import type { GroundedFact } from "../rules/types";

/** A passage short enough to quote and long enough to say something. */
const PASSAGE_MIN_CHARS = 40;
const PASSAGE_MAX_CHARS = 300;

/** A sentence carrying a numeral says something a reader can check against
 *  the page. Preferred over one that does not; a page with none still
 *  grounds a draft on its longest ordinary statement rather than failing,
 *  because §8 asks for a verifiable fact, not for a number. */
const NUMERAL_RE = /\d/;

const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+/;

function candidateSentences(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT_RE)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(
      (sentence) => sentence.length >= PASSAGE_MIN_CHARS && sentence.length <= PASSAGE_MAX_CHARS
    );
}

/** Document order among the sentences that carry a numeral, then document
 *  order among the rest. Deterministic: the same page always grounds the
 *  same way, so a regeneration is not a different fact by accident.
 *  Exported for readiness, which asks what kind of passage a site's pages
 *  hold before a day is planned on them (issue 478). */
export function orderedPassages(text: string): string[] {
  const sentences = candidateSentences(text);
  return [
    ...sentences.filter((sentence) => NUMERAL_RE.test(sentence)),
    ...sentences.filter((sentence) => !NUMERAL_RE.test(sentence)),
  ];
}

/** Freshest first, so a page read this week grounds ahead of one read a
 *  month ago; ties break on the URL, which `readMeasuredText` already
 *  orders by. */
function freshestFirst(pages: readonly MeasuredText[]): MeasuredText[] {
  return [...pages].reverse();
}

/** Content words, as both sides of the overlap count them. Two letters or
 *  fewer is not a word that tells two pages apart. */
function wordsOf(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2)
  );
}

/** How many of the target's own words a page's text carries. */
function sharedWords(wanted: ReadonlySet<string>, held: ReadonlySet<string>): number {
  let shared = 0;
  for (const word of wanted) if (held.has(word)) shared++;
  return shared;
}

/** The pages that speak to the target search first, freshest first within
 *  a tie — and plain freshest-first where no target is given, which is what
 *  every caller that asks only "has this site a fact at all" wants. Stable:
 *  the same pages always order the same way, so a regeneration is not a
 *  different fact by accident. */
function aboutTheQuestionFirst(pages: readonly MeasuredText[], target?: string): MeasuredText[] {
  const ordered = freshestFirst(pages);
  const wanted = wordsOf(target ?? "");
  if (wanted.size === 0) return ordered;
  return ordered
    .map((page, index) => ({ page, index, shared: sharedWords(wanted, wordsOf(page.text)) }))
    .sort((x, y) => y.shared - x.shared || x.index - y.index)
    .map((row) => row.page);
}

export type GroundingRead =
  | { fact: GroundedFact; sourceText: string }
  /** No page of the customer's own yielded a passage. Not an error — a
   *  measurable state, and the one §8 leaves no way around. */
  | { failed: "no_fact" };

/** One passage of the customer's own page, with the page text it was read
 *  from — what the grounding rule re-verifies it against. */
export interface SourcedFact {
  fact: GroundedFact;
  sourceText: string;
}

export interface FactRead {
  siteId: string;
  scanId?: string;
  /** The search the page is being written for, where the caller knows it.
   *  Only an ordering: a page that shares none of its words is still offered,
   *  after the ones that do (issue 900). */
  target?: string;
}

/**
 * Every passage of the customer's own measured pages, in the order a brief
 * should meet them: the pages that speak to the target search first, then
 * one passage from each page in turn.
 *
 * Uncapped, because the callers that look a *recorded* passage back up
 * (`../edit.ts`, and the pinned-fact check on a rewrite) have to be able to
 * find one the brief chose however deep it sat; the cap belongs to the
 * prompt and is applied by `readFacts`.
 */
export async function readAllFacts(a: FactRead): Promise<SourcedFact[]> {
  const pages = aboutTheQuestionFirst(
    await readMeasuredText({ siteId: a.siteId, scanId: a.scanId }),
    a.target
  );
  const queues = pages.map((page) => ({ page, passages: orderedPassages(page.text) }));
  const out: SourcedFact[] = [];
  const seen = new Set<string>();
  const rounds = Math.max(0, ...queues.map((queue) => queue.passages.length));
  for (let round = 0; round < rounds; round++) {
    for (const queue of queues) {
      const passage = queue.passages[round];
      if (passage === undefined || seen.has(passage)) continue;
      seen.add(passage);
      out.push({
        fact: { url: queue.page.url, readAt: queue.page.measuredAt, passage },
        sourceText: queue.page.text,
      });
    }
  }
  return out;
}

/**
 * Up to `BRIEF_MAX_FACTS` of those — the facts a brief chooses among (issue
 * 475), drawn from as many of the customer's pages as the site has (issue
 * 900). Empty where no page yields one.
 */
export async function readFacts(a: FactRead): Promise<SourcedFact[]> {
  return (await readAllFacts(a)).slice(0, BRIEF_MAX_FACTS);
}

export async function readGroundingFact(a: FactRead): Promise<GroundingRead> {
  const [first] = await readFacts(a);
  return first === undefined ? { failed: "no_fact" } : first;
}
