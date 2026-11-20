// The stored side of the market correction (BUILD §6.7): the current report's facts and the one conditional write of its `correction_state`. The decision itself is the market module's.
// `scans.correction_state` and `scans.is_current` are missing from the generated `Database` type, so both queries go through `untyped`.
// The removal list is asked of `admission.ts`, its one reader.
// The re-measurement registers itself through `registerCorrectionRunner`; while none is registered a correction is refused before it runs, so no state is stranded.
import { dbAdmin } from "@/lib/db";
import type { CorrectionState } from "@/lib/market/coherence/state";
import type { ReportFacts } from "@/lib/market/coherence/offer";
import { isDomainRemoved } from "./admission";
import type { CanonicalDomain } from "./domain";

/** The scan pipeline's entry point as this seam calls it (BUILD §6.3): one pipeline with the tier as a parameter, `correctionOf` the category the reader corrected to,
 *  and the visitor's network. A correction re-measures inside the scan it corrects: no ceiling override, no deadline. */
export type CorrectionRunner = (a: {
  domain: string;
  tier: "free";
  correctionOf: string;
  category: string;
  /** The visitor's network key: the rerun's row counts against their free bounds. */
  network: string;
}) => Promise<CorrectionRun>;

/** A started re-measurement: `scanId` is already claimed, so the report can follow its stages at `/api/scan/{scanId}/progress`; `finished` settles with the pass and goes to `after()`. */
export interface CorrectionRun {
  scanId: string;
  finished: Promise<{ scanId: string; status: "done" | "degraded" | "failed" }>;
}

let runner: CorrectionRunner | null = null;

/** Registered once, by the scan pipeline, at its own module load. */
export function registerCorrectionRunner(fn: CorrectionRunner | null): void {
  runner = fn;
}

/** `null` while no pipeline has registered — the caller must then refuse
 *  before the run rather than record an attempt nothing can finish. */
export function correctionRunner(): CorrectionRunner | null {
  return runner;
}

// ── The two stale-type gaps ─────────────────────────────────────────────

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  update(values: Record<string, unknown>): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  is(column: string, value: boolean): MinimalQueryBuilder<T>;
  limit(n: number): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

/** Cast boundary for the two gaps; nothing else here bypasses the generated `Database` type. */
function untyped(client: ReturnType<typeof dbAdmin>): MinimalClient {
  return client as unknown as MinimalClient;
}

interface CurrentScanRow {
  id: string;
  created_at: string;
  correction_state: string;
  report: unknown;
}

const CORRECTION_STATES: readonly CorrectionState[] = [
  "none",
  "running",
  "failed_once",
  "running_retry",
  "used",
  "exhausted",
];

/** A stored `correction_state` outside the machine's six members is not a
 *  seventh state: it is an unreadable one, and the safest reading of an
 *  unreadable attempt count is that both attempts are gone. */
function asCorrectionState(stored: string): CorrectionState {
  return CORRECTION_STATES.find((state) => state === stored) ?? "exhausted";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The category the report measured, from the stored market section's profile. Unmeasured, older or non-string reads as `null`: none may be guessed into one. */
function categoryIn(report: unknown): string | null {
  if (!isRecord(report) || !isRecord(report.market)) return null;
  const market = report.market;
  if (market.kind !== "measured" && market.kind !== "zero") return null;
  if (!isRecord(market.value) || !isRecord(market.value.profile)) return null;
  const category = market.value.profile.category;
  return typeof category === "string" && category.length > 0 ? category : null;
}

/** An unanswerable read is not evidence of a removal; this only keeps an offer off a removed report, so it fails open. */
async function removedOrUnanswerable(domain: CanonicalDomain): Promise<boolean> {
  try {
    return await isDomainRemoved(domain);
  } catch {
    return false;
  }
}

/**
 * The facts the correction offer is decided from, for the domain's one
 * current report. `null` where that domain has no current report at all —
 * there is nothing to correct, and no report is invented to carry an
 * offer.
 */
export async function readCorrectionFacts(domain: CanonicalDomain): Promise<ReportFacts | null> {
  const { data, error } = await untyped(dbAdmin())
    .from<CurrentScanRow>("scans")
    .select("id, created_at, correction_state, report")
    .eq("domain", domain)
    .is("is_current", true)
    .limit(1);
  if (error) throw new Error(error.message);

  const row = data?.[0];
  if (!row) return null;

  return {
    scanId: row.id,
    measuredAt: new Date(row.created_at),
    category: categoryIn(row.report),
    correctionState: asCorrectionState(row.correction_state),
    domainRemoved: await removedOrUnanswerable(domain),
  };
}

/**
 * Moves one report's `correction_state` from the value the decision was
 * made against to the value the state machine returned — conditional on
 * the stored value still being `from`, so two submissions racing for the
 * same report resolve in Postgres and exactly one of them wins. The loser
 * is told a correction is already under way, which is what is true.
 *
 * Returns whether this caller is the one that advanced the state.
 */
export async function advanceCorrectionState(a: {
  scanId: string;
  from: CorrectionState;
  to: CorrectionState;
}): Promise<boolean> {
  const { data, error } = await untyped(dbAdmin())
    .from<{ id: string }>("scans")
    .update({ correction_state: a.to })
    .eq("id", a.scanId)
    .eq("correction_state", a.from)
    .select("id");
  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length === 1;
}
