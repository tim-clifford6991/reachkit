/**
 * Rolls the 11-value ReferrerCategory taxonomy into the 5 channel groups shown
 * on the Competitors gap-map, and buckets each entity's presence by referrer
 * count. Low-value categories (ai_directory/spam/other) are intentionally
 * excluded — the matrix shows QUALITY discovery channels only.
 */
import type { ReferrerCategory } from "@/lib/scan/referral/classify-referrers";

export type ChannelGroup = "reviews" | "directories" | "community" | "media" | "partners";
export const CHANNEL_GROUPS: ChannelGroup[] = ["reviews", "directories", "community", "media", "partners"];
export type StrengthBucket = "hi" | "med" | "lo" | "absent";

// Every QUALITY_CATEGORY maps to exactly one group (total coverage of the 8).
const CATEGORY_GROUP: Partial<Record<ReferrerCategory, ChannelGroup>> = {
  marketplace: "reviews",
  software_directory: "directories",
  community: "community",
  social: "community",
  blog: "media",
  media: "media",
  newsletter: "media",
  partner: "partners",
  // ai_directory / spam / other → intentionally unmapped (low-value)
};

function bucket(count: number): StrengthBucket {
  if (count <= 0) return "absent";
  if (count <= 2) return "lo";
  if (count <= 6) return "med";
  return "hi";
}

export function channelStrengthFor(
  byCategory: Partial<Record<ReferrerCategory, number>>,
): Record<ChannelGroup, StrengthBucket> {
  const counts: Record<ChannelGroup, number> = { reviews: 0, directories: 0, community: 0, media: 0, partners: 0 };
  for (const [cat, n] of Object.entries(byCategory)) {
    const g = CATEGORY_GROUP[cat as ReferrerCategory];
    if (g) counts[g] += n ?? 0;
  }
  return {
    reviews: bucket(counts.reviews),
    directories: bucket(counts.directories),
    community: bucket(counts.community),
    media: bucket(counts.media),
    partners: bucket(counts.partners),
  };
}
