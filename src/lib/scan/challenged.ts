// SPEC §2 (issue 1383) — a report measured off a bot-protection page, read
// as what it is.
//
// Issue 1379 stopped a pass from measuring a protection's page as the site.
// The reports stored before it were measured off exactly such a page, and
// they are still the domain's current report: sage.com stayed "0, Invisible"
// while the 7-day re-scan window answered every new scan from it. This
// module applies the measure-time rule at read time. It asks the ledger for
// the home document the report was measured from, has `challengeOf` judge
// it, and where it was a protection's page reads the report as the pass
// would store it today: the site's own pages unmeasured, no score, no band,
// no on-page site issue, and not a report the re-scan window protects.
//
// **Decided from the ledger, never from a list of domains.** The home
// document is the newest `fetches` row of the home address read at or
// before the report's date (a scan served from the cache ledgers no row of
// its own, so the row is found by its address, not by the scan's id).
//
// **Two reads, and the second is rare.** The first asks for no document
// body, only what `couldBeChallenge` reads; the body is fetched for the few
// rows that could be a protection's page.
//
// **Not a report the vendor's browser measured.** Where the plain read met
// a protection and the rendered read returned the site (issue 1379), the
// report holds the site's facts. A rendered read of the home address that
// is the site's own page, ledgered after the plain read, says so.
//
// Under-report, never over-report: a read the ledger cannot answer leaves
// the report as it is stored.
import { dbAdmin } from "@/lib/db";
import { BOT_PROTECTION, challengeOf, couldBeChallenge } from "@/lib/measure/challenge";
import { unmeasured } from "@/lib/measure/measured";
import { isStoredDocument, OWN_FETCH_SOURCE, RENDERED_FETCH_SOURCE, renderedDocumentOf } from "@/lib/measure/own-fetch";
import { computeScore, limitingFactorOf, type ScoreFactors } from "@/lib/measure/score";
import { checkSite } from "@/lib/site-issues/checks";
import type { StoredReport } from "./report";

interface LightRow {
  id: string;
  cache_key: string;
  created_at: string;
  status: unknown;
  bytes: unknown;
  headers: unknown;
  readAt: unknown;
}
interface PayloadRow {
  id: string;
  cache_key: string;
  created_at: string;
  payload: unknown;
}
interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  in(column: string, values: readonly string[]): MinimalQueryBuilder<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

/** `fetches` is outside the generated `Database` type — the same narrow
 *  cast `src/lib/measure/text.ts` carries. */
function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

function homeUrl(domain: string): string {
  return `https://${domain}/`;
}

function headersOf(value: unknown): Record<string, string> {
  if (value === null || typeof value !== "object") return {};
  const headers: Record<string, string> = {};
  for (const [name, text] of Object.entries(value)) if (typeof text === "string") headers[name] = text;
  return headers;
}

async function rowsOf<T>(query: MinimalQueryBuilder<T>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(`challenged.ts: read from fetches failed: ${error.message}`);
  return data ?? [];
}

/**
 * The domains among `asked` whose home document, as read at or before
 * `at`, was a bot-protection page that no rendered read replaced.
 *
 * `at` is the report's own date for a stored report (the home document's
 * `readAt` is that date), and the scan's finish for a gallery card.
 */
export async function challengedHomes(asked: readonly { domain: string; at: Date }[]): Promise<ReadonlySet<string>> {
  const challenged = new Set<string>();
  if (asked.length === 0) return challenged;
  try {
    const light = await rowsOf(
      untyped()
        .from<LightRow>("fetches")
        .select(
          "id, cache_key, created_at, status:payload->status, bytes:payload->bytes, headers:payload->headers, readAt:payload->>readAt"
        )
        .eq("source", OWN_FETCH_SOURCE)
        .in("cache_key", asked.map((a) => homeUrl(a.domain)))
    );

    // Each domain's home document as of its date, where it could be a
    // protection's page.
    const candidates = new Map<string, { domain: string; ledgeredAt: number }>();
    for (const a of asked) {
      let home: LightRow | null = null;
      let homeReadAt = Number.NEGATIVE_INFINITY;
      for (const row of light) {
        if (row.cache_key !== homeUrl(a.domain) || typeof row.readAt !== "string") continue;
        const readAt = new Date(row.readAt).getTime();
        if (Number.isNaN(readAt) || readAt > a.at.getTime() || readAt <= homeReadAt) continue;
        home = row;
        homeReadAt = readAt;
      }
      if (home === null || typeof home.status !== "number") continue;
      const bytes = typeof home.bytes === "number" ? home.bytes : 0;
      if (!couldBeChallenge({ status: home.status, bytes, headers: headersOf(home.headers) })) continue;
      candidates.set(home.id, { domain: a.domain, ledgeredAt: new Date(home.created_at).getTime() });
    }
    if (candidates.size === 0) return challenged;

    const documents = await rowsOf(
      untyped().from<PayloadRow>("fetches").select("id, cache_key, created_at, payload").in("id", [...candidates.keys()])
    );
    const protectedHomes = new Map<string, { domain: string; ledgeredAt: number }>();
    for (const row of documents) {
      const candidate = candidates.get(row.id);
      if (candidate === undefined || !isStoredDocument(row.payload) || challengeOf(row.payload) === null) continue;
      protectedHomes.set(homeUrl(candidate.domain), candidate);
    }
    if (protectedHomes.size === 0) return challenged;

    const rendered = await rowsOf(
      untyped()
        .from<PayloadRow>("fetches")
        .select("id, cache_key, created_at, payload")
        .eq("source", RENDERED_FETCH_SOURCE)
        .in("cache_key", [...protectedHomes.keys()])
    );
    for (const [url, home] of protectedHomes) {
      const drawn = rendered.some(
        (row) =>
          row.cache_key === url &&
          new Date(row.created_at).getTime() >= home.ledgeredAt &&
          renderedDocumentOf(row.payload) !== null
      );
      if (!drawn) challenged.add(home.domain);
    }
    return challenged;
  } catch (error: unknown) {
    console.log(
      JSON.stringify({
        event: "challenged_home_unread",
        because: error instanceof Error ? error.message : String(error),
      })
    );
    return new Set();
  }
}

/**
 * A stored report as the pass would store it where bot protection kept the
 * reader off the site: Foundations and Answerability unmeasured, so no
 * score and no band; no site issue read off a page; and `complete` false,
 * which is what lets a new scan measure again inside the re-scan window
 * and offers the visitor that scan.
 */
export function unreadByProtection(report: StoredReport): StoredReport {
  const at = report.verdict.measuredAt;
  const factors: ScoreFactors = {
    ...report.verdict.factors,
    foundations: unmeasured("undeterminable", at, BOT_PROTECTION),
    answerability: unmeasured("undeterminable", at, BOT_PROTECTION),
  };
  const missing: StoredReport["verdict"]["missing"][number][] = [];
  for (const factor of ["foundations", "answerability", "presence"] as const) {
    const m = factors[factor];
    if (m.kind === "unmeasured") missing.push({ factor, reason: m.reason });
  }
  return {
    ...report,
    complete: false,
    onPage: unmeasured("undeterminable", at, BOT_PROTECTION),
    verdict: {
      ...report.verdict,
      factors,
      scoreAndBand: computeScore(factors),
      limiting: limitingFactorOf(factors),
      missing,
    },
    siteIssues:
      report.siteIssues === null
        ? null
        : checkSite({ crawl: null, robots: report.robots, blockedAgents: report.blockedAgents }),
  };
}

/** The report as it may be shown and relied on: itself, or `unreadByProtection`
 *  of it where its home document was a protection's page. */
export async function readPastProtection(report: StoredReport): Promise<StoredReport> {
  if (report.onPage.kind === "unmeasured") return report;
  const challenged = await challengedHomes([{ domain: report.domain, at: report.verdict.measuredAt }]);
  return challenged.has(report.domain) ? unreadByProtection(report) : report;
}
