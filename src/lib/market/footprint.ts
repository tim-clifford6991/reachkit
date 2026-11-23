// SPEC §7 *Readiness holds only for harm*: a site's market footprint, the gate that holds its new comparison and
// listicle pages `out_of_reach`. Every stored row that places a page of the site is read; the gate opens on one at 20
// or better whose search carries no own brand token and passes the test a search passes before it joins the twelve
// (`selectTwelve`: `neverMeasured` against the market in force, then `passesRelevanceGuard`); a live page's own search
// needs no test. Pure; nothing is bought.
import { withoutPlace } from "@/lib/locale/place";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { measuredMarketOf, neverMeasured, searchKey } from "@/lib/market/questions/measured";
import { classifyIntent, passesRelevanceGuard } from "@/lib/market/questions/select";
import { isOwnDomain } from "@/lib/market/rivals/domains";
import { TRACKED_DEPTH, type PageReading } from "@/lib/measure/page-reading";
import type { StoredReport } from "@/lib/scan/report";

/** One stored row that places a page of the site: where it was read, the search, and the place. */
export interface FootprintRow {
  from: "serp" | "local_pack" | "ranked" | "reading";
  search: string;
  place: number;
  branded: boolean;
  onMarket: boolean;
}

/** A row that opens the gate. */
export const opensGate = (row: FootprintRow): boolean => row.place <= TRACKED_DEPTH && !row.branded && row.onMarket;

/** The current report's twelve organic results and local packs, its ranked rows, and each live page's place on its
 *  own search, where they hold the site. No report, or no profile on it, reads nothing as on its market. */
export function footprintRows(a: { report: StoredReport | null; market: MarketConclusion | null; readings: readonly ({ place?: PageReading["place"] } | null | undefined)[] }): FootprintRow[] {
  const report = a.report;
  if (report === null) return [];
  const profile = report.market.kind === "measured" ? report.market.value.profile : null;
  const place = a.market?.serves ?? undefined;
  const measured = measuredMarketOf(a.market, place);
  const terms = new Set((measured?.terms ?? []).map((term) => searchKey(term.term)));
  const marketWords = [a.market?.category ?? "", ...(a.market?.synonyms ?? [])].filter((word) => word.trim() !== "").join(" ") || undefined;
  const row = (from: FootprintRow["from"], search: string, at: number): FootprintRow => ({
    from,
    search,
    place: at,
    branded: profile !== null && classifyIntent(search, profile) === "own_brand",
    // A live page of ours was written only once its search passed the fit gate, so its own search is the market's.
    onMarket:
      profile !== null &&
      (from === "reading" ||
        terms.has(searchKey(search)) ||
        ((measured === undefined || neverMeasured(search, measured) === null) && passesRelevanceGuard(place === undefined ? search : withoutPlace(search, place), profile, marketWords))),
  });
  const own = (domain: string) => domain !== "" && isOwnDomain(domain, report.domain);
  const questions = report.questions.kind === "measured" ? report.questions.value : [];
  const rows = questions.flatMap((question, n) => {
    const serp = report.serps[n];
    if (serp?.kind !== "measured") return [];
    const search = question.search.keyword;
    return [
      ...serp.value.organic.filter((hit) => hit.unresolved !== true && own(hit.domain)).map((hit) => row("serp", search, hit.position)),
      ...(serp.value.localPack ?? []).flatMap((hit, at) => (hit.unresolved !== true && own(hit.domain) ? [row("local_pack", search, at + 1)] : [])),
    ];
  });
  rows.push(...report.ownRankedRows.map((ranked) => row("ranked", ranked.keyword, ranked.position)));
  for (const reading of a.readings) if (reading?.place != null) rows.push(row("reading", reading.place.query, reading.place.value));
  return rows;
}

/** What `footprintOpen` reads and writes: the opportunity store's members. */
interface FootprintStore {
  footprintOpened?(siteId: string): Promise<boolean>;
  openFootprint?(siteId: string, row: string): Promise<void>;
  refreshPages(siteId: string): Promise<readonly { reading?: { place?: PageReading["place"] } }[]>;
}

/** Whether the site's market footprint is open: recorded once, else read from its stored rows, which are logged.
 *  `record` (the Monday pass) records the first opening, so the gate never closes again. */
export async function footprintOpen(store: FootprintStore, siteId: string, a: { report: StoredReport | null; market: MarketConclusion | null; record: boolean }): Promise<boolean> {
  if ((await store.footprintOpened?.(siteId)) === true) return true;
  // Unreadable pages leave the report's rows to decide.
  const pages = await store.refreshPages(siteId).catch(() => []);
  const rows = footprintRows({ ...a, readings: pages.map((page) => page.reading) });
  const open = rows.some(opensGate);
  console.log(JSON.stringify({ event: "market_footprint", siteId, open, rows }));
  if (open && a.record) await store.openFootprint?.(siteId, JSON.stringify(rows.find(opensGate)));
  return open;
}
