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
import { AI_PRESENCE_MIN_READS, AI_READER_AGENTS, SCORING } from "@/lib/config/constants";
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
import { asciiLowerCase, type OnPageFacts } from "./parse";

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

/** The `because` of an AI presence read from too few results (issue 1419). */
export const TOO_FEW_READ = "too_few_read";

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
  return says(text, siteName ?? label) || says(text, own) || (label.length >= 4 && says(text, label));
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
    else if (namesSite(url, siteName, own)) mentioned = true;
  }
  if (said.text !== undefined && namesSite(said.text, siteName, own)) mentioned = true;
  return { cited, mentioned };
}

/** What AIPresence reads of one SERP: its AI Overview's references, and its
 *  addresses and text where they were kept. */
type AiOverviewRead = {
  aiOverview: Pick<SerpAiOverview, "present" | "unread" | "referenceDomains" | "referenceUrls" | "text">;
};

/** BUILD §5's AIPresence. The rates are over the SERPs whose AI-overview
 *  item was *measured* — never over the SERPs asked for, because a SERP we
 *  could not read is not a SERP that named nobody. Every SERP `unmeasured`
 *  yields `unmeasured` with the fold of their reasons; no SERPs handed in
 *  at all is `undeterminable`. A measured set naming the customer nowhere
 *  is the `zero` arm, carrying the formula's floor of 1. A SERP whose AI
 *  Overview's sources were not loaded (`unread`, issue 1357) is not one of
 *  the measured: it is in neither rate.
 *
 *  **Fewer than `AI_PRESENCE_MIN_READS` read is no rate** (issue
 *  1419). One read that cited only YouTube made zapier.com's AI presence 1,
 *  and through ∛ and √ that one result moved the whole score. Such a set is
 *  `unmeasured` with the fold of the unread SERPs' reasons — a read the
 *  deadline cut off says why — and `undeterminable` where every SERP asked
 *  was read; `because` says the sample was too small. */
export function aiPresenceOf(a: {
  serps: readonly Measured<AiOverviewRead>[];
  ownDomain: string;
  /** The site's name, as `namesSite` reads it; `null` where none is known. */
  siteName?: string | null;
  at: Date;
}): Measured<number> {
  const read: AiOverviewRead[] = [];
  for (const serp of a.serps) {
    if (serp.kind !== "unmeasured" && serp.value.aiOverview.unread !== true) read.push(serp.value);
  }
  if (read.length === 0) {
    return unmeasured(unmeasuredReasonOf(a.serps) ?? "undeterminable", a.at);
  }
  if (read.length < AI_PRESENCE_MIN_READS) {
    return unmeasured(unmeasuredReasonOf(a.serps) ?? "undeterminable", a.at, TOO_FEW_READ);
  }

  let mentions = 0;
  let citations = 0;
  for (const serp of read) {
    if (!serp.aiOverview.present) continue;
    const { referenceDomains, referenceUrls, text } = serp.aiOverview;
    const { cited, mentioned } = classifyReferences(referenceDomains, a.ownDomain, {
      ...(referenceUrls === undefined ? {} : { urls: referenceUrls }),
      ...(text === undefined ? {} : { text }),
      siteName: a.siteName ?? null,
    });
    if (mentioned) mentions++;
    if (cited) citations++;
  }
  const mentionRate = mentions / read.length;
  const citationRate = citations / read.length;
  const raw = (AI_MENTION_WEIGHT * mentionRate + AI_CITATION_WEIGHT * citationRate) * SCALE;
  const floored = Math.max(AI_PRESENCE_FLOOR, raw);
  return raw === 0 ? measuredZero(floored, a.at) : measured(floored, a.at);
}
