// SPEC §7 (2026-09-20, #928) — keeping the known-content index true.
//
// "read through the connection when it is made and every Monday". Two
// callers, one function: `POST /api/settings/destination` when a customer
// connects their WordPress, and the weekly pass before it derives. Both hand
// it the site and its domain; it reads the three sources and writes what it
// read.
//
// **Each source is written on its own.** A WordPress that did not answer
// leaves the WordPress rows exactly as they were — last Monday's reading is
// a better answer than none — and our own pages and the crawl's are written
// regardless. One source failing must never empty the index, because an
// empty index answers "nothing is covered" to every question asked of it,
// which is the one wrong answer this rule cannot afford.
//
// **It never throws.** The two callers are a customer pressing Connect and a
// weekly pass measuring a market; neither should fail because an index
// could not be refreshed. What could not be read is logged as its own line
// and the pass goes on with the reading it already had.
import { KNOWN_CONTENT } from "@/lib/config/constants";
import type { InventoryRow } from "@/lib/site-profile/types";
import { readKnownContent, readOurPages, writeKnownSource } from "./store";
import type { KnownPage, KnownSource } from "./types";

/** What one refresh did, per source, for the log and for the caller that
 *  wants to say how many pages it knows about. */
export interface KnownRefresh {
  reachkit: number | null;
  wordpress: number | null;
  site: number | null;
}

/** The crawl's reading of the main site, as the index holds it. Bounded by
 *  #928's own cap: a hundred pages is what the rule was written against,
 *  and a site with three thousand is a crawl we do not hold in this table. */
export function inventoryPages(inventory: readonly InventoryRow[]): KnownPage[] {
  const seen = new Set<string>();
  const pages: KnownPage[] = [];
  for (const row of inventory) {
    const title = (row.h1.trim() || row.title.trim()).replace(/\s+/g, " ");
    const url = row.url.trim();
    if (title === "" || url === "" || seen.has(url)) continue;
    seen.add(url);
    pages.push({
      source: "site",
      ref: url,
      url,
      title,
      headings: [],
      live: true,
      publishedAt: null,
    });
    if (pages.length >= KNOWN_CONTENT.INVENTORY_MAX) break;
  }
  return pages;
}

/** One source, written; `null` where it could not be read. Swallowed on
 *  purpose — see this file's header. */
async function write(
  siteId: string,
  source: KnownSource,
  read: () => Promise<readonly KnownPage[] | null>
): Promise<number | null> {
  try {
    const pages = await read();
    if (pages === null) return null;
    await writeKnownSource({ siteId, source, pages });
    return pages.length;
  } catch (error) {
    console.log(
      JSON.stringify({ event: "known_content_not_refreshed", siteId, source, detail: String(error) })
    );
    return null;
  }
}

/**
 * Re-reads what this site already has.
 *
 * `inventory` is handed in by the caller that already has it — the weekly
 * pass reads the profile anyway — and read here only where it is not.
 * `wordpress` is the connected destination's reader, or absent where the
 * site has none: a hosted-only site has no third source, and an absent
 * reader writes no WordPress rows rather than emptying them.
 */
export async function refreshKnownContent(a: {
  siteId: string;
  inventory?: readonly InventoryRow[];
  readInventory?: () => Promise<readonly InventoryRow[]>;
  readWordPress?: () => Promise<readonly KnownPage[] | null>;
}): Promise<KnownRefresh> {
  const reachkit = await write(a.siteId, "reachkit", () => readOurPages(a.siteId));
  const site = await write(a.siteId, "site", async () => {
    const inventory = a.inventory ?? (a.readInventory === undefined ? null : await a.readInventory());
    return inventory === null ? null : inventoryPages(inventory);
  });
  const wordpress =
    a.readWordPress === undefined ? null : await write(a.siteId, "wordpress", a.readWordPress);
  return { reachkit, wordpress, site };
}

/** What the site knows, after the refresh — the read every other caller
 *  makes. Re-exported here so a caller that refreshes and then reads does
 *  not import two modules to do it. */
export { readKnownContent };
