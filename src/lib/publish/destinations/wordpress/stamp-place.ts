// BUILD §4.7 · §9 — the WordPress destination answering the deleted-account mail's place port, the `StampCapability`
// seam `account/lifecycle/left-in-wordpress.ts` declares; unregistered it answers `null`, never a guessed place.
// The side that knows the answer registers it (ADR-050), so account surfaces never import the publishing graph; the seam
// is imported by file, since the lifecycle barrel would build a cycle out of a registration.
// `stamp_capable === true` is a place and nothing else is (REQ-079 c6). The base URL is read through `withConfig`, not
// stored twice; `deleteAccount` asks before it changes anything, so the credential is still there.
import { WORDPRESS } from "@/lib/config/constants";
import {
  setStampCapability,
  type WordPressListPlace,
} from "@/lib/account/lifecycle/left-in-wordpress";
import { withConfig } from "../config";
import { readDestination } from "../store";

/** The one place in the customer's WordPress listing ReachKit's posts, or `null` for every other case alike: a departing
 *  customer is owed the count, not a note about our probe. */
export async function stampPlace(destinationId: string): Promise<WordPressListPlace | null> {
  const row = await readDestination(destinationId);
  // No kind test: only an adapter with a stamp probe writes a non-null value, and hosted has none.
  if (row === null || row.stamp_capable !== true) return null;

  try {
    const siteBaseUrl = await withConfig<{ baseUrl?: unknown }, string | null>(
      destinationId,
      async (cfg) => (typeof cfg.baseUrl === "string" && cfg.baseUrl !== "" ? cfg.baseUrl : null)
    );
    if (siteBaseUrl === null) return null;
    return { siteBaseUrl, stampSlug: WORDPRESS.stampSlug };
  } catch {
    // No credential, or one that would not open: the mail still names the outcome and its count.
    return null;
  }
}

/** Registers the port once at boot. Unasserted, unlike `installActiveAccessGate`: missing, it costs one mail its link. */
export function installStampCapability(): void {
  setStampCapability({ place: stampPlace });
}
