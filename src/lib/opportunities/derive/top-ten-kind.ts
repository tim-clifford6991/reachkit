// SPEC §6 *Topics by business fit* (issue 1506, from the SEO review of
// 2026-10-17, item 7) — a search whose top ten is another kind of business.
//
// reachkit.app, a software product, went live on "best answer engine
// optimization services": the top ten were agencies and lists of agencies.
// A buyer there is choosing whom to hire, and no page of a product's
// answers that. So a search whose stored top ten holds six or more results
// of the kind of business that is not this one's, read off a SERP stored no
// more than 30 days before, is `low_fit`, whatever its volume (the SEO
// master review of 2026-10-18 on the issue):
//
//   software       agencies — a firm that does the work by hand;
//   shop           directories — review sites and listings — where it sells
//                  everywhere: a shop that serves one place is found
//                  through them ("bakery near me" is Yelp and Tripadvisor
//                  for every bakery on the panel), so they are its market;
//   local service  publishers — articles and round-ups, not providers.
//
// Hospitality, professional services and creators have no such kind: a
// café's market is its listings, an agency's is agencies, and a teacher's
// is articles. A market concluded before kinds (D69) is read as none.
//
// The reading of each result is the rivals' own (`market/rivals/domains`):
// a listing host is a directory and a round-up or article row is a
// publisher, the same signal that keeps a publisher out of the rivals, with
// a ranked title in any language beside it. An agency is read off the
// result's own title in every language's words.
// Pure, and stored evidence only: it buys nothing.
import { SHAPES } from "@/lib/locale/language";
import type { BusinessKind } from "@/lib/market/kinds";
import { isArticleRow, isListingHost, isRoundupPage } from "@/lib/market/rivals/domains";

export type OtherKind = "agency" | "directory" | "publisher";

/** The kind of business whose top ten is not this kind's market. Drafted
 *  (issue 1506); the owner may correct it. */
export const OTHER_KIND: Readonly<Partial<Record<BusinessKind, OtherKind>>> = Object.freeze({
  software: "agency",
  shop: "directory",
  "local-service": "publisher",
});

/** The business as this reads it: its kind, and the one place it serves
 *  (`MarketConclusion.serves`), `null` where it sells everywhere. */
export interface KindOfBusiness {
  kind?: BusinessKind | null;
  serves?: unknown;
}

/** How many of a top ten's results of the other kind make it that kind's
 *  market, and how old a stored SERP may be to say so. */
export const OTHER_KIND_TOP_TEN = Object.freeze({ min: 6, maxAgeDays: 30 });

/** A stored top ten and when its SERP was bought. */
export interface TopTenRead {
  at: Date;
  rows: readonly TopTenRow[];
}

/** The rows of a stored top ten still young enough to say anything at
 *  `now`, or `null`. */
export function freshTopTen(read: TopTenRead | null | undefined, now: Date): readonly TopTenRow[] | null {
  if (read == null) return null;
  return now.getTime() - read.at.getTime() <= OTHER_KIND_TOP_TEN.maxAgeDays * 86_400_000 ? read.rows : null;
}

export interface TopTenRow {
  domain: string;
  url?: string;
  title?: string;
}

function words(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** A title that ranks others in any language's words: a "best" beside a
 *  number ("Die 10 besten Elektriker", "beste Bäckerei 2026"). The rivals'
 *  own round-up reading knows English titles only. */
function rankedList(title: string | undefined): boolean {
  if (title === undefined) return false;
  const text = words(title);
  return SHAPES.best.test(text) && /\p{N}/u.test(text);
}

/** Whether one result is a business of `kind`, read off its own address and
 *  title. */
export function resultIs(row: TopTenRow, kind: OtherKind): boolean {
  if (kind === "directory") return isListingHost(row.url ?? row.domain) || isListingHost(row.domain);
  if (kind === "publisher") return !isListingHost(row.domain) && (isRoundupPage(row) || isArticleRow(row) || rankedList(row.title));
  return row.title !== undefined && SHAPES.agency.test(words(row.title));
}

/**
 * The other kind of business a stored top ten is, for `business` — six or
 * more of its first ten results — or `null` where it is not, or the
 * business's kind is not known.
 */
export function otherKindTopTen(rows: readonly TopTenRow[], business: KindOfBusiness | null): OtherKind | null {
  const kind = business?.kind ?? null;
  const other = kind === null ? undefined : OTHER_KIND[kind];
  if (other === undefined) return null;
  if (other === "directory" && business?.serves != null) return null;
  const held = rows.slice(0, 10).filter((row) => resultIs(row, other)).length;
  return held >= OTHER_KIND_TOP_TEN.min ? other : null;
}
