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
  return `You generate search queries to find people who HAVE a problem — not people who know a product.

PRODUCT (for context only — NEVER mention it in the queries):
- Brand: ${brief.brand}
- Problem it solves: ${brief.problem}
- For: ${brief.audience}
- Value: ${brief.valueProp}

Write ${count} short search queries (3–8 words) phrased the way someone SUFFERING this
problem would type them — their pain, their words. Mix: direct complaints, "how do I…"
questions, and "looking for a way to…" phrasings.

Return ONLY this JSON (no markdown fences):
{ "queries": ["...", "..."] }

Hard rules:
- NEVER include the brand "${brief.brand}" or any product/brand name.
- Express the PAIN or the GOAL, not a solution category buzzword.
- No quotes, no operators, no hashtags — plain phrases only.`;
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
 * Generate normalized pain queries for a brief. Fixtures-mode returns []
 * (the live dogfood needs a real Anthropic key). Never throws.
 */
export async function generatePainQueries(
  brief: ProductBrief,
  opts: { count?: number; scanId?: string | null } = {},
): Promise<string[]> {
  const count = opts.count ?? 10;
  if (fixturesEnabled()) return [];
  try {
    const { text } = await callModel({
      model: MODEL,
      system: "You generate search queries that find people describing a problem. Return only JSON.",
      prompt: buildPainQueryPrompt(brief, count),
      scanId: opts.scanId ?? null,
      stage: "extract",
    });
    return normalizePainQueries(parsePainQueries(text), brief.brand, count);
  } catch {
    return [];
  }
}
