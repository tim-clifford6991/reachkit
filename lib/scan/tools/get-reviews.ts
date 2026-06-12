import type { ToolDefinition } from "@/lib/tools/registry";
import type { ReviewItem } from "@/lib/scan/types";
import { fetchAppReviews } from "@/lib/scan/adapters/app-store-rss";
import { upsertRawDocument } from "@/lib/db/raw-documents";
import { recordPipelineRun } from "@/lib/telemetry/pipeline-runs";

export interface GetReviewsArgs {
  appId: string;
  subjectKey: string;
}

export interface GetReviewsResult {
  reviews: ReviewItem[];
}

export const getReviews: ToolDefinition<GetReviewsArgs, GetReviewsResult> = {
  name: "get_reviews",
  klass: "D",
  async run(args, ctx) {
    const t0 = Date.now();
    ctx.budget.charge({ toolCalls: 1, cents: 0 });

    const reviews = await fetchAppReviews(args.appId);

    await upsertRawDocument({
      subjectType: "app",
      subjectKey: args.subjectKey,
      sourceType: "app_store_rss",
      body: reviews,
      mode: ctx.mode,
    });

    await recordPipelineRun({
      scanId: ctx.scanId,
      stage: "tool",
      costCents: 0,
      durationMs: Date.now() - t0,
    });

    return { reviews };
  },
};
