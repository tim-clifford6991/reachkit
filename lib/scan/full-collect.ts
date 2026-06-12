import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts } from "@/lib/scan/types";
import { searchKeywords, findCommunities, findCreators } from "@/lib/scan/tools/index";
import { hostname } from "@/lib/scan/url";

/**
 * Full collect — the heavier data pass (keywords + communities + creators)
 * that feeds findings/actions downstream.
 *
 * - Runs all three D-tools in parallel under Promise.allSettled
 * - Each tool call is additionally .catch-guarded so one failure degrades
 *   only that source (the tools persist their own raw_documents)
 * - Returns void; raw_documents written by tools are what extract/action-gen reads
 * - NEVER throws
 */
export async function runFullCollect(
  ctx: ScanContext,
  facts: PreliminaryFacts,
): Promise<void> {
  // Derive inputs
  const host = hostname(ctx.storeUrl);
  const hostPrefix = host.split(".")[0] ?? host;
  const productName = facts.listing.name || hostPrefix;

  const competitorNames = facts.competitors
    .map((c) => c.name)
    .filter(Boolean)
    .slice(0, 5);

  const seeds = [productName, ...competitorNames];
  const topic = facts.listing.category ?? productName;
  const subjectKey = ctx.storeUrl;
  const toolCtx = { scanId: ctx.scanId, mode: ctx.mode, budget: ctx.budget };

  await Promise.allSettled([
    searchKeywords
      .run({ seeds, subjectKey }, toolCtx)
      .catch(() => undefined),

    findCommunities
      .run({ topic, subjectKey }, toolCtx)
      .catch(() => undefined),

    findCreators
      .run({ competitors: competitorNames, subjectKey }, toolCtx)
      .catch(() => undefined),
  ]);
}
