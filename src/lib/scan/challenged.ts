// A report measured off a bot-protection page, read at read time as the pass would store it today: the site's pages unmeasured, no score, no band, no on-page issue, not protected by the re-scan window.
// Decided from the ledger, never a domain list: the newest `fetches` row of the home address at or before the report's home-facts date (a cached scan ledgers no row, so the row is found by address).
// The first read asks no body, only what `couldBeChallenge` reads; a body is fetched only where the re-score kept no `fetch_facts`.
// A later rendered read of the home address that drew the site's own page clears it. Under-report, never over-report: an unanswerable read leaves the report as stored.
import { BOT_PROTECTION, challengeOf, couldBeChallenge } from "@/lib/measure/challenge";
import { unmeasured } from "@/lib/measure/measured";
import { holdsHtml, isStoredDocument, OWN_FETCH_SOURCE, RENDERED_FETCH_SOURCE, renderedDocumentOf } from "@/lib/measure/own-fetch";
import { computeScore, limitingFactorOf, type ScoreFactors } from "@/lib/measure/score";
import { checkSite } from "@/lib/site-issues/checks";
import { deployedFactsVersion } from "./derivation";
import type { PageFacts } from "./page-facts";
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
  payload: unknown;
}
interface FactRow {
  fetch_id: string;
  facts_version: string;
  fact: unknown;
}
interface RenderedRow {
  id: string;
  cache_key: string;
  created_at: string;
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

/** `fetches` is outside the generated `Database` type; imported on demand so the pure halves below load without the database. */
async function untyped(): Promise<MinimalClient> {
  const { dbAdmin } = await import("@/lib/db");
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

/** Each read's `fact`, as the re-score derived it at the deployed facts
 *  version, else as `judge` reads it off the payload, else, where the
 *  payload's html was pruned, as it was derived at any version. */
async function judged(db: MinimalClient, ids: readonly string[], fact: "protection" | "drawn", judge: (payload: unknown) => boolean): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  const older = new Map<string, boolean>();
  const version = deployedFactsVersion();
  if (version !== null && ids.length > 0) {
    const kept = await rowsOf(db.from<FactRow>("fetch_facts").select(`fetch_id, facts_version, fact:facts->${fact}`).in("fetch_id", ids));
    for (const row of kept) if (typeof row.fact === "boolean") (row.facts_version === version ? out : older).set(row.fetch_id, row.fact);
  }
  const missing = ids.filter((id) => !out.has(id));
  if (missing.length === 0) return out;
  for (const row of await rowsOf(db.from<PayloadRow>("fetches").select("id, payload").in("id", missing))) {
    const had = older.get(row.id);
    out.set(row.id, had !== undefined && !holdsHtml(row.payload) ? had : judge(row.payload));
  }
  return out;
}

/**
 * The domains among `asked` whose home document, as read at or before
 * `at`, was a bot-protection page that no rendered read replaced.
 *
 * `at` is the date of a stored report's home-page facts (the home
 * document's `readAt`), and the scan's finish for a gallery card.
 */
export async function challengedHomes(asked: readonly { domain: string; at: Date }[]): Promise<ReadonlySet<string>> {
  const challenged = new Set<string>();
  if (asked.length === 0) return challenged;
  try {
    const db = await untyped();
    const light = await rowsOf(
      db
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

    const protection = await judged(db, [...candidates.keys()], "protection", protectionPage);
    const protectedHomes = new Map<string, { domain: string; ledgeredAt: number }>();
    for (const [id, candidate] of candidates) if (protection.get(id) === true) protectedHomes.set(homeUrl(candidate.domain), candidate);
    if (protectedHomes.size === 0) return challenged;

    const rendered = await rowsOf(
      db.from<RenderedRow>("fetches").select("id, cache_key, created_at").eq("source", RENDERED_FETCH_SOURCE).in("cache_key", [...protectedHomes.keys()])
    );
    const drawn = await judged(db, rendered.map((row) => row.id), "drawn", (payload) => renderedDocumentOf(payload) !== null);
    for (const [url, home] of protectedHomes) {
      const since = rendered.filter((row) => row.cache_key === url && new Date(row.created_at).getTime() >= home.ledgeredAt);
      if (!since.some((row) => drawn.get(row.id) === true)) challenged.add(home.domain);
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

/** Whether a stored plain read was a protection's page, as `challengedHomes`
 *  judges one: the half of its answer a single read decides. */
export function protectionPage(payload: unknown): boolean {
  if (!isStoredDocument(payload)) return false;
  if (!couldBeChallenge({ status: payload.status, bytes: payload.bytes, headers: headersOf(payload.headers) })) return false;
  return challengeOf(payload) !== null;
}

/** `challengedHomes`' answer for one stored home read, from reads already in hand (the re-score reads stored rows): a protection's page no later rendered read replaced. */
export function readAsProtection(a: {
  home: { created_at: string; facts: Pick<PageFacts, "protection"> } | null;
  rendered: readonly { created_at: string; facts: Pick<PageFacts, "drawn"> }[];
}): boolean {
  if (a.home === null || !a.home.facts.protection) return false;
  const since = new Date(a.home.created_at).getTime();
  return !a.rendered.some((row) => new Date(row.created_at).getTime() >= since && row.facts.drawn);
}

/**
 * A stored report as the pass would store it where bot protection kept the
 * reader off the site: Foundations and Answerability unmeasured, so no
 * score and no band; no site issue read off a page; and `complete` false,
 * which is what lets a new scan measure again inside the re-scan window
 * and offers the visitor that scan.
 */
export function unreadByProtection<R extends Pick<StoredReport, "verdict" | "robots" | "blockedAgents" | "onPage" | "complete" | "siteIssues">>(
  report: R
): R {
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
  // No score, so no range.
  const verdict = { ...report.verdict };
  delete verdict.estimate;
  return {
    ...report,
    complete: false,
    onPage: unmeasured("undeterminable", at, BOT_PROTECTION),
    verdict: {
      ...verdict,
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
  const challenged = await challengedHomes([{ domain: report.domain, at: report.onPage.at }]);
  return challenged.has(report.domain) ? unreadByProtection(report) : report;
}
