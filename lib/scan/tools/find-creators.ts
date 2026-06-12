import type { ToolDefinition } from "@/lib/tools/registry";
import type { Creator } from "@/lib/scan/types";
import { fixturesEnabled, fixtureCreators } from "@/lib/dev/fixtures";
import { youtubeSearch } from "@/lib/scan/adapters/youtube";
import { upsertRawDocument } from "@/lib/db/raw-documents";
import { recordPipelineRun } from "@/lib/telemetry/pipeline-runs";

export interface FindCreatorsArgs {
  competitors: string[];
  subjectKey: string;
}

export interface FindCreatorsResult {
  creators: Creator[];
}

export const findCreators: ToolDefinition<FindCreatorsArgs, FindCreatorsResult> = {
  name: "find_creators",
  klass: "D",
  async run(args, ctx) {
    const t0 = Date.now();

    // Fixture short-circuit — before any env-key use or fetch
    if (fixturesEnabled()) {
      ctx.budget.charge({ toolCalls: 1, cents: 0 });
      const creators = fixtureCreators(args.competitors);
      await upsertRawDocument({
        subjectType: ctx.mode === "web" ? "web" : "app",
        subjectKey: args.subjectKey,
        sourceType: "youtube",
        body: creators,
        mode: ctx.mode,
      });
      await recordPipelineRun({
        scanId: ctx.scanId,
        stage: "tool",
        costCents: 0,
        durationMs: Date.now() - t0,
      });
      return { creators };
    }

    ctx.budget.charge({ toolCalls: 1, cents: 0 });

    // One YouTube search per competitor — allSettled so a dead search degrades, doesn't throw
    const results = await Promise.allSettled(
      args.competitors.map((competitor) =>
        youtubeSearch(`${competitor} review`, competitor),
      ),
    );

    const creators: Creator[] = results.flatMap((r) =>
      r.status === "fulfilled" ? r.value : [],
    );

    await upsertRawDocument({
      subjectType: ctx.mode === "web" ? "web" : "app",
      subjectKey: args.subjectKey,
      sourceType: "youtube",
      body: creators,
      mode: ctx.mode,
    });

    await recordPipelineRun({
      scanId: ctx.scanId,
      stage: "tool",
      costCents: 0,
      durationMs: Date.now() - t0,
    });

    return { creators };
  },
};
