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

/**
 * Up to `BRIEF_MAX_FACTS` passages of the customer's own measured pages,
 * freshest page first and, within a page, in `orderedPassages`' order — the
 * facts a brief chooses among (issue 475). Empty where no page yields one.
 */
export async function readFacts(a: { siteId: string; scanId?: string }): Promise<SourcedFact[]> {
  const pages = await readMeasuredText({ siteId: a.siteId, scanId: a.scanId });
  const out: SourcedFact[] = [];
  const seen = new Set<string>();
  for (const page of freshestFirst(pages)) {
    for (const passage of orderedPassages(page.text)) {
      if (seen.has(passage)) continue;
      seen.add(passage);
      out.push({ fact: { url: page.url, readAt: page.measuredAt, passage }, sourceText: page.text });
      if (out.length >= BRIEF_MAX_FACTS) return out;
    }
  }
  return out;
}

export async function readGroundingFact(a: {
  siteId: string;
  scanId?: string;
}): Promise<GroundingRead> {
  const [first] = await readFacts(a);
  return first === undefined ? { failed: "no_fact" } : first;
}
