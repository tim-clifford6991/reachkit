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
import { SHAPES, languagePack } from "@/lib/locale/language";
import type { Language, Place } from "@/lib/locale/locales";
import { BATTERY, SELECTION, WINNABILITY } from "@/lib/config/constants";
import { difficultyCeiling, qualifyingDemand } from "@/lib/opportunities/winnability/bars";
import { namesPlace, saysNearMe, withoutPlace } from "@/lib/locale/place";
import { BUSINESS_KINDS, type BusinessKind } from "@/lib/market/kinds";
import { neverMeasured, type MeasuredMarket } from "./measured";
import type { Profile } from "./profile-types";
import type { SuggestionRow } from "./market-set";
import { malformedSearch } from "./well-formed";
import { isCategoryName } from "@/lib/market/rivals/category-name";

/** A row selection reads: a suggestion, or a ranked keyword pooled beside
 *  them (SPEC §6 thin markets, #778). `rivals` names the tracked rivals that
 *  rank for it; their brand tokens support it in the relevance guard. */
export interface MarketRow extends SuggestionRow {
  rivals?: readonly string[];
}

export type Intent = "decision" | "solution" | "problem" | "informational";

/** BP-025 `## Public interface`. `rank` is 1…n in the returned order. */
export interface SelectedSearch {
  keyword: string;
  volume: number;
  intent: Intent;
  score: number;
  rank: number;
  /** The volume step this search was admitted at (SPEC §6 thin markets,
   *  2026-09-16) — the highest of `SELECTION.volumeSteps` its volume meets,
   *  and never below the floor the selection ran at. Absent on a report
   *  stored before #778, which selected at `SELECTION.volumeFloorPerMonth`. */
  floor?: number;
  /** The vendor's keyword difficulty, 0–100, where it gave one (issue 858)
   *  — derivation bands the target by it. */
  difficulty?: number;
  /** True where the search is one of the market's own searched terms
   *  (SPEC §6, owner D65, issue 1303): measured at its own volume, whatever
   *  the site's demand ceiling. */
  term?: true;
}

/** A row's difficulty as a stored row carries it: present only where the
 *  vendor gave one, so a row without it stores as it always did. */
export function difficultyField(difficulty: number | null | undefined): { difficulty?: number } {
  return difficulty === undefined || difficulty === null ? {} : { difficulty };
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
  ["decision", Object.freeze([SHAPES.best, SHAPES.comparison])],
  ["problem", Object.freeze([SHAPES.howTo, SHAPES.pain])],
  ["solution", Object.freeze([SHAPES.solution])],
  ["informational", Object.freeze([SHAPES.informational])],
] as const);

/** The "how-to" shape `SELECTION.maxHowTo` caps — the anchored form only, not
 *  every pain phrase that classifies as `problem`. */
const HOW_TO = SHAPES.howTo;

/** English function words. Dropped by `stemKey` (so word order and
 *  connectives cannot make two spellings of one search look like two
 *  searches) and never counted as a token the relevance guard demands
 *  support for. Each language has its own (`src/lib/locale/language/`);
 *  these two are the English ones, for the readers that name them. */
export const STOP_WORDS: ReadonlySet<string> = languagePack("en").stopWords;

/** Tokens that carry a search's *shape* rather than its *subject*. The
 *  relevance guard demands profile support for every other token; demanding
 *  it for these would kill "best {category} software" on the word "best". */
export const GENERIC_TOKENS: ReadonlySet<string> = languagePack("en").genericTokens;

// ── Normalisation, shared by every predicate below ─────────────────────────

/** Lower-case, punctuation to space, whitespace collapsed. Word order and
 *  stop-words survive: the shape tables read them. */
function normalise(keyword: string): string {
  return keyword.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

/** Plural content tokens to their singular. Deliberately blunt and total —
 *  both sides of every comparison pass through it, so a word it stems oddly
 *  still matches itself. */
export function contentTokens(text: string, language: Language = "en"): string[] {
  const pack = languagePack(language);
  const out: string[] = [];
  for (const token of normalise(text).split(" ")) {
    if (token === "" || pack.stopWords.has(token)) continue;
    out.push(pack.stem(token));
  }
  return out;
}

function phraseIsPresent(phrase: string, tokens: ReadonlySet<string>, language: Language): boolean {
  const wanted = contentTokens(phrase, language);
  return wanted.length > 0 && wanted.every((token) => tokens.has(token));
}

function namesAnyOf(keyword: string, phrases: readonly string[], language: Language = "en"): boolean {
  const tokens = new Set(contentTokens(keyword, language));
  return phrases.some((phrase) => phraseIsPresent(phrase, tokens, language));
}

// ── The four predicates ────────────────────────────────────────────────────

/**
 * The profile's brand tokens that name the business (SPEC §6, 2026-10-14,
 * issue 1423). A product name made only of the market's own words — its
 * category, its vocabulary, its offering type — is also the category's word
 * ("Payments", "Billing" for a payment processing platform), and dropping
 * every search that says it drops the market. The same test issue 1369
 * applies to a rival's name; a token with one word of its own ("Radar",
 * "Marketing Hub") still names the business.
 *
 * The first token is the business's own name (the mail and the writer read
 * it so) and always stands, and a vocabulary phrase that says it
 * ("reachkit autopilot") is not a word of the market.
 */
export function ownBrandTokens(p: Profile): readonly string[] {
  const [name, ...products] = p.brandTokens;
  if (name === undefined) return [];
  const language = p.language ?? "en";
  const vocabulary = p.vocabulary.filter((phrase) => !namesAnyOf(phrase, [name], language));
  const market = { category: p.category, synonyms: [...vocabulary, p.offeringType] };
  return [name, ...products.filter((token) => !isCategoryName(token, market, language))];
}

/**
 * Total: every keyword lands in exactly one arm. `own_brand` first — a search
 * carrying the customer's own name measures nothing about discovery and is
 * dropped before its shape is ever read (BUILD §6.7 step 3).
 */
export function classifyIntent(keyword: string, p: Profile, where?: PlacedBusiness | null): Intent | "own_brand" {
  if (namesAnyOf(keyword, ownBrandTokens(p), p.language)) return "own_brand";
  const text = normalise(keyword);
  const local = where != null && asksForService(keyword, p, where);
  for (const [intent, patterns] of INTENT_PATTERNS) {
    if (!patterns.some((pattern) => pattern.test(text))) continue;
    // Issue 1561: only a "best" or "vs", or an anchored "how to", outranks
    // a local service asked for where it is sold.
    return local && intent !== "decision" && !HOW_TO.test(text) ? "solution" : intent;
  }
  return local ? "solution" : "informational";
}

/** The business a search is read against where it can serve one place
 *  (issue 1561): its kind, the place it serves, `null` where it serves
 *  none, and the market's own words for what it sells. */
export interface PlacedBusiness {
  kind?: BusinessKind | null;
  serves?: Place | null;
  marketWords?: string;
}

/**
 * Whether a search asks a business that serves one place for its service
 * there (issue 1561): the kind is one that can serve a place, the search
 * names that place, says "near me", or carries one of its language's local
 * words ("emergency", "24 hour", "notdienst"), and what it asks for is the
 * business's own offering (`namesOffering`). "emergency plumber austin" is
 * bought, not read about, for a plumber in Austin as much as "aeo software"
 * is for a software maker.
 */
export function asksForService(keyword: string, p: Profile, where: PlacedBusiness): boolean {
  const kind = where.kind ?? null;
  if (kind === null || !BUSINESS_KINDS[kind].placed) return false;
  const place = where.serves ?? null;
  const pack = languagePack(p.language ?? "en");
  const said =
    (place !== null && namesPlace(keyword, place)) ||
    saysNearMe(keyword) ||
    normalise(keyword).split(" ").some((word) => pack.offering.local.has(word));
  if (!said) return false;
  return namesOffering(place === null ? keyword : withoutPlace(keyword, place), p, where.marketWords);
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
export function stemKey(keyword: string, language: Language = "en"): string {
  return contentTokens(keyword, language).sort().join(" ");
}

/**
 * BUILD §6.7 step 3's relevance guard, which kills seed drift: **every**
 * non-generic token must be supported by the profile's own vocabulary, and at
 * least one token must actually be supported — so an empty profile supports
 * nothing and passes nothing, rather than passing every keyword vacuously.
 *
 * The support set is the profile's and only the profile's: its `vocabulary`,
 * `category`, `offeringType`, `job`, every offering's category and name
 * (issue 1454), `audienceTerms` and `namedRivals`. The
 * last is not decoration — `SELECTION.maxRivalBrand` admits up to three
 * rival-brand searches into the twelve, which a guard blind to the rivals the
 * site itself names would delete before the cap ever saw them.
 *
 * One addition from outside the profile: the category the founder confirmed
 * (`sites.category`, or the free report's correction), where the pass has
 * one. It is the seed the market was bought on (#767), so a guard blind to
 * its words would delete the very searches it asked for.
 *
 * And for a ranked keyword pooled from a tracked rival (SPEC §6 thin
 * markets, #778): that rival's brand tokens — its domain's first label — so
 * "appcues alternatives" survives off the rival's own rows. The category's
 * head term is already inside `category`'s tokens.
 */
export function passesRelevanceGuard(
  keyword: string,
  p: Profile,
  category?: string,
  rivals: readonly string[] = []
): boolean {
  const pack = languagePack(p.language ?? "en");
  const support = supportSet(p, category, rivals);
  let supported = 0;
  for (const token of contentTokens(keyword, p.language)) {
    if (pack.supports(token, support)) {
      supported++;
      continue;
    }
    if (!pack.genericTokens.has(token)) return false;
  }
  return supported > 0;
}

/**
 * Whether a search names what a business measured in its town offers (issue
 * 1449). A local buyer searches for the service or the place to go — "water
 * heater repair", "coffee shop", "french restaurant" — so the search's head,
 * the last word of what it asks for before any "for", "in" or "near" and
 * past the words that say where or when, is a word of the business's
 * category, offering, job or confirmed market, or a word that names a
 * provider or a service in any trade. "seasonal ingredients" for a
 * restaurant, or "hmrc online accounts" for an accountant, names neither.
 * `subject` is the search without its town.
 */
export function namesOffering(subject: string, p: Profile, marketWords?: string): boolean {
  const language = p.language ?? "en";
  const pack = languagePack(language);
  const object: string[] = [];
  for (const word of normalise(subject).split(" ")) {
    if (word === "") continue;
    if (object.length > 0 && pack.offering.before.has(word)) break;
    const token = pack.stem(word);
    if (pack.stopWords.has(word) || pack.genericTokens.has(token) || pack.offering.local.has(word)) continue;
    object.push(token);
  }
  const head = object.at(-1);
  if (head === undefined) return false;
  const offering = new Set<string>();
  for (const source of [marketWords ?? "", p.category, p.offeringType, p.job, ...pack.offering.providers]) {
    for (const token of contentTokens(source, language)) offering.add(token);
  }
  return pack.supports(head, offering);
}

function supportSet(p: Profile, category?: string, rivals: readonly string[] = []): ReadonlySet<string> {
  const tokens = new Set<string>();
  const sources = [
    category ?? "",
    p.category,
    p.offeringType,
    p.job,
    // Issue 1454: every line the business sells is its market too.
    ...(p.offerings ?? []).flatMap((o) => [o.category, o.name]),
    ...p.vocabulary,
    ...p.audienceTerms,
    ...p.namedRivals,
    ...rivals.map(brandOf),
  ];
  for (const source of sources) {
    for (const token of contentTokens(source, p.language)) tokens.add(token);
  }
  return tokens;
}

/** A tracked rival's brand as a search spells it: the domain's first label
 *  with its hyphens closed up — `user-pilot.com` → `userpilot`. Never the
 *  label's parts, which would let "user" support any search. */
export function brandOf(domain: string): string {
  const label = domain.toLowerCase().replace(/^www\./, "").split(".")[0] ?? "";
  return label.replace(/[^a-z0-9]/g, "");
}

// ── The selection ──────────────────────────────────────────────────────────

interface Candidate {
  keyword: string;
  volume: number;
  difficulty: number | null;
  intent: Intent;
  score: number;
  rivalBrand: boolean;
  howTo: boolean;
  term: boolean;
}

/** The lowest volume step: a market term below it is not measured. */
const LOWEST_FLOOR: number = SELECTION.volumeSteps[SELECTION.volumeSteps.length - 1]!;

/** Score descending, then volume descending, then keyword ascending — a
 *  total order over distinct keywords, so two runs over the same market can
 *  never differ. Plain string comparison, never `localeCompare`: the order
 *  must not depend on the machine's locale. */
function byRank(a: Candidate, b: Candidate): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.volume !== b.volume) return b.volume - a.volume;
  return a.keyword < b.keyword ? -1 : a.keyword > b.keyword ? 1 : 0;
}

/**
 * The twelve — or as many as the market yielded.
 *
 * `score = intentWeight × log10(volume + 1)` (× `SELECTION.longTailWeight`
 * for a long-tail search at cold start, issue 858), volume floor 50/mo unless
 * the caller steps it down (SPEC §6 thin markets, `widen.ts`), volume ceiling
 * `qualifyingDemand(ownRanked)` (SPEC §6 right-sizing, issue 830), difficulty
 * ceiling `difficultyCeiling(ownRanked)` where the vendor gave one, own-brand
 * dropped, relevance guard against the profile's vocabulary, near-duplicate
 * collapse, composition constraints. Pure: no context, no clock, no I/O.
 *
 * The two caps (rival-brand, how-to) hold; the floors that forced best, top
 * and vs searches into the twelve are gone (SPEC §6, 2026-09-29, issue 1134).
 */
export function selectTwelve(a: {
  profile: Profile;
  market: readonly MarketRow[];
  /** The founder's confirmed category, where the pass has one — it joins
   *  the relevance guard's support set. */
  category?: string;
  /** A concluded market's other names (#1195): they join the support set
   *  beside the category, so a search in the market's own words is not
   *  dropped as off-topic. */
  synonyms?: readonly string[];
  /** The volume floor, one of `SELECTION.volumeSteps`. Defaults to the
   *  first step. */
  floor?: number;
  /** How many keywords the site itself ranks for — the footprint the
   *  demand ceiling scales with, the same number derivation bands by
   *  (unmeasured reads as the cold-start 0). Required: a selection that
   *  never saw the site's size could pick a head term it cannot win. */
  ownRanked: number;
  /** The market in force, where the site has one (SPEC §6, owner D65, issue
   *  1303): its searched terms are measured at their own volume — the
   *  demand and difficulty ceilings are for what the site is offered to
   *  write, and a market's own searches are what it is measured on — and a
   *  search that is off this market is never selected (`measured.ts`). */
  measured?: MeasuredMarket;
  /** Where the pass measures, where it has no market in force to say so (a
   *  free scan with a town, issue 1441): the town is where a search is asked,
   *  not part of what the business sells. */
  place?: Place;
  /** How many to return; the twelve unless a caller wants the runners-up
   *  too, to have them judged with the twelve. */
  limit?: number;
}): SelectedSearch[] {
  const { profile } = a;
  const limit = a.limit ?? BATTERY.QUESTIONS;
  const floor = a.floor ?? SELECTION.volumeFloorPerMonth;
  // SPEC §6 right-sizing law (2026-09-16, issue 830): a search above the
  // most demand this site may be offered is not a question for it at all —
  // it takes no slot among the twelve and buys no SERP or battery call.
  const ceiling = qualifyingDemand(a.ownRanked);
  // Issue 858: nor one harder than its footprint allows, by the vendor's own
  // difficulty. The ladder steps volume down; it never raises this.
  const hardest = difficultyCeiling(a.ownRanked);
  // While the demand ceiling is at its cold-start floor, specific long-tail
  // searches lead: a new site wins "seo content brief template for
  // startups", not "seo software".
  const coldStart = ceiling === WINNABILITY.demandFloor;
  const named = [a.category ?? "", ...(a.synonyms ?? [])].filter((n) => n.trim() !== "");
  const marketWords = named.length === 0 ? undefined : named.join(" ");

  const survivors: Candidate[] = [];
  // D65: the market's own searched terms, each at its volume. On the market
  // by what they are, so neither ceiling nor the relevance guard reads them.
  for (const term of a.measured?.terms ?? []) {
    const keyword = term.term.toLowerCase().replace(/\s+/g, " ").trim();
    if (term.volume < LOWEST_FLOOR || keyword === "" || malformedSearch(keyword, a.measured?.rivals) !== null) continue;
    const intent = classifyIntent(keyword, profile);
    if (intent === "own_brand") continue;
    survivors.push({
      keyword,
      volume: term.volume,
      difficulty: null,
      intent,
      score: Math.max(SELECTION.intentWeights[intent], SELECTION.intentWeights.solution) * Math.log10(term.volume + 1),
      rivalBrand: false,
      howTo: false,
      term: true,
    });
  }
  for (const row of a.market) {
    if (row.volume < floor || row.volume > ceiling) continue;
    // Issue 1314: a search nobody would type as it stands is not measured,
    // whatever volume the vendor lists it at, with or without a market.
    if (malformedSearch(row.keyword, a.measured?.rivals) !== null) continue;
    if (a.measured !== undefined && neverMeasured(row.keyword, a.measured) !== null) continue;
    const difficulty = row.difficulty ?? null;
    if (difficulty !== null && difficulty > hardest) continue;
    const intent = classifyIntent(row.keyword, profile);
    if (intent === "own_brand") continue;
    const rivals = row.rivals ?? [];
    // D67: the place is where the search is asked, not part of what is sold.
    const place = a.measured?.place ?? a.place;
    const subject = place === undefined ? row.keyword : withoutPlace(row.keyword, place);
    if (!passesRelevanceGuard(subject, profile, marketWords, rivals)) continue;
    // Issue 1449: a business measured in its town is searched for by what
    // it offers.
    if (place !== undefined && !namesOffering(subject, profile, marketWords)) continue;
    const longTail = coldStart && contentTokens(row.keyword, profile.language).length >= SELECTION.longTailWords;
    survivors.push({
      keyword: row.keyword,
      volume: row.volume,
      difficulty,
      intent,
      score:
        SELECTION.intentWeights[intent] *
        Math.log10(row.volume + 1) *
        (longTail ? SELECTION.longTailWeight : 1),
      rivalBrand: namesAnyOf(row.keyword, [...profile.namedRivals, ...rivals.map(brandOf)], profile.language),
      howTo: HOW_TO.test(normalise(row.keyword)),
      term: false,
    });
  }

  // Near-duplicate collapse: one survivor per stem, the highest volume, and
  // on an exact tie the keyword that sorts first — a total rule, so the
  // group's winner does not depend on the order the market arrived in.
  const byStem = new Map<string, Candidate>();
  for (const candidate of survivors) {
    const key = stemKey(candidate.keyword, profile.language);
    const held = byStem.get(key);
    // A market term stands for its stem: it is the measured volume.
    if (held?.term === true && !candidate.term) continue;
    if (
      held === undefined ||
      (candidate.term && !held.term) ||
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

  // D65: the market's terms first, most searched first, in up to
  // `SELECTION.maxMarketTerms` of the places; then everything by score.
  const terms = ranked.filter((candidate) => candidate.term).sort((x, y) => y.volume - x.volume || byRank(x, y));
  for (const candidate of terms.slice(0, Math.min(SELECTION.maxMarketTerms, limit))) picked.add(candidate);
  for (const candidate of ranked) {
    if (picked.size >= limit) break;
    if (admits(candidate)) picked.add(candidate);
  }

  const selected = ranked
    .filter((candidate) => picked.has(candidate))
    .map((candidate, index) => ({
      keyword: candidate.keyword,
      volume: candidate.volume,
      intent: candidate.intent,
      score: candidate.score,
      rank: index + 1,
      floor: stepOf(candidate.volume, floor),
      ...difficultyField(candidate.difficulty),
      ...(candidate.term ? { term: true as const } : {}),
    }));

  logSelection(ranked.length, Math.min(selected.length, BATTERY.QUESTIONS), floor);
  return selected;
}

/** BP-025 `## NFR budget`: "selected count and which constraint bound it".
 *  Counts and constraint names only — never a keyword. */
function logSelection(eligible: number, selected: number, floor: number): void {
  const boundBy =
    selected >= BATTERY.QUESTIONS ? "questions" : selected === eligible ? "market" : "caps";
  console.log(JSON.stringify({ event: "selection", eligible, selected, boundBy, floor }));
}

/** The step a search was admitted at: the highest volume step its volume
 *  meets, never below the floor the selection ran at. */
function stepOf(volume: number, floor: number): number {
  return SELECTION.volumeSteps.find((step) => step >= floor && volume >= step) ?? floor;
}
