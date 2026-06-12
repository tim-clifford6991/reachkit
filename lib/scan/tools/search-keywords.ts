import type { ToolDefinition } from "@/lib/tools/registry";
import type { KeywordRow } from "@/lib/scan/types";
import { keywordsData } from "@/lib/scan/adapters/keywords";
import { useFixtures } from "@/lib/dev/fixtures";
import { upsertRawDocument } from "@/lib/db/raw-documents";
import { recordPipelineRun } from "@/lib/telemetry/pipeline-runs";

export interface SearchKeywordsArgs {
  seeds: string[];
  subjectKey: string;
}

export interface SearchKeywordsResult {
  keywords: KeywordRow[];
}

export const searchKeywords: ToolDefinition<SearchKeywordsArgs, SearchKeywordsResult> = {
  name: "search_keywords",
  klass: "D",
  async run(args, ctx) {
    const t0 = Date.now();
    const costCents = useFixtures() ? 0 : 1;
    ctx.budget.charge({ toolCalls: 1, cents: costCents });

    const { keywords, raw } = await keywordsData(args.seeds);

    await upsertRawDocument({
      subjectType: "web",
      subjectKey: args.subjectKey,
      sourceType: "dataforseo_keywords",
      body: raw,
      mode: ctx.mode,
    });

    await recordPipelineRun({
      scanId: ctx.scanId,
      stage: "tool",
      costCents,
      durationMs: Date.now() - t0,
    });

    return { keywords };
  },
};
