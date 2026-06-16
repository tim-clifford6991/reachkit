/**
 * Demand discovery (M3) — intent classification.
 *
 * For each search hit, decide: is this a real person expressing the problem (a
 * potential buyer) vs. a generic discussion, listicle, or noise? Strictness here
 * is what keeps demand pockets trustworthy — a wrong "buyer" thread erodes trust
 * fast, so the bar is "someone actually has this problem right now".
 *
 * Prompt + parser + score-map are pure/exported; the LLM call is fixtures-aware.
 */

import { callModel } from "@/lib/llm/anthropic";
import { extractJson } from "@/lib/llm/json";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import type { DemandHit, ClassifiedHit } from "./types";

const MODEL = "claude-haiku-4-5-20251001" as const;
const MAX_HITS_PER_CALL = 30;

export function intentLabelToScore(label: string): number {
  switch (label.toLowerCase().trim()) {
    case "high":
      return 0.9;
    case "medium":
      return 0.6;
    case "low":
      return 0.3;
    default:
      return 0; // "none" / unknown
  }
}

export function buildClassifyPrompt(problem: string, hits: DemandHit[]): string {
  const list = hits
    .map((h, i) => `${i}. ${h.title}\n   ${h.snippet}`)
    .join("\n");
  return `A product solves this problem: "${problem}".

Below are search results. For EACH, judge whether it is a real person expressing
THIS problem (a potential buyer asking for a solution) vs. a generic article,
listicle, off-topic thread, or noise.

RESULTS:
${list}

Return ONLY this JSON (no fences), one entry per result index:
{ "results": [ { "i": 0, "buyerPain": true, "intent": "high|medium|low|none" } ] }

Rules:
- buyerPain=true ONLY when someone is actually describing the problem or asking for
  a solution. A "best X tools" article is NOT buyer pain.
- intent reflects how ready-to-buy the person sounds. Default to "none" when unsure.`;
}

/** Pure: align LLM classifications back onto the hits (defensive). */
export function parseClassifications(raw: string, hits: DemandHit[]): ClassifiedHit[] {
  let byIndex = new Map<number, { buyerPain: boolean; intent: number }>();
  try {
    const parsed = JSON.parse(extractJson(raw)) as { results?: unknown };
    const results = Array.isArray(parsed.results) ? parsed.results : [];
    for (const r of results) {
      const o = r as { i?: unknown; buyerPain?: unknown; intent?: unknown };
      const i = Number(o.i);
      if (!Number.isInteger(i)) continue;
      byIndex.set(i, {
        buyerPain: o.buyerPain === true,
        intent: intentLabelToScore(String(o.intent ?? "none")),
      });
    }
  } catch {
    byIndex = new Map();
  }

  return hits.map((hit, i) => {
    const c = byIndex.get(i);
    const buyerPain = c?.buyerPain ?? false;
    return { ...hit, isBuyerPain: buyerPain, intent: buyerPain ? c?.intent ?? 0 : 0 };
  });
}

/**
 * Classify hits by buyer-intent. Fixtures-mode marks all as non-pain (the live
 * run needs a real key). Batches to bound cost; never throws.
 */
export async function classifyHits(
  problem: string,
  hits: DemandHit[],
  opts: { scanId?: string | null } = {},
): Promise<ClassifiedHit[]> {
  if (hits.length === 0) return [];
  if (fixturesEnabled()) {
    return hits.map((h) => ({ ...h, isBuyerPain: false, intent: 0 }));
  }

  const out: ClassifiedHit[] = [];
  for (let i = 0; i < hits.length; i += MAX_HITS_PER_CALL) {
    const batch = hits.slice(i, i + MAX_HITS_PER_CALL);
    try {
      const { text } = await callModel({
        model: MODEL,
        system: "You judge whether search results show real buyer pain. Return only JSON.",
        prompt: buildClassifyPrompt(problem, batch),
        scanId: opts.scanId ?? null,
        stage: "critic",
      });
      out.push(...parseClassifications(text, batch));
    } catch {
      out.push(...batch.map((h) => ({ ...h, isBuyerPain: false, intent: 0 })));
    }
  }
  return out;
}
