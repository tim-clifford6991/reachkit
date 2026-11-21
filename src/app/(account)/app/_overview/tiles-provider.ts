// SPEC §4 *Overview's four tiles* — the signed-in account's tiles, read once a request.
// Pages and Google are counted by the functions that build the lists they open.
import { cache } from "react";
import { contentOf, type PublishedPage } from "@/lib/measure/published";
import type { PlaceReport } from "@/lib/measure/page-reading";
import { weekStartFor } from "@/lib/scan/weekly/week";
import { isReservedFixtureAccount, requireSetUpAccount } from "../_session/account";
import { readPublished } from "./content-provider";
import { googlePagesOf } from "./google-pages";
import { readRivals } from "./rivals-provider";
import { TILE_WEEKS, tilesOf, type TilePage, type TilePass, type TilesModel } from "./tiles";

const WEEK_MS = 7 * 86_400_000;
const NOT_READ = { kind: "unmeasured", reason: "not_attempted" } as const;

const tilePageOf = (page: PublishedPage): TilePage => ({
  id: page.id,
  liveUrl: page.url,
  publishedAt: page.publishedAt.toISOString(),
  unpublishedAt: null,
  search: page.reading?.place?.query ?? null,
});

/** The reserved account's six Mondays, rebuilt from its own pages' readings: more placed and linked each week, one week unhealthy. */
function fixturePasses(pages: readonly PublishedPage[], week: string): TilePass[] {
  return Array.from({ length: TILE_WEEKS }, (_, k) => {
    const weekStart = new Date(Date.parse(`${week}T06:00:00Z`) - (TILE_WEEKS - 1 - k) * WEEK_MS).toISOString().slice(0, 10);
    const at = `${weekStart}T06:00:00.000Z`;
    const rows = pages
      .filter((page) => page.url !== null && page.reading?.linkedBy != null && page.publishedAt.toISOString() <= at)
      .map((page, j) => ({
        publicationId: page.id,
        question: { search: page.reading?.place?.query ?? page.title },
        cell: { kind: "answered", ownUrls: (page.reading?.linkedBy ?? []).length > 0 && k >= 4 ? [page.url!] : [] },
        engines: [],
        organic: page.reading?.place != null && j % TILE_WEEKS <= k ? [{ url: page.url!, position: page.reading.place.value }] : [],
      }));
    const report = { questions: NOT_READ, serps: [], ownRanked: NOT_READ, ownRankedRows: [], pageQuestions: { rows }, verdict: { measuredAt: new Date(at) } };
    return { weekStart, at, healthy: k !== 3, firstPage: k === 3 ? null : Math.max(0, k - 2), report: report as unknown as PlaceReport };
  });
}

/** `null` where the rows could not be read: the row is not drawn, never zeros. */
export const readTiles = cache(async function readTiles(coming: number, goLive: boolean): Promise<TilesModel | null> {
  const account = await requireSetUpAccount();
  try {
    const [published, rivals] = await Promise.all([readPublished(), readRivals().catch(() => null)]);
    const content = contentOf(published);
    if (content === null) return null;
    const at = published.now;
    const week = weekStartFor({ at, zone: account.timeZone });
    const fixture = isReservedFixtureAccount(account);
    // Imported at the call: the store resolves `@/lib/db`, which the reserved account never reaches.
    const rows = fixture
      ? { passes: fixturePasses(content.pages, week), pages: content.pages.map(tilePageOf) }
      : await import("./tiles-store").then((m) => m.readTileRows({ siteId: account.siteId, domain: account.domain, week }));
    const google = googlePagesOf(content.pages, at);
    const firstPage = rivals?.firstPage;
    return tilesOf({
      ...rows,
      lists: { live: content.pages.length, firstLive: content.pages.at(-1)?.publishedAt ?? null, google: { live: google.live, placed: google.placed } },
      rivals:
        firstPage === undefined
          ? null
          : { you: firstPage.you.count, of: firstPage.of, rivals: firstPage.rivals, measuredAt: rivals?.measuredAt ?? null },
      now: at,
      week,
      coming,
      goLive,
    });
  } catch {
    return null;
  }
});
