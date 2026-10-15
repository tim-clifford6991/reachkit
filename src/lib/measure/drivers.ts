// BUILD §5
// src/lib/measure/drivers.ts — the four measured quantities, as four pure
// functions. BUILD §5's formulas are the whole of the arithmetic: no
// fetch, no vendor call, no clock (`at` is always the caller's), no
// persistence. Every function returns `Measured<number>` and no branch
// reaches a number out of an `unmeasured` arm — a driver that could not be
// measured is `unmeasured` (rendered "—"), a measured 0 is the `zero` arm,
// and an empty denominator reads 0, never null.
//
// The coefficients that BUILD §5 states as numbers of formula *shape*
// (25, 0.55, 0.45, 4, 0.4, 0.6, the "/ 3") live here beside the sentence
// they transcribe. The two that are pins — the direct-answer window and
// the answerability floor — are read from `SCORING`; the closed reader
// list is `AI_READER_AGENTS`. Nothing here is customer-visible.
import { AI_READER_AGENTS, SCORE_ESTIMATE, SCORING } from "@/lib/config/constants";
import type { RobotsPolicy } from "@/lib/egress/types";
import type { RankedResult, RankedRow, SerpAiOverview } from "@/lib/vendors/dataforseo/types";

/** What §5's reach and share read of a `ranked_keywords` answer: the total
 *  and each row's position — all a stored report keeps enough of to
 *  re-score (issue 1426). */
export interface RankedPositions {
  readonly rows: readonly Pick<RankedRow, "position">[];
  readonly total: number | null;
}
import { measured, measuredZero, unmeasured, worseReason, type Measured, type UnmeasuredReason } from "./measured";
import ORDINARY_WORDS from "./ordinary-words.json";
import { asciiLowerCase, type OnPageFacts } from "./parse";
import { NO_AI_ANSWERS } from "./score";

/** The top of every 0–100 scale in BUILD §5 — the range each driver is
 *  already expressed in, not a separate pin (same reading as `score.ts`'s
 *  `SCALE_CEILING`). */
const SCALE = 100;

/** A computed value to its arm: a value of exactly 0 is "read it; it
 *  contained none" (REQ-004's `zero`), anything else is `measured`. The
 *  only place in this file a value is boxed. */
function ofValue(value: number, at: Date): Measured<number> {
  return value === 0 ? measuredZero(0, at) : measured(value, at);
}

/** Folds the `unmeasured` reasons of `parts` under `worseReason`;
 *  `undefined` when every part was read. */
function unmeasuredReasonOf(parts: readonly Measured<unknown>[]): UnmeasuredReason | undefined {
  let reason: UnmeasuredReason | undefined;
  for (const part of parts) {
    if (part.kind === "unmeasured") {
      reason = reason === undefined ? part.reason : worseReason(reason, part.reason);
    }
  }
  return reason;
}

// ── Foundations ─────────────────────────────────────────────────────────
//
// BUILD §5: "Foundations = access gates + clarity signals, 0–100 (generic
// noindex on the home document ⇒ 0, and score ⇒ 0)". §5 states the two
// halves and the one override; the composition below is this module's
// formula shape (BP-010 decision 2), equal-weighted and recorded once here:
//
//   gates   = the share of the closed AI-reader list the robots policy
//             lets through (`disallowsAll` ⇒ 0; an absent robots.txt ⇒
//             SCALE), halved when the home document carries a *targeted*
//             noindex (one that names a reader, not every reader)
//   clarity = one quarter of SCALE per signal present: structured data,
//             Open Graph, at least one heading, visible text
//   Foundations = (gates + clarity) / 2

/** Two halves, equal weight. */
const FOUNDATIONS_HALVES = 2;
/** A targeted noindex (a reader named, not every reader) halves the gate. */
const TARGETED_NOINDEX_GATE_FACTOR = 0.5;
/** The four clarity signals, each worth a quarter of the scale. */
const CLARITY_SIGNALS = 4;

/** The same reading of `RobotsPolicy` as `verdict.ts`'s blocked-readers
 *  count — one lookup shape, so the gate here and the count there can
 *  never disagree about which readers a document blocks. */
function blockedReaderCount(policy: RobotsPolicy): number {
  if (policy.absent) return 0;
  if (policy.disallowsAll) return AI_READER_AGENTS.length;
  return AI_READER_AGENTS.filter((token) => policy.disallowedAgents[token] === true).length;
}

function gatesOf(facts: OnPageFacts, policy: RobotsPolicy): number {
  // `AI_READER_AGENTS` is a pinned, non-empty tuple (asserted non-empty in
  // `tests/config/constants.test.ts`), so the denominator cannot be 0 — its
  // length is a literal type, which is why no empty-list guard is written here.
  const readers = AI_READER_AGENTS.length;
  const openShare = (readers - blockedReaderCount(policy)) / readers;
  const gates = openShare * SCALE;
  return facts.noindex ? gates * TARGETED_NOINDEX_GATE_FACTOR : gates;
}

function clarityOf(facts: OnPageFacts): number {
  const signals = [
    facts.schemaTypes.length > 0,
    facts.openGraphProperties.length > 0,
    facts.headings > 0,
    facts.visibleChars > 0,
  ];
  const present = signals.filter(Boolean).length;
  return (present / CLARITY_SIGNALS) * SCALE;
}

/** BUILD §5: "Foundations = access gates + clarity signals, 0–100 (generic
 *  noindex on the home document ⇒ 0, and score ⇒ 0)".
 *
 *  A home document that was read and tells every reader not to index it
 *  is a **measured 0** (`zero`), decided before the robots policy is even
 *  consulted — the document itself closed every gate. A home document that
 *  could not be read is `unmeasured` with the reason its read carried; a
 *  robots policy that could not be read makes the gate half unmeasurable
 *  and so the whole driver `unmeasured` — never a number estimated from
 *  the half that was read. */
export function foundationsOf(a: {
  onPage: Measured<OnPageFacts>;
  robots: Measured<RobotsPolicy>;
  at: Date;
}): Measured<number> {
  if (a.onPage.kind !== "unmeasured") {
    const facts = a.onPage.value;
    if (facts.noindex && facts.noindexAppliesToEveryReader) {
      return measuredZero(0, a.at);
    }
  }
  const reason = unmeasuredReasonOf([a.onPage, a.robots]);
  if (reason !== undefined) return unmeasured(reason, a.at);
  // Both read: narrowed by exclusion above.
  const facts = (a.onPage as { value: OnPageFacts }).value;
  const policy = (a.robots as { value: RobotsPolicy }).value;
  const value = (gatesOf(facts, policy) + clarityOf(facts)) / FOUNDATIONS_HALVES;
  return ofValue(value, a.at);
}

// ── Answerability ───────────────────────────────────────────────────────

/** BUILD §5: "shape = (questionShaped + directAnswers + evidenceDensity) / 3". */
const SHAPE_TERMS = 3;
/** BUILD §5: "… per 1k chars". */
const EVIDENCE_PER_CHARS = 1000;
/** Where the saturating log curve reads the full scale: this many evidence
 *  tokens per 1k visible chars, or more, is "dense" (formula shape,
 *  BP-010 decision 2 — §5 names the curve, not its knee). */
const EVIDENCE_SATURATION_PER_1K = 20;

/** BUILD §5: "`evidenceDensity` = saturating log curve over (numerals +
 *  dates + outbound citations per 1k chars)". A log curve through the
 *  origin, saturating at `EVIDENCE_SATURATION_PER_1K`; zero visible chars
 *  is an empty denominator and reads 0. */
function evidenceDensityOf(tokens: number, chars: number): number {
  if (chars === 0) return 0;
  const perThousand = tokens / (chars / EVIDENCE_PER_CHARS);
  const curve = Math.log10(1 + perThousand) / Math.log10(1 + EVIDENCE_SATURATION_PER_1K);
  return Math.min(1, curve) * SCALE;
}

/** BUILD §5: "Answerability = shape of the home + measured pages, 0–100,
 *  floored at 1 · shape = (questionShaped + directAnswers +
 *  evidenceDensity) / 3", where `questionShaped` = question-shaped headings
 *  ÷ all headings × 100 and `directAnswers` = direct-answer headings ÷ all
 *  headings × 100. Counts are pooled across every page that was read —
 *  one shape for the site's measured text, so a page we could not read
 *  neither counts for nor against it. Empty denominators read 0, never
 *  null: a read page set with no headings is the `zero` arm (carrying the
 *  floor). No page read at all is `unmeasured` — with the fold of the
 *  reads' reasons, or `undeterminable` when nothing was even handed in. */
export function answerabilityOf(a: { pages: readonly Measured<OnPageFacts>[]; at: Date }): Measured<number> {
  const read: OnPageFacts[] = [];
  for (const page of a.pages) {
    if (page.kind !== "unmeasured") read.push(page.value);
  }
  if (read.length === 0) {
    return unmeasured(unmeasuredReasonOf(a.pages) ?? "undeterminable", a.at);
  }

  let headings = 0;
  let questionShaped = 0;
  let directAnswers = 0;
  let evidenceTokens = 0;
  let chars = 0;
  for (const facts of read) {
    headings += facts.headings;
    questionShaped += facts.questionShapedHeadings;
    directAnswers += facts.directAnswerHeadings;
    evidenceTokens += facts.numerals + facts.dates + facts.outboundCitations;
    chars += facts.visibleChars;
  }

  const questionShapedPct = headings === 0 ? 0 : (questionShaped / headings) * SCALE;
  const directAnswersPct = headings === 0 ? 0 : (directAnswers / headings) * SCALE;
  const evidenceDensity = evidenceDensityOf(evidenceTokens, chars);
  const shape = (questionShapedPct + directAnswersPct + evidenceDensity) / SHAPE_TERMS;

  // The floor applies only to a value that exists — this line is below the
  // `unmeasured` return above, so an unmeasured answerability can never
  // surface as 1. A shape of 0 keeps the `zero` arm and carries the floor,
  // the same reading `score.ts`'s `floorAt` gives it.
  const floored = Math.max(SCORING.answerabilityFloor, shape);
  return shape === 0 ? measuredZero(floored, a.at) : measured(floored, a.at);
}

// ── SearchPresence ──────────────────────────────────────────────────────

/** BUILD §5: "SearchPresence = min(100, 25 × log10(ranked + 1)) × (0.55 +
 *  0.45 × min(1, top10share × 4))". Each coefficient beside its term. */
const SEARCH_LOG_COEFFICIENT = 25;
const SEARCH_BASE_SHARE = 0.55;
const SEARCH_TOP10_WEIGHT = 0.45;
const SEARCH_TOP10_SATURATION = 4;
/** "top10share" — the share of ranked rows at positions 1–10. */
const TOP10_LAST_POSITION = 10;

/** How many searches a domain ranks for, read off one `ranked_keywords`
 *  answer: the vendor's own total, which is what the rival bands are
 *  multiples of (#117) and what §5's reach term counts (#529). `null`
 *  means the vendor reported none, and the fallback is the row count — the
 *  capped figure, so the fallback never reads a domain as bigger than it
 *  was measured. A total of 0 is the total, not an absence. */
function rankedCountOf(result: RankedPositions): number {
  return result.total ?? result.rows.length;
}

/**
 * The customer's own ranked count — the number of rows, not a score.
 *
 * §6.6 bands a rival against "the customer's own measured count from the
 * same pass", and §7's two winnability bars are `max(500, 5× customer's)`
 * and `max(100, 2× customer's)`. Both want the count itself, which
 * `searchPresenceOf` below consumes and does not give back. One call, two
 * readings, and no second fetch: this reads the very rows that call
 * returned.
 *
 * Zero rows is a measured 0 (BUILD §6.3: "0 rows is a legal result"), not
 * an absence — a domain that ranks for nothing is the cold-start case the
 * product exists to serve, and `unmeasured` would hide it.
 *
 * **Capped by the row limit the pass bought** (`PRICE_BOOK.RANKED_*_ROWS`),
 * so a customer at the limit reads as exactly the limit. Stated rather
 * than corrected here: understating the customer's own count *tightens*
 * both bars, so the error is in the direction of fewer opportunities,
 * never of one they cannot win. Issue #117 is the vendor-side fix, shared
 * with the rival side.
 */
export function ownRankedOf(a: { ranked: Measured<RankedResult>; at: Date }): Measured<number> {
  if (a.ranked.kind === "unmeasured") return unmeasured(a.ranked.reason, a.at);
  return ofValue(rankedCountOf(a.ranked.value), a.at);
}

/** BUILD §5's SearchPresence over one `ranked_keywords` answer. The two
 *  terms take two different readings of it (#529):
 *
 *  - **reach** reads the vendor's **total** — how many searches the domain
 *    ranks for. §5's `min(100, 25 × log10(ranked + 1))` saturates at
 *    10 000 ranked keywords, so it measures the domain's whole footprint;
 *    fed the rows the pass bought (50 on the free tier) it was the constant
 *    `25 × log10(51)` for every site at or above the cap, and could not
 *    tell a site ranking for 50 searches from one ranking for 7 412. Where
 *    the vendor reports no total, the rows are the count — the same rule
 *    `ownRankedOf` applies (`rankedCountOf`).
 *  - **top10share** reads the **rows bought** — the share of them at
 *    positions 1–10. A share must be a fraction of the rows it counts;
 *    dividing a count from the sample by the total would divide one
 *    measurement by another (#117's reasoning, which holds for the share).
 *
 *  §5's coefficients and shape are unchanged; only reach's input is. Zero
 *  rows and no total is a legal result and a measured 0 (BUILD §6.3: "0
 *  rows is a legal result") — the `zero` arm, never `unmeasured`. An
 *  `unmeasured` answer is `unmeasured` with the reason it carried. */
export function searchPresenceOf(a: { ranked: Measured<RankedPositions>; at: Date }): Measured<number> {
  if (a.ranked.kind === "unmeasured") return unmeasured(a.ranked.reason, a.at);
  const rows = a.ranked.value.rows;
  const ranked = rankedCountOf(a.ranked.value);
  const top10 = rows.filter((row) => row.position >= 1 && row.position <= TOP10_LAST_POSITION).length;
  const top10share = rows.length === 0 ? 0 : top10 / rows.length;
  const reach = Math.min(SCALE, SEARCH_LOG_COEFFICIENT * Math.log10(ranked + 1));
  const quality = SEARCH_BASE_SHARE + SEARCH_TOP10_WEIGHT * Math.min(1, top10share * SEARCH_TOP10_SATURATION);
  return ofValue(reach * quality, a.at);
}

// ── AIPresence ──────────────────────────────────────────────────────────

/** BUILD §5: "AIPresence = max(1, (0.4 × mentionRate + 0.6 × citationRate)
 *  × 100)". Each coefficient beside its term. */
const AI_MENTION_WEIGHT = 0.4;
const AI_CITATION_WEIGHT = 0.6;
const AI_PRESENCE_FLOOR = 1;

/** A reference as DataForSEO returns it — a bare host, a host with a path,
 *  or a full URL — to its ASCII-lowercased host with any port and any
 *  leading `www.` removed. Never throws; a reference no `URL` can parse
 *  falls back to the text before its first `/`, which is the host in every
 *  form the vendor's own `referenceDomains` field takes. */
function hostOf(reference: string): string {
  const trimmed = reference.trim();
  let host = trimmed;
  if (trimmed.includes("://")) {
    try {
      host = new URL(trimmed).hostname;
    } catch {
      host = trimmed;
    }
  }
  host = asciiLowerCase(host);
  // A protocol-relative reference (`//host/path`) and a bare `host/path`
  // both reduce to the same host; a `host:port` drops the port.
  host = host.replace(/^\/+/, "").split("/")[0] ?? "";
  host = host.split(":")[0] ?? "";
  return host.startsWith("www.") ? host.slice("www.".length) : host;
}

/** A reference split into its ASCII-lowercased alphanumeric runs — the
 *  units a brand token can match as a *whole*. Substring matching would
 *  make "apple.com" a mention of the brand "app"; splitting first means a
 *  token matches only where it is the whole of a label, a path segment or
 *  a query word. */
function tokensOf(reference: string): readonly string[] {
  return asciiLowerCase(reference)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The phrase as a whole word or phrase, case-insensitive: never inside a
 *  longer word, which is the guard `tokensOf` gives a reference ("app" is
 *  not named by "apple"). Shorter than three characters names nothing.
 *  Exported for the tracked prompts' rivals (`readPromptAnswer`). */
export function says(text: string, phrase: string): boolean {
  const wanted = phrase.trim();
  if (wanted.length < 3) return false;
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeForRegExp(wanted)}(?![\\p{L}\\p{N}])`, "iu").test(text);
}

/** The text names the site (issue 1420; SPEC §6, D19): its name, else its
 *  domain's first label, or its domain, as a whole word or phrase. `siteName`
 *  is the name a branded prompt asks about (`promptSiteName`), `null` where
 *  none is known. One rule for every AI answer the product reads: an AI
 *  Overview's text and cited addresses, AI Mode's and ChatGPT's answers, and
 *  the tracked prompts. */
export function namesSite(text: string, siteName: string | null, ownDomain: string): boolean {
  const own = hostOf(ownDomain);
  const label = own.split(".")[0] ?? own;
  if (says(text, own)) return true;
  const names = [siteName ?? label, ...(label.length >= 4 ? [label] : [])];
  return names.some((name) => {
    const ordinary = ordinaryOf(name);
    return ordinary === null ? says(text, name) : namedAsName(text, casedName(name), ordinary);
  });
}

/** English's common words (SCOWL; the notice is `ordinary-words.COPYRIGHT`):
 *  sizes 10 and 20, the commonest (make, front, linear, notion), and size 35
 *  beside them (sage, loom, slack, rippling). A brand that is one of them is
 *  named in a text only where the text uses it as a name (issue 1420): "you
 *  can make a workflow" names nobody. */
const COMMON = new Set<string>(ORDINARY_WORDS.common);
const LESS_COMMON = new Set<string>(ORDINARY_WORDS.less);

/** Days and months: ordinary words English always capitalises, so a capital
 *  is no sign of a name ("on Monday mornings"). */
const CALENDAR = new Set([
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
]);

function wordsOf(phrase: string): string[] {
  return asciiLowerCase(phrase)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);
}

/** How ordinary a name is: `common` where a word of it is one of the
 *  commonest words or a calendar name, `less` where every word is at least a
 *  common one, `null` for a name that is no ordinary word ("Tattly"). */
function ordinaryOf(name: string): "common" | "less" | null {
  const words = wordsOf(name);
  if (words.length === 0 || !words.every((word) => COMMON.has(word) || LESS_COMMON.has(word) || CALENDAR.has(word))) return null;
  return words.some((word) => COMMON.has(word) || CALENDAR.has(word)) ? "common" : "less";
}

/** The name is made of ordinary English words. */
export function isOrdinaryName(name: string): boolean {
  return ordinaryOf(name) !== null;
}

/** The name as a name is written: the profile's own casing where it has a
 *  capital, else with one. */
function casedName(name: string): string {
  const trimmed = name.trim();
  return /\p{Lu}/u.test(trimmed) ? trimmed : trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Markup and quotes that may stand before a word without ending a
 *  sentence's run of words. */
const LEADING_MARKS = /[\s*_[\]()>"'“”‘’`]+$/u;

/** An ordinary-word name used as a name: marked up as one (bold, a link's
 *  label, a heading, a list item's lead), or written in its own case apart
 *  from other capitalised words. A title's capital and a longer name it is
 *  part of are not evidence, nor is a calendar name's capital, and for the
 *  commonest words neither is a sentence's, clause's or table cell's first
 *  word ("Make sure") unless a list of names or a gloss follows it; a less
 *  common one keeps it ("Rippling and ADP lead"). */
function namedAsName(text: string, name: string, ordinary: "common" | "less"): boolean {
  const n = escapeForRegExp(name);
  const marked = [
    new RegExp(`(\\*\\*|__)\\s*${n}\\s*\\1`, "iu"),
    new RegExp(`\\[\\s*${n}\\s*\\]\\(`, "iu"),
    new RegExp(`^\\s{0,3}#{1,6}\\s*(?:\\d+[.)]\\s*)?${n}\\s*#*\\s*$`, "imu"),
    new RegExp(`^\\s*(?:[-*+•]|\\d+[.)])\\s+(?:\\*\\*|__)?${n}(?:\\*\\*|__)?(?=\\s*(?:[:–—(-]|$))`, "mu"),
  ];
  if (marked.some((pattern) => pattern.test(text))) return true;
  if (wordsOf(name).every((word) => CALENDAR.has(word))) return false;
  const exact = new RegExp(`(?<![\\p{L}\\p{N}])${n}(?![\\p{L}\\p{N}])`, "gu");
  for (const match of text.matchAll(exact)) {
    const before = text.slice(0, match.index).split("\n").pop() ?? "";
    const after = text.slice(match.index + match[0].length).split("\n")[0] ?? "";
    // A heading's words are capitalised as a title.
    if (/^\s{0,3}#/u.test(before)) continue;
    // A sentence's first word counts for the commonest words only where it
    // opens a list of names or a gloss: "Plausible and Matomo", "Make (formerly
    // Integromat)" — never "Make sure".
    if (ordinary === "common" && opensASentence(before) && !/^[*_]*\s*(?:\(|(?:,|&|and|or|vs\.?|versus)\s+[*_]*\p{Lu})/u.test(after)) continue;
    // Part of a longer name or a title: "First Page Sage", "to Make Your Site";
    // a sentence's own first word before it is neither ("Try Make").
    const previous = /(\p{Lu}[\p{L}\p{N}]*)[*_]*\s+[*_]*$/u.exec(before);
    if (previous !== null && !opensASentence(before.slice(0, previous.index))) continue;
    if (/^[*_]*\s+[*_]*\p{Lu}/u.test(after)) continue;
    return true;
  }
  return false;
}

/** What stands before a word on its line leaves it a sentence's first word:
 *  nothing, a list marker, or the end of a sentence, a clause a capital may
 *  open ("Note: Make sure") or a table cell. */
function opensASentence(before: string): boolean {
  const run = before.replace(LEADING_MARKS, "");
  return run === "" || /^\s*(?:[-*+•]|\d+[.)])$/u.test(run) || /[.!?:|]$/u.test(run);
}

/** A cited address names the site where one of its path's segments is the
 *  site's slug — `/products/rippling`, `/reviews/make`, `/make` — never where
 *  the slug is only inside a segment (`/how-to-make-a-form`). */
function pathNamesSite(url: string, siteName: string | null, own: string): boolean {
  const label = own.split(".")[0] ?? own;
  const slugs = new Set([label, ...(siteName === null ? [] : [wordsOf(siteName).join("-")])].filter((slug) => slug.length > 0));
  let path: string;
  try {
    path = new URL(url.includes("://") ? url : `https://${url}`).pathname;
  } catch {
    return false;
  }
  return path.split("/").some((segment) => {
    let decoded = segment;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      // A malformed escape is read as written.
    }
    return slugs.has(asciiLowerCase(decoded));
  });
}

/** What an answer said beside its reference hosts, where it was kept: the
 *  addresses it cited and its text. */
export interface AnswerSaid {
  urls?: readonly string[];
  text?: string;
  siteName?: string | null;
}

/** BUILD §6.3: "Brand mentions/citations = string match over references."
 *  A *citation* is a reference whose host is the customer's domain or a
 *  subdomain of it — the answer points at the site. A *mention* is the
 *  answer naming the brand anywhere else (issue 1420): a reference host
 *  that carries the brand token whole, a cited address on another site
 *  whose path names it (`g2.com/products/rippling`), or the answer's own
 *  text naming it (`namesSite`). Before issue 1420 only the first counted,
 *  so a brand an answer recommended through review sites was never named.
 *  The two can both hold for one answer; a reference host is only ever one
 *  of the two.
 *
 *  **Exported for the AI answers tab** (SPEC §6, 2026-09-20, #918), which
 *  draws *named* and *linked* as two marks and has to split them the way
 *  the score already splits them. One implementation, so a cell on that
 *  screen and the rates inside `aiPresenceOf` can never come to disagree
 *  about what being named means. It is pure and takes no clock, so the
 *  screen reads stored references with it and measures nothing. */
export function classifyReferences(
  references: readonly string[],
  ownDomain: string,
  said: AnswerSaid = {}
): { cited: boolean; mentioned: boolean } {
  const own = hostOf(ownDomain);
  const brandToken = own.split(".")[0] ?? own;
  const siteName = said.siteName ?? null;
  let cited = false;
  let mentioned = false;
  for (const reference of references) {
    const host = hostOf(reference);
    if (host === own || host.endsWith(`.${own}`)) {
      cited = true;
    } else if (brandToken.length > 0 && tokensOf(reference).includes(brandToken)) {
      mentioned = true;
    }
  }
  for (const url of said.urls ?? []) {
    const host = hostOf(url);
    if (host === own || host.endsWith(`.${own}`)) cited = true;
    else if (pathNamesSite(url, siteName, own)) mentioned = true;
  }
  if (said.text !== undefined && namesSite(said.text, siteName, own)) mentioned = true;
  return { cited, mentioned };
}

/** What AIPresence reads of one SERP: its AI Overview's references, and its
 *  addresses and text where they were kept. */
type AiOverviewRead = {
  aiOverview: Pick<SerpAiOverview, "present" | "unread" | "referenceDomains" | "referenceUrls" | "text">;
};

/** What AI presence is read from (issue 1439): how many Google results were
 *  read, how many of them showed an AI answer, and in how many of those the
 *  answer named or linked the site. */
export interface AiSample {
  read: number;
  answered: number;
  mentioned: number;
  cited: number;
}

/** The counts AI presence and its range are read from. A SERP we could not
 *  read is not one that named nobody, and a SERP whose AI Overview's sources
 *  were not loaded (`unread`, issue 1357) is not read either: both are in no
 *  count. */
export function aiSampleOf(a: {
  serps: readonly Measured<AiOverviewRead>[];
  ownDomain: string;
  /** The site's name, as `namesSite` reads it; `null` where none is known. */
  siteName?: string | null;
}): AiSample {
  const sample: AiSample = { read: 0, answered: 0, mentioned: 0, cited: 0 };
  for (const serp of a.serps) {
    if (serp.kind === "unmeasured" || serp.value.aiOverview.unread === true) continue;
    sample.read++;
    if (!serp.value.aiOverview.present) continue;
    sample.answered++;
    const { referenceDomains, referenceUrls, text } = serp.value.aiOverview;
    const { cited, mentioned } = classifyReferences(referenceDomains, a.ownDomain, {
      ...(referenceUrls === undefined ? {} : { urls: referenceUrls }),
      ...(text === undefined ? {} : { text }),
      siteName: a.siteName ?? null,
    });
    if (mentioned) sample.mentioned++;
    if (cited) sample.cited++;
  }
  return sample;
}

/** §5's weighting of the two rates, over 0–100 and floored. */
function aiPresenceValue(mentionRate: number, citationRate: number): number {
  return Math.max(AI_PRESENCE_FLOOR, (AI_MENTION_WEIGHT * mentionRate + AI_CITATION_WEIGHT * citationRate) * SCALE);
}

/** BUILD §5's AIPresence, judged on the AI answers that exist (owner, issue
 *  1439). The rates are over the read SERPs that **showed** an AI answer: a
 *  search Google answers without one is no answer that left the site out,
 *  so it is in neither rate. How often AI answers appear is the AI-answers
 *  card's context line, never a penalty here.
 *
 *  - No SERP read: `unmeasured` with the fold of their reasons
 *    (`undeterminable` where none was handed in).
 *  - SERPs read and none showed an AI answer: `unmeasured`, `undeterminable`,
 *    `because` `NO_AI_ANSWERS`. There is nothing to judge, so Presence is
 *    search presence alone (`presenceOf`).
 *  - Otherwise the rate, however few answers back it: how sure it is, is
 *    the score's range (`aiPresenceRangeOf`), never a refusal to score.
 *
 *  A rate naming the customer nowhere is the `zero` arm, carrying the
 *  formula's floor of 1. */
export function aiPresenceOf(a: {
  serps: readonly Measured<AiOverviewRead>[];
  ownDomain: string;
  /** The site's name, as `namesSite` reads it; `null` where none is known. */
  siteName?: string | null;
  at: Date;
}): Measured<number> {
  const sample = aiSampleOf(a);
  if (sample.read === 0) return unmeasured(unmeasuredReasonOf(a.serps) ?? "undeterminable", a.at);
  if (sample.answered === 0) return unmeasured("undeterminable", a.at, NO_AI_ANSWERS);
  const raw = aiPresenceValue(sample.mentioned / sample.answered, sample.cited / sample.answered);
  return sample.mentioned === 0 && sample.cited === 0 ? measuredZero(raw, a.at) : measured(raw, a.at);
}

/** The Wilson score interval of `hits` in `n`, at `SCORE_ESTIMATE.z`: a
 *  range that is wide over few answers and narrows as they grow, and never
 *  leaves 0–1, even at 0 or n hits. Over no answers it is the whole of 0–1. */
export function wilsonOf(hits: number, n: number): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 1 };
  const z = SCORE_ESTIMATE.z;
  const p = hits / n;
  const z2 = z * z;
  const centre = p + z2 / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  const denominator = 1 + z2 / n;
  return { low: Math.max(0, (centre - spread) / denominator), high: Math.min(1, (centre + spread) / denominator) };
}

/** Where AI presence could lie given the answers behind it (issue 1439):
 *  each rate's Wilson interval, carried through §5's weighting. `null` where
 *  AI answered none of the searches read — there is no AI term to range
 *  over. Over no read at all it is the whole scale. */
export function aiPresenceRangeOf(sample: AiSample): { low: number; high: number } | null {
  if (sample.read > 0 && sample.answered === 0) return null;
  const mention = wilsonOf(sample.mentioned, sample.answered);
  const citation = wilsonOf(sample.cited, sample.answered);
  return { low: aiPresenceValue(mention.low, citation.low), high: aiPresenceValue(mention.high, citation.high) };
}
