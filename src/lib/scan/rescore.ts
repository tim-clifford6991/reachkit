// src/lib/scan/rescore.ts — a stored scan, scored again by the current code
// from what was stored (owner ruling 2026-10-14, issue 1426).
//
// "For any of the new calculations to our scoring or similar, you should
// retro fit this to all existing scans and profiles WITHOUT incurring any new
// dataforseo costs." So this reads only what a pass kept — the report's
// SERPs, AI Overview references, ranked rows, on-page facts and access rules,
// the home read in `fetches`, and the stored rival sets — and runs them
// through the same functions a new pass runs: `verdictOf`, the four
// drivers, `cardsOf`, `unreadByProtection`, `rivalHome`. It buys nothing,
// asks no model and reaches no network: every function here is pure.
//
// What a pass never kept is not re-bought; it stands as stored and the scan
// says so (`kept`). Answerability (Content) is read from the home page, the
// pricing page and the site's measured pages (issue 1551): from their reads
// in `fetches` where they are stored, and as stored where they are not.
//
// `src/lib/scan/rescore-run.ts` reads the stored rows in production (the
// `scan/rescore` job, issue 1433), writes the before and after, and on apply
// writes the change, keeping the original report under `report.previous`.
//
// Issue 1539: what each tracked-prompt answer states of the business is read
// again from the answer's stored text (`statementsOf`), so a stored report
// carries it without a new pass.
import { retrofitReading, type Retrofit } from "@/lib/business/retrofit";
import { aiPresenceOf, aiPresenceRangeOf, aiSampleOf, classifyReferences, foundationsOf, localPackSearches, searchPresenceOf } from "@/lib/measure/drivers";
import { isProtectionName } from "@/lib/measure/challenge";
import { contentOf, detectPricingUrl, measuredPagesOf, storedFactsOf } from "@/lib/measure/pages";
import { isStoredDocument } from "@/lib/measure/own-fetch";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import { foldSerps, outcomeOf, type InputOutcome, type ScanInput } from "@/lib/measure/partition";
import type { OnPageFacts } from "@/lib/measure/parse";
import { isPlaceholder, withoutPlaceholders } from "@/lib/measure/placeholder";
import type { Drivers } from "@/lib/measure/score";
import { verdictOf, type Verdict } from "@/lib/measure/verdict";
import type { CoherenceVerdict } from "@/lib/market/coherence/check";
import { rivalHome } from "@/lib/market/infer/rival-home";
import type { RivalConclusion } from "@/lib/market/infer/types";
import type { RivalSizeBand } from "@/lib/market/rivals/band";
import type { RivalCandidate } from "@/lib/market/rivals/derive";
import { isOwnDomain, registrableDomain } from "@/lib/market/rivals/domains";
import { brandOf } from "@/lib/market/questions/select";
import { statementsOf } from "@/lib/market/prompts/misstated";
import type { Profile } from "@/lib/market/questions/profile-types";
import type { PresenceCard } from "@/lib/market/rivals/presence";
import type { MarketSerp, QuestionView } from "@/lib/market/views";
import { AI_ANSWER_SOURCES, type RankedRow } from "@/lib/vendors/dataforseo/types";
import { cardsOf, placeStands, reachOfReport } from "./cards";
import { readAsProtection, unreadByProtection } from "./challenged";
import { marketEvidence, type EvidenceReport } from "./market-evidence";
import { localeOfReport, type AnswerCell, type EngineCell, type PromptAnswer, type StoredReport } from "./report";
import { rivalCellsOf } from "./sections";
import type { ScanStatus } from "./store";

/** The AI-answers section as far as a score reads it and the re-score
 *  writes it: the counts, the rival rows, and each row's cells. A row's
 *  wording is the question's and does not move. */
export interface RescoreAnswers {
  measuredSearches: number;
  answeredSearches: number;
  customerCitations: number;
  reusedFrom: string | null;
  coverage: "async_included" | "cached_only";
  rivals: readonly { domain: string; cells: readonly AnswerCell[] }[];
  rows: readonly { question: { search: string }; cell: AnswerCell; engines: readonly EngineCell[] }[];
}

/** What the re-score reads of a stored report — `StoredReport`'s own members,
 *  narrowed where a slice is all it needs, so the export carries no more. */
export interface RescoreReport extends Pick<
  StoredReport,
  | "version"
  | "domain"
  | "tier"
  | "complete"
  | "stoppedReason"
  | "verdict"
  | "blockedAgents"
  | "onPage"
  | "robots"
  | "ownRanked"
  | "sources"
  | "rivals"
  | "presence"
  | "coherence"
  | "siteIssues"
  | "measuredCategory"
  | "marketPrompts"
  | "locale"
  | "prompts"
> {
  ownRankedRows: readonly (Pick<RankedRow, "position"> & { keyword?: string })[];
  serps: readonly Measured<MarketSerp>[];
  questions: Measured<QuestionView[]>;
  rivalSizes: Measured<readonly { domain: string; state: string; band?: RivalSizeBand }[]>;
  aiAnswers: RescoreAnswers | null;
  market: Measured<{
    profile: { category: string | null; town?: string; offeringType?: string; language?: string; offerings?: unknown; kind?: unknown; reach?: unknown };
  }>;
}

/** One stored scan, as the export hands it over. */
export interface RescoreScan {
  id: string;
  status: ScanStatus;
  score: number | null;
  /** `scans.drivers`: the four quantities the stored score was composed of. */
  drivers: Drivers | null;
  report: RescoreReport;
  /** The home read the report's on-page facts came from (`fetches`), and
   *  the rendered reads of that page; `null` where it is no longer stored. */
  home: { created_at: string; payload: unknown } | null;
  rendered: readonly { created_at: string; payload: unknown }[];
  /** The site's name as an AI answer is read for it (`promptSiteName` over
   *  the stored profile), `null` where no profile is stored (issue 1420). */
  siteName: string | null;
  /** The AI Mode and ChatGPT answers this scan bought, as `fetches` keeps
   *  them: the ledger source, the cache key (the search first) and what the
   *  answer said (issue 1420). Empty where none is stored under this scan. */
  answers: readonly StoredAnswer[];
  /** A paying site's market (`sites.market`): the kind and place its pass
   *  concluded and the place the founder gave; absent on a free scan. */
  market?: { kind?: unknown; serves?: unknown; area?: { place?: unknown }; rivals?: readonly { name: string; domain: string }[] } | null;
  /** Issue 1551: the site's measured pages as this scan's own reads hold
   *  them — the pages ReachKit had live when it ran, newest first, then the
   *  pages it read itself, in the order it read them — and each address's
   *  stored read, the home's and the pricing page's among them. Absent where
   *  the scan ledgered no read of its own: Content stands as stored. */
  measured?: { pages: readonly string[]; reads: ReadonlyMap<string, unknown> };
  /** When the scan was asked for (`scans.created_at`): a report dated
   *  before it was dated by a stored read of a page (issue 1392), and is
   *  dated again by it (issue 1479). Absent, the stored date stands. */
  startedAt?: string;
}

/** One bought AI Mode or ChatGPT answer, as `fetches` keeps it. */
export interface StoredAnswer {
  source: string;
  key: string;
  text: string | null;
  citedUrls: readonly string[] | null;
  /** The whole text, where `text` is cut to the AI Overview's length: a
   *  tracked prompt's answer is read whole (issue 1539). */
  whole?: string | null;
}

/** The members a re-score may rewrite, as the scan would now store them. */
export interface RescoredMembers {
  verdict: Verdict;
  complete: boolean;
  onPage: Measured<OnPageFacts>;
  siteIssues: StoredReport["siteIssues"];
  rivals: Measured<RivalCandidate[]>;
  sources: readonly string[];
  presence: PresenceCard | null;
  coherence: CoherenceVerdict;
  aiAnswers: RescoreAnswers | null;
}

/** One rewrite: a path into `scans.report` and the value it takes. */
export interface ReportChange {
  path: readonly (string | number)[];
  value: unknown;
}

export interface Rescored {
  before: RescoredMembers;
  after: RescoredMembers;
  /** Against the stored report: empty where the current code says what it
   *  already says. */
  changes: readonly ReportChange[];
  drivers: Drivers;
  score: number | null;
  status: ScanStatus;
  /** What stands as stored on this scan, and why. */
  kept: readonly string[];
  /** The current code reads this scan's market elsewhere than its stored
   *  searches were bought (issue 1504): it stands as stored, and the run
   *  lists it as stale until it is scanned again. */
  stale: boolean;
  /** What the stored profile gains of the business's reading (issue 1470):
   *  empty where it holds it all, or nothing stored decides the rest. */
  reading: Retrofit;
}

/** Every `Measured` under one verdict carries the verdict's date
 *  (`verdictOf` asserts it); a stored value read again is re-dated. */
function dated<T>(m: Measured<T>, at: Date): Measured<T> {
  return { ...m, at };
}

function membersOf(r: RescoreReport): RescoredMembers {
  return {
    verdict: r.verdict,
    complete: r.complete,
    onPage: r.onPage,
    siteIssues: r.siteIssues,
    rivals: r.rivals,
    sources: r.sources,
    presence: r.presence,
    coherence: r.coherence,
    aiAnswers: r.aiAnswers,
  };
}

/** The search-presence driver from the ranked rows the report kept, or
 *  `null` where it kept a count but not its rows (a report of version 8 or
 *  before): then the stored driver stands. A stored SERP whose local pack
 *  shows the site counts that search as a top-ten result (issue 1441). */
function searchPresenceFrom(r: RescoreReport, at: Date): Measured<number> | null {
  if (r.ownRanked.kind === "unmeasured") return searchPresenceOf({ ranked: r.ownRanked, at });
  if (r.ownRankedRows.length === 0 && r.ownRanked.value > 0) return null;
  const searches = r.questions.kind === "unmeasured" ? [] : r.questions.value.map((question) => question.search.keyword);
  const localPack = localPackSearches({ serps: r.serps, searches, ownDomain: r.domain });
  return searchPresenceOf({
    ranked: measured({ rows: r.ownRankedRows, total: r.ownRanked.value }, at),
    at,
    ...(localPack.length === 0 ? {} : { localPack }),
  });
}

/** The cards over the stored SERPs, where the pass that stored them got as
 *  far as counting them; otherwise the stored members stand. */
function cardsAfter(
  r: RescoreReport,
  scan: Pick<RescoreScan, "siteName" | "answers">,
  kept: string[]
): Pick<RescoredMembers, "rivals" | "sources" | "presence" | "coherence" | "aiAnswers"> {
  if (r.presence === null || r.questions.kind === "unmeasured") {
    return { rivals: r.rivals, sources: r.sources, presence: r.presence, coherence: r.coherence, aiAnswers: r.aiAnswers };
  }
  const cards = cardsOf({
    serps: r.serps,
    questions: r.questions.value,
    rivalSizes: r.rivalSizes,
    ownDomain: r.domain,
    reach: reachOfReport(r),
    siteName: scan.siteName,
    coverage: r.aiAnswers?.coverage ?? "async_included",
  });
  const cells = cards.card.rows.map((row) => row.cell);
  const aiAnswers: RescoreAnswers | null =
    r.aiAnswers === null
      ? null
      : {
          ...r.aiAnswers,
          measuredSearches: cards.card.measuredSearches,
          answeredSearches: cards.card.answeredSearches,
          customerCitations: cards.card.customerCitations,
          reusedFrom: cards.card.reusedFrom,
          rivals: cards.rivals.map((rival) => ({ domain: rival.domain, cells: rivalCellsOf(cells, rival.domain) })),
          // The AI Overview column is the SERP's; the two battery engines
          // were bought answers, kept as they were read except whether they
          // name the site, read again from their stored text (issue 1420).
          rows: r.aiAnswers.rows.map((row, i) => {
            const cell = cells[i] ?? row.cell;
            return {
              ...row,
              cell,
              engines: row.engines.map((engine) =>
                engine.engine === "ai_overview" ? { ...engine, cell } : { ...engine, cell: engineCellAfter(engine, row.question.search, r.domain, scan, kept) }
              ),
            };
          }),
        };
  return {
    rivals: r.rivals.kind === "unmeasured" ? r.rivals : measured(cards.rivals, r.rivals.at),
    sources: cards.sources,
    presence: cards.presence,
    coherence: cards.coherence,
    aiAnswers,
  };
}

export const KEPT_CONTENT_UNREAD = "content: the reads of its home or pricing page are not stored under this scan, so its stored value stands";
export const KEPT_CONTENT_PAGES = "content: some of the pages it would read have no stored read, so it reads the ones that do";

/**
 * Issue 1551: Content over the home page, the pricing page and the site's
 * measured pages, from their stored reads, as `withMeasuredPages` reads them
 * on a pass. `null` where this cannot be read from what is stored.
 */
function contentFrom(r: RescoreReport, scan: RescoreScan, at: Date, kept: string[]): Measured<number> | null {
  const m = scan.measured;
  if (m === undefined || r.onPage.kind === "unmeasured") return null;
  const home = scan.home?.payload;
  // A home read as the vendor's browser drew it is not the stored read here.
  if (!isStoredDocument(home) || scan.rendered.length > 0) {
    kept.push(KEPT_CONTENT_UNREAD);
    return null;
  }
  const pricingUrl = detectPricingUrl(home.html, `https://${r.domain}/`);
  const pricing = pricingUrl === null ? null : m.reads.get(pricingUrl);
  if (pricing === undefined) {
    kept.push(KEPT_CONTENT_UNREAD);
    return null;
  }
  const wanted = measuredPagesOf({ tier: r.tier, domain: r.domain, pricingUrl, pages: m.pages });
  if (wanted.some((url) => !m.reads.has(url))) kept.push(KEPT_CONTENT_PAGES);
  const urls = measuredPagesOf({ tier: r.tier, domain: r.domain, pricingUrl, pages: m.pages.filter((url) => m.reads.has(url)) });
  return contentOf({
    onPage: r.onPage,
    pricing: pricing === null ? null : storedFactsOf(pricing, at),
    pages: urls.map((url) => storedFactsOf(m.reads.get(url), at)),
    at,
  });
}

/** What `kept` says of a scan whose AI Overviews were stored without their
 *  text, and of a battery answer whose text is no longer stored. */
export const KEPT_NO_OVERVIEW_TEXT = "AI presence: its AI Overviews were stored without their text, so a brand they name only in words is not counted";
export const KEPT_NO_ANSWER_TEXT = "AI answers: an AI Mode or ChatGPT answer's text is not stored under this scan, so whether it names the site stands as read";
/** Issue 1504: a free scan's town its profile no longer reads as its market. */
export const KEPT_TOWN_BOUGHT = "town: its searches were bought in a town its profile no longer reads as its market, so its place and rivals stand until its next scan";

/** A battery engine's answered cell, its `named` read again from the text
 *  `fetches` kept under this scan for that search; as stored where none is. */
function engineCellAfter(
  engine: EngineCell,
  search: string,
  ownDomain: string,
  scan: Pick<RescoreScan, "siteName" | "answers">,
  kept: string[]
): AnswerCell {
  const cell = engine.cell;
  if (cell.kind !== "answered" || engine.engine === "ai_overview") return cell;
  const source = AI_ANSWER_SOURCES[engine.engine];
  const stored = scan.answers.find((answer) => answer.source === source && answer.text !== null && answer.key.split("|")[0] === search);
  if (stored === undefined || stored.text === null) {
    if (!kept.includes(KEPT_NO_ANSWER_TEXT)) kept.push(KEPT_NO_ANSWER_TEXT);
    return cell;
  }
  const { mentioned } = classifyReferences(cell.citedDomains, ownDomain, {
    urls: stored.citedUrls ?? [],
    text: stored.text,
    siteName: scan.siteName,
  });
  const rest: AnswerCell = { ...cell };
  delete rest.named;
  return mentioned ? { ...rest, named: true } : rest;
}

/** A stored scan scored again by the current code, from what it stored. */
export function rescoreScan(scan: RescoreScan): Rescored {
  const r = scan.report;
  const at = scanDate(r.verdict.measuredAt, scan.startedAt);
  const kept: string[] = [];
  const stored = scan.drivers;
  const robots = dated(r.robots, at);

  // Foundations, from the facts and the access rules the report kept; where
  // the home page was not read there are no facts, and the stored value
  // (with why it was not read) stands.
  const foundations =
    r.onPage.kind === "unmeasured"
      ? dated(stored?.foundations ?? r.verdict.factors.foundations, at)
      : foundationsOf({ onPage: r.onPage, robots, at });

  // Content, from the stored reads of the pages it reads; where they are
  // not stored, the stored value stands.
  const answerability = contentFrom(r, scan, at, kept) ?? dated(stored?.answerability ?? r.verdict.factors.answerability, at);

  const searchPresence = searchPresenceFrom(r, at);
  if (searchPresence === null) kept.push("search presence: the report kept its ranked count but not the rows");
  const aiPresence = aiPresenceOf({ serps: r.serps, ownDomain: r.domain, siteName: scan.siteName, at });
  const textless = r.serps.some(
    (serp) => serp.kind !== "unmeasured" && serp.value.aiOverview.present && serp.value.aiOverview.unread !== true && serp.value.aiOverview.text === undefined
  );
  if (textless) kept.push(KEPT_NO_OVERVIEW_TEXT);

  const drivers: Drivers = {
    foundations,
    answerability,
    searchPresence: searchPresence ?? dated(stored?.searchPresence ?? unmeasured("undeterminable", at), at),
    aiPresence,
  };
  // Presence where neither the rows nor the stored drivers say what search
  // presence was: the stored factor stands.
  const presence = searchPresence === null && stored === null ? dated(r.verdict.factors.presence, at) : undefined;

  // The inputs no stored member restates are read off the stored verdict:
  // one it listed as unread is unread, any other was read.
  const unreadElsewhere = new Map(r.verdict.unmeasuredElsewhere.map((u) => [u.input, u.reason] as const));
  const asStored = (input: ScanInput): InputOutcome => {
    const because = unreadElsewhere.get(input);
    return because === undefined ? { read: true, empty: false } : { read: false, because };
  };
  const inputs: Readonly<Record<ScanInput, InputOutcome>> = {
    home_document: outcomeOf(r.onPage),
    pricing_document: asStored("pricing_document"),
    access_rules: outcomeOf(robots),
    business_profile: asStored("business_profile"),
    market_suggestions: asStored("market_suggestions"),
    own_ranked_rows: outcomeOf(drivers.searchPresence),
    question_serps: outcomeOf(foldSerps(r.serps, at)),
  };
  const aiSample = aiSampleOf({ serps: r.serps, ownDomain: r.domain, siteName: scan.siteName });
  const verdict = verdictOf({
    domain: r.verdict.domain,
    measuredAt: at,
    drivers,
    inputs,
    robots,
    aiRange: aiPresenceRangeOf(aiSample),
    searchesRead: aiSample.read,
    ...(presence === undefined ? {} : { presence }),
  });

  // The profile as this re-score completes it (issue 1470). A free scan's
  // town that profile reads as no market of its own (issue 1480) still
  // stands: its searches were bought there and are read as they were, and
  // the scan is stale until its next pass measures it nationally (issue
  // 1504), as a stored country stands.
  const profile = clearedProfileOf(r);
  const reading = readingOf(r, profile, scan.market ?? null);
  const read = withReading(r, profile, reading);
  const stale = read.locale?.place !== undefined && !placeStands(read);
  if (stale) kept.push(KEPT_TOWN_BOUGHT);

  let after: RescoredMembers = { ...membersOf(r), verdict, ...cardsAfter(read, scan, kept) };

  // A home read that was a protection's page is no reading of the site
  // (issue 1383): the report says what a new scan of it would say.
  if (r.onPage.kind !== "unmeasured") {
    if (scan.home === null) kept.push("home page: its stored read is gone, so it was not checked for a protection's page");
    else if (readAsProtection({ home: scan.home, rendered: scan.rendered })) {
      after = { ...after, ...unreadByProtection({ ...after, robots: r.robots, blockedAgents: r.blockedAgents }) };
      drivers.foundations = after.verdict.factors.foundations;
      drivers.answerability = after.verdict.factors.answerability;
    }
  }

  const before = membersOf(r);
  const changes = [...changesOf(before, after), ...profileChanges(r, profile, reading), ...promptChanges(r, scan)];
  // A new date is a change though `same` reads past dates: the whole
  // verdict is written again, every member of it carrying that date.
  if (at.getTime() !== new Date(r.verdict.measuredAt).getTime() && !changes.some((c) => c.path.length === 1 && c.path[0] === "verdict")) {
    changes.unshift({ path: ["verdict"], value: after.verdict });
  }
  const score = after.verdict.scoreAndBand.kind === "unmeasured" ? null : after.verdict.scoreAndBand.value.score;
  return { before, after, changes, drivers, score, status: statusAfter(scan.status, before.verdict, after.verdict), kept, stale, reading };
}

/**
 * Issue 1539: each tracked-prompt answer's statements of the business, read
 * again from its stored text as the pass reads them (`readPromptAnswer`).
 * An answer whose text is no longer stored stands as stored.
 */
function promptChanges(r: RescoreReport, scan: Pick<RescoreScan, "siteName" | "answers" | "market">): ReportChange[] {
  const section = r.prompts;
  // A stored blob is not checked by its type: a section that lost a list is
  // left as stored.
  const answers: readonly PromptAnswer[] = Array.isArray(section?.answers) ? section.answers : [];
  if (section === undefined || !Array.isArray(section.asked)) return [];
  const language = localeOfReport(r).language;
  const changes: ReportChange[] = [];
  answers.forEach((answer, i) => {
    const asked = section.asked.find((prompt) => prompt.id === answer.promptId);
    const stored =
      asked === undefined
        ? undefined
        : scan.answers.find(
            (each) =>
              each.source === AI_ANSWER_SOURCES[answer.engine] &&
              each.key.startsWith(`${asked.text}|`) &&
              Number(/\|run:(\d+)$/.exec(each.key)?.[1] ?? 1) === answer.run
          );
    const text = stored?.whole ?? stored?.text ?? null;
    if (text === null) return;
    const rivals = scan.market?.rivals ?? answer.rivals.map((domain) => ({ name: brandOf(domain), domain }));
    const states = answer.named ? statementsOf({ text, siteName: section.siteName, ownDomain: r.domain, rivals, language }) : [];
    if (!same(answer.states ?? [], states)) changes.push({ path: ["prompts", "answers", i, "states"], value: states });
  });
  return changes;
}

/** The date the report wears: the scan's start (issue 1392). A stored date
 *  before the scan was asked for is a cached page read's, so the scan's own
 *  replaces it; any other stands. */
function scanDate(stored: Date | string, startedAt: string | undefined): Date {
  const measured = new Date(stored);
  if (startedAt === undefined) return measured;
  const started = new Date(startedAt);
  return Number.isNaN(started.getTime()) || measured.getTime() >= started.getTime() ? measured : started;
}

/** The stored profile with every field that names nothing taken out
 *  (issue 1479): a placeholder, or a protection page's words where the scan
 *  read one. `null` where no profile is stored. */
function clearedProfileOf(r: RescoreReport): Record<string, unknown> | null {
  if (r.market.kind === "unmeasured") return null;
  const profile: unknown = r.market.value.profile;
  if (profile === null || typeof profile !== "object") return null;
  return withoutPlaceholders(profile as Profile, (text) => isPlaceholder(text) || isProtectionName(text, r.domain)) as unknown as Record<string, unknown>;
}

/** Issue 1470: the lines, kind and reach a stored profile lacks, read from
 *  what the scan stored (`retrofitReading`). None where no profile is. */
function readingOf(r: RescoreReport, profile: Record<string, unknown> | null, market: RescoreScan["market"] | null): Retrofit {
  if (profile === null) return {};
  const serps: MarketSerp[] = [];
  for (const serp of r.serps) if (serp.kind !== "unmeasured") serps.push(serp.value);
  return retrofitReading({
    profile,
    measuredInTown: reachOfReport(r).measuredInTown,
    schemaTypes: r.onPage.kind === "unmeasured" ? [] : r.onPage.value.schemaTypes,
    serps,
    market,
  });
}

/** The report with its cleared profile completed by `reading`. */
function withReading(r: RescoreReport, profile: Record<string, unknown> | null, reading: Retrofit): RescoreReport {
  if (r.market.kind === "unmeasured" || profile === null) return r;
  if (profile === r.market.value.profile && Object.keys(reading).length === 0) return r;
  return { ...r, market: { ...r.market, value: { ...r.market.value, profile: { ...profile, ...reading } as typeof r.market.value.profile } } };
}

/** The profile's new members, each written at its own path; a profile that
 *  lost a field that named nothing is written whole. */
function profileChanges(r: RescoreReport, profile: Record<string, unknown> | null, reading: Retrofit): ReportChange[] {
  const path = ["market", "value", "profile"];
  const gained = (["offerings", "kind", "reach"] as const).filter((key) => reading[key] !== undefined);
  if (profile !== null && r.market.kind !== "unmeasured" && profile !== r.market.value.profile) {
    return [{ path, value: { ...profile, ...Object.fromEntries(gained.map((key) => [key, reading[key]])) } }];
  }
  return gained.map((key) => ({ path: [...path, key], value: reading[key] }));
}

/** A factor the current code cannot measure on this scan degrades it, as it
 *  degrades a new pass; nothing here makes a degraded or failed scan done. */
function statusAfter(status: ScanStatus, before: Verdict, after: Verdict): ScanStatus {
  if (status !== "done") return status;
  const was = new Set(before.missing.map((m) => m.factor));
  return after.missing.some((m) => !was.has(m.factor)) ? "degraded" : "done";
}

/** A value as it is stored: dates as ISO strings, keys in one order (a
 *  `jsonb` column keeps its own), and no `at`, which only re-dates a value
 *  and is no change to it. */
function canonical(value: unknown): string {
  return JSON.stringify(value, function (key, member: unknown) {
    if (key === "at" || key === "measuredAt") return undefined;
    if (member === null || typeof member !== "object" || Array.isArray(member)) return member;
    return Object.fromEntries(Object.entries(member as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  });
}

export function same(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}

/** The paths of `scans.report` the re-score rewrites. The AI-answers section
 *  is rewritten member by member, since its rows' wording is not exported. */
function changesOf(before: RescoredMembers, after: RescoredMembers): ReportChange[] {
  const changes: ReportChange[] = [];
  const put = (path: readonly (string | number)[], from: unknown, to: unknown): void => {
    if (!same(from, to)) changes.push({ path, value: to });
  };
  for (const key of ["verdict", "complete", "onPage", "siteIssues", "rivals", "sources", "presence", "coherence"] as const) {
    put([key], before[key], after[key]);
  }
  const was = before.aiAnswers;
  const now = after.aiAnswers;
  if (was === null || now === null) {
    put(["aiAnswers"], was, now);
    return changes;
  }
  for (const key of ["measuredSearches", "answeredSearches", "customerCitations", "reusedFrom", "rivals"] as const) {
    put(["aiAnswers", key], was[key], now[key]);
  }
  now.rows.forEach((row, i) => {
    const old = was.rows[i];
    if (old === undefined) return;
    put(["aiAnswers", "rows", i, "cell"], old.cell, row.cell);
    row.engines.forEach((engine, j) => put(["aiAnswers", "rows", i, "engines", j, "cell"], old.engines[j]?.cell, engine.cell));
  });
  return changes;
}

// ── The site's stored rivals ────────────────────────────────────────────

/** One site's stored rival set, and the report its evidence is read from. */
export interface RescoreSite {
  id: string;
  domain: string;
  /** `sites.competitors`. */
  competitors: readonly string[];
  /** `sites.market.current.rivals`; `null` where no market is stored. */
  rivals: readonly RivalConclusion[] | null;
  /** The founder chose the rivals: they stand (D28). */
  overridden: boolean;
  /** The site's current report. */
  report: EvidenceReport | null;
}

export interface RehomedSite {
  rivals: RivalConclusion[];
  competitors: string[];
  moved: readonly { name: string; from: string; to: string | null }[];
}

/**
 * A stored rival set read again with the current rule for where a rival is
 * kept (issue 1417's `rivalHome`): a rival stored under a store, a directory
 * or a platform is moved to its own site where the stored answers give one,
 * and dropped where they do not. The stored model answer is what is re-read;
 * no model is asked. `null` where nothing moves.
 */
export function rehomeSite(site: RescoreSite): RehomedSite | null {
  if (site.overridden || site.rivals === null) return null;
  const evidence = marketEvidence({
    domain: site.domain,
    siteName: null,
    headline: null,
    pages: [],
    products: [],
    claims: [],
    report: site.report,
  });
  const moved: { name: string; from: string; to: string | null }[] = [];
  const rivals: RivalConclusion[] = [];
  const taken = new Set<string>();
  for (const rival of site.rivals) {
    const home = rivalHome(rival, evidence);
    const to = home === null || taken.has(home) || isOwnDomain(home, site.domain) ? null : home;
    if (to !== rival.domain) moved.push({ name: rival.name, from: rival.domain, to });
    if (to === null) continue;
    taken.add(to);
    rivals.push({ ...rival, domain: to });
  }
  if (moved.length === 0) return null;
  const competitors: string[] = [];
  for (const domain of site.competitors) {
    const move = moved.find((m) => m.from === (registrableDomain(domain) ?? domain));
    const to = move === undefined ? domain : move.to;
    if (to !== null && !competitors.includes(to)) competitors.push(to);
  }
  return { rivals, competitors, moved };
}
