// src/lib/scan/derivation.ts — issue 1481: the re-score follows every scoring
// deploy by itself, and a public report is never silently stale.
//
// The deployment carries its derivation: `scripts/derivation.mjs`'s
// fingerprint of the code under `src/lib` the re-score reads a scan with,
// computed by `next.config.ts` at build as `RK_DERIVATION`. Each
// `rescore_runs` row records the derivation it ran with, so the tick can tell
// a deploy that changed how a scan is read from one that did not, and ask the
// next step itself (owner, 2026-10-14, issue 1426: every derivation change
// reaches every stored scan at 0¢; owner action is never a required step).
// One download per derivation (SPEC issue 1481 (2) as amended 2026-11-01):
//
//   no run at this derivation            → the apply, guarded in memory
//   a finished run                       → settled
//   a held guard or a run that failed    → held: nothing more is asked, and
//                                          the tick says so on every run
//
// The guard (`RESCORE_GUARD`), decided before any write: no score moves
// further than it allows, no scored scan loses its number, and no scan this
// build cannot read beyond the ones the run before could not read either.
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

/** A scan whose score the run would change. `null` is no number. */
export interface ScoreMove {
  domain: string;
  before: number | null;
  after: number | null;
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
  return reasons.length === 0 ? null : reasons.join("; ");
}

/** Whether the deployed code reads this stored scan differently from its
 *  report (SPEC §2, issue 1481): the last finished run at the deployed
 *  derivation lists it, as one the run would move or the apply left.
 *  `false` where nothing says so, or nothing can be read — the report still
 *  renders. */
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
