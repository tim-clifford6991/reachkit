import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/config/env";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { recordPipelineRun, anthropicCostCents } from "@/lib/telemetry/pipeline-runs";
import { currentScanId } from "@/lib/scan/cost-context";
import type { ModelId } from "@/lib/telemetry/pipeline-runs";

type Stage = "extract" | "synth" | "critic" | "format";

export async function callModel(args: {
  model: ModelId;
  system: string;
  prompt: string;
  /**
   * The scan to bill this call to. Pass `null` to inherit the ambient costed
   * step's scanId (`currentScanId()`) — every call inside `costedStep` /
   * `costedIntelStep` therefore attributes automatically, without threading a
   * scanId through every generator signature. Only a call made outside ANY
   * costed step stays unattributed (invariant #2).
   */
  scanId: string | null;
  stage: Stage;
  maxTokens?: number;
}): Promise<{
  text: string;
  usage: { inputTokens: number; outputTokens: number };
  /** Anthropic stop_reason — "max_tokens" means the output was TRUNCATED and
   *  callers producing long-form content must continue or retry, never ship
   *  the cut-off text. */
  stopReason: string | null;
}> {
  // Fixtures mode makes zero paid calls; LLM-derived fields are intentionally empty in this mode.
  if (fixturesEnabled()) return { text: "", usage: { inputTokens: 0, outputTokens: 0 }, stopReason: null };
  const client = new Anthropic({ apiKey: env.anthropicApiKey });
  const started = performance.now();

  const res = await client.messages.create({
    model: args.model,
    // Default suits Haiku extraction; synth/critic callers should pass a higher maxTokens.
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

  // Telemetry row written only on success: a thrown SDK error (network/rate-limit/auth)
  // exits before this point, records no row, and is correct — Anthropic does not bill
  // failed requests and there are no token counts to record.
  await recordPipelineRun({
    // Fall back to the ambient costed step (invariant #2): a caller that passes
    // no scanId still bills the scan it is running under, so LLM spend can never
    // silently become an unattributable `scan_id = NULL` row.
    scanId: args.scanId ?? currentScanId(),
    stage: args.stage,
    model: args.model,
    tokensIn: inputTokens,
    tokensOut: outputTokens,
    costCents: anthropicCostCents(args.model, inputTokens, outputTokens),
    durationMs: Math.round(performance.now() - started),
  });

  return { text, usage: { inputTokens, outputTokens }, stopReason: res.stop_reason ?? null };
}
