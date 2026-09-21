// SPEC §7 (2026-09-20, #928) — "Known content", as the rest of the product
// reaches it.
//
// One façade over the four parts: the index's rows (`store.ts`), what the
// three sources say (`refresh.ts`, `wordpress.ts`), how close two topics are
// (`similarity.ts`) and whether one is already covered (`match.ts`).
//
// **Every import below the façade is made at the call.** The store reaches
// `@/lib/db` and the WordPress reader reaches the egress seam; both parse
// environment bindings the moment they are evaluated, and the derivation and
// the screens that read this index must not need either to be reachable in
// order to be rendered or tested.
import type { InventoryRow } from "@/lib/site-profile/types";
import type { KnownPage } from "./types";
import type { KnownRefresh } from "./refresh";

export { topicSimilarity, trigrams } from "./similarity";
export { alreadyCovered, closestKnown, pageScore, type PlannedTopic } from "./match";
export { KNOWN_SOURCES, type KnownMatch, type KnownPage, type KnownSource } from "./types";
export { inventoryPages, type KnownRefresh } from "./refresh";
export { knownLinkTargets, publishedGuideLinks } from "./links";

/** The site's whole index. */
export async function knownContentFor(siteId: string): Promise<KnownPage[]> {
  const { readKnownContent } = await import("./store");
  return readKnownContent(siteId);
}

/** The rows worth scoring against one planned topic — the database's own
 *  narrowing (full text, then trigram). */
export async function knownContentNear(a: { siteId: string; query: string }): Promise<KnownPage[]> {
  const { nearKnownContent } = await import("./store");
  return nearKnownContent(a);
}

/** How many pages this site already has. The one number Settings states. */
export async function knownContentCount(siteId: string): Promise<number> {
  const { countKnownContent } = await import("./store");
  return countKnownContent(siteId);
}

/**
 * Re-reads the three sources and writes what they say.
 *
 * The two moments SPEC §7 names: when a WordPress connection is made, and
 * every Monday before the pass derives. Never throws — a source that could
 * not be read leaves that source's rows as they were, and the caller is a
 * customer pressing Connect or a pass measuring a market.
 *
 * `inventory` is passed by the caller that has just read it; otherwise the
 * stored profile for `domain` is read here.
 */
export async function refreshKnownContentFor(a: {
  siteId: string;
  /** The site's own domain, where the caller already has it. Read here
   *  otherwise — `connect` has a destination and not a domain. */
  domain?: string;
  inventory?: readonly InventoryRow[];
}): Promise<KnownRefresh> {
  const [{ refreshKnownContent }, { wordPressReaderFor }, { siteDomainOf }] = await Promise.all([
    import("./refresh"),
    import("./sources"),
    import("./store"),
  ]);
  const readWordPress = await wordPressReaderFor(a.siteId);
  return refreshKnownContent({
    siteId: a.siteId,
    ...(a.inventory === undefined ? {} : { inventory: a.inventory }),
    readInventory: async () => {
      const domain = a.domain ?? (await siteDomainOf(a.siteId));
      if (domain === null) return [];
      const { readSiteProfile } = await import("@/lib/site-profile");
      const profile = await readSiteProfile(domain);
      return profile?.inventory ?? [];
    },
    ...(readWordPress === undefined ? {} : { readWordPress }),
  });
}
