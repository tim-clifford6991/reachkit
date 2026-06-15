import type { Competitor } from "@/lib/scan/types";
import type { ScanContext } from "@/lib/scan/pipeline";
import { callModel } from "@/lib/llm/anthropic";
import { extractJson } from "@/lib/llm/json";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { NON_PRODUCT_NAMES } from "@/lib/scan/competitor-filter";

const MODEL = "claude-haiku-4-5-20251001" as const;

export interface CompetitorNameInput {
  subjectName: string;
  subjectHost: string;
  category: string;
  content: string;
}

export function buildCompetitorNamesPrompt(i: CompetitorNameInput): string {
  return `You are identifying the real competitors of ONE specific product.

SUBJECT — the ONLY product to analyse:
- Name: ${i.subjectName}
- Site: ${i.subjectHost}
- Category: ${i.category || "(infer from the content)"}

Below is text scraped from "alternatives to ${i.subjectName}" search results. It may
mention products in OTHER categories that merely share the name — IGNORE THOSE.

CONTENT:
${i.content.slice(0, 6000)}

Return ONLY this JSON (no markdown fences):
{ "competitors": [ { "name": "<real product name>" } ] }

Hard rules:
- List up to 8 products that genuinely compete with ${i.subjectName} in the SAME category (${i.category || "the subject's category"}).
- NEVER include a different product that merely shares part of the subject's name.
- NEVER include ${i.subjectName} itself, ${i.subjectHost}, or generic listicle/review sites (g2, capterra, "top 10", "best …").
- NEVER include forum/community artifacts or thread titles (e.g. "Ask HN", "Show HN", "Hacker News", "Reddit", "r/…", "Quora").
- Names only — no URLs, no commentary. If nothing genuinely competes, return { "competitors": [] }.`;
}

export function parseCompetitorNames(raw: string): Competitor[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return [];
  }
  // Guard against a model that returns valid JSON with a non-array `competitors`
  // (e.g. {"competitors": 42} or an object) — for...of on a non-iterable would throw.
  const rawList = (parsed as { competitors?: unknown }).competitors;
  const list: unknown[] = Array.isArray(rawList) ? rawList : [];
  const seen = new Set<string>();
  const out: Competitor[] = [];
  for (const c of list) {
    const name = String((c as { name?: unknown } | null)?.name ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (NON_PRODUCT_NAMES.has(key)) continue; // forum/listicle artifacts, never products
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, url: "", source: "llm_extracted", rank: out.length + 1 });
    if (out.length >= 8) break;
  }
  return out;
}

/** Reads the alternatives content and returns category-matched competitor names. Never throws. */
export async function extractCompetitorNames(
  ctx: ScanContext,
  input: CompetitorNameInput,
): Promise<Competitor[]> {
  if (!input.content.trim()) return [];
  if (fixturesEnabled()) return []; // fixtures already provide a clean competitor set
  try {
    const { text } = await callModel({
      model: MODEL,
      system: "You identify the real competitors of one specific product. Return only JSON, no prose.",
      prompt: buildCompetitorNamesPrompt(input),
      scanId: ctx.scanId,
      stage: "extract",
    });
    return parseCompetitorNames(text);
  } catch {
    return [];
  }
}
