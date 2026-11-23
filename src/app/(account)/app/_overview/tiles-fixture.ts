// SPEC §4 *Overview's four tiles* — the reserved account's weekly passes, rebuilt from its own fixture
// pages' readings, so its tiles go through the same builder as every account's.
import type { PublishedPage } from "@/lib/measure/published";
import { onGoogleSince } from "@/lib/measure/ladder";
import { addressOf, type PlaceReport } from "@/lib/measure/page-reading";
import type { AnswerQuestion } from "./answers-model";
import { TILE_WEEKS, type TilePage, type TilePass } from "@/lib/measure/results";
import type { Visits } from "@/lib/publish/reads/visits";

/** The reserved account's 28 days of visits: small, with a week before the line starts. */
export const FIXTURE_VISITS: Visits = {
  n: 46,
  bySource: { google: 31, ai: 6, other: 9 },
  direct: 12,
  clicks: 5,
  aiRead: [],
  since: null,
  weeks: [null, 6, 9, 11, 10, 14],
};

const WEEK_MS = 7 * 86_400_000;
const NOT_READ = { kind: "unmeasured", reason: "not_attempted" } as const;

export const tilePageOf = (page: PublishedPage): TilePage => ({
  id: page.id,
  liveUrl: page.url,
  publishedAt: page.publishedAt.toISOString(),
  unpublishedAt: null,
  search: page.reading?.place?.query ?? null,
  onGoogle: onGoogleSince(page.reading),
});

/** The reserved account's six Mondays, rebuilt from its own pages' readings: more placed and linked each week, one week unhealthy. */
export function fixturePasses(pages: readonly PublishedPage[], week: string, pageQuestions: readonly AnswerQuestion[]): TilePass[] {
  // The pages the account's own answers name without a link: the latest pass records those mentions.
  const named = new Set(
    pageQuestions.flatMap((q) => (q.page !== null && q.marks.includes("names_you") && !q.marks.includes("links_to_you") ? [addressOf(q.page.url)] : []))
  );
  return Array.from({ length: TILE_WEEKS }, (_, k) => {
    const weekStart = new Date(Date.parse(`${week}T06:00:00Z`) - (TILE_WEEKS - 1 - k) * WEEK_MS).toISOString().slice(0, 10);
    const at = `${weekStart}T06:00:00.000Z`;
    const rows = pages
      .filter((page) => page.url !== null && page.reading?.linkedBy != null && page.publishedAt.toISOString() <= at)
      .map((page, j) => ({
        publicationId: page.id,
        question: { search: page.reading?.place?.query ?? page.title },
        cell: {
          kind: "answered",
          ownUrls: (page.reading?.linkedBy ?? []).length > 0 && k >= 4 ? [page.url!] : [],
          ...(k === TILE_WEEKS - 1 && named.has(addressOf(page.url!)) ? { named: true } : {}),
        },
        engines: [],
        organic: page.reading?.place != null && j % TILE_WEEKS <= k ? [{ url: page.url!, position: page.reading.place.value }] : [],
      }));
    const report = { questions: NOT_READ, serps: [], ownRanked: NOT_READ, ownRankedRows: [], pageQuestions: { rows }, verdict: { measuredAt: new Date(at) } };
    // The same readings stand in for the panel's AI Overview answers, so the tile draws a figure.
    const overview = rows.map((row) => ({ search: row.question.search, cell: row.cell }));
    return { weekStart, at, healthy: k !== 3, overview, firstPage: k === 3 ? null : new Map(Array.from({ length: 12 }, (_, i) => [`search ${i}`, i < k - 2])), report: report as unknown as PlaceReport };
  });
}

