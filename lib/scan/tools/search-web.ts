import type { ToolDefinition } from "@/lib/tools/registry";
import type { Competitor } from "@/lib/scan/types";
import { tavilyAlternatives } from "@/lib/scan/adapters/tavily";
import { upsertRawDocument } from "@/lib/db/raw-documents";
import { recordPipelineRun } from "@/lib/telemetry/pipeline-runs";

export interface SearchWebArgs {
  productName: string;
}

export interface SearchWebResult {
  competitors: Competitor[];
}

export const searchWeb: ToolDefinition<SearchWebArgs, SearchWebResult> = {
  name: "search_web",
  klass: "D",
  async run(args, ctx) {
    const t0 = Date.now();
    ctx.budget.charge({ toolCalls: 1, cents: 1 });

    const result = await tavilyAlternatives(args.productName);

    await upsertRawDocument({
      subjectType: "web",
      subjectKey: args.productName,
      sourceType: "tavily",
      body: result.raw,
      mode: ctx.mode,
    });

    await recordPipelineRun({
      scanId: ctx.scanId,
      stage: "tool",
      costCents: 1,
      durationMs: Date.now() - t0,
    });

    return { competitors: result.competitors };
  },
};
