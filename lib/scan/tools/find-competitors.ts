import type { ToolDefinition } from "@/lib/tools/registry";
import type { Competitor } from "@/lib/scan/types";
import type { FactsExtras } from "./types";
import { appIdFromUrl, fetchItunesCompetitors } from "@/lib/scan/adapters/itunes";
import { liveSerpAlternatives } from "@/lib/scan/adapters/dataforseo";
import { fetchPhByName } from "@/lib/scan/adapters/product-hunt";
import { tavilyAlternatives } from "@/lib/scan/adapters/tavily";
import { rankCompetitors } from "@/lib/scan/competitors";
import { upsertRawDocument } from "@/lib/db/raw-documents";
import { recordPipelineRun } from "@/lib/telemetry/pipeline-runs";
import { hostname } from "@/lib/scan/url";

export interface FindCompetitorsArgs {
  productName: string;
  storeUrl: string;
  subjectKey: string;
}

export interface FindCompetitorsResult {
  competitors: Competitor[];
  extras: FactsExtras;
}

export const findCompetitors: ToolDefinition<FindCompetitorsArgs, FindCompetitorsResult> = {
  name: "find_competitors",
  klass: "D",
  async run(args, ctx) {
    const t0 = Date.now();

    if (ctx.mode === "web") {
      ctx.budget.charge({ toolCalls: 3, cents: 1 });

      const [serpResult, phResult, tavilyResult] = await Promise.allSettled([
        liveSerpAlternatives(args.productName),
        fetchPhByName(args.productName),
        tavilyAlternatives(args.productName),
      ]);

      const serp =
        serpResult.status === "fulfilled"
          ? serpResult.value
          : { competitors: [], serpResultCount: 0, raw: null };
      const ph =
        phResult.status === "fulfilled"
          ? phResult.value
          : { selfUpvotes: 0, neighbours: [], raw: null };
      const tavily =
        tavilyResult.status === "fulfilled"
          ? tavilyResult.value
          : { competitors: [], raw: null };

      // Persist only fulfilled sources
      const persistPromises: Promise<unknown>[] = [];
      if (serpResult.status === "fulfilled") {
        persistPromises.push(
          upsertRawDocument({
            subjectType: "web",
            subjectKey: args.subjectKey,
            sourceType: "dataforseo_serp",
            body: serp.raw,
            mode: ctx.mode,
          }),
        );
      }
      if (phResult.status === "fulfilled") {
        persistPromises.push(
          upsertRawDocument({
            subjectType: "web",
            subjectKey: args.subjectKey,
            sourceType: "product_hunt",
            body: ph.raw,
            mode: ctx.mode,
          }),
        );
      }
      if (tavilyResult.status === "fulfilled") {
        persistPromises.push(
          upsertRawDocument({
            subjectType: "web",
            subjectKey: args.subjectKey,
            sourceType: "tavily",
            body: tavily.raw,
            mode: ctx.mode,
          }),
        );
      }
      await Promise.all(persistPromises);

      const all: Competitor[] = [
        ...serp.competitors,
        ...ph.neighbours,
        ...tavily.competitors,
      ];
      const competitors = rankCompetitors(all, { selfHost: hostname(args.storeUrl) });

      await recordPipelineRun({
        scanId: ctx.scanId,
        stage: "tool",
        costCents: 1,
        durationMs: Date.now() - t0,
      });

      return {
        competitors,
        extras: {
          serpResultCount: serp.serpResultCount ?? 0,
          phUpvotes: ph.selfUpvotes ?? 0,
        },
      };
    }

    // app mode (ios / android)
    ctx.budget.charge({ toolCalls: 1, cents: 0 });

    const appId = appIdFromUrl(args.storeUrl);
    const cands = await fetchItunesCompetitors(args.productName, appId);
    const competitors = rankCompetitors(cands);

    await upsertRawDocument({
      subjectType: "app",
      subjectKey: args.subjectKey,
      sourceType: "itunes_search",
      body: cands,
      mode: ctx.mode,
    });

    await recordPipelineRun({
      scanId: ctx.scanId,
      stage: "tool",
      costCents: 0,
      durationMs: Date.now() - t0,
    });

    return { competitors, extras: {} };
  },
};
