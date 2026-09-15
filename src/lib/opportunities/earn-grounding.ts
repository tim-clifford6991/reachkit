// SPEC §6 (owner, 2026-09-15) · issue 478 — the grounding fact an Earn asset
// needs.
//
// Readiness already refuses every row of a site whose own pages yield no
// passage at all. An Earn row asks for more: the asset it plans has to be
// written from a fact of its own kind, or the generator would be asked for a
// comparison table with nothing of the customer's to compare.
//
//   comparison_table    a passage from a page the site profile files as
//                       `pricing`, `features` or `product`;
//   integration_page    a passage from a page whose address, title or h1 is
//                       about integrating (`INTEGRATION_SHAPE`, the words
//                       that chose the asset);
//   original_data_page  a passage carrying a numeral.
//
// Pure, and mechanical: the passages are the generator's own
// (`orderedPassages`), the purposes are the crawl's, and no model decides.
import { canonicalUrl } from "./cluster";
import { INTEGRATION_SHAPE } from "./derive/earn";
import type { InventoryRow, PagePurpose } from "@/lib/site-profile/types";
import type { EarnAsset } from "./types";

/** One of the site's own measured pages, with the passages it yields. */
export interface OwnPage {
  url: string;
  passages: readonly string[];
}

export type EarnGrounding = Readonly<Record<EarnAsset, boolean>>;

/** A site that grounds no Earn asset — the answer where nothing was read. */
export const NO_EARN_GROUNDING: EarnGrounding = Object.freeze({
  comparison_table: false,
  integration_page: false,
  original_data_page: false,
});

const COMPARABLE_PURPOSES: ReadonlySet<PagePurpose> = new Set(["pricing", "features", "product"]);
const NUMERAL = /\d/;

export function earnGroundingOf(a: {
  pages: readonly OwnPage[];
  inventory: readonly InventoryRow[];
}): EarnGrounding {
  const rows = new Map(a.inventory.map((row) => [canonicalUrl(row.url), row]));
  const grounding = { ...NO_EARN_GROUNDING };

  for (const page of a.pages) {
    if (page.passages.length === 0) continue;
    const row = rows.get(canonicalUrl(page.url));
    if (row !== undefined && COMPARABLE_PURPOSES.has(row.purpose)) grounding.comparison_table = true;
    const words = `${page.url} ${row?.title ?? ""} ${row?.h1 ?? ""}`.toLowerCase();
    if (INTEGRATION_SHAPE.test(words)) grounding.integration_page = true;
    if (page.passages.some((passage) => NUMERAL.test(passage))) grounding.original_data_page = true;
  }
  return Object.freeze(grounding);
}
