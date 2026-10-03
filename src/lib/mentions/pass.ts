// SPEC §6 (2026-09-22, #1004) — the Monday pass's LLM Mentions read.
//
// "Buy DataForSEO LLM Mentions **weekly**, per site, as part of the Monday
// pass … one request per site, 100-row cap … Cost recorded against the
// weekly cap (`CAPS`); the pass skips the call if the cap would be exceeded
// and says so."
//
// One call, one week, one row. Everything it decides is here; the request
// is `src/lib/vendors/dataforseo/mentions.ts`'s and the two tables are
// `store.ts`'s.
//
// ── Where it runs, and why it runs last ─────────────────────────────────
//
// Inside `runWeekly`'s `afterReport` hook, after `deriveForPass`. The hook
// hands a `CostContext` opened on what the pass's row has already spent,
// under `CAPS.WEEKLY_C` — so the cap accounting #1004 asks for is the
// product's own seam and not a second ledger, and a reservation the 40c
// cap has no room for is refused by `recordFetch` before a byte leaves.
//
// **After the derivation, deliberately.** A weekly pass that is running
// short has to lose something, and what it loses should be the
// supplementary list rather than the calendar: opportunity typing is what
// fills the week's pages, which is the paying path, and *Also appearing
// for* is — in the pilot's own words — "a supplementary list, not the
// score". So the mentions read is the first thing a tight week gives up,
// and it gives it up by being asked last. A week that skipped it says so
// on its own row and the card states it; no other measurement moves.
//
// ── What the four statuses mean, and why a skip is stored ───────────────
//
// A read that was never made still writes a row. That is the whole of
// SPEC §6's distinction: "a week with no rows is a measured zero (a written
// line), not a blank card; a site never queried draws no card." A site
// never queried has **no row**, and the card is not drawn at all. A week
// the cap skipped has a row saying so, and the card can say the week was
// not bought rather than implying the engines answered nobody.
//
// The arms map one-for-one onto the seam's own (`envelope.ts`):
//   cap-skipped → `unmeasured/not_attempted` → `skipped_cap`
//   a failure   → `unmeasured/undeterminable` → `failed`
//   `[]`        → `zero`      — the vendor answered with nothing, which is
//                               a measurement and is billed
//   rows        → `measured`
//
// ── Never throws ────────────────────────────────────────────────────────
//
// A pass that has measured the whole market must not be taken down by a
// supplementary list. Everything here is caught, logged with the week it
// belongs to, and the pass carries on — the contract `afterReport`'s own
// caller already keeps for the derivation beside it.
//
// ── Who is bought, and how often (owner D32 of 2026-10-03, #1162) ───────
//
// The read costs 10¢ whatever comes back, and on a site with almost no
// ranked searches it came back empty. So it is bought only for a site
// whose own ranked footprint is `LLM_MENTIONS_MIN_FOOTPRINT` or more, and
// then once in `LLM_MENTIONS_EVERY_WEEKS`. Either skip writes its own row,
// asks the vendor nothing and spends nothing.
import type { CostContext } from "@/lib/costs";
import { LLM_MENTIONS_EVERY_WEEKS, LLM_MENTIONS_MIN_FOOTPRINT } from "@/lib/config/constants";
import { llmMentions } from "@/lib/vendors/dataforseo";
import type { MentionRow } from "@/lib/vendors/dataforseo/types";
import { boughtInWeeks, storeMentionWeek } from "./store";
import type { MentionReadStatus, StoredMention } from "./types";

/** What one pass reports about its own mentions read — the log line's
 *  subject, and what a test asserts on without a database. */
export interface MentionsPassOutcome {
  status: MentionReadStatus;
  /** Normalised rows written. One mention citing two of the site's pages is
   *  two rows, so this is not the vendor's row count. */
  stored: number;
  /** The vendor's own count of every mention it holds for this domain. */
  totalCount: number | null;
}

/**
 * One site's weekly LLM Mentions read, bought and stored.
 *
 * `weekStart` is the pass's own — computed once in `runWeekly` from the
 * site's zone and written on the scan row — never recomputed here. Two
 * readings of a customer's Monday is how one week comes to be stored under
 * two labels.
 */
export async function readWeeklyMentions(
  cost: CostContext,
  a: {
    siteId: string;
    domain: string;
    weekStart: string;
    scanId: string;
    /** How many keywords the site itself ranks for, as this pass measured
     *  it; `null` where the pass could not read it, which buys nothing. */
    ownRanked: number | null;
  }
): Promise<MentionsPassOutcome> {
  const skip: MentionReadStatus | null =
    a.ownRanked === null || a.ownRanked < LLM_MENTIONS_MIN_FOOTPRINT
      ? "skipped_footprint"
      : (await boughtInWeeks({ siteId: a.siteId, weekStarts: weeksBefore(a.weekStart, LLM_MENTIONS_EVERY_WEEKS - 1) }))
        ? "skipped_monthly"
        : null;
  if (skip !== null) {
    const written = await storeMentionWeek({
      siteId: a.siteId,
      weekStart: a.weekStart,
      scanId: a.scanId,
      status: skip,
      totalCount: null,
      costCents: 0,
      mentions: [],
    });
    logMentionsPass({ siteId: a.siteId, weekStart: a.weekStart, status: skip, stored: 0, totalCount: null, costCents: 0, written: written.stored });
    return { status: skip, stored: 0, totalCount: null };
  }

  const spentBefore = cost.spentCents();
  const answer = await llmMentions(cost, {
    domain: a.domain,
    mode: "live",
    scope: { site: a.siteId },
  });

  const status: MentionReadStatus =
    answer.kind === "measured"
      ? "measured"
      : answer.kind === "zero"
        ? "zero"
        : answer.reason === "not_attempted"
          ? "skipped_cap"
          : "failed";

  const rows = answer.kind === "unmeasured" ? [] : normalise(answer.value.rows);
  const totalCount = answer.kind === "unmeasured" ? null : answer.value.total;
  // What this read actually cost, off the context's own running total —
  // the settled figure the ledger recorded, not the reservation, so the row
  // and `fetches.cost_cents` agree. A cache hit inside the six-day window
  // costs nothing and says so, and so does a read the cap refused.
  //
  // A delta is exact here, not an estimate: `spentCents()` is
  // `ledgered + inFlightReserved` (`src/lib/costs/index.ts`), the call
  // above is awaited, and nothing else in this function spends — so the
  // reservation is already released and the difference is this one call's
  // settlement and nothing else's.
  const costCents = Math.max(0, cost.spentCents() - spentBefore);

  const outcome: MentionsPassOutcome = { status, stored: rows.length, totalCount };
  const written = await storeMentionWeek({
    siteId: a.siteId,
    weekStart: a.weekStart,
    scanId: a.scanId,
    status,
    totalCount,
    costCents,
    mentions: rows,
  });

  logMentionsPass({
    siteId: a.siteId,
    weekStart: a.weekStart,
    status,
    stored: rows.length,
    totalCount,
    costCents,
    written: written.stored,
  });
  return outcome;
}

/** The `count` Mondays before `weekStart`, as `YYYY-MM-DD`. */
function weeksBefore(weekStart: string, count: number): string[] {
  const monday = Date.parse(`${weekStart}T12:00:00.000Z`);
  return Array.from({ length: count }, (_, i) =>
    new Date(monday - (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
}

/**
 * The vendor's rows as the table's rows.
 *
 * **One row per (question, engine, cited page).** A mention citing two of
 * the site's own pages becomes two rows, which is what makes "how many
 * questions cite this page" one group-by rather than a scan through an
 * array — and *Cited pages* is exactly that question. A mention citing none
 * still becomes one row with no URL: *Also appearing for* is a list of
 * questions, and dropping one because its source would not parse would be
 * losing the measurement to its decoration.
 */
export function normalise(rows: readonly MentionRow[]): readonly Omit<StoredMention, "weekStart">[] {
  const out: Omit<StoredMention, "weekStart">[] = [];
  for (const row of rows) {
    const base = {
      question: row.question,
      engine: row.engine,
      model: row.model,
      aiSearchVolume: row.aiSearchVolume,
      monthlySearches: row.monthlySearches,
      firstSeenAt: parseInstant(row.firstSeenAt),
      lastSeenAt: parseInstant(row.lastSeenAt),
    };
    if (row.citedUrls.length === 0) {
      out.push({ ...base, citedUrl: null });
      continue;
    }
    for (const citedUrl of row.citedUrls) out.push({ ...base, citedUrl });
  }
  return out;
}

/** The vendor's date as an instant, or `null` where it gave none or gave
 *  one that will not parse — never today's date, which would read as a
 *  question first seen this week. */
function parseInstant(value: string | null): Date | null {
  if (value === null) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** One line a week. No question text and no URL: what a reader needs to
 *  find the week again is the site, the Monday and what happened. */
function logMentionsPass(record: {
  siteId: string;
  weekStart: string;
  status: MentionReadStatus;
  stored: number;
  totalCount: number | null;
  costCents: number;
  written: boolean;
}): void {
  console.log(JSON.stringify({ event: "llm_mentions_week", ...record }));
}
