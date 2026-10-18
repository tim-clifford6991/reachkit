// SPEC §7 (2026-10-17, issue 1487) — a retargeted page moves to an address
// that says its new topic, and the old address answers 301 to it.
//
// A move is stored as nothing new: it is an update published at an address
// other than the one it updates. The newer publication's opportunity names
// the page it updates (`target_ref`); where its own `live_url` is another
// slug, the old slug moved there. The old rows are taken out of the live
// set when the move is written (`../../attempt/move.ts`), so every reader
// that lists live pages — the sitemap, the index, the verdicts, Overview —
// sees one page at the new address and no second one at the old.
//
// Pure, and reached from the middleware through `store.ts`: it imports
// nothing that reaches a database or a model.
import { linkWords, sameWord } from "@/lib/generate/links/text";

/** One hosted publication of a site, as the address read selects it. */
export interface AddressRow {
  id: string;
  live_url: string | null;
  published_at: string | null;
  unpublished_at: string | null;
  /** The address this publication updates, where it is an update of one of
   *  the site's pages (`opportunities.target_ref` of an Improve row). */
  updates: string | null;
  /** The publication this one was merged into (issue 1506): its address
   *  answers with that page. Absent reads as none. */
  merged_into?: string | null;
}

/** What one address on a site's host is: serving a page now, moved to
 *  another address, retired from serving one, or neither. */
export type HostedAddressState = "live" | "moved" | "retired" | "none";

/** The address's state, and the publication it serves where it is live.
 *  A moved address names the publication it moved to and that page's slug. */
export type HostedAddress =
  | { state: "live" | "retired" | "none"; publicationId: string | null }
  | { state: "moved"; publicationId: string; slug: string };

export function slugOf(url: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    const marker = url.lastIndexOf("/");
    pathname = marker < 0 ? "" : url.slice(marker);
  }
  const segments = pathname.split("/").filter((segment) => segment !== "");
  return segments.length === 0 ? null : (segments[segments.length - 1] ?? null);
}

/** A chain of moves is followed at most this far: one retarget a page per
 *  §6's 30 days makes a longer one years old. */
const MOVES_FOLLOWED = 8;

/**
 * What `slug` answers, from every hosted publication of its site. Pure.
 *
 * **Live comes first**: a slug with a live row serves it, whatever moved
 * through it before. Then **moved**: the newest publication that updated
 * this address from another one, followed to the address it lives at now —
 * a page moved twice answers its newest address in one hop. A move whose
 * page was later taken down is not a move: the old address is `retired`,
 * as it would be had the page never moved. Then **merged** (issue 1506):
 * an address whose page went into another answers with that page. `none`
 * is an address that never served a page.
 */
export function addressOf(rows: readonly AddressRow[], slug: string): HostedAddress {
  return addressAt(rows, slug, 0);
}

function addressAt(rows: readonly AddressRow[], slug: string, depth: number): HostedAddress {
  const liveAt = (at: string): AddressRow | undefined =>
    rows.find(
      (row) => row.live_url !== null && slugOf(row.live_url) === at && row.published_at !== null && (row.unpublished_at ?? null) === null
    );
  const live = liveAt(slug);
  if (live !== undefined) return { state: "live", publicationId: live.id };

  const movedFrom = (at: string): AddressRow | undefined =>
    rows
      .filter(
        (row) =>
          row.published_at !== null &&
          row.live_url !== null &&
          row.updates !== null &&
          slugOf(row.updates) === at &&
          slugOf(row.live_url) !== at
      )
      .sort((x, y) => (y.published_at ?? "").localeCompare(x.published_at ?? ""))[0];
  const seen = new Set([slug]);
  let at = slug;
  for (let hop = 0; hop < MOVES_FOLLOWED; hop++) {
    const next = movedFrom(at);
    const to = next?.live_url === null || next === undefined ? null : slugOf(next.live_url);
    if (to === null || seen.has(to)) break;
    seen.add(to);
    at = to;
    const there = liveAt(to);
    if (there !== undefined) return { state: "moved", publicationId: there.id, slug: to };
  }

  // Issue 1506: an address merged into another page answers with that page,
  // wherever it lives now — moved on, or itself merged. A merge whose page
  // was later taken down is not one: the address is retired.
  const merged = rows
    .filter((row) => row.live_url !== null && slugOf(row.live_url) === slug && (row.merged_into ?? null) !== null)
    .sort((x, y) => (y.published_at ?? "").localeCompare(x.published_at ?? ""))[0];
  const into = merged === undefined ? undefined : rows.find((row) => row.id === merged.merged_into);
  const intoSlug = into?.live_url == null ? null : slugOf(into.live_url);
  if (intoSlug !== null && intoSlug !== slug && depth < MOVES_FOLLOWED) {
    const there = addressAt(rows, intoSlug, depth + 1);
    if (there.state === "live" && there.publicationId !== null) return { state: "moved", publicationId: there.publicationId, slug: intoSlug };
    if (there.state === "moved") return there;
  }

  const retired = rows.some(
    (row) => row.live_url !== null && slugOf(row.live_url) === slug && (row.unpublished_at ?? null) !== null
  );
  return { state: retired ? "retired" : "none", publicationId: null };
}

/**
 * Whether a page's address and its title describe one topic: at least half
 * the words of the slug are words of the title (or its heading), read as
 * the link text check reads them ("scan" and "scans" are one word). A
 * slug with no words of its own says nothing and is not held to it. Pure.
 *
 * Found on reachkit.app (issue 1487): `/tools-to-track-where-ai-sends-
 * potential-customers` served "How to rank on ChatGPT when buyers search
 * your market" — none of the slug's six words.
 */
export function slugDescribesTitle(slug: string, title: string): boolean {
  const wanted = [...new Set(linkWords(slug.replace(/[-_+]+/g, " ")))];
  if (wanted.length === 0) return true;
  const said = linkWords(title);
  const held = wanted.filter((word) => said.some((other) => sameWord(word, other)));
  return held.length * 2 >= wanted.length;
}
