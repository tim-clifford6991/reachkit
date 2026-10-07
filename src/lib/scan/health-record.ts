// src/lib/scan/health-record.ts — a paid pass's health, checked and kept on
// its own row (SPEC §6, owner D58 of 2026-10-06, issue 1287).
//
// The last thing a deep, weekly or re-measuring pass does with its report:
// after its rivals are re-checked and its topics derived, so the market read
// here is the one the pass leaves in force. The checks are `./health.ts`'s;
// this reads what they need and writes `scans.health`.
//
// It never throws and never changes the pass: a pass whose health could not
// be recorded keeps `health` null, which no reader calls unhealthy.
import { dbAdmin } from "@/lib/db";
import { checkHealth, failingChecks, parseHealth, type ScanHealth, type SerpReads } from "./health";
import type { StoredReport } from "./report";

interface Result<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface Query<T> extends PromiseLike<Result<T>> {
  select(columns: string): Query<T>;
  update(values: Record<string, unknown>): Query<T>;
  eq(column: string, value: string): Query<T>;
  in(column: string, values: readonly string[]): Query<T>;
  gte(column: string, value: string): Query<T>;
  lt(column: string, value: string): Query<T>;
  not(column: string, operator: string, value: null): Query<T>;
}

function table<T>(name: string): Query<T> {
  return (dbAdmin() as unknown as { from(table: string): Query<T> }).from(name);
}

function scans<T>(): Query<T> {
  return table<T>("scans");
}

/** The ledger's names for a Google SERP read: the organic results
 *  (`serpOrganic`'s `source`) and AI Mode (`aiMode`'s), which is a SERP
 *  endpoint under the same request bound (issue 1314). */
export const SERP_SOURCES = ["serp/google/organic", "serp/google/ai_mode"] as const;

/** A failed call's kind, read out of the row's stored failure. */
export const FAILURE_KIND = "payload->>vendorFailure";

/**
 * The SERP reads one pass's ledger rows hold (D63, issue 1298). A row is a
 * call that reached the vendor, so a search asked twice is two reads. `null`
 * where the ledger could not be read: the check then fails nothing.
 */
export async function serpReadsOf(scanId: string): Promise<SerpReads | null> {
  const { data, error } = await table<{ failure: string | null }>("fetches")
    .select(`failure:${FAILURE_KIND}`)
    .eq("scan_id", scanId)
    .in("source", SERP_SOURCES);
  if (error !== null || data === null) return null;
  return { reads: data.length, timeouts: data.filter((row) => row.failure === "timeout").length };
}

export async function recordPassHealth(a: {
  scanId: string;
  siteId: string;
  domain: string;
  report: StoredReport;
  /** Whether this pass asks the tracked prompts: the onboarding pass asks
   *  none (SPEC §6, 2026-10-03), and states no rate. */
  asksPrompts: boolean;
}): Promise<ScanHealth | null> {
  try {
    const [{ promptsInForce }, { samplesOf }, { ownKeywords }] = await Promise.all([
      import("./market-conclusion"),
      import("./weekly/prompts"),
      import("@/lib/market/infer/demand"),
    ]);
    const [inForce, serp, knowledgePages] = await Promise.all([
      promptsInForce({ siteId: a.siteId, domain: a.domain }),
      serpReadsOf(a.scanId).catch(() => null),
      import("@/lib/site-profile/knowledge/store")
        .then(({ readStoredKnowledge }) => readStoredKnowledge(a.domain))
        .then((stored) => stored.pages.length)
        .catch(() => null),
    ]);
    const section = a.report.prompts;
    const health = checkHealth({
      market: inForce?.market ?? null,
      ownNames: ownKeywords({ domain: a.domain, siteName: inForce?.siteName ?? null }),
      asked: section?.asked ?? inForce?.stored.prompts ?? [],
      generated: inForce?.generated ?? [],
      samples: a.asksPrompts ? (section === undefined ? [] : samplesOf(section)) : null,
      serp,
      knowledgePages,
      at: new Date(),
    });
    const { error } = await scans<{ id: string }>().update({ health }).eq("id", a.scanId);
    if (error !== null) throw new Error(error.message);
    console.log(
      JSON.stringify({
        event: "pass_health",
        scanId: a.scanId,
        siteId: a.siteId,
        failing: failingChecks(health).map((result) => result.check),
      })
    );
    return health;
  } catch (error) {
    console.log(
      JSON.stringify({
        event: "pass_health_failed",
        scanId: a.scanId,
        because: error instanceof Error ? error.message : String(error),
      })
    );
    return null;
  }
}

/**
 * The ids of one site's passes since `since` that a check failed on: the
 * passes the headline numbers are not read from. Degrades to none — a read
 * that fails hides no pass.
 */
export async function unhealthyScans(a: { siteId: string; since: string }): Promise<ReadonlySet<string>> {
  try {
    const { data, error } = await scans<{ id: string; health: unknown }>()
      .select("id, health")
      .eq("site_id", a.siteId)
      .gte("created_at", a.since)
      .not("health", "is", null);
    if (error !== null || data === null) return new Set();
    return new Set(data.filter((row) => typeof row.id === "string" && failingChecks(parseHealth(row.health)).length > 0).map((row) => row.id));
  } catch {
    return new Set();
  }
}

/** One pass a check failed on, as the Monday owner digest lists it. */
export interface UnhealthyPass {
  scanId: string;
  domain: string;
  failing: readonly { check: string; detail: string }[];
}

/** Every pass created in `[from, to)` that a check failed on, oldest first. */
export async function unhealthyPassesBetween(a: { from: string; to: string }): Promise<UnhealthyPass[]> {
  const { data, error } = await scans<{ id: string; domain: string; created_at: string; health: unknown }>()
    .select("id, domain, created_at, health")
    .gte("created_at", a.from)
    .lt("created_at", a.to)
    .not("health", "is", null);
  if (error !== null) throw new Error(`unhealthyPassesBetween: ${error.message}`);
  return [...(data ?? [])]
    .sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)))
    .flatMap((row) => {
      const failing = failingChecks(parseHealth(row.health));
      return failing.length === 0
        ? []
        : [{ scanId: row.id, domain: row.domain, failing: failing.map((result) => ({ check: result.check, detail: result.detail })) }];
    });
}
