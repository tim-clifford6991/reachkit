// SPEC §7 (2026-09-20, #928) — the one source that is not ours to read
// whenever we like.
//
// A connected WordPress is an API on the customer's own host, reachable with
// the credential they gave us and at no other time. This file is the join
// between "this site has one" and "here is what is on it", and it is kept
// apart from `refresh.ts` so that the refresh — which is where the rules
// about partial failure live — depends on no publishing module at all.
//
// **A site with no WordPress has no reader.** `undefined`, not a reader that
// answers nothing: the difference is whether the refresh writes an empty
// WordPress source over what it already holds, and it must not.
import type { KnownPage } from "./types";

export async function wordPressReaderFor(
  siteId: string
): Promise<(() => Promise<KnownPage[] | null>) | undefined> {
  const { destinationOf } = await import("@/lib/publish/destinations");
  const row = await destinationOf(siteId, "wordpress").catch(() => null);
  if (row === null) return undefined;

  return async () => {
    const [{ withConfig }, { readWordPressPosts }] = await Promise.all([
      import("@/lib/publish/destinations/config"),
      import("./wordpress"),
    ]);
    try {
      return await withConfig<
        import("@/lib/publish/destinations/wordpress/client").WordPressConfig,
        KnownPage[] | null
      >(row.id, (cfg) => readWordPressPosts(cfg));
    } catch {
      // No credential, or one that could not be unsealed. Nothing was read,
      // and nothing is written over what the last read left.
      return null;
    }
  };
}
