// SPEC §4 *The three totals* — the two reads `totals.ts` counts over: every
// weekly pass's stored members, and every publication ever published. Shared
// by Overview and the Monday mail.
import { dbAdmin } from "@/lib/db";
import { failingChecks, parseHealth } from "@/lib/scan/health";
import { weekStartFor } from "@/lib/scan/weekly/week";
import { totalsOf, type Totals, type TotalsPage, type TotalsPass } from "./totals";

interface Query<T> extends PromiseLike<{ data: T[] | null; error: { message: string } | null }> {
  select(columns: string): Query<T>;
  eq(column: string, value: string): Query<T>;
  neq(column: string, value: string): Query<T>;
  not(column: string, operator: string, value: null): Query<T>;
}

function from<T>(table: string): Query<T> {
  return (dbAdmin() as unknown as { from(table: string): Query<T> }).from(table);
}

type PassRow = Omit<TotalsPass, "weekStart" | "at" | "healthy"> & { week_start: string; created_at: string; health: unknown };
interface PageRow {
  id: string;
  live_url: string | null;
  published_at: string;
  unpublished_at: string | null;
}

/** Every weekly pass and every published page of one site. */
export async function readTotalsRows(a: { siteId: string; zone: string }): Promise<{ passes: TotalsPass[]; pages: TotalsPage[] }> {
  const [passes, pages] = await Promise.all([
    from<PassRow>("scans")
      .select("week_start, created_at, health, prompts:report->prompts, questions:report->questions, serps:report->serps, pageQuestions:report->pageQuestions, ownRankedRows:report->ownRankedRows")
      .eq("site_id", a.siteId)
      .eq("tier", "weekly")
      .neq("status", "failed")
      .not("report", "is", null),
    from<PageRow>("publications").select("id, live_url, published_at, unpublished_at").eq("site_id", a.siteId).not("published_at", "is", null),
  ]);
  if (passes.error !== null || passes.data === null) throw new Error(`totals: could not read the passes: ${passes.error?.message}`);
  if (pages.error !== null || pages.data === null) throw new Error(`totals: could not read the pages: ${pages.error?.message}`);
  return {
    passes: passes.data.map(({ week_start, created_at, health, ...members }) => ({
      ...members,
      weekStart: week_start,
      at: created_at,
      healthy: failingChecks(parseHealth(health)).length === 0,
    })),
    pages: pages.data.map((row) => ({
      id: row.id,
      liveUrl: row.live_url,
      publishedAt: row.published_at,
      unpublishedAt: row.unpublished_at,
      weekStart: weekStartFor({ at: new Date(row.published_at), zone: a.zone }),
    })),
  };
}

/** The three totals this site-local week; `null` where the rows could not be read, never zeros. */
export async function readTotals(a: { siteId: string; zone: string; now: Date }): Promise<Totals | null> {
  try {
    return totalsOf({ ...(await readTotalsRows(a)), week: weekStartFor({ at: a.now, zone: a.zone }) });
  } catch {
    return null;
  }
}
