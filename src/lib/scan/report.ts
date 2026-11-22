// BUILD §4.1, §6.3: the stored report, declared once, and the one read of it (`readCurrentReport`).
// The blob is what `/scan/{domain}` renders and what the pass recorded: the record half (market, twelve, SERPs, rivals, coherence) is read by
// the correction, by a deep pass reusing a fresh free scan inside its cache windows (§6.4), and by anyone reproducing a report.
// A section that could not be produced is present and says so: `null` for the screen's, `unmeasured` for the record's; never an absent key.
// The engines' own prose is never stored: only whether an engine answered and whom it named.
// Each fact has one home. The category is `market`'s (`categoryOf`). The twelve keep two shapes: `questions` is the measurement, and
// `aiAnswers.rows[].question` the screen's projection behind `GeneratedText`, written only by `storedQuestionOf` at assembly.
// `coherence` is a member of the blob, not of `MarketSet`.
// Old versions are upgraded here, since `readStoredReport` is the blob's one reader; each upgrade writes frozen literals, never a moving helper.
import { measuredLocale, type Country, type Locale } from "@/lib/locale/locales";
import { AI_READER_AGENTS, TIMING } from "@/lib/config/constants";
import type { RobotsPolicy } from "@/lib/egress/types";
import type { SiteIssuesSection } from "@/lib/site-issues/types";
import type { CoherenceVerdict } from "@/lib/market/coherence/check";
import type { CorrectionState } from "@/lib/market/coherence/state";
import type { EngineCell } from "@/lib/market/questions/matrix";
import type { MarketSet } from "@/lib/market/questions/market-set";
import type { PromptKind } from "@/lib/market/prompts/generate";
import type { AnswerStatement } from "@/lib/market/prompts/misstated-types";
import type { Question } from "@/lib/market/questions/phrase";
import type { RivalCandidate } from "@/lib/market/rivals/derive";
import type { RivalSize } from "@/lib/market/rivals/size";
import type { PresenceCard } from "@/lib/market/rivals/presence";
import type { Measured } from "@/lib/measure/measured";
import type { OnPageFacts } from "@/lib/measure/parse";
import type { GeneratedText } from "@/lib/presentation/generated";
import type { Verdict } from "@/lib/measure/verdict";
import type { RankedRow, SerpResult } from "@/lib/vendors/dataforseo/types";
import { readPastProtection } from "./challenged";
import type { CanonicalDomain } from "./domain";
import { upgradeFromVersion13 } from "./upgrade-v14";

export type Tier = "free" | "deep" | "weekly";

/** The tiers a signed-in site's screens count as its pass; a free re-scan carrying the site's id is not one. */
export const SITE_PASS_TIERS = ["weekly", "deep"] as const satisfies readonly Tier[];

/** How a pass ended: the values `scans.stopped_reason` is constrained to. `site_unreadable` is a pass whose first stage could not read the home document,
 *  so nothing after it is attempted and it is never called `complete`. */
export type StoppedReason = "complete" | "time_ceiling" | "spend_ceiling" | "site_unreadable" | "failed";

/** The one blob version this build writes; an unknown version throws, since `null` would read as "no report". */
export const REPORT_VERSION = 14;

/** One cell of the AI-answers matrix: one question, one measured SERP (`matrix.ts` owns it). `unmeasured` lowers the denominator and is never a place the customer was ignored. */
export type AnswerCell =
  | {
      kind: "answered";
      citedDomains: readonly string[];
      namesCustomer: boolean;
      /** The site's own pages this answer cited, which a page's verdict reads before crediting it. Absent where the addresses were not read
       *  (older cells): absent is not empty and decides nothing. */
      ownUrls?: readonly string[];
      /** The answer names the site (`classifyReferences`' mention, from its text or a cited address elsewhere). Absent where it does not, and on older cells. */
      named?: true;
    }
  | { kind: "no_answer" }
  | {
      kind: "unmeasured";
      reason: "undeterminable" | "not_attempted";
      /** What the engine last said, where heard: a vendor failure's kind, never a message. Optional: "Retry this part" and the engine column read it
       *  to say why a column is blank rather than drawing a miss. */
      because?: string;
    };

/** Re-exported so a screen or fixture can name the type without a runtime edge into the market leaf: `_fixture/states.ts` is reachable from
 *  middleware, and importing `matrix.ts` there pulls `node:net` into the Edge bundle and fails the build. */
export type { EngineCell, BatteryEngine } from "@/lib/market/questions/matrix";

/** One question as the screen stores it: the number the list shows, the wording behind `GeneratedText` (reached only through `renderQuestion`),
 *  and the search it was phrased from. The projection of `questions`, not a second home. No volume: a field that does not exist cannot be rendered. */
export interface StoredQuestion {
  /** 1-based, the number the list shows beside the question. */
  n: number;
  wording: GeneratedText;
  /** The search this question was derived from. */
  search: string;
}

/** BUILD §4.1 module 2, left card: `AiAnswersCard` plus the measurement date the source chip shows. */
export interface AiAnswersSection {
  /** n — the denominator: searches whose AI answer could be read at all. */
  measuredSearches: number;
  /** m of n — searches an AI answer actually appeared on. */
  answeredSearches: number;
  /** Counted over m, never over n. */
  customerCitations: number;
  measuredAt: Date;
  /** The customer's own domain, so the matrix can label its own row. */
  ownDomain: string;
  /** Rival rows of the dot matrix, in the order the presence card orders
   *  them; one cell per row per question. */
  rivals: readonly { domain: string; cells: readonly AnswerCell[] }[];
  /** One row per question. `cell` is the AI-Overview column the card renders; `engines` is §6.2's three columns with that cell first. */
  rows: readonly { question: StoredQuestion; cell: AnswerCell; engines: readonly EngineCell[] }[];
  /** Which AI answers this card could see, a state the disclosure renders: the free twelve count Google's actual AI answers (`async_included`);
   *  a market correction buys none within the 12¢ cap, so its card counts only what Google had cached (`cached_only`). */
  coverage: "async_included" | "cached_only";
  /** When the answers on this card were bought where this pass did not buy them (a re-scan answered from `fetches` inside §6.4's window),
   *  carried from the ledger row through the SERP and card. The oldest such date, so the card never claims an answer is fresher than it is;
   *  `null` where every answer was this pass's, or the report predates it. Not `coverage`: that says which answers it could see. */
  reusedFrom: string | null;
}

/** The page questions, beside the twelve and never inside them: `aiAnswers` is what the cards and counts are over, so a page question there
 *  would move a published score because the product wrote a page. The score's AI Presence reads each row's `cell` beside the twelve's on purpose.
 *  `null` where the pass asked none (free and onboarding passes, no live page, older reports); never an empty section. */
export interface PageQuestionsSection {
  measuredAt: Date;
  /** The site's own registrable domain, so a row is read for a mention without deciding what "the site" is twice. */
  ownDomain: string;
  /** How many questions this pass tracked in all, stored so a screen states the number the pass obeyed even after the cap changes. */
  tracked: number;
  /** `TRACKED_QUESTIONS_MAX` as this pass read it, for the same reason. */
  cap: number;
  rows: readonly PageQuestionRow[];
  /** The pages whose question left the set this week: a page's verdict reads it, and it says which week a retired question stopped. */
  retired: readonly RetiredPageQuestion[];
  /** The re-score read this section's stored answers for rivals: it reads none again, filled or not. Absent where it has not. */
  rivalsRead?: true;
}

/** One published page's own question as this pass asked it, shaped like the AI-answers row so one reader draws both. */
export interface PageQuestionRow {
  /** The publication this question belongs to: its identity across weeks, and what a page's verdict is keyed by. */
  publicationId: string;
  /** Where the page is, as it was live this week. */
  liveUrl: string;
  /** Numbered on from the twelve (13, 14, …): the screen draws one list of tracked questions. */
  question: StoredQuestion;
  cell: AnswerCell;
  engines: readonly EngineCell[];
  /** The organic rows of the Google result bought for this question, to the depth bought, which the page's verdict reads its place from.
   *  `null` where unreadable this week; absent on older rows. */
  organic?: readonly { url: string; position: number }[] | null;
  /** How deep `organic` was bought; absent on a row bought ten deep. */
  depth?: number;
}

export interface RetiredPageQuestion {
  publicationId: string;
  liveUrl: string;
  /** The question as asked, in plain text: read to say which question stopped, never rendered as a question to a customer. */
  question: string;
  /** How many weekly passes asked it and heard nothing: the number that reached `PAGE_QUESTION_RETIRE_WEEKS`. */
  weeksWithoutMention: number;
}

/** BUILD §4.1 module 2, right card: `PresenceCard` re-exported, not re-declared. It has no member for rival size, revenue, traffic value,
 *  funding, headcount, projected return, severity or market total: the card's honesty bound is having nowhere to put a violation. */
export type PresenceSection = PresenceCard;

/** BUILD §4.1 module 3's two counts that are not on the verdict; blocked readers is `Verdict.blockedReaders`, one measurement, one home. */
export interface SupplySection {
  missingPages: Measured<number>;
  unquotablePages: Measured<number>;
}

/** BUILD §4.1 module 5: page 1 of N, offered for an address. `title` is model text, reached through `renderGenerated`. */
export interface FreePageSection {
  opportunityId: string;
  title: GeneratedText;
  slug: GeneratedText;
  /** The search the page targets and its monthly volume: the page's own target, not a per-question volume. */
  target: { keyword: string; volume: number };
  /** The rival this page is written to overtake, where there is one. */
  beats: string | null;
  /** The opportunity type, rendered as written by the copy key for it. */
  format: string;
  /** How many pages the scan found in total — "page 1 of {N}". */
  totalPages: number;
}

/** What `GET /scan/{domain}` renders. One date governs the whole blob:
 *  `verdict.measuredAt` — every figure under it is that scan's. */
export interface StoredReport {
  /** The blob is versioned; readers branch on nothing else. */
  version: number;
  scanId: string;
  /** The one canonical domain key. */
  domain: CanonicalDomain;
  tier: Tier;
  /** False where `stoppedReason` is a ceiling or a failure. */
  complete: boolean;
  stoppedReason: StoppedReason;
  /** The re-scan control reads this: an offer made once, which does not chain. */
  fromIncompleteRescan: boolean;

  verdict: Verdict;
  /** Which answer readers the home document's access rules block, in the pinned list's order (training crawlers are not in it).
   *  Typed from `AI_READER_AGENTS`, so a new agent needs no edit here. `Verdict.blockedReaders` is their count. */
  blockedAgents: readonly (typeof AI_READER_AGENTS)[number][];
  aiAnswers: AiAnswersSection | null;
  /** The page questions, beside the twelve. `null` where none were asked, never an empty section; the score reads `aiAnswers`, not this. */
  pageQuestions: PageQuestionsSection | null;
  presence: PresenceSection | null;
  supply: SupplySection;
  freePage: FreePageSection | null;

  // ── The record: what the pass measured, not what the screen renders ────
  // Read by the correction, a deep pass's reuse of a fresh free scan (§6.4), and anyone reproducing a report.

  /** §6.7 steps 1–2: the profile, the measured market and its size, which fail together, so one `Measured` wraps the set. */
  market: Measured<MarketSet>;
  /** The twelve, with the selected search each was phrased from: the measurement the opportunity ranking and the paid pass's frozen set read.
   *  `aiAnswers.rows[].question` is its projection, not a second home. */
  questions: Measured<Question[]>;
  /** The bought top-tens, one per question, in question order. Every card
   *  above was counted over exactly these. */
  serps: readonly Measured<SerpResult>[];
  rivals: Measured<RivalCandidate[]>;
  /** §6.6's sizing, one entry per rival sized, read only by §7's winnability through `rankedCountsFromSizes`.
   *  `unmeasured`, never `[]`, where not sized: an empty array would say we sized the rivals and there are none. */
  rivalSizes: Measured<RivalSize[]>;
  /** The customer's own ranked count from this pass (rows, not the 0–100 sub-measure): §6.6 bands rivals against it and §7's bars are
   *  `max(500, 5× it)` and `max(100, 2× it)`. Capped by the rows bought, which understates it and so tightens both bars. */
  ownRanked: Measured<number>;
  /** The rows `ownRanked` counts: each search the customer ranks for, its position and url, bought once. Improve reads its update candidates here.
   *  Empty where the call failed, and on reports before it was kept. */
  ownRankedRows: readonly RankedRow[];
  /** §6.6's platform partition — the "sources" half. Stored, not rendered
   *  in MVP. */
  sources: readonly string[];
  onPage: Measured<OnPageFacts>;
  robots: Measured<RobotsPolicy>;
  /** SPEC §9's nine technical-issue checks over the crawled pages. `null` only on a report older than the checks; a pass that ran them carries reasons. */
  siteIssues: SiteIssuesSection | null;
  /** §6.7 step 5. Unwrapped: it already carries its own failure arm, and a wrapper would give consumers two `unknown`s. */
  coherence: CoherenceVerdict;
  /** The correction state, stored on the scan row too. */
  correctionState: CorrectionState;
  /** The category this pass measured under: the confirmed one it was handed (`readSiteCategory`, or the correction's), or `null` where it seeded from the profile.
   *  Stored, not derived, because `categoryOf(market)` is the inferred category; the pending-change comparison (`measuredAnswers`) reads only this.
   *  `null` on older reports, which claims nothing. */
  measuredCategory: string | null;
  /** The market's buyer prompts a deep pass asked AI Mode beside the twelve, with cited domains and the start of the text: the evidence its rivals
   *  are concluded from. Absent where none were asked; the score and cards never read it. */
  marketPrompts?: readonly MarketPromptAnswer[];
  /** The tracked buyer prompts a weekly pass asked and what each answer said: the source of the mention rate, share of voice and *your pages cited*. */
  prompts?: PromptsSection;
  /** The country and language this pass measured in, where not the United States and English or where the site said something unmeasured.
   *  `fellBack` is that something, which the report says in one line. Absent where measured in the United States, in English, with nothing fallen back. */
  locale?: ReportLocale;
  /** The city a local business's home page structured data states, which setup fills its question with. Absent where none. */
  statedPlace?: { name: string; region?: string };
  /** `search` where the market, questions and AI answers were read from the site's appearance in search because bot protection kept the reader off.
   *  The report says so in one line. */
  marketFrom?: "search";
  /** A free pass stored this report with chosen searches unread, and `scan/finish-reads` is reading them: how many and since when.
   *  Its own write sets it to `null`. */
  finishingReads?: { searches: number; since: Date } | null;
  /** Where the re-score rewrote this report with the current code: when, at which commit, and the report and `scans` columns as first stored,
   *  so the rewrite can be undone. No surface reads them. */
  rescoredAt?: Date;
  rescoredBy?: string;
  previous?: unknown;
  previousColumns?: unknown;
}

export interface ReportLocale extends Locale {
  fellBack?: { country: string | null; language: string | null };
  /** The other markets the site's home page declares, as BCP-47 tags
   *  without the measured one (`marketsServed`). Absent where it declares
   *  none, and on every report read before it was counted. */
  alsoServes?: readonly string[];
  /** Which evidence named the town a free scan measured in (`PLACE_FROM`). Absent where none, or a paid pass settled the place. */
  placeFrom?: "address" | "area_served" | "address_text" | "page_text";
  /** `default` where the pass read neither the home page nor a country in the address, so it measured in the default, guessed. */
  basis?: "default";
  /** On a guessed pass, the other supported country the site's own Google
   *  listing reads as (`listingLocaleOf`). */
  listingReads?: Country;
}

/** How many searches the report says it is still reading at `now`, or `null`: no marker, or one older than the line's window,
 *  since a job that never ran is not a promise kept for ever. */
export function stillReading(report: Pick<StoredReport, "finishingReads">, now: Date): number | null {
  const marker = report.finishingReads;
  if (marker === undefined || marker === null) return null;
  const since = new Date(marker.since).getTime();
  if (!(now.getTime() - since < TIMING.finishReadsNoticeS * 1000)) return null;
  return marker.searches;
}

export const localeOfReport: (report: Pick<StoredReport, "locale">) => Locale = measuredLocale;

/** The two engines a tracked prompt is asked on. */
export const PROMPT_ENGINES = ["ai_mode", "chatgpt"] as const;
export type PromptEngine = (typeof PROMPT_ENGINES)[number];

/** One answer to one tracked prompt as read: whether it named or linked the site, which of its pages it cited and which rivals it named.
 *  Never the prose, never a position. */
export interface PromptAnswer {
  promptId: string;
  engine: PromptEngine;
  /** 1-based: which of the week's asks of this prompt on this engine. */
  run: number;
  named: boolean;
  linked: boolean;
  ownUrls: readonly string[];
  rivals: readonly string[];
  /** The cited addresses that hold "alternative": buyers asking it were shown a rival's alternatives. Absent where none, and on older answers. */
  alternatives?: readonly string[];
  /** The pages it cited on other sites, their homes left out. Absent where
   *  it cited none, and on an answer no pass or re-score has read since. */
  cited?: readonly string[];
  /** The prices, counts and countries it gave the business, each with the few words around it. Absent where none, and on older answers. */
  states?: readonly AnswerStatement[];
}

/** One weekly pass's tracked prompts. */
export interface PromptsSection {
  /** The name the answers were read for. */
  siteName: string;
  /** The set as this pass asked it. */
  asked: readonly { id: string; kind: PromptKind; text: string }[];
  /** How many asks the set is: prompts × engines × runs. */
  asks: number;
  /** The asks that answered. One that did not is absent, so it leaves the
   *  rate's denominator and is never a miss. */
  answers: readonly PromptAnswer[];
  /** When the set asked was rebuilt whole; a week with another mark asked another set, and the rolling rate leaves it out. */
  restartedAt?: string;
}

/** What one pass checked: the searches it read a result page for, and the
 *  AI questions it put. A pass with no prompts block measured no AI
 *  question, so its count is `null`, never 0. */
export function askedOf(report: Pick<StoredReport, "serps" | "prompts">): { searches: number; questions: number | null } {
  return {
    searches: report.serps.filter((serp) => serp.kind !== "unmeasured").length,
    questions: report.prompts === undefined ? null : report.prompts.asked.length,
  };
}

/** One buyer prompt as its AI answer read. */
export interface MarketPromptAnswer {
  prompt: string;
  citedDomains: readonly string[];
  namesSite: boolean;
  /** The start of the answer's text: it names products it does not link. */
  excerpt: string;
}

// ── Reading a stored blob ─────────────────────────────────────────────────

/** A strict ISO-8601 instant, exactly as `Date.prototype.toJSON` writes
 *  one. Narrow on purpose: a customer's own keyword or heading cannot
 *  match it by accident. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/** Rebuilds a parsed `jsonb` value with every ISO instant back as a
 *  `Date` — `measuredAt` and every `Measured.at` under it. Total: it never
 *  throws and never drops a key. */
function reviveDates(value: unknown): unknown {
  if (typeof value === "string") {
    return ISO_INSTANT.test(value) ? new Date(value) : value;
  }
  if (Array.isArray(value)) return value.map(reviveDates);
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, member] of Object.entries(value as Record<string, unknown>)) {
      out[key] = reviveDates(member);
    }
    return out;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The versions this build's upgrade chain can lift. */
const MIGRATABLE_VERSIONS: readonly number[] = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

/** The two battery columns of a report written before anything bought them: `not_attempted`, not `no_answer`, since nobody asked.
 *  Frozen literals, not `engineColumns(...)`: a migration does not follow a moving helper. */
function engineColumnsAtVersion3(overview: unknown): unknown[] {
  return [
    { engine: "ai_overview", cell: overview },
    { engine: "ai_mode", cell: { kind: "unmeasured", reason: "not_attempted" } },
    { engine: "chatgpt", cell: { kind: "unmeasured", reason: "not_attempted" } },
  ];
}

/** Version 3 → 4: every AI-answers row gains its `engines` triple, adding one member per row so an old report renders as it did. */
function upgradeFromVersion3(blob: Record<string, unknown>): Record<string, unknown> {
  const answers = blob.aiAnswers;
  if (!isRecord(answers) || !Array.isArray(answers.rows)) {
    return { ...blob, version: 4 };
  }
  const rows = answers.rows.map((row) =>
    isRecord(row) ? { ...row, engines: engineColumnsAtVersion3(row.cell) } : row
  );
  return { ...blob, version: 4, aiAnswers: { ...answers, rows } };
}

/** Version 4 → 5: `category` and `rows[].question.namedBrands` were second copies derived at assembly, so dropping them loses nothing
 *  and a v4 report renders as it did. */
function without(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const out = { ...record };
  delete out[key];
  return out;
}

function upgradeFromVersion4(blob: Record<string, unknown>): Record<string, unknown> {
  const rest = without(blob, "category");
  const answers = rest.aiAnswers;
  if (!isRecord(answers) || !Array.isArray(answers.rows)) {
    return { ...rest, version: 5 };
  }
  const rows = answers.rows.map((row) => {
    if (!isRecord(row) || !isRecord(row.question)) return row;
    return { ...row, question: without(row.question, "namedBrands") };
  });
  return { ...rest, version: 5, aiAnswers: { ...answers, rows } };
}

/** Version 5 → 6: the verdict carries the three score factors. An older report did not keep them, so they arrive `unmeasured/undeterminable`
 *  and the header draws a dash; nothing is guessed, and the score and band render as they did. */
function upgradeFromVersion5(blob: Record<string, unknown>): Record<string, unknown> {
  const verdict = blob.verdict;
  if (!isRecord(verdict)) return { ...blob, version: 6 };
  const at = verdict.measuredAt;
  const unmeasured = { kind: "unmeasured", reason: "undeterminable", at };
  return {
    ...blob,
    version: 6,
    verdict: {
      ...verdict,
      factors: {
        foundations: unmeasured,
        answerability: unmeasured,
        presence: unmeasured,
      },
    },
  };
}

/** Version 6 → 7: SPEC §9's checks. An older report never ran them, so `siteIssues` arrives `null`, never nine zeros. */
function upgradeFromVersion6(blob: Record<string, unknown>): Record<string, unknown> {
  return { ...blob, version: 7, siteIssues: null };
}

/** Version 7 → 8: each check names the pages it counted. None is recovered: `pages: null`, and no Fix opportunity is derived from it. */
function upgradeFromVersion7(blob: Record<string, unknown>): Record<string, unknown> {
  const section = blob.siteIssues;
  if (!isRecord(section) || !Array.isArray(section.issues)) return { ...blob, version: 8 };
  const issues = section.issues.map((issue: unknown) =>
    isRecord(issue) && issue.ran === true ? { ...issue, pages: null } : issue
  );
  return { ...blob, version: 8, siteIssues: { ...section, checkedPages: null, issues } };
}

/** Version 8 → 9: the report keeps the customer's ranked rows. None is recovered: `ownRankedRows` arrives empty. */
function upgradeFromVersion8(blob: Record<string, unknown>): Record<string, unknown> {
  // The literal `9`, not `REPORT_VERSION`: each upgrade lifts one version and the chain does the rest, so no later upgrade is skipped.
  return { ...blob, version: 9, ownRankedRows: [] };
}

/** Version 9 → 10: the category the pass measured under. None is invented: `measuredCategory` arrives `null`, so nothing reads as pending;
 *  the inferred category is not it, and using it would hold pages on sites where nothing changed. */
function upgradeFromVersion9(blob: Record<string, unknown>): Record<string, unknown> {
  return { ...blob, version: 10, measuredCategory: null };
}

/** Version 10 → 11: the page questions. An older pass asked none, so `pageQuestions` arrives `null`, never an empty section or rows from the twelve. */
function upgradeFromVersion10(blob: Record<string, unknown>): Record<string, unknown> {
  return { ...blob, version: 11, pageQuestions: null };
}

/** Version 11 → 12: when a reused answer was bought. Not recorded before, so `reusedFrom` arrives `null`, which claims nothing;
 *  a report with no `aiAnswers` keeps `null` there rather than gaining an invented card. */
function upgradeFromVersion11(blob: Record<string, unknown>): Record<string, unknown> {
  const section = blob.aiAnswers;
  return {
    ...blob,
    version: 12,
    aiAnswers: isRecord(section) ? { ...section, reusedFrom: null } : section,
  };
}

/** Version 12 → 13: blocked readers count the answer readers, not training crawlers. The access rules are in the blob, so the list and counts
 *  are re-read from them against the pin (old keys were lowercased). Snippet controls were not read, so the score stays as measured. */
function upgradeFromVersion12(blob: Record<string, unknown>): Record<string, unknown> {
  const next = { ...blob, version: 13 };
  const robots = blob.robots;
  if (!isRecord(robots) || robots.kind === "unmeasured" || !isRecord(robots.value)) return next;
  const policy = robots.value;
  const named = isRecord(policy.disallowedAgents) ? policy.disallowedAgents : {};
  const blocked =
    policy.absent === true
      ? []
      : AI_READER_AGENTS.filter(
          (agent) => policy.disallowsAll === true || named[agent] === true || named[agent.toLowerCase()] === true
        );
  const count = blocked.length;

  const verdict = blob.verdict;
  const prior = isRecord(verdict) ? verdict.blockedReaders : undefined;
  const section = blob.siteIssues;
  return {
    ...next,
    blockedAgents: blocked,
    verdict:
      isRecord(verdict) && isRecord(prior) && prior.kind !== "unmeasured"
        ? { ...verdict, blockedReaders: { kind: count === 0 ? "zero" : "measured", value: count, at: prior.at } }
        : verdict,
    siteIssues:
      isRecord(section) && Array.isArray(section.issues)
        ? {
            ...section,
            issues: section.issues.map((issue: unknown) =>
              isRecord(issue) && issue.check === "ai_readers_blocked" && issue.ran === true
                ? {
                    ...issue,
                    count,
                    over: AI_READER_AGENTS.length,
                    severity: count === 0 ? "nothing_to_fix" : "critical",
                  }
                : issue
            ),
          }
        : section,
  };
}

/** Every upgrade, oldest first, each lifting one version; chained so an old report is lifted step by step. */
const UPGRADES: readonly ((blob: Record<string, unknown>) => Record<string, unknown>)[] = [
  upgradeFromVersion3,
  upgradeFromVersion4,
  upgradeFromVersion5,
  upgradeFromVersion6,
  upgradeFromVersion7,
  upgradeFromVersion8,
  upgradeFromVersion9,
  upgradeFromVersion10,
  upgradeFromVersion11,
  upgradeFromVersion12,
  upgradeFromVersion13,
];

/** The version guard and upgrade. Throws loudly on a blob this build can neither read nor lift: `null` would read as "no report" and take
 *  a customer's report off its address. Forward only: an older build throws on a newer blob, so production rolls forward only.
 *  The message names the on-disk version and this build's, which are the whole diagnosis. */
export function readStoredReport(blob: unknown): StoredReport {
  if (!isRecord(blob)) {
    throw new Error("readCurrentReport: the stored report is not an object");
  }
  let current = blob;
  while (typeof current.version === "number" && MIGRATABLE_VERSIONS.includes(current.version)) {
    const upgrade = UPGRADES[current.version - MIGRATABLE_VERSIONS[0]!];
    if (upgrade === undefined) break;
    current = upgrade(current);
  }
  if (current.version !== REPORT_VERSION) {
    throw new Error(
      `readCurrentReport: stored report version ${String(blob.version)} is not readable by this build (expected ${REPORT_VERSION})`
    );
  }
  return reviveDates(current) as StoredReport;
}

// `scans.is_current` is not in the generated `Database` type, so this one query goes through a narrow cast; nothing else here bypasses the type.

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  is(column: string, value: boolean): MinimalQueryBuilder<T>;
  limit(n: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

// The database is imported where a read asks for it, so `readStoredReport` loads without database bindings for the re-score.
function untyped(client: unknown): MinimalClient {
  return client as unknown as MinimalClient;
}

interface CurrentReportRow {
  report: unknown;
}

/**
 * The domain's one current report, or `null` where it has none.
 *
 * One indexed read off the partial unique index that makes two current
 * reports for one domain unrepresentable — never a "latest scan wins"
 * query, which would make a failed re-scan the report. Writes nothing,
 * opens no transaction, and takes no tier and no `forFree` parameter:
 * there is one report and everyone sees all of it.
 */
export async function readCurrentReport(domain: string): Promise<StoredReport | null> {
  const { dbAdmin } = await import("@/lib/db");
  const { data, error } = await untyped(dbAdmin())
    .from<CurrentReportRow>("scans")
    .select("report")
    .eq("domain", domain)
    .is("is_current", true)
    .limit(1);
  if (error) throw new Error(`readCurrentReport: ${error.message}`);

  const row = data?.[0];
  if (!row || row.report === null || row.report === undefined) return null;
  // A report measured off a bot-protection page is read as unmeasured there, by every reader of the current report.
  return readPastProtection(readStoredReport(row.report));
}

/** One scan's own stored report by id, or `null`, for a step after the pass that stored it; not the current report, which a later pass may have replaced. */
export async function readScanReport(scanId: string): Promise<StoredReport | null> {
  const { dbAdmin } = await import("@/lib/db");
  const { data, error } = await untyped(dbAdmin())
    .from<CurrentReportRow>("scans")
    .select("report")
    .eq("id", scanId)
    .limit(1);
  if (error) throw new Error(`readScanReport: ${error.message}`);

  const row = data?.[0];
  if (!row || row.report === null || row.report === undefined) return null;
  return readStoredReport(row.report);
}
