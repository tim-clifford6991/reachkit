// SPEC §4 · §6 (2026-09-22, #1004) — the two mentions cards' facts, for a
// real account.
//
// The other half of `mentions-provider.ts`, and it exists for the reason
// `answers-store.ts` beside it exists: everything that resolves `@/lib/db`
// or reaches the market leaves lives **here**, behind the provider's lazy
// import, so the screen's own module graph stays free of them and the
// reserved fixture account's render touches no database at all.
//
// It measures nothing and buys nothing. Every value below is a projection
// of rows the Monday pass already wrote (`src/lib/mentions/store.ts`).
//
// **The window is computed once, here.** Three readings of "the last four
// Mondays" is three chances for the rate, the grid and these two cards to
// mean three different sets of weeks — so this makes the same call
// `answers-store.ts` makes, from the site's own zone, and hands back the
// weeks that have a row.
import { ANSWER_RATE_WEEKS } from "@/lib/config/constants";
import { readMentionWeeks } from "@/lib/mentions";
import { previousWeekStart, weekStartFor } from "@/lib/scan/weekly";
import type { MentionsFacts } from "./mentions-model";

export interface MentionsSite {
  siteId: string;
  timeZone: string;
}

export async function readMentionFacts(
  site: MentionsSite,
  at: Date,
  tracked: readonly string[]
): Promise<MentionsFacts> {
  const weekStarts = windowWeeks(at, site.timeZone);
  // A window that could not be read draws no card, exactly as a site never
  // queried does: both are "we have nothing measured to show you", and
  // neither is a claim about what the engines said. The grid and the rate
  // above are the screen's subject and still render.
  const weeks = await readMentionWeeks({ siteId: site.siteId, weekStarts }).catch((error: unknown) => {
    console.warn(
      JSON.stringify({ event: "llm_mentions_unread", detail: error instanceof Error ? error.message : String(error) })
    );
    return [];
  });
  return { weeks, tracked };
}

/** The window's Mondays, oldest first, in the site's own zone — the same
 *  `week_start` strings the Monday pass stamps its rows with, and the same
 *  computation `answers-store.ts` makes for the four-week rate. */
function windowWeeks(at: Date, timeZone: string): string[] {
  const weeks: string[] = [weekStartFor({ at, zone: timeZone })];
  for (let back = 1; back < ANSWER_RATE_WEEKS; back += 1) {
    weeks.unshift(previousWeekStart(weeks[0] as string));
  }
  return weeks;
}
