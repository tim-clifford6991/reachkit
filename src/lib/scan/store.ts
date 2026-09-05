// BUILD §4.1, §6.5 — the composition that omits no section, and the one
// transaction that flips the current-report pointer.
//
// `assembleReport` is **pure and total**: one required member per section
// of `StoredReport`, so a section a stage never produced is a compile
// error rather than a missing key, and the caller must pass the `Measured`
// arm that says why. It computes nothing — no score, no rate, no count, no
// band — and re-derives no figure. It derives exactly two fields from what
// it is given: `complete`, which is `stoppedReason === 'complete'`, and
// `version`, the one blob version this build writes. It reads no clock:
// `measuredAt` is the caller's, so the report's date is the date of the
// measurement and not of the storage, and every `Measured.at` under it
// still agrees with it.
//
// `storeCurrentReport` is the write. The row and the pointer flip are one
// transaction — `store_current_report` in
// `supabase/migrations/20260905120000_scans_current_flip.sql`, which
// explains why the two statements the partial unique index forces cannot
// be two PostgREST round trips. A `stoppedReason` of `'failed'` never sets
// `is_current` and never clears the previous one.
import { dbAdmin } from "@/lib/db";
import type { CoherenceVerdict } from "@/lib/market/coherence/check";
import type { CorrectionState } from "@/lib/market/coherence/state";
import type { AiAnswersCard } from "@/lib/market/questions/matrix";
import type { MarketSet } from "@/lib/market/questions/market-set";
import type { Question } from "@/lib/market/questions/phrase";
import type { PresenceCard } from "@/lib/market/rivals/presence";
import type { RivalCandidate } from "@/lib/market/rivals/derive";
import type { Measured } from "@/lib/measure/measured";
import type { OnPageFacts } from "@/lib/measure/parse";
import type { Drivers } from "@/lib/measure/score";
import type { Verdict } from "@/lib/measure/verdict";
import type { RobotsPolicy } from "@/lib/egress/types";
import type { SerpResult } from "@/lib/vendors/dataforseo/types";
import type { CanonicalDomain } from "./domain";
import { REPORT_VERSION, type StoredReport, type StoppedReason, type Tier } from "./report";

/**
 * One required member per section of `StoredReport`. Required, not
 * optional, and that is the whole point: a section that could not be
 * measured is present with its `Measured` arms saying so, because an
 * absent key and a `not_attempted` value read the same to a consumer. An
 * optional member here would make that a convention; a required one makes
 * it a compile error.
 */
export interface ReportSections {
  scanId: string;
  domain: CanonicalDomain;
  measuredAt: Date;
  tier: Tier;
  stoppedReason: StoppedReason;
  fromIncompleteRescan: boolean;
  verdict: Verdict;
  market: Measured<MarketSet>;
  questions: Measured<Question[]>;
  answers: AiAnswersCard;
  presence: PresenceCard;
  serps: readonly Measured<SerpResult>[];
  rivals: Measured<RivalCandidate[]>;
  sources: readonly string[];
  onPage: Measured<OnPageFacts>;
  robots: Measured<RobotsPolicy>;
  coherence: CoherenceVerdict;
  correctionState: CorrectionState;
}

/** Pure and total: a copy plus the two derived fields. No arithmetic, no
 *  clock, no I/O, and every section in the result is the very value it was
 *  handed. */
export function assembleReport(s: ReportSections): StoredReport {
  return {
    version: REPORT_VERSION,
    scanId: s.scanId,
    domain: s.domain,
    measuredAt: s.measuredAt,
    tier: s.tier,
    complete: s.stoppedReason === "complete",
    stoppedReason: s.stoppedReason,
    fromIncompleteRescan: s.fromIncompleteRescan,
    verdict: s.verdict,
    market: s.market,
    questions: s.questions,
    answers: s.answers,
    presence: s.presence,
    serps: s.serps,
    rivals: s.rivals,
    sources: s.sources,
    onPage: s.onPage,
    robots: s.robots,
    coherence: s.coherence,
    correctionState: s.correctionState,
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

// The generated `Database` type carries neither `scans.is_current` nor the
// `store_current_report` function, both of which are on disk in
// `supabase/migrations/`. One narrow, explicitly cast boundary, the same
// worked-around gap `admission.ts` and `report.ts` already carry;
// regenerating `types.generated.ts` is not this change's to do.
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
  costCents: number;
}): Promise<{ scanId: string; status: ScanStatus }> {
  const status = statusOf({ stoppedReason: a.report.stoppedReason, degraded: a.degraded });

  const { error } = await untyped(dbAdmin()).rpc("store_current_report", {
    p_scan_id: a.report.scanId,
    p_domain: a.report.domain,
    p_site_id: a.siteId ?? null,
    p_tier: a.report.tier,
    p_status: status,
    p_score: a.report.verdict.scoreAndBand.kind === "unmeasured" ? null : a.report.verdict.scoreAndBand.value.score,
    p_drivers: a.drivers,
    p_report: a.report,
    p_cost_cents: Math.ceil(a.costCents),
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
