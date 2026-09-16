// src/lib/scan/correction.ts — BUILD §6.7 step 5, the stored side of the
// one market correction.
//
// The correction *decision* is the market module's — the coherence
// verdict, the offer and the state machine are pure and live there. This
// file is the two things that decision needs from storage and cannot get
// without it: the facts of the domain's current report, and the one
// conditional write that moves that report's `correction_state` forward.
// It holds no threshold, no allowance arithmetic and no state table: it
// reads `CorrectionState` values and writes the one it is handed.
//
// **Two stale-type gaps, worked around the way `admission.ts` already
// works around its own** (`untyped`, below, and that file's module header
// for the pattern): `scans.correction_state` and `scans.is_current` are on
// disk in `supabase/migrations/20260904110000_scans_current.sql` and
// neither is in the generated `Database` type, which has not been
// regenerated since. Both queries here go through a narrow, explicitly
// cast builder against a locally declared row shape; regenerating
// `types.generated.ts` is its own change, not this one.
//
// The removal list is *not* read here: `admission.ts` is the one file
// under `src/` that names that table (REQ-002 c4), and this module asks it
// rather than opening a second reader of the same fact.
//
// **The re-measurement itself is issue #25's `runScan`, which is not on
// disk.** Rather than fork a second pipeline here, this module declares
// the one seam that pipeline registers itself through
// (`registerCorrectionRunner`) and answers honestly while nothing is
// registered: `correctionRunner()` returns `null`, and the correction is
// refused *before it runs* — the same arm as free scanning being paused or
// switched off, which costs the reader neither attempt and leaves the
// control standing. Nothing here writes a state that a missing pipeline
// would then strand.
import { dbAdmin } from "@/lib/db";
import type { CorrectionState } from "@/lib/market/coherence/state";
import type { ReportFacts } from "@/lib/market/coherence/offer";
import { isDomainRemoved } from "./admission";
import type { CanonicalDomain } from "./domain";

/** The scan pipeline's own entry point, as this seam needs to call it:
 *  BUILD §6.3's one pipeline with the tier as a parameter, plus
 *  `correctionOf` — "a market correction re-measures inside the scan it
 *  corrects: same spend ceiling, no second allowance consumed" — and the
 *  category the reader corrected to, which is what the re-measurement
 *  seeds on (#767). Nothing else is ever passed through it from here: no
 *  ceiling override, no deadline, no allowance flag. */
export type CorrectionRunner = (a: {
  domain: string;
  tier: "free";
  correctionOf: string;
  category: string;
}) => Promise<CorrectionRun>;

/** A started re-measurement (#786). `scanId` is the row the pass writes
 *  to, already claimed when this resolves — so the report can follow the
 *  rerun's stages at `/api/scan/{scanId}/progress` from the moment the
 *  submission is answered — and `finished` settles when the pass does. The
 *  correction route hands `finished` to `after()`: the pass outlives the
 *  response, as the free scan's does. */
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

/** Cast boundary for the two gaps named in the module header. Nothing else
 *  in this file bypasses the generated `Database` type. */
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

/**
 * The category the report measured, read out of the stored blob's market
 * section: `market` is `Measured<MarketSet>` and a `MarketSet` carries the
 * profile the category belongs to (ADR-095). A market that was not
 * measured, a blob written before that shape, and a category that is not a
 * non-empty string all read the same way — `null`, "the scan never reached
 * one" — because none of them is a category and none may be guessed into
 * one.
 */
function categoryIn(report: unknown): string | null {
  if (!isRecord(report) || !isRecord(report.market)) return null;
  const market = report.market;
  if (market.kind !== "measured" && market.kind !== "zero") return null;
  if (!isRecord(market.value) || !isRecord(market.value.profile)) return null;
  const category = market.value.profile.category;
  return typeof category === "string" && category.length > 0 ? category : null;
}

/** A read that cannot be answered is not evidence of a removal. The report
 *  address decides what a removed domain is served (REQ-002 c3); this read
 *  only keeps a correction from being offered on one, so it fails open the
 *  same way the admission order's own first step does. */
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
