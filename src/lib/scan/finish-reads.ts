// src/lib/scan/finish-reads.ts — SPEC §2 (owner, 2026-10-15, issue 1440)
//
// A free pass that ends with searches it chose and never read — `not_attempted`
// where its 50 s ran out first, `undeterminable` where the vendor timed out or
// failed — stores its report saying so (`finishingReads`) and sends
// `scan/finish-reads`. That job reads only those searches, once, with the
// pass's own query, locale and settings, from the SERP cache first, on the
// spend ledger the pass used: the row's `cost_cents` is what the 12¢ free cap
// has already spent, and the close adds this job's spend to it
// (`withStoredPassSpend`). No second budget.
//
// The report is then rewritten with the new cells and scored again through
// the re-score's own path (`rescoreRow`, `rescore_scan`): guarded by the
// report's checksum, keeping the stored one under `report.previous`. A search
// that fails again stays unmeasured with its reason. One attempt; nothing
// here asks a second time.
//
// Stored scans are never read again by this: that would be new DataForSEO
// spend (owner rule, issue 1426). Only a report a pass marked is finished.
import { CAPS, CACHE_WINDOWS_D, TIMING } from "@/lib/config/constants";
import type { CostContext, VendorFailure } from "@/lib/costs";
import { unmeasured, type Measured } from "@/lib/measure/measured";
import type { Locale } from "@/lib/locale/locales";
import { promptSiteName } from "@/lib/market/prompts/generate";
import type { SerpResult } from "@/lib/vendors/dataforseo/types";
import { PAID_SERP_FANOUT } from "./budgets";
import { cardsOf } from "./cards";
import { localeOfReport, readStoredReport, type StoredReport } from "./report";
import { same, type ReportChange } from "./rescore";
import { rescoreRow, type ScanWrite, type StoredRead, type StoredScanRow } from "./rescore-run";
import { answersSectionOf } from "./sections";

/** One search the pass chose and did not read: its place among the twelve. */
export interface UnreadSearch {
  index: number;
  keyword: string;
}

/** The searches of a free report that were chosen and not read. A search the
 *  vendor answered with nothing is read; only the two arms that say nobody
 *  knows are unread. */
export function unreadSearches(report: Pick<StoredReport, "tier" | "questions" | "serps">): UnreadSearch[] {
  if (report.tier !== "free" || report.questions.kind === "unmeasured") return [];
  const out: UnreadSearch[] = [];
  report.questions.value.forEach((question, index) => {
    const serp = report.serps[index];
    const unread =
      serp === undefined || (serp.kind === "unmeasured" && (serp.reason === "not_attempted" || serp.reason === "undeterminable"));
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
  if (searches === 0 || leftCents(spentCents) <= 0) return null;
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
  a: { scanId: string; now: Date; version: string },
  store: FinishStore = databaseFinish(),
  vendor: FinishVendor = vendorFinish()
): Promise<FinishResult> {
  const row = await store.row(a.scanId);
  if (row === null || row.report === null || typeof row.report !== "object") return { finished: false, because: "no_report" };
  const blob = row.report as Record<string, unknown>;
  if (blob.finishingReads === undefined || blob.finishingReads === null) return { finished: false, because: "nothing_to_finish" };

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
  if (unread.length > 0 && leftCents(row.costCents ?? CAPS.FREE_C) > 0) {
    // D67 (issue 1441): a free pass measured in its town finishes its reads
    // there too, not in the country.
    const place = report.locale?.place;
    const locale = place === undefined ? localeOfReport(report) : { ...localeOfReport(report), place };
    const untilMs = Date.now() + TIMING.paidPassCeilingS * 1000;
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
          cells.set(search.index, cell);
        }
      };
      await Promise.all(Array.from({ length: Math.min(PAID_SERP_FANOUT, unread.length) }, () => worker()));
    });
  }

  // 2. The report with the new cells in place of the unread ones.
  const merged: Record<string, unknown> = { ...blob, finishingReads: null };
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
      local: report.locale?.place !== undefined,
      siteName: promptSiteName(await store.siteName(report.domain), report.domain),
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

  const changes: ReportChange[] = [{ path: ["finishingReads"], value: null }];
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
  console.log(JSON.stringify({ event: "finish_reads", scanId: row.id, asked: cells.size, read, written }));
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
        // An unreadable total is the whole cap spent (SPEC §2, #792).
        costCents: s.cost_cents === null || !Number.isFinite(spent) ? null : spent,
      };
    },
    homeReads: (domain) => databaseRescoreReads(domain),
    async siteName(domain) {
      const { data, error } = await (await client())
        .from<{ site_name: string | null }>("site_profiles")
        .select("site_name")
        .eq("domain", domain)
        .limit(1);
      if (error !== null) throw new Error(error.message);
      return data?.[0]?.site_name ?? null;
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
