// BUILD §6.7 step 3 — the one intent classifier and the deterministic selection (issue #26; WO-073 and WO-074's plans)
//
// "**selection is deterministic and auditable end to end — the LLM touches
// vocabulary, never selection**" (BUILD §6.7). Nothing in this file takes a
// `CostContext`, reads a clock, opens a socket or calls a model: it is a pure
// function of a profile and a market, and `select/is-pure-and-model-free`
// asserts that over the resolved import graph rather than trusting the prose.
//
// It is also the product's **single** classification of a search: the
// opportunity engine ranks with the same `intentWeight` the twelve were
// selected by, so a second classifier is a defect, not an alternative.
//
// **Cold-start law (§6.6).** A market of nothing selects nothing and
// completes: `selectTwelve` returns 0…12 searches and has no code path that
// invents, repeats or pads a row to reach twelve. Fewer than twelve is a
// complete result, never a shortfall.
//
// **The relevance guard follows BUILD §6.7, not the archived WO-073's
// paraphrase of it.** The spec's rule is "every non-generic token must be
// supported by the profile's vocabulary", and its own worked example —
// "employee onboarding checklist HR" dying for a user-onboarding SaaS —
// survives only under that reading: the weaker "shares at least one token"
// rule WO-073 step 4 wrote down would keep it alive on `onboarding` alone.
// Where the spec rules, the archived plan does not re-open it (CLAUDE.md).
import { BATTERY, SELECTION } from "@/lib/config/constants";
import type { Profile } from "./profile";
import type { SuggestionRow } from "./market-set";

export type Intent = "decision" | "solution" | "problem" | "informational";

/** BP-025 `## Public interface`. `rank` is 1…n in the returned order. */
export interface SelectedSearch {
  keyword: string;
  volume: number;
  intent: Intent;
  score: number;
  rank: number;
}

// ── The shape tables. One edit changes a classification everywhere ──────────
//
// Every pattern below transcribes a shape BUILD §6.7 step 3 names:
//   decision      best X · X vs Y · X alternatives · top X tools
//   solution      {category} software|tool|app|platform
//   problem       how to {job} · {pain phrase}
//   informational what is X
// The one place the spec gives a shape rather than a phrase is "{pain
// phrase}", which has no shape at all — so it is read here as a closed table
// of pain markers (rule 1.1, chosen: reversal cost is one array in this file,
// and nothing is stored from it). Anything matching no table is
// `informational`, the lowest weight — an unrecognised search can never
// outrank a recognised decision search on its classification alone.

/** Matched in this order; the first table that matches decides. `problem` is
 *  tried before `solution` so an anchored "how to …" stays a problem search
 *  even when its object happens to carry an offering noun. */
export const INTENT_PATTERNS: ReadonlyArray<readonly [Intent, readonly RegExp[]]> = Object.freeze([
  ["decision", Object.freeze([/\bbest\b/, /\bvs\b/, /\bversus\b/, /\balternatives?\b/, /\btop\b/])],
  [
    "problem",
    Object.freeze([
      /^how (?:to|do|does|can|d[oi] i)\b/,
      /\bproblems?\b/,
      /\bissues?\b/,
      /\berrors?\b/,
      /\bnot working\b/,
      /\bfix\b/,
      /\btroubleshoot(?:ing)?\b/,
      /\bbroken\b/,
    ]),
  ],
  ["solution", Object.freeze([/\b(?:software|tools?|apps?|platforms?)\b/])],
  [
    "informational",
    Object.freeze([/^what (?:is|are)\b/, /^why\b/, /^who\b/, /^when\b/, /^where\b/, /\bdefinitions?\b/, /\bmeaning\b/]),
  ],
] as const);

/** The "how-to" shape `SELECTION.maxHowTo` caps — the anchored form only, not
 *  every pain phrase that classifies as `problem`. */
const HOW_TO = /^how (?:to|do|does|can|d[oi] i)\b/;

/** Function words. Dropped by `stemKey` (so word order and connectives cannot
 *  make two spellings of one search look like two searches) and never counted
 *  as a token the relevance guard demands support for. */
export const STOP_WORDS: ReadonlySet<string> = Object.freeze(
  new Set([
    "a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "at", "by",
    "from", "with", "is", "are", "be", "my", "your", "our", "their", "it",
    "its", "that", "this", "i", "you", "we", "do", "does", "can",
  ])
);

/** Tokens that carry a search's *shape* rather than its *subject*. The
 *  relevance guard demands profile support for every other token; demanding
 *  it for these would kill "best {category} software" on the word "best". */
export const GENERIC_TOKENS: ReadonlySet<string> = Object.freeze(
  new Set([
    "best", "top", "vs", "versus", "alternative", "comparison", "compare",
    "review", "software", "tool", "app", "platform", "solution", "how",
    "what", "why", "which", "who", "when", "where", "free", "online",
    "cheap", "cheapest", "price", "pricing", "cost", "guide", "example",
    "template", "list", "near", "me", "new", "good", "great", "not",
    "working", "fix", "problem", "issue", "error", "broken", "troubleshoot",
  ])
);

// ── Normalisation, shared by every predicate below ─────────────────────────

/** Lower-case, punctuation to space, whitespace collapsed. Word order and
 *  stop-words survive: the shape tables read them. */
function normalise(keyword: string): string {
  return keyword.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

/** Plural content tokens to their singular. Deliberately blunt and total —
 *  both sides of every comparison pass through it, so a word it stems oddly
 *  still matches itself. */
function singular(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (/(?:sses|shes|ches|xes|zes)$/.test(token)) return token.slice(0, -2);
  if (token.endsWith("ss") || token.endsWith("us")) return token;
  if (token.endsWith("s")) return token.slice(0, -1);
  return token;
}

/** The tokens a search is *about*: normalised, stop-words dropped, singular. */
function contentTokens(text: string): string[] {
  const out: string[] = [];
  for (const token of normalise(text).split(" ")) {
    if (token === "" || STOP_WORDS.has(token)) continue;
    out.push(singular(token));
  }
  return out;
}

/** True when every token of `phrase` appears among `tokens` — a token match,
 *  never a substring one, so a brand cannot swallow an unrelated word that
 *  merely contains it. A phrase with no content tokens matches nothing. */
function phraseIsPresent(phrase: string, tokens: ReadonlySet<string>): boolean {
  const wanted = contentTokens(phrase);
  return wanted.length > 0 && wanted.every((token) => tokens.has(token));
}

function namesAnyOf(keyword: string, phrases: readonly string[]): boolean {
  const tokens = new Set(contentTokens(keyword));
  return phrases.some((phrase) => phraseIsPresent(phrase, tokens));
}

// ── The four predicates ────────────────────────────────────────────────────

/**
 * Total: every keyword lands in exactly one arm. `own_brand` first — a search
 * carrying the customer's own name measures nothing about discovery and is
 * dropped before its shape is ever read (BUILD §6.7 step 3).
 */
export function classifyIntent(keyword: string, p: Profile): Intent | "own_brand" {
  if (namesAnyOf(keyword, p.brandTokens)) return "own_brand";
  const text = normalise(keyword);
  for (const [intent, patterns] of INTENT_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(text))) return intent;
  }
  return "informational";
}

/**
 * `SELECTION.intentWeights[intent]`, and `0` for `own_brand` — so a caller
 * that ranks by weight drops an own-brand search without a second branch.
 * The second parameter is required and there is no one-argument form: the
 * own-brand drop set is the profile's, and a weight derived without it would
 * be a second classifier.
 */
export function intentWeight(keyword: string, p: Profile): number {
  const intent = classifyIntent(keyword, p);
  return intent === "own_brand" ? 0 : SELECTION.intentWeights[intent];
}

/**
 * The near-duplicate collapse key: two searches differing only in plural
 * form, word order, punctuation or stop-words produce the same key, and two
 * differing in any content token do not.
 */
export function stemKey(keyword: string): string {
  return contentTokens(keyword).sort().join(" ");
}

/**
 * BUILD §6.7 step 3's relevance guard, which kills seed drift: **every**
 * non-generic token must be supported by the profile's own vocabulary, and at
 * least one token must actually be supported — so an empty profile supports
 * nothing and passes nothing, rather than passing every keyword vacuously.
 *
 * The support set is the profile's and only the profile's: its `vocabulary`,
 * `category`, `offeringType`, `job`, `audienceTerms` and `namedRivals`. The
 * last is not decoration — `SELECTION.maxRivalBrand` admits up to three
 * rival-brand searches into the twelve, which a guard blind to the rivals the
 * site itself names would delete before the cap ever saw them.
 *
 * One addition from outside the profile: the category the founder confirmed
 * (`sites.category`, or the free report's correction), where the pass has
 * one. It is the seed the market was bought on (#767), so a guard blind to
 * its words would delete the very searches it asked for.
 */
export function passesRelevanceGuard(keyword: string, p: Profile, category?: string): boolean {
  const support = supportSet(p, category);
  let supported = 0;
  for (const token of contentTokens(keyword)) {
    if (support.has(token)) {
      supported++;
      continue;
    }
    if (!GENERIC_TOKENS.has(token)) return false;
  }
  return supported > 0;
}

function supportSet(p: Profile, category?: string): ReadonlySet<string> {
  const tokens = new Set<string>();
  const sources = [category ?? "", p.category, p.offeringType, p.job, ...p.vocabulary, ...p.audienceTerms, ...p.namedRivals];
  for (const source of sources) {
    for (const token of contentTokens(source)) tokens.add(token);
  }
  return tokens;
}

// ── The selection ──────────────────────────────────────────────────────────

interface Candidate {
  keyword: string;
  volume: number;
  intent: Intent;
  score: number;
  rivalBrand: boolean;
  howTo: boolean;
}

/** Score descending, then volume descending, then keyword ascending — a
 *  total order over distinct keywords, so two runs over the same market can
 *  never differ. Plain string comparison, never `localeCompare`: the order
 *  must not depend on the machine's locale. */
function byRank(a: Candidate, b: Candidate): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.volume !== b.volume) return b.volume - a.volume;
  return a.keyword < b.keyword ? -1 : a.keyword > b.keyword ? 1 : 0;
}

const FLOORS: ReadonlyArray<readonly [Intent, number]> = Object.freeze([
  ["decision", SELECTION.minDecision],
  ["solution", SELECTION.minSolution],
] as const);

/**
 * The twelve — or as many as the market yielded.
 *
 * `score = intentWeight × log10(volume + 1)`, volume floor 50/mo, own-brand
 * dropped, relevance guard against the profile's vocabulary, near-duplicate
 * collapse, composition constraints. Pure: no context, no clock, no I/O.
 *
 * Constraints are **relaxed in one fixed order — floors first**: a floor that
 * cannot be met means the market yielded fewer than twelve of that intent,
 * which is legal, whereas exceeding a cap would put a leaderboard where a
 * portfolio belongs.
 */
export function selectTwelve(a: {
  profile: Profile;
  market: SuggestionRow[];
  /** The founder's confirmed category, where the pass has one — it joins
   *  the relevance guard's support set. */
  category?: string;
}): SelectedSearch[] {
  const { profile } = a;

  const survivors: Candidate[] = [];
  for (const row of a.market) {
    if (row.volume < SELECTION.volumeFloorPerMonth) continue;
    const intent = classifyIntent(row.keyword, profile);
    if (intent === "own_brand") continue;
    if (!passesRelevanceGuard(row.keyword, profile, a.category)) continue;
    survivors.push({
      keyword: row.keyword,
      volume: row.volume,
      intent,
      score: SELECTION.intentWeights[intent] * Math.log10(row.volume + 1),
      rivalBrand: namesAnyOf(row.keyword, profile.namedRivals),
      howTo: HOW_TO.test(normalise(row.keyword)),
    });
  }

  // Near-duplicate collapse: one survivor per stem, the highest volume, and
  // on an exact tie the keyword that sorts first — a total rule, so the
  // group's winner does not depend on the order the market arrived in.
  const byStem = new Map<string, Candidate>();
  for (const candidate of survivors) {
    const key = stemKey(candidate.keyword);
    const held = byStem.get(key);
    if (
      held === undefined ||
      candidate.volume > held.volume ||
      (candidate.volume === held.volume && candidate.keyword < held.keyword)
    ) {
      byStem.set(key, candidate);
    }
  }

  const ranked = [...byStem.values()].sort(byRank);
  const picked = new Set<Candidate>();
  const count = (predicate: (c: Candidate) => boolean): number => {
    let n = 0;
    for (const candidate of picked) if (predicate(candidate)) n++;
    return n;
  };
  const admits = (candidate: Candidate): boolean =>
    (!candidate.rivalBrand || count((c) => c.rivalBrand) < SELECTION.maxRivalBrand) &&
    (!candidate.howTo || count((c) => c.howTo) < SELECTION.maxHowTo);

  for (const candidate of ranked) {
    if (picked.size >= BATTERY.QUESTIONS) break;
    if (admits(candidate)) picked.add(candidate);
  }

  const unmetFloors: Intent[] = [];
  for (const [intent, floor] of FLOORS) {
    while (count((c) => c.intent === intent) < floor) {
      const promote = ranked.find((c) => c.intent === intent && !picked.has(c) && admits(c));
      // The market yielded no more of this intent: the floor is relaxed, and
      // the shorter set is the honest answer.
      if (promote === undefined) {
        unmetFloors.push(intent);
        break;
      }
      if (picked.size < BATTERY.QUESTIONS) {
        picked.add(promote);
        continue;
      }
      // Make room by evicting the lowest-ranked picked search that no floor
      // needs. Where none exists, this floor is relaxed rather than another
      // floor broken to satisfy it.
      const evict = ranked.filter((c) => picked.has(c)).reverse().find((c) => isSurplus(c, intent, count));
      if (evict === undefined) {
        unmetFloors.push(intent);
        break;
      }
      picked.delete(evict);
      picked.add(promote);
    }
  }

  const selected = ranked
    .filter((candidate) => picked.has(candidate))
    .map((candidate, index) => ({
      keyword: candidate.keyword,
      volume: candidate.volume,
      intent: candidate.intent,
      score: candidate.score,
      rank: index + 1,
    }));

  logSelection(ranked.length, selected.length, unmetFloors);
  return selected;
}

/** A picked search a floor does not need: not of the intent being filled, and
 *  either carrying no floor of its own or standing above it. */
function isSurplus(
  candidate: Candidate,
  filling: Intent,
  count: (predicate: (c: Candidate) => boolean) => number
): boolean {
  if (candidate.intent === filling) return false;
  const floor = FLOORS.find(([intent]) => intent === candidate.intent);
  if (floor === undefined) return true;
  return count((c) => c.intent === candidate.intent) > floor[1];
}

/** BP-025 `## NFR budget`: "selected count and which constraint bound it".
 *  Counts and constraint names only — never a keyword. */
function logSelection(eligible: number, selected: number, unmetFloors: readonly Intent[]): void {
  const boundBy =
    selected >= BATTERY.QUESTIONS ? "questions" : selected === eligible ? "market" : "caps";
  console.log(JSON.stringify({ event: "selection", eligible, selected, boundBy, unmetFloors }));
}
