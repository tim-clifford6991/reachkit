// The public report's read, for `/scan/{domain}` and its share image: a visit
// reads the current row's status and checksum, and the blob only when that
// checksum is new. The engine reads `readCurrentReport`, never this.
import { unstable_cache } from "next/cache";
import { readPastProtection } from "./challenged";
import { readStoredReport, REPORT_VERSION, type StoredReport } from "./report";

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

// `is_current` and `report_md5` are not in the generated `Database` type.
interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  is(column: string, value: boolean): MinimalQueryBuilder<T>;
  limit(n: number): MinimalQueryBuilder<T>;
}

async function currentRow<T>(domain: string, columns: string): Promise<T | undefined> {
  const { dbAdmin } = await import("@/lib/db");
  const { data, error } = await (dbAdmin() as unknown as { from<R>(table: string): MinimalQueryBuilder<R> })
    .from<T>("scans")
    .select(columns)
    .eq("domain", domain)
    .is("is_current", true)
    .limit(1);
  if (error) throw new Error(`readShownReport: ${error.message}`);
  return data?.[0];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Next's data cache refuses an item over 2 MB, measured as it stores it. */
const CACHE_ITEM_MAX_CHARS = 1.9 * 1024 * 1024;
const warnedOversized = new Set<string>();

/** The kept copy as the one score the re-scored line names, or nothing where it cannot be read. */
function keptScoreOf(previous: unknown): unknown {
  if (previous === undefined) return undefined;
  try {
    return { version: REPORT_VERSION, verdict: { scoreAndBand: readStoredReport(previous).verdict.scoreAndBand } };
  } catch {
    return undefined;
  }
}

/**
 * What the page, its resolver and its share image read of a report. The
 * engine's members they never read go: the re-score's kept copy, the raw
 * robots rules and sitemaps, the crawl's page list, the ranked rows, the
 * page questions and the market prompts. The SERPs, sources and sizes stay,
 * because the free page and its holder are derived from them. Back in
 * jsonb's shape, because a cache miss hands this on before any round trip.
 */
export function shownView(report: StoredReport): unknown {
  const robots = report.robots.kind === "unmeasured" ? report.robots : { ...report.robots, value: { ...report.robots.value, rules: undefined, sitemaps: [] } };
  return JSON.parse(
    JSON.stringify({
      ...report,
      robots,
      siteIssues: report.siteIssues === null ? null : { ...report.siteIssues, checkedPages: null },
      ownRankedRows: [],
      pageQuestions: null,
      marketPrompts: undefined,
      previous: keptScoreOf(report.previous),
    })
  );
}

const OVERSIZED = { oversized: true } as const;

async function shownBlob(domain: string): Promise<unknown> {
  const fresh = async () => {
    const blob = (await currentRow<{ report: unknown }>(domain, "report"))?.report;
    return blob === null || blob === undefined ? null : shownView(readStoredReport(blob));
  };
  const stamp = await currentRow<{ status: string; report_md5: string | null }>(domain, "status, report_md5");
  if (stamp === undefined) return null;
  // A running scan, or a row with no checksum to key on, is read fresh.
  if (stamp.status === "running" || typeof stamp.report_md5 !== "string") return fresh();
  let missed: unknown = OVERSIZED;
  // The key changes with the report, so no writer has to invalidate it.
  const held = await unstable_cache(
    async () => {
      missed = await fresh();
      // Next stores the item as a JSON string inside JSON, so it measures it escaped.
      const chars = JSON.stringify(JSON.stringify(missed)).length;
      if (chars <= CACHE_ITEM_MAX_CHARS) return missed;
      if (!warnedOversized.has(domain)) {
        warnedOversized.add(domain);
        console.warn(`readShownReport: ${domain}'s report is ${chars} chars as shown, over the cache's bound; it is read uncached`);
      }
      return OVERSIZED;
    },
    ["shown-report", domain, stamp.report_md5]
  )();
  if (!isRecord(held) || held.oversized !== true) return held;
  return missed === OVERSIZED ? fresh() : missed;
}

/** The domain's current report as the public page shows it, or `null`. The
 *  protection ledger is read on every visit, outside the cache. */
export async function readShownReport(domain: string): Promise<StoredReport | null> {
  const blob = await shownBlob(domain);
  if (blob === null || blob === undefined) return null;
  return readPastProtection(readStoredReport(blob));
}
