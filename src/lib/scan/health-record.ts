// A paid pass's health, checked and kept on its own row (`scans.health`): the last thing a deep, weekly or re-measuring pass does,
// after its rivals are re-checked and topics derived, so the market read is the one it leaves in force. The checks are `./health.ts`'s.
// It never throws and never changes the pass: unrecorded health stays null, which no reader calls unhealthy.
import { dbAdmin } from "@/lib/db";
import { checkHealth, failingChecks, parseHealth, type ScanHealth, type SerpReads } from "./health";
import type { PromptsSection, StoredReport } from "./report";

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
  order(column: string, options: { ascending: boolean }): Query<T>;
  limit(count: number): Query<T>;
}

function table<T>(name: string): Query<T> {
  return (dbAdmin() as unknown as { from(table: string): Query<T> }).from(name);
}

function scans<T>(): Query<T> {
  return table<T>("scans");
}

/** The ledger's names for a Google SERP read: organic results and AI Mode, a SERP endpoint under the same request bound. */
export const SERP_SOURCES = ["serp/google/organic", "serp/google/ai_mode"] as const;

/** A failed call's kind, read out of the row's stored failure. */
export const FAILURE_KIND = "payload->>vendorFailure";

/** The SERP reads one pass's ledger rows hold; a row is a call that reached the vendor, so a search asked twice is two reads. `null` where unreadable: the check then fails nothing. */
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
  /** Whether this pass asks the tracked prompts: the onboarding pass asks none and states no rate. */
  asksPrompts: boolean;
}): Promise<ScanHealth | null> {
  try {
    const [{ readSiteMarket }, { samplesOf }] = await Promise.all([import("@/lib/market/infer/stored"), import("./weekly/prompts")]);
    const [market, serp, knowledgePages] = await Promise.all([
      readSiteMarket(a.siteId).then((read) => read?.stored.current ?? null),
      serpReadsOf(a.scanId).catch(() => null),
      import("@/lib/site-profile/knowledge/store")
        .then(({ readStoredKnowledge }) => readStoredKnowledge(a.domain))
        .then((stored) => stored.pages.length)
        .catch(() => null),
    ]);
    const section = a.report.prompts;
    const health = checkHealth({
      market,
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

/** The tracked prompts' answers of the site's newest pass that asked them and whose health was recorded and passed,
 *  so a pass still running, or one a check failed on, is never read. `null` where there is none or the read fails. */
export async function healthyPrompts(siteId: string): Promise<PromptsSection | null> {
  try {
    const { data } = await scans<{ health: unknown; prompts: PromptsSection | null }>()
      .select("health, prompts:report->prompts")
      .eq("site_id", siteId)
      .not("health", "is", null)
      .order("created_at", { ascending: false })
      .limit(8);
    const passed = (row: { health: unknown }) => parseHealth(row.health) !== null && failingChecks(parseHealth(row.health)).length === 0;
    const asked = (row: { prompts: PromptsSection | null }) => Array.isArray(row.prompts?.asked) && Array.isArray(row.prompts.answers);
    return (data ?? []).find((row) => passed(row) && asked(row))?.prompts ?? null;
  } catch {
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
