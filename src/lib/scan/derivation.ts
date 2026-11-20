// The re-score follows every scoring deploy by itself. The deployment carries its derivation (`RK_DERIVATION`, `scripts/derivation.mjs`'s fingerprint of the code the re-score reads with),
// and each `rescore_runs` row records the one it ran with, so the tick asks the next step itself at 0¢. One download per derivation:
// no run at this derivation → the apply, guarded in memory; a finished run → settled; a held guard or a failed run → held, said on every tick.
// The guard (`RESCORE_GUARD`), before any write: no score moves past it, no scored scan loses its number, no new unreadable scans,
// and no report with `rivalsLostFrom` measured rivals or more left with none.
import { RESCORE_GUARD } from "@/lib/config/constants";

/** The deployed derivation; `null` where the build carried none (a test, a
 *  local run), which asks for nothing. */
export function deployedDerivation(): string | null {
  const value = process.env.RK_DERIVATION;
  return value === undefined || value === "" ? null : value;
}

/** The deployed facts version (`fetch_facts.facts_version`); `null` where
 *  the build carried none, which keeps no facts. */
export function deployedFactsVersion(): string | null {
  const value = process.env.RK_FACTS_VERSION;
  return value === undefined || value === "" ? null : value;
}

/** Only production's own tick asks: dev reads the same database (one
 *  Supabase project) with code that may be ahead of production's. */
export function asksByItself(): boolean {
  return process.env.VERCEL_ENV === "production" && deployedDerivation() !== null;
}

/** A `rescore_runs` row as the tick reads it. */
export interface RunRecord {
  mode: "dry" | "apply";
  derivation: string | null;
  requestedAt: string;
  finishedAt: string | null;
  error: string | null;
  held: string | null;
  /** Stored scans that run could not read. */
  unreadable: number | null;
}

export type NextStep =
  | { ask: "apply" }
  | { wait: true }
  | { settled: true }
  | { held: string };

/** What the tick does next at `derivation`, from every run so far. */
export function nextStep(runs: readonly RunRecord[], derivation: string): NextStep {
  if (runs.some((r) => r.finishedAt === null)) return { wait: true };
  const here = runs.filter((r) => r.derivation === derivation).sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const last = here.at(-1);
  if (last === undefined) return { ask: "apply" };
  if (last.error !== null) return { held: `the ${last.mode === "dry" ? "dry run" : "apply"} failed: ${last.error}` };
  if (last.held !== null) return { held: last.held };
  return { settled: true };
}

/** Whether a tick has work, read without a write: a run not finished, or an apply to ask or hold. */
export function rescoreWaits(runs: readonly RunRecord[], derivation: string | null, byItself: boolean = asksByItself()): boolean {
  if (runs.some((r) => r.finishedAt === null)) return true;
  return derivation !== null && byItself && !("settled" in nextStep(runs, derivation));
}

/** A scan whose score or rival count the run would change. `null` is no
 *  number; for rivals, not measured, which is never 0. */
export interface ScoreMove {
  domain: string;
  before: number | null;
  after: number | null;
  rivalsBefore: number | null;
  rivalsAfter: number | null;
}

/** Why a run may not write, or `null` where it may. */
export function heldBecause(a: {
  moves: readonly ScoreMove[];
  unreadable: number;
  /** The run before's count; `null` where no run recorded one. */
  unreadableBefore: number | null;
  /** True where this read follows the run's own writes: every move it
   *  still finds is the apply lagging. */
  afterApply: boolean;
  changed: number;
}): string | null {
  if (a.afterApply && a.changed > 0) {
    return `after the apply, ${a.changed} ${a.changed === 1 ? "scan still reads" : "scans still read"} differently from the deployed code`;
  }
  const reasons: string[] = [];
  for (const m of a.moves) {
    if (m.before !== null && m.after === null) reasons.push(`${m.domain} loses its score (${m.before} → none)`);
    else if (m.before !== null && m.after !== null && Math.abs(m.after - m.before) > RESCORE_GUARD.maxScoreMove) {
      reasons.push(`${m.domain} moves ${Math.abs(m.after - m.before)} points (${m.before} → ${m.after}), more than ${RESCORE_GUARD.maxScoreMove}`);
    }
  }
  if (a.unreadableBefore !== null && a.unreadable > a.unreadableBefore) {
    reasons.push(`${a.unreadable} stored scans this build cannot read, ${a.unreadableBefore} before`);
  }
  const emptied = a.moves.filter((m) => m.rivalsBefore !== null && m.rivalsBefore >= RESCORE_GUARD.rivalsLostFrom && m.rivalsAfter === 0);
  if (emptied.length === 1) reasons.push(`${emptied[0]!.domain} loses all its rivals (${emptied[0]!.rivalsBefore} → 0)`);
  else if (emptied.length > 1) reasons.push(`${emptied.length} reports lose all their rivals: ${emptied.map((m) => `${m.domain} (${m.rivalsBefore} → 0)`).join(", ")}`);
  return reasons.length === 0 ? null : reasons.join("; ");
}

/** Whether the deployed code reads this stored scan differently from its report: the last finished run at this derivation lists it.
 *  `false` where nothing says so or nothing can be read; the report still renders. */
export async function readsDifferently(scanId: string, derivation = deployedDerivation()): Promise<boolean> {
  if (derivation === null) return false;
  try {
    const { dbAdmin } = await import("@/lib/db");
    // `rescore_runs` is not in the generated `Database` type — the same
    // narrow cast `rescore-run.ts` documents.
    const client = dbAdmin() as unknown as {
      from(table: string): {
        select(columns: string): {
          eq(column: string, value: string): {
            not(column: string, operator: string, value: null): {
              order(column: string, options: { ascending: boolean }): {
                limit(n: number): PromiseLike<{ data: { stale_scans: string[] | null }[] | null; error: unknown }>;
              };
            };
          };
        };
      };
    };
    const { data, error } = await client
      .from("rescore_runs")
      .select("stale_scans")
      .eq("derivation", derivation)
      .not("finished_at", "is", null)
      .order("requested_at", { ascending: false })
      .limit(1);
    if (error !== null) return false;
    return data?.[0]?.stale_scans?.includes(scanId) ?? false;
  } catch {
    return false;
  }
}
