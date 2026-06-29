/**
 * Demand discovery (M3) — pain-query generation.
 *
 * Turns a product brief into search phrasings a SUFFERER would type — in their
 * own words, never the brand name — so we find people describing the problem
 * rather than people who already know the product. Prompt + parser + normalize
 * are pure/exported for unit tests; the LLM call is fixtures-aware.
 */

import { callModel } from "@/lib/llm/anthropic";
import { extractJson } from "@/lib/llm/json";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import type { ProductBrief } from "./types";

const MODEL = "claude-haiku-4-5-20251001" as const;

export function buildPainQueryPrompt(brief: ProductBrief, count: number): string {
  return `You generate search queries to find people who HAVE a specific problem — not people who know a product, and NOT the broad category.

PRODUCT (context only — NEVER mention it in the queries):
- Brand: ${brief.brand}
- Problem it solves: ${brief.problem}
- For: ${brief.audience}
- Value: ${brief.valueProp}

Break THIS product's problem into 4–6 distinct sub-angles that ${brief.audience} actually
experience, and for EACH angle write 2 short search queries (3–8 words) phrased the way
someone SUFFERING that specific angle would type them — their pain, their words.

CRITICAL: stay tightly anchored to THIS product's exact problem and audience. Do NOT drift
to generic "${brief.problem.split(" ").slice(-2).join(" ")}"-style category terms that would
surface unrelated discussions. Every query must describe the pain of someone who would be a
genuine buyer of THIS product.

Return ONLY this JSON (no markdown fences):
{ "angles": [ { "angle": "<2-4 word label of the sub-problem>", "queries": ["...", "..."] } ] }

Hard rules:
- NEVER include the brand "${brief.brand}" or any product/brand name.
- Express the PAIN or the GOAL, not a solution category buzzword.
- No quotes, no operators, no hashtags — plain phrases only. Aim for ~${count} queries total.`;
}

export function parsePainQueries(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return [];
  }
  const list = (parsed as { queries?: unknown }).queries;
  return Array.isArray(list) ? list.map((q) => String(q ?? "")) : [];
}

/**
 * Clean a raw query list: trim, drop empties / too-short / brand-mentioning,
 * dedupe case-insensitively, cap to `cap`. PURE.
 */
export function normalizePainQueries(queries: string[], brand: string, cap: number): string[] {
  const brandLc = brand.trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of queries) {
    const q = raw.replace(/["']/g, "").trim();
    if (q.length < 8) continue; // too short to be a meaningful pain phrase
    if (q.split(/\s+/).length < 2) continue;
    const lc = q.toLowerCase();
    if (brandLc && lc.includes(brandLc)) continue; // never search the brand itself
    if (seen.has(lc)) continue;
    seen.add(lc);
    out.push(q);
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * Generate product-grounded pain queries, each tagged with the PRODUCT-RELEVANT
 * angle (sub-problem) it explores — so the community search stays on-topic and the
 * results classify by a meaningful theme. Fixtures-mode returns []. Never throws.
 */
export async function generatePainQueries(
  brief: ProductBrief,
  opts: { count?: number; scanId?: string | null } = {},
): Promise<Array<{ query: string; theme: string }>> {
  const count = opts.count ?? 10;
  if (fixturesEnabled()) return [];
  try {
    const { text } = await callModel({
      model: MODEL,
      system: "You generate search queries that find people describing a SPECIFIC product's problem. Return only JSON.",
      prompt: buildPainQueryPrompt(brief, count),
      scanId: opts.scanId ?? null,
      stage: "extract",
    });
    const parsed = JSON.parse(extractJson(text)) as { angles?: Array<{ angle?: unknown; queries?: unknown }>; queries?: unknown };
    const angles = Array.isArray(parsed?.angles) ? parsed.angles : [];
    const out: Array<{ query: string; theme: string }> = [];
    const seen = new Set<string>();
    const push = (q: string, theme: string) => {
      const lc = q.toLowerCase();
      if (seen.has(lc)) return;
      seen.add(lc);
      out.push({ query: q, theme });
    };
    for (const a of angles) {
      const theme = String(a?.angle ?? "").trim() || "Problem";
      for (const q of normalizePainQueries(Array.isArray(a?.queries) ? a.queries.map(String) : [], brief.brand, 99)) {
        push(q, theme);
        if (out.length >= count) return out;
      }
    }
    // Fallback: the model returned a flat { queries: [...] } (or no angles) — still usable.
    if (out.length === 0 && Array.isArray(parsed?.queries)) {
      for (const q of normalizePainQueries(parsed.queries.map(String), brief.brand, count)) push(q, "Problem");
    }
    return out.slice(0, count);
  } catch {
    return [];
  }
}
