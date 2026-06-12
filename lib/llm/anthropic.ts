import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/config/env";
import { recordPipelineRun, anthropicCostCents } from "@/lib/telemetry/pipeline-runs";
import type { ModelId } from "@/lib/telemetry/pipeline-runs";

type Stage = "extract" | "synth" | "critic" | "format";

export async function callModel(args: {
  model: ModelId;
  system: string;
  prompt: string;
  scanId: string | null;
  stage: Stage;
  maxTokens?: number;
}): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } }> {
  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  const started = performance.now();

  const res = await client.messages.create({
    model: args.model,
    max_tokens: args.maxTokens ?? 2048,
    system: args.system,
    messages: [{ role: "user", content: args.prompt }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const inputTokens = res.usage.input_tokens;
  const outputTokens = res.usage.output_tokens;

  await recordPipelineRun({
    scanId: args.scanId,
    stage: args.stage,
    model: args.model,
    tokensIn: inputTokens,
    tokensOut: outputTokens,
    costCents: anthropicCostCents(args.model, inputTokens, outputTokens),
    durationMs: Math.round(performance.now() - started),
  });

  return { text, usage: { inputTokens, outputTokens } };
}
