import { SocialProofMarquee } from "./social-proof-marquee";
import { getRecentScanChips, type ScanChip } from "@/lib/scan/recent-chips";

/**
 * RecentScans — async marquee of real recent completed scans.
 *
 * Render inside a <Suspense> with a SocialProofMarquee fallback (using the same
 * curated chips), so the page shell still prerenders (PPR / cacheComponents)
 * while the live data streams in. Falls back to `fallback` if the query fails.
 */
export async function RecentScans({
  fallback,
  label = "Recent scans",
}: {
  fallback: readonly ScanChip[];
  label?: string;
}) {
  const chips = await getRecentScanChips(fallback);
  return <SocialProofMarquee content={{ label, chips }} />;
}
