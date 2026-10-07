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
// **There is no fallback for the business fact.** A page stands on at least
// one passage of the customer's own, and the model's knowledge is never a
// source: a site with no readable measured text yields `no_fact`, and the
// day has no page. What a rival's page or a study says is the *second* pool
// (SPEC §7, 2026-09-29, *Two pools of facts*; issue 1135) — read by
// `./research.ts`, cited beside the sentence that uses it, and never a
// substitute for this one.
//
// **The report's measurements are business facts** (SPEC §7, 2026-10-03,
// issue 1163): what the latest complete report measured is stated in
// sentences by `report-facts.ts` and read here as one more page, sourced to
// the report's own address and dated by the measurement.
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
import nlp from "compromise";
import { BRIEF_MAX_FACTS } from "@/lib/config/constants";
import { readMeasuredText, type MeasuredText } from "@/lib/measure/text";
import { isNeverRead } from "@/lib/site-profile/knowledge/priority";
import { derivePurpose } from "@/lib/site-profile/purpose";
import { readReportPage } from "./report-facts";
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

/** Ends as a sentence ends, allowing a closing quote or bracket. */
const SENTENCE_END_RE = /[.!?]["'”’)\]]?$/;

/** A passage is the site's chrome, not something one page says, where it
 *  repeats on at least this many of the site's pages **and** on more than
 *  half of them (SPEC §5, 2026-10-03, issue 1163). The count alone cut real
 *  claims on a small site: on six pages, a promise made on three is the
 *  site saying it three times, not a menu. */
const REPEATED_ON_PAGES = 3;
const REPEATED_ON_SHARE = 0.5;

/** A legal page — privacy, terms, imprint, cookies — is tagged by its
 *  address, with the crawl's own table (`site-profile/purpose.ts`), and is
 *  never read for facts (SPEC §5, 2026-10-03, issue 1163): a removal clause
 *  or a processor list is not what a business says about itself. */
function isLegalPage(url: string): boolean {
  return derivePurpose({ url, title: "", h1: "" }) === "legal";
}

/** Prose, not a label: it ends in punctuation and it has a verb (SPEC §5,
 *  2026-09-29 — "keeps a sentence only where it is prose"). Menus, tiles
 *  and figures ("Discoverability Score 62") fail one or both. */
function readsAsProse(sentence: string): boolean {
  return SENTENCE_END_RE.test(sentence) && nlp(sentence).verbs().length > 0;
}

/** The text is one block per line (`@/lib/measure/prose`): a sentence
 *  never runs across two blocks. */
function candidateSentences(text: string): string[] {
  return text
    .split("\n")
    .flatMap((block) => block.split(SENTENCE_SPLIT_RE))
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(
      (sentence) =>
        sentence.length >= PASSAGE_MIN_CHARS && sentence.length <= PASSAGE_MAX_CHARS && readsAsProse(sentence)
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

/** A line of an example, as the passages are normalised: its sentences and
 *  the whole line, so a caption is matched however the page breaks it. */
export function examplePhrases(line: string): string[] {
  const whole = line.replace(/\s+/g, " ").trim();
  return [whole, ...whole.split(SENTENCE_SPLIT_RE).map((sentence) => sentence.trim())];
}

/**
 * Each page's passages, minus what is not the business speaking: a legal
 * page and a gallery page yield none (issue 1249:
 * six of the eight reachkit.app pages a round read were its scan gallery,
 * which is about other businesses), a passage the site repeats on three or more pages and
 * on more than half of them is chrome, and a phrase any page of the site
 * shows inside an example is an example wherever it appears. Every caller
 * that reads passages over a set of pages reads them here, so a footer's
 * sentence is dropped however the facts are read.
 */
export function sitePassages<P extends { url: string; text: string; examples?: readonly string[] }>(
  pages: readonly P[]
): { page: P; passages: string[] }[] {
  const read = pages.map((page) => ({ page, passages: orderedPassages(page.text) }));
  const onPages = new Map<string, Set<string>>();
  for (const { page, passages } of read) {
    for (const passage of passages) onPages.set(passage, (onPages.get(passage) ?? new Set()).add(page.url));
  }
  const repeated = (passage: string): boolean => {
    const count = onPages.get(passage)?.size ?? 0;
    return count >= REPEATED_ON_PAGES && count > pages.length * REPEATED_ON_SHARE;
  };
  const demo = new Set(pages.flatMap((page) => (page.examples ?? []).flatMap(examplePhrases)));
  return read.map(({ page, passages }) => ({
    page,
    passages: isLegalPage(page.url) || isNeverRead(page.url)
      ? []
      : passages.filter((passage) => !repeated(passage) && !demo.has(passage)),
  }));
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
      .split(/[^\p{L}\p{N}]+/u)
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
  /** Read off the report's own page, not one of the customer's (issue
   *  1163): a measurement, which no page of theirs states. */
  report?: true;
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
  const [measured, report] = await Promise.all([
    readMeasuredText({ siteId: a.siteId, scanId: a.scanId }),
    readReportPage(a.siteId),
  ]);
  const own = sitePassages(aboutTheQuestionFirst(measured, a.target));
  // The report is one more page in the rotation, after the site's own — and
  // only beside them: a site none of whose pages yields a passage is not
  // written from its measurements alone.
  const queues =
    report === null || own.every((queue) => queue.passages.length === 0)
      ? own
      : // Its address is under the gallery's own path on reachkit.app, and it
        // is composed here, not crawled: it is read as it stands.
        [...own, { page: report, passages: orderedPassages(report.text) }];
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
        ...(report !== null && queue.page.url === report.url ? { report: true as const } : {}),
      });
    }
  }
  return out;
}

/**
 * The site's demo phrases and menu lines (SPEC §7, D41 stage 4; issue 1249):
 * what its pages' example elements and its `nav`, `header` and `footer`
 * said. None of it is the business speaking, and a generated page that
 * repeats a line of it is stopped (`../rules/demo.ts`).
 */
export async function readDemoPhrases(a: { siteId: string; scanId?: string }): Promise<string[]> {
  const measured = await readMeasuredText({ siteId: a.siteId, scanId: a.scanId });
  return [...new Set(measured.flatMap((page) => [...(page.examples ?? []), ...(page.menus ?? [])]))];
}

/**
 * Up to `BRIEF_MAX_FACTS` of those — the facts a brief chooses among (issue
 * 475), drawn from as many of the customer's pages as the site has (issue
 * 900). Empty where no page yields one.
 */
export async function readFacts(a: FactRead): Promise<SourcedFact[]> {
  return (await readAllFacts(a)).slice(0, BRIEF_MAX_FACTS);
}

/**
 * The same passages, minus the ones the customer switched off (#926, #927).
 *
 * **A pure filter, and the refusals are passed in.** A customer who switched
 * a passage off on Settings › Your business has said ReachKit may not quote
 * it, and a page that quoted it anyway would be the one thing that control
 * is for. The list arrives from the caller rather than being read here, and
 * the reason is worth stating because the first draft of this did read it:
 * this module is reached by the writer, by an edit, by the opportunities
 * store and by the Settings screen, and a read inside it puts a database
 * behind every one of them — including a suite about passage *ordering* that
 * has no business standing one up. It also read it twice on the draft path,
 * since the caller already reads the same row for the profile.
 *
 * So the one read is the caller's — `../voice/confirmed.ts` returns the
 * refusals beside the profile — and this stays the filter.
 * `tests/build/grounding-callers.test.ts` is what holds every quoting path
 * to it.
 */
export function allowedFacts(
  all: readonly SourcedFact[],
  factsOff: readonly string[]
): SourcedFact[] {
  if (factsOff.length === 0) return [...all];
  const off = new Set(factsOff);
  return all.filter((sourced) => !off.has(sourced.fact.passage));
}

/**
 * Whether this site has any passage to write from at all, and the first of
 * them.
 *
 * **It reads the base list, and that is deliberate** (#927): the question it
 * answers is whether a site has *supply* — `../../opportunities/store.ts`
 * asks it to decide whether an opportunity can be written at all — not which
 * passage a page will quote. A site whose passages are all switched off has
 * none it may quote, and the writer finds that out at the moment it matters,
 * with §8's own "no fact" path. Reading the refusals here would put a
 * database read behind every supply question for an answer the writer
 * re-derives anyway.
 */
export async function readGroundingFact(a: FactRead): Promise<GroundingRead> {
  const [first] = await readFacts(a);
  return first === undefined ? { failed: "no_fact" } : first;
}
