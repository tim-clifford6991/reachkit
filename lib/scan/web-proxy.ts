import type { WebProxy } from "@/lib/scan/types";
const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function webProxyScore(i: { serpResultCount: number; phUpvotes: number; domainAgeYears: number | null }): WebProxy {
  const serp = Math.log10(i.serpResultCount + 1) / 7;        // ~0..1 (10M results ≈ 1)
  const ph = Math.log10(i.phUpvotes + 1) / 3;                // ~0..1 (1000 upvotes ≈ 1)
  const age = Math.min((i.domainAgeYears ?? 0) / 10, 1);     // 10y ≈ 1
  return { score: clamp(((serp + ph + age) / 3) * 100), serpResultCount: i.serpResultCount, phUpvotes: i.phUpvotes, domainAgeYears: i.domainAgeYears };
}
