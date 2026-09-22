// SPEC §6 (2026-09-22, #1004) — the one write and the one read of a site's
// LLM Mentions weeks.
//
// Every statement that touches `llm_mention_reads` and `llm_mentions` is
// here, so the pass holds no SQL and the cards hold none either. Nothing
// below decides anything: which week it is belongs to
// `src/lib/scan/weekly/week.ts`, what was bought belongs to `pass.ts`, and
// what the two cards show belongs to the screen.
//
// **Write: the read row first, then its mentions.** `llm_mentions`
// references `(site_id, week_start)` on `llm_mention_reads`, so the week
// has to exist before a row can point at it — which is the same ordering
// `runScan` keeps for `opportunities.scan_id`, and for the same reason.
//
// **A re-run of one Monday replaces that Monday, and never doubles it.**
// The read is upserted on its primary key and the week's mentions are
// deleted before the new ones are inserted, so a pass that ran twice in one
// site-local week — a retry after a crash, a week claimed again — leaves
// one week's rows, not two. Nothing in the four-week window can then count
// a question twice.
//
// **A mention insert that fails leaves the read standing, with its own
// count.** `rows_stored` is written from what was actually inserted, so a
// week whose rows did not land reads back as a week with rows recorded and
// none present, rather than as a real zero. The two are different facts and
// the column is what keeps them apart.
//
// These two tables are on disk and not in the generated `Database` type,
// which has not been regenerated since. Every query here goes through one
// narrow, explicitly cast builder against locally declared row shapes — the
// same worked-around gap `scan/weekly/store.ts`, `admission.ts` and
// `costs/ledger.ts` already carry.
import { dbAdmin } from "@/lib/db";
import type { MentionReadStatus, MentionWeek, StoredMention } from "./types";

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  insert(values: Record<string, unknown> | Record<string, unknown>[]): MinimalQueryBuilder<T>;
  upsert(values: Record<string, unknown>, options: { onConflict: string }): MinimalQueryBuilder<T>;
  delete(): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  in(column: string, values: readonly string[]): MinimalQueryBuilder<T>;
  order(column: string, options: { ascending: boolean }): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

function untyped(): MinimalClient {
  return dbAdmin() as unknown as MinimalClient;
}

const READS = "llm_mention_reads";
const MENTIONS = "llm_mentions";

interface ReadRow {
  week_start: string;
  status: string;
  total_count: number | null;
  rows_stored: number;
}

interface MentionRowStored {
  week_start: string;
  question: string;
  engine: string | null;
  model: string | null;
  cited_url: string | null;
  ai_search_volume: number | null;
  monthly_searches: number | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
}

/** What one Monday's read is worth storing. `mentions` is empty on every
 *  status but `measured`, and on `zero` that emptiness is the measurement. */
export interface MentionWeekWrite {
  siteId: string;
  weekStart: string;
  /** The pass this was bought inside. Absent where there is none to name. */
  scanId?: string;
  status: MentionReadStatus;
  totalCount: number | null;
  /** What it cost, in cents — the settled figure the ledger recorded, so
   *  this row and `fetches.cost_cents` agree. 0 for a skipped read. */
  costCents: number;
  mentions: readonly Omit<StoredMention, "weekStart">[];
}

/**
 * One site's Monday, stored.
 *
 * Never throws: a week that could not be written is a week the cards do not
 * draw, and a pass that has already measured the market must not be taken
 * down by a supplementary list failing to land. The failure is logged with
 * the week it belongs to and the pass carries on — the same contract
 * `afterReport`'s own caller keeps.
 */
export async function storeMentionWeek(write: MentionWeekWrite): Promise<{ stored: boolean }> {
  const client = untyped();

  const upsert = await client.from<ReadRow>(READS).upsert(
    {
      site_id: write.siteId,
      week_start: write.weekStart,
      ...(write.scanId === undefined ? {} : { scan_id: write.scanId }),
      status: write.status,
      rows_stored: write.mentions.length,
      total_count: write.totalCount,
      cost_cents: write.costCents,
      read_at: new Date().toISOString(),
    },
    { onConflict: "site_id,week_start" }
  );
  if (upsert.error !== null) {
    logMentionStore({ siteId: write.siteId, weekStart: write.weekStart, because: upsert.error.message });
    return { stored: false };
  }

  // This Monday's rows, replaced rather than added to: a pass that ran
  // twice in one site-local week leaves one week of mentions.
  const cleared = await client
    .from<MentionRowStored>(MENTIONS)
    .delete()
    .eq("site_id", write.siteId)
    .eq("week_start", write.weekStart);
  if (cleared.error !== null) {
    logMentionStore({ siteId: write.siteId, weekStart: write.weekStart, because: cleared.error.message });
    return { stored: false };
  }
  if (write.mentions.length === 0) return { stored: true };

  const inserted = await client.from<MentionRowStored>(MENTIONS).insert(
    write.mentions.map((mention) => ({
      site_id: write.siteId,
      week_start: write.weekStart,
      question: mention.question,
      engine: mention.engine,
      model: mention.model,
      cited_url: mention.citedUrl,
      ai_search_volume: mention.aiSearchVolume,
      monthly_searches: mention.monthlySearches,
      first_seen_at: mention.firstSeenAt === null ? null : mention.firstSeenAt.toISOString(),
      last_seen_at: mention.lastSeenAt === null ? null : mention.lastSeenAt.toISOString(),
    }))
  );
  if (inserted.error !== null) {
    logMentionStore({ siteId: write.siteId, weekStart: write.weekStart, because: inserted.error.message });
    return { stored: false };
  }
  return { stored: true };
}

/**
 * The weeks a site has read rows for, among the ones asked about.
 *
 * Two reads, and neither of them per week: a read per Monday would be four
 * round trips on a render path. A week with no read row is **absent** from
 * the answer rather than present-and-empty — that is the difference between
 * a site that was never queried (no card at all) and a week the engines
 * answered nobody in (a written line), and collapsing them here would lose
 * it before the screen could state it.
 */
export async function readMentionWeeks(a: {
  siteId: string;
  weekStarts: readonly string[];
}): Promise<readonly MentionWeek[]> {
  if (a.weekStarts.length === 0) return [];
  const client = untyped();

  const [reads, mentions] = await Promise.all([
    client
      .from<ReadRow>(READS)
      .select("week_start, status, total_count, rows_stored")
      .eq("site_id", a.siteId)
      .in("week_start", a.weekStarts),
    client
      .from<MentionRowStored>(MENTIONS)
      .select(
        "week_start, question, engine, model, cited_url, ai_search_volume, monthly_searches, first_seen_at, last_seen_at"
      )
      .eq("site_id", a.siteId)
      .in("week_start", a.weekStarts),
  ]);
  if (reads.error !== null || reads.data === null) {
    throw new Error(`mentions: weeks — ${reads.error?.message ?? "no rows"}`);
  }
  // The mentions degrade rather than propagate: a week whose read row says
  // what happened is still worth stating even if its rows could not be
  // read, and the screen draws the line rather than an error.
  const rows = mentions.error !== null || mentions.data === null ? [] : mentions.data;

  const byWeek = new Map<string, StoredMention[]>();
  for (const row of rows) {
    const week = byWeek.get(row.week_start) ?? [];
    week.push({
      weekStart: row.week_start,
      question: row.question,
      engine: row.engine,
      model: row.model,
      citedUrl: row.cited_url,
      aiSearchVolume: row.ai_search_volume,
      monthlySearches: row.monthly_searches,
      firstSeenAt: parseDate(row.first_seen_at),
      lastSeenAt: parseDate(row.last_seen_at),
    });
    byWeek.set(row.week_start, week);
  }

  // The window's own order, oldest first, over the weeks that have a read.
  const found = new Map(reads.data.map((row) => [row.week_start, row]));
  const weeks: MentionWeek[] = [];
  for (const weekStart of [...a.weekStarts].sort()) {
    const read = found.get(weekStart);
    if (read === undefined) continue;
    weeks.push({
      weekStart,
      status: statusOf(read.status),
      totalCount: read.total_count,
      mentions: byWeek.get(weekStart) ?? [],
    });
  }
  return weeks;
}

/** The column's four words, and nothing else. A row carrying a fifth is
 *  read as `failed`: it is a week whose reading this build cannot make
 *  sense of, which is exactly what that arm says. The check constraint
 *  makes it unreachable from this product; a hand-written row is what it
 *  guards against. */
function statusOf(value: string): MentionReadStatus {
  switch (value) {
    case "measured":
    case "zero":
    case "skipped_cap":
      return value;
    default:
      return "failed";
  }
}

function parseDate(value: string | null): Date | null {
  if (value === null) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** One line when a week could not be written. No domain, no question — the
 *  site and the week are what a reader needs to find it again. */
function logMentionStore(a: { siteId: string; weekStart: string; because: string }): void {
  console.log(JSON.stringify({ event: "llm_mentions_store_failed", ...a }));
}
