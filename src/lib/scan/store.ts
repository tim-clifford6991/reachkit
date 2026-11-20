// BUILD §4.1, §6.5: the composition that omits no section, and the one transaction that flips the current-report pointer.
// `assembleReport` is pure and total: one required member per section, so a missing section is a compile error. It computes and re-shapes nothing,
// deriving only `complete` and `version`, and reads no clock: the report's one date is the caller's `verdict.measuredAt`.
// `storeCurrentReport` writes the row and flips the pointer in one transaction (`store_current_report`), since the partial unique index forces
// two statements that cannot be two PostgREST round trips. A `failed` pass never sets `is_current` nor clears the previous one.
import { dbAdmin } from "@/lib/db";
import type { CoherenceVerdict } from "@/lib/market/coherence/check";
import type { CorrectionState } from "@/lib/market/coherence/state";
import type { MarketSet } from "@/lib/market/questions/market-set";
import type { Question } from "@/lib/market/questions/phrase";
import type { RivalCandidate } from "@/lib/market/rivals/derive";
import type { RivalSize } from "@/lib/market/rivals/size";
import type { Measured } from "@/lib/measure/measured";
import type { OnPageFacts } from "@/lib/measure/parse";
import type { Drivers } from "@/lib/measure/score";
import type { Verdict } from "@/lib/measure/verdict";
import type { RobotsPolicy } from "@/lib/egress/types";
import type { SiteIssuesSection } from "@/lib/site-issues/types";
import type { RankedRow, SerpResult } from "@/lib/vendors/dataforseo/types";
import type { CanonicalDomain } from "./domain";
import type { AI_READER_AGENTS } from "@/lib/config/constants";
import { REPORT_VERSION } from "./report";
import { shownScore } from "./shown-score";
import type {
  AiAnswersSection,
  PageQuestionsSection,
  FreePageSection,
  MarketPromptAnswer,
  PromptsSection,
  PresenceSection,
  StoppedReason,
  StoredReport,
  SupplySection,
  Tier,
} from "./report";

/** One required member per section: an unmeasurable section is present with its `Measured` arms saying so, since an absent key and `not_attempted`
 *  read the same; required makes that a compile error, not a convention. */
export interface ReportSections {
  scanId: string;
  domain: CanonicalDomain;
  tier: Tier;
  stoppedReason: StoppedReason;
  fromIncompleteRescan: boolean;
  /** The one date governing the whole blob, `verdict.measuredAt`; there is no second, so they cannot drift. */
  verdict: Verdict;
  blockedAgents: readonly (typeof AI_READER_AGENTS)[number][];
  aiAnswers: AiAnswersSection | null;
  /** The page questions, or `null` on a pass that asked none: required, since a missing key would mean "nobody handed this over". */
  pageQuestions: PageQuestionsSection | null;
  presence: PresenceSection | null;
  supply: SupplySection;
  freePage: FreePageSection | null;
  market: Measured<MarketSet>;
  questions: Measured<Question[]>;
  serps: readonly Measured<SerpResult>[];
  rivals: Measured<RivalCandidate[]>;
  rivalSizes: Measured<RivalSize[]>;
  ownRanked: Measured<number>;
  ownRankedRows: readonly RankedRow[];
  sources: readonly string[];
  onPage: Measured<OnPageFacts>;
  robots: Measured<RobotsPolicy>;
  siteIssues: SiteIssuesSection | null;
  coherence: CoherenceVerdict;
  correctionState: CorrectionState;
  /** The category the pass was handed, or `null` where it seeded from the profile. */
  measuredCategory: string | null;
  /** The buyer prompts a pass asked, empty where none; the blob omits the member then. */
  marketPrompts: readonly MarketPromptAnswer[];
  /** The tracked prompts a weekly pass asked, `null` where none; the blob omits the member then. */
  prompts: PromptsSection | null;
}

/** Pure and total: a copy plus the two derived fields. No arithmetic, no
 *  clock, no I/O, and every section in the result is the very value it was
 *  handed. */
export function assembleReport(s: ReportSections): StoredReport {
  return {
    version: REPORT_VERSION,
    scanId: s.scanId,
    domain: s.domain,
    tier: s.tier,
    complete: s.stoppedReason === "complete",
    stoppedReason: s.stoppedReason,
    fromIncompleteRescan: s.fromIncompleteRescan,
    verdict: s.verdict,
    blockedAgents: s.blockedAgents,
    aiAnswers: s.aiAnswers,
    pageQuestions: s.pageQuestions,
    presence: s.presence,
    supply: s.supply,
    freePage: s.freePage,
    market: s.market,
    questions: s.questions,
    serps: s.serps,
    rivals: s.rivals,
    rivalSizes: s.rivalSizes,
    ownRanked: s.ownRanked,
    ownRankedRows: s.ownRankedRows,
    sources: s.sources,
    onPage: s.onPage,
    robots: s.robots,
    siteIssues: s.siteIssues,
    coherence: s.coherence,
    correctionState: s.correctionState,
    measuredCategory: s.measuredCategory,
    ...(s.marketPrompts.length === 0 ? {} : { marketPrompts: s.marketPrompts }),
    ...(s.prompts === null ? {} : { prompts: s.prompts }),
  };
}

export type ScanStatus = "done" | "degraded" | "failed";

/** Total over `stoppedReason` × `degraded`, with no arm that swallows a
 *  fourth case: a failure is `failed` whatever else was true; a pass that
 *  a ceiling stopped, or that the cap made skip work, is `degraded`;
 *  everything else is `done`. */
export function statusOf(a: { stoppedReason: StoppedReason; degraded: boolean }): ScanStatus {
  if (a.stoppedReason === "failed") return "failed";
  if (a.degraded || a.stoppedReason !== "complete") return "degraded";
  return "done";
}

// The generated `Database` type carries neither `scans.is_current` nor `store_current_report`: one narrow cast boundary.
interface MinimalRpcClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ error: { message: string } | null }>;
}

function untyped(client: ReturnType<typeof dbAdmin>): MinimalRpcClient {
  return client as unknown as MinimalRpcClient;
}

/**
 * Writes the scan row and moves the current-report pointer in one
 * transaction, and returns the status the pipeline reports.
 *
 * The flip is the commit point. A report whose pass `failed` is still
 * written — the row records what happened — but never becomes current, so
 * the previous report and its date stay exactly where they were.
 */
export async function storeCurrentReport(a: {
  report: StoredReport;
  siteId?: string;
  supersedesScanId?: string;
  /** The four measured quantities the score was composed from. Stored on
   *  the row, never in the blob and never on a surface. */
  drivers: Drivers;
  /** The cost seam's own `degraded()`, carried and not recomputed. */
  degraded: boolean;
  /** The caller's own verdict that the pass measured nothing it can stand on. */
  failed?: true;
  costCents: number;
}): Promise<{ scanId: string; status: ScanStatus }> {
  const status = a.failed === true ? "failed" : statusOf({ stoppedReason: a.report.stoppedReason, degraded: a.degraded });

  const { error } = await untyped(dbAdmin()).rpc("store_current_report", {
    p_scan_id: a.report.scanId,
    p_domain: a.report.domain,
    p_site_id: a.siteId ?? null,
    p_tier: a.report.tier,
    p_status: status,
    p_score: shownScore(a.report),
    p_drivers: a.drivers,
    p_report: a.report,
    // The figure the seam settled, not rounded to a cent: `cost_cents` is `numeric(12,4)`.
    p_cost_cents: a.costCents,
    p_stopped_reason: a.report.stoppedReason,
    p_correction_state: a.report.correctionState,
    p_supersedes_scan_id: a.supersedesScanId ?? null,
    p_make_current: a.report.stoppedReason !== "failed",
  });
  if (error) throw new Error(`storeCurrentReport: ${error.message}`);

  logStore({ scanId: a.report.scanId, status, stoppedReason: a.report.stoppedReason });
  return { scanId: a.report.scanId, status };
}

function logStore(fields: { scanId: string; status: ScanStatus; stoppedReason: StoppedReason }): void {
  console.log(JSON.stringify({ event: "report_stored", ...fields }));
}
