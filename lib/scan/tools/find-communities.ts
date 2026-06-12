import type { ToolDefinition } from "@/lib/tools/registry";
import type { Community } from "@/lib/scan/types";
import { fixturesEnabled, fixtureCommunities } from "@/lib/dev/fixtures";
import { hnSearch } from "@/lib/scan/adapters/hn-algolia";
import { blueskySearch } from "@/lib/scan/adapters/bluesky";
import { upsertRawDocument } from "@/lib/db/raw-documents";
import { recordPipelineRun } from "@/lib/telemetry/pipeline-runs";

export interface FindCommunitiesArgs {
  topic: string;
  subjectKey: string;
}

export interface FindCommunitiesResult {
  communities: Community[];
}

export const findCommunities: ToolDefinition<FindCommunitiesArgs, FindCommunitiesResult> = {
  name: "find_communities",
  klass: "D",
  async run(args, ctx) {
    const t0 = Date.now();

    // Fixture short-circuit — before any fetch
    if (fixturesEnabled()) {
      ctx.budget.charge({ toolCalls: 1, cents: 0 });
      const communities = fixtureCommunities(args.topic);
      await upsertRawDocument({
        subjectType: ctx.mode === "web" ? "web" : "app",
        subjectKey: args.subjectKey,
        sourceType: "communities",
        body: communities,
        mode: ctx.mode,
      });
      await recordPipelineRun({
        scanId: ctx.scanId,
        stage: "tool",
        costCents: 0,
        durationMs: Date.now() - t0,
      });
      return { communities };
    }

    ctx.budget.charge({ toolCalls: 1, cents: 0 });

    // HN Algolia + Bluesky are both free/public — run in parallel, degrade gracefully
    const [hnResult, bskyResult] = await Promise.allSettled([
      hnSearch(args.topic),
      blueskySearch(args.topic),
    ]);

    const communities: Community[] = [
      ...(hnResult.status === "fulfilled" ? hnResult.value : []),
      ...(bskyResult.status === "fulfilled" ? bskyResult.value : []),
    ];

    await upsertRawDocument({
      subjectType: ctx.mode === "web" ? "web" : "app",
      subjectKey: args.subjectKey,
      sourceType: "communities",
      body: communities,
      mode: ctx.mode,
    });

    await recordPipelineRun({
      scanId: ctx.scanId,
      stage: "tool",
      costCents: 0,
      durationMs: Date.now() - t0,
    });

    return { communities };
  },
};
