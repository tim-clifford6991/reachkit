// A free pass that ends with chosen searches unread (`not_attempted` or `undeterminable`) stores `finishingReads` and sends `scan/finish-reads`.
// That job reads only those searches, once, with the pass's own query, locale and settings, cache first, on the pass's own ledger under the 12¢ free cap; no second budget.
// The report is rewritten and re-scored through `rescoreRow`/`rescore_scan`, checksum-guarded, keeping the old one under `report.previous`.
// Stored scans are never read again by this: that would be new DataForSEO spend. Only a report a pass marked is finished.
// A weekly pass's searches whose queued task outlived its ceiling are read the same way after it, from the task its post paid for (`finishLateSerps`).
import { CAPS, CACHE_WINDOWS_D, TIMING } from "@/lib/config/constants";
import type { CostContext, VendorFailure } from "@/lib/costs";
import { measured, measuredZero, unmeasured, type Measured } from "@/lib/measure/measured";
import type { Locale } from "@/lib/locale/locales";
import { promptSiteName } from "@/lib/market/prompts/names";
import type { SerpResult } from "@/lib/vendors/dataforseo/types";
import { storedSiteName } from "@/lib/site-profile/site-name";
import { PAID_SERP_FANOUT } from "./budgets";
import { cardsOf, reachOfReport } from "./cards";
import { localeOfReport, readStoredReport, type StoredReport } from "./report";
import { same, type ReportChange } from "./rescore";
import { rescoreRow, type ScanWrite, type StoredRead, type StoredScanRow } from "./rescore-run";
import { answersSectionOf } from "./sections";

/** One search the pass chose and did not read: its place among the twelve. */
export interface UnreadSearch {
  index: number;
  keyword: string;
}

/** The searches of a report that were chosen and not read. A search the
 *  vendor answered with nothing is read; on a free report the two arms that say
 *  nobody knows are unread, on a paid one any cell with no settled failure, since a task posted just before the seal leaves its cell as it was. */
export function unreadSearches(report: Pick<StoredReport, "tier" | "questions" | "serps">): UnreadSearch[] {
  if (report.questions.kind === "unmeasured") return [];
  const out: UnreadSearch[] = [];
  report.questions.value.forEach((question, index) => {
    const serp = report.serps[index];
    const unread =
      report.tier !== "free"
        ? serp?.kind === "unmeasured" && (serp.because === undefined || serp.because === "deadline")
        : serp === undefined || (serp.kind === "unmeasured" && (serp.reason === "not_attempted" || serp.reason === "undeterminable"));
    if (unread) out.push({ index, keyword: question.search.keyword });
  });
  return out;
}

/** What the free cap still holds after `spentCents`. */
function leftCents(spentCents: number): number {
  return Math.max(0, CAPS.FREE_C - spentCents);
}

/** The marker a free pass stores where it left searches unread and the cap
 *  still holds money to read them with; `null` otherwise, and then nothing is
 *  sent. */
export function finishingOf(
  report: Pick<StoredReport, "tier" | "questions" | "serps">,
  spentCents: number,
  at: Date
): { searches: number; since: Date } | null {
  const searches = unreadSearches(report).length;
  if (report.tier !== "free" || searches === 0 || leftCents(spentCents) <= 0) return null;
  return { searches, since: at };
}

// ── The job ─────────────────────────────────────────────────────────────

/** A `scans` row as this job reads it: the re-score's row, plus what the row
 *  has already spent. */
export interface FinishRow extends StoredScanRow {
  costCents: number | null;
}

export interface FinishStore {
  row(scanId: string): Promise<FinishRow | null>;
  homeReads(domain: string): Promise<readonly StoredRead[]>;
  siteName(domain: string): Promise<string | null>;
  /** `rescore_scan`: false where the report changed after it was read. */
  writeScan(write: ScanWrite): Promise<boolean>;
}

export interface FinishVendor {
  /** The pass's own ledger: opens on the row's `cost_cents` under the free
   *  cap and adds this spend to it at close. */
  spend<T>(scanId: string, body: (cost: CostContext) => Promise<T>): Promise<T>;
  /** One question's SERP, as the free pass asks it. */
  read(
    cost: CostContext,
    a: { query: string; locale: Locale; domain: string; untilMs: number; onFailure: (failure: VendorFailure) => void }
  ): Promise<Measured<SerpResult>>;
}

export type FinishResult =
  | { finished: true; asked: number; read: number; written: boolean }
  | { finished: false; because: "no_report" | "nothing_to_finish" | "unreadable" };

/** A value as `jsonb` holds it: dates as ISO strings. */
function stored<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

/** The members the rewrite may move, compared with the stored report. */
const MEMBERS = ["serps", "verdict", "complete", "onPage", "siteIssues", "rivals", "sources", "presence", "coherence", "aiAnswers"] as const;

/**
 * Reads the searches a free pass left unread, once, and rewrites its report.
 *
 * Idempotent: the marker is the request, and the write that answers it sets
 * the marker to `null` under the checksum read here. A second delivery finds
 * no marker and does nothing; a retried step is served what the first bought
 * from the cache at 0¢.
 */
export async function finishReads(
  a: { scanId: string; now: Date; version: string; untilMs?: number },
  store: FinishStore = databaseFinish(),
  vendor: FinishVendor = vendorFinish()
): Promise<FinishResult> {
  const row = await store.row(a.scanId);
  if (row === null || row.report === null || typeof row.report !== "object") return { finished: false, because: "no_report" };
  const blob = row.report as Record<string, unknown>;
  const marked = blob.finishingReads !== undefined && blob.finishingReads !== null;
  if (!marked && blob.tier === "free") return { finished: false, because: "nothing_to_finish" };

  let report: StoredReport;
  try {
    const bare = { ...blob };
    for (const key of ["previous", "previousColumns", "rescoredAt", "rescoredBy"]) delete bare[key];
    report = readStoredReport(bare);
  } catch {
    return { finished: false, because: "unreadable" };
  }

  // 1. The unread searches, read once, with what the cap still holds.
  const unread = unreadSearches(report);
  const at = report.questions.at;
  const cells = new Map<number, Measured<SerpResult>>();
  if (unread.length > 0 && (report.tier !== "free" || leftCents(row.costCents ?? CAPS.FREE_C) > 0)) {
    // A free pass measured in its town finishes its reads there too, not in the country.
    const place = report.locale?.place;
    const locale = place === undefined ? localeOfReport(report) : { ...localeOfReport(report), place };
    const untilMs = a.untilMs ?? Date.now() + TIMING.paidPassCeilingS * 1000;
    await vendor.spend(a.scanId, async (cost) => {
      let next = 0;
      const worker = async (): Promise<void> => {
        for (;;) {
          const search = unread[next];
          next += 1;
          if (search === undefined) return;
          if (cost.capHit()) continue;
          const heard: { failure: VendorFailure | null } = { failure: null };
          let cell: Measured<SerpResult>;
          try {
            cell = await vendor.read(cost, {
              query: search.keyword,
              locale,
              domain: report.domain,
              untilMs,
              onFailure: (failure) => {
                heard.failure = failure;
              },
            });
          } catch {
            cell = unmeasured("undeterminable", at);
          }
          if (cell.kind === "unmeasured" && heard.failure !== null) {
            cell = unmeasured(cell.reason, cell.at, heard.failure.vendorFailure);
          }
          // A paid cell nothing was posted for keeps what the pass wrote.
          if (report.tier !== "free" && cell.kind === "unmeasured" && heard.failure === null && !("because" in (report.serps[search.index] ?? {}))) continue;
          cells.set(search.index, cell);
        }
      };
      await Promise.all(Array.from({ length: Math.min(PAID_SERP_FANOUT, unread.length) }, () => worker()));
    });
  }

  // A paid report none of whose tasks has settled is left as it was.
  const pending = (cell: Measured<SerpResult>) => cell.kind === "unmeasured" && cell.because === "deadline";
  if (!marked && [...cells.values()].every(pending)) return { finished: true, asked: cells.size, read: 0, written: false };

  // 2. The report with the new cells in place of the unread ones.
  const merged: Record<string, unknown> = marked ? { ...blob, finishingReads: null } : { ...blob };
  const twelve = report.questions.kind === "unmeasured" ? [] : report.questions.value;
  const serps = twelve.map((_, i) => cells.get(i) ?? report.serps[i] ?? unmeasured<SerpResult>("not_attempted", at));
  merged.serps = stored(serps);

  // A pass that stopped before it counted anything stored no cards; they are
  // counted here as its scoring stage would have counted them.
  if (report.presence === null && twelve.length > 0) {
    const cards = cardsOf({
      serps,
      questions: twelve,
      rivalSizes: report.rivalSizes,
      ownDomain: report.domain,
      reach: reachOfReport(report),
      siteName: promptSiteName(await store.siteName(report.domain), report.domain),
      town: report.locale?.place?.name,
      coverage: "async_included",
    });
    merged.presence = stored(cards.presence);
    merged.rivals = stored({ kind: "measured", value: cards.rivals, at });
    merged.sources = stored(cards.sources);
    merged.coherence = stored(cards.coherence);
    merged.aiAnswers = stored(
      answersSectionOf({ card: cards.card, questions: report.questions, rivals: cards.rivals, ownDomain: report.domain, measuredAt: at })
    );
  }

  // 3. Scored again through the re-score's path, over the merged report.
  const scored = rescoreRow(
    { ...row, report: merged },
    await store.homeReads(report.domain),
    { siteName: promptSiteName(await store.siteName(report.domain), report.domain), answers: [] }
  );
  if (!("result" in scored)) return { finished: false, because: "unreadable" };
  const after = scored.result.after;

  const changes: ReportChange[] = marked ? [{ path: ["finishingReads"], value: null }] : [];
  for (const key of MEMBERS) {
    const now = key === "serps" ? merged.serps : stored(after[key]);
    if (!same(blob[key], now)) changes.push({ path: [key], value: now });
  }

  const written = await store.writeScan({
    id: row.id,
    md5: row.md5,
    changes,
    score: scored.result.score,
    status: scored.result.status,
    drivers: scored.result.drivers,
    at: a.now.toISOString(),
    by: `finish-reads@${a.version}`,
  });
  const read = [...cells.values()].filter((cell) => cell.kind !== "unmeasured").length;
  const left = [...cells.values()].filter(pending).length;
  const measuredOf = serps.filter((serp) => serp.kind !== "unmeasured").length;
  console.log(JSON.stringify({ event: "finish_reads", scanId: row.id, tier: report.tier, asked: cells.size, read, left, written, measured: measuredOf, of: serps.length }));
  return { finished: true, asked: cells.size, read, written };
}

// ── The database and the vendor ─────────────────────────────────────────

/** `report_md5` and `is_current` are not in the generated `Database` type —
 *  the same narrow cast `rescore-run.ts` makes. */
interface MinimalQuery<T> extends PromiseLike<{ data: T[] | null; error: { message: string } | null }> {
  select(columns: string): MinimalQuery<T>;
  eq(column: string, value: unknown): MinimalQuery<T>;
  limit(n: number): MinimalQuery<T>;
}
interface MinimalClient {
  from<T>(table: string): MinimalQuery<T>;
}

interface FinishRecord {
  id: string;
  domain: string;
  created_at: string;
  status: StoredScanRow["status"];
  score: number | null;
  drivers: unknown;
  report: unknown;
  report_md5: string;
  site_id: string | null;
  is_current: boolean | null;
  cost_cents: number | string | null;
}

/** The database, imported at the call: the engine seam reaches this module. */
export function databaseFinish(): FinishStore {
  async function client(): Promise<MinimalClient> {
    const { dbAdmin } = await import("@/lib/db");
    return dbAdmin() as unknown as MinimalClient;
  }
  return {
    async row(scanId) {
      const { data, error } = await (await client())
        .from<FinishRecord>("scans")
        .select("id, domain, created_at, status, score, drivers, report, report_md5, site_id, is_current, cost_cents")
        .eq("id", scanId)
        .limit(1);
      if (error !== null) throw new Error(error.message);
      const s = data?.[0];
      if (s === undefined) return null;
      const spent = Number(s.cost_cents);
      return {
        id: s.id,
        domain: s.domain,
        createdAt: s.created_at,
        status: s.status,
        score: s.score,
        drivers: s.drivers,
        md5: s.report_md5,
        report: s.report,
        siteId: s.site_id,
        isCurrent: s.is_current === true,
        // An unreadable total is the whole cap spent.
        costCents: s.cost_cents === null || !Number.isFinite(spent) ? null : spent,
      };
    },
    homeReads: (domain) => databaseRescoreReads(domain),
    async siteName(domain) {
      const { data, error } = await (await client())
        .from<{ domain: string; site_name: string | null; home_title: string | null }>("site_profiles")
        .select("domain, site_name, home_title:inventory->0->>title")
        .eq("domain", domain)
        .limit(1);
      if (error !== null) throw new Error(error.message);
      const row = data?.[0];
      // Read by the name rule, so a placeholder, a protection's page or a call to action is never the name an answer is read for.
      return row === undefined ? null : storedSiteName(row, row.home_title);
    },
    async writeScan(w) {
      const { databaseRescore } = await import("./rescore-run");
      return databaseRescore().writeScan(w);
    },
  };
}

async function databaseRescoreReads(domain: string): Promise<readonly StoredRead[]> {
  const { databaseRescore } = await import("./rescore-run");
  return databaseRescore().homeReads(domain);
}

/** The free pass's own ledger and its own SERP read: the same query, locale,
 *  queue, AI Overview and cache window as `askTheTwelve`. The one bound that
 *  differs is the request's: nobody is waiting, so a read gets a paid pass's
 *  `paidSerpAbortMs` rather than the 10 s that timed it out. */
export function vendorFinish(): FinishVendor {
  return {
    async spend(scanId, body) {
      const { withStoredPassSpend } = await import("./ceilings");
      return withStoredPassSpend({ scanId, cap: "FREE" }, body);
    },
    async read(cost, a) {
      const [{ serpOrganic }, { VENDOR }] = await Promise.all([
        import("@/lib/vendors/dataforseo/serp"),
        import("@/lib/config/constants"),
      ]);
      return serpOrganic(cost, {
        query: a.query,
        locale: a.locale,
        mode: "std",
        // eslint-disable-next-line local/serp-normal-queue -- the free report's unread searches, finished while its visitor waits.
        priority: "high",
        pollMs: VENDOR.waitedQueuePollIntervalS * 1000,
        loadAsyncAiOverview: true,
        scope: { domain: a.domain },
        freshnessDays: CACHE_WINDOWS_D.serp,
        abortMs: VENDOR.paidSerpAbortMs,
        untilMs: a.untilMs,
        onFailure: a.onFailure,
      });
    },
  };
}

/** A ledger row of one of the pass's Google reads: its key and what it holds, a stored answer or the task still out. */
interface HeldSerp {
  id: string;
  cache_key: string;
  payload: unknown;
}

/** A paid pass's reads from the tasks its posts paid for, at 0¢: nothing is posted, so a read that settles late is used and never bought twice. */
export function lateVendor(scanId: string): FinishVendor {
  let rows: Promise<HeldSerp[]> | null = null;
  const held = async (): Promise<HeldSerp[]> => {
    const [{ dbAdmin }, { SERP_SOURCE }] = await Promise.all([import("@/lib/db"), import("@/lib/vendors/dataforseo/serp")]);
    const { data, error } = await (dbAdmin() as unknown as MinimalClient).from<HeldSerp>("fetches").select("id, cache_key, payload").eq("scan_id", scanId).eq("source", SERP_SOURCE);
    if (error !== null) throw new Error(error.message);
    return data ?? [];
  };
  return {
    async spend(id, body) {
      const { withStoredPassSpend } = await import("./ceilings");
      return withStoredPassSpend({ scanId: id, cap: "WEEK" }, body);
    },
    async read(_cost, a) {
      const at = new Date();
      const endpoint = "serp/google/organic";
      const stillOut = (taskId?: string) => {
        a.onFailure({ vendorFailure: "deadline", endpoint, billed: true, ...(taskId === undefined ? {} : { taskId }) });
        return unmeasured<SerpResult>("undeterminable", at);
      };
      try {
        const [{ collectSerp, EMPTY_SERP }, { storeCollected }] = await Promise.all([import("@/lib/vendors/dataforseo/serp"), import("@/lib/costs/ledger")]);
        rows ??= held();
        // The pass's own read of this search: the twelve's keys carry the async AI Overview, research's do not.
        const mine = (await rows).filter((row) => row.cache_key.startsWith(`${a.query}|`) && row.cache_key.includes("|aio:async|"));
        const answered = (list: unknown) => (Array.isArray(list) ? (list.length === 0 ? measuredZero(EMPTY_SERP, at) : measured(list[0] as SerpResult, at)) : null);
        const stored = mine.map((row) => answered(row.payload)).find((cell) => cell !== null);
        if (stored != null) return stored;
        const row = mine.find((each) => typeof (each.payload as { taskId?: unknown } | null)?.taskId === "string");
        if (row === undefined) return unmeasured("undeterminable", at);
        const taskId = (row.payload as { taskId: string }).taskId;
        const got = await collectSerp(taskId, a.untilMs);
        if (got.kind === "pending") return stillOut(taskId);
        if (got.kind === "failed") {
          // So it is not read again: the task came to nothing.
          await storeCollected(row.id, { vendorFailure: got.failure, endpoint, billed: true });
          a.onFailure({ vendorFailure: got.failure, endpoint, billed: true });
          return unmeasured("undeterminable", at);
        }
        // On the row its post wrote, so a later ask of the same search is served it.
        await storeCollected(row.id, got.rows);
        return answered(got.rows) ?? unmeasured("undeterminable", at);
      } catch {
        return stillOut();
      }
    },
  };
}

/** A weekly pass's searches whose task outlived its ceiling, read and scored into its report; how many it did not read. Never throws. */
export async function finishLateSerps(a: { scanId: string; now: Date; untilMs: number }): Promise<number> {
  try {
    const version = (process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown").slice(0, 7);
    const done = await finishReads({ ...a, version }, databaseFinish(), lateVendor(a.scanId));
    return done.finished ? done.asked - done.read : 0;
  } catch (error) {
    console.log(JSON.stringify({ event: "finish_reads_failed", scanId: a.scanId, because: error instanceof Error ? error.message : String(error) }));
    return 0;
  }
}
