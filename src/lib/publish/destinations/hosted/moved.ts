// SPEC §7 — a retargeted page moves to an address that says its new topic, and the old address answers 301 to it.
// A move is an update published at another address than the one it updates (`target_ref`); `../../attempt/move.ts`
// takes the old rows out of the live set, so every reader of live pages sees one page at the new address.
// Pure: the middleware reaches it through `store.ts`, so it imports nothing that reaches a database or a model.
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
  /** The publication this one was merged into, whose page its address answers with; absent reads as none. */
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

/** At one retarget per §6's 30 days, a longer chain of moves is years old. */
const MOVES_FOLLOWED = 8;

/** What `slug` answers. Live first, whatever moved through it. Then moved: the newest update from it, followed to where
 *  it lives now in one hop; a move later taken down leaves the address `retired`. Then merged: the page it went into.
 *  `none` never served a page. */
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

  // Merged: the page it went into, wherever it lives now; one later taken down leaves the address retired.
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

/** Whether address and title describe one topic: at least half the slug's words are the title's, read as the link text
 *  check reads them ("scan" and "scans" are one word). A slug with no words is not held to it. */
export function slugDescribesTitle(slug: string, title: string): boolean {
  const wanted = [...new Set(linkWords(slug.replace(/[-_+]+/g, " ")))];
  if (wanted.length === 0) return true;
  const said = linkWords(title);
  const held = wanted.filter((word) => said.some((other) => sameWord(word, other)));
  return held.length * 2 >= wanted.length;
}
