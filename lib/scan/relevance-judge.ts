/**
 * The LLM relevance judge (Phase B, 2026-07-22 — D3 in the product-contract
 * reset).
 *
 * The problem it fixes: category/niche relevance was decided by TOKEN OVERLAP —
 * a leader keyword counted as "the category" if it shared one stemmed token with
 * the category vocabulary. That is structurally too coarse to answer the only
 * question that matters — "is this keyword this business's market?" — a judgment
 * call, not a string match. Live symptom: mixpanel (product/mobile analytics)
 * chosen as usefathom's (web analytics) category leader pulled in "mobile app
 * analytics" phrases, and a generic "data analytics tools" (301k/mo) dominated
 * the market card, all on a shared "analytics" token.
 *
 * The fix: classify REAL keyword strings against the subject's actual business.
 * Numbers stay DataForSEO's — the judge only decides membership (category /
 * niche / irrelevant), never invents a volume (invariant #11-compatible:
 * classification of real data, never generation).
 *
 * Design (matches the `demand/classify.ts` house idiom — no zod, prompt-instructed
 * JSON + `extractJson` + defensive parse + degrade):
 *   - Verdicts are DATA: `judgeRelevance` returns a `Map<keyword, verdict>`; the
 *     pure card functions (`computeMarketFromLeader`, `computeCategoryDemand`)
 *     take it as an optional param and are unit-tested with replayed maps, so CI
 *     stays deterministic (no live LLM in tests).
 *   - LOCAL fallback: a keyword the judge did not rule on (omitted, or a total
 *     failure) has NO verdict, and the pure functions fall back to today's
 *     token-overlap for THAT keyword — so a partial/flaky judge only ever REFINES
 *     the result, never renders worse than the pre-judge heuristic (degrade,
 *     never invent).
 *   - Cache: a per-subject `fact_sheets` row of kind `relevance_verdicts`, merged
 *     and GROWN across scans (judge only the not-yet-cached candidates), version-
 *     stamped by `RELEVANCE_JUDGE_VERSION` so a prompt change invalidates old
 *     rows on read-back (invariant #3 / Task 2b). Never caches an empty map.
 *   - Cost rides the ambient free-report/​full-scan cost context via
 *     `callModel({ scanId: null })` (invariant #2).
 */

import { callModel } from "@/lib/llm/anthropic";
import { extractJson } from "@/lib/llm/json";
import { fixtures } from "@/lib/scan/fixture-seam";
import { getFreshFactSheet, upsertFactSheet, factSheetSubjectType } from "@/lib/scan/fact-sheets";
import { RELEVANCE_JUDGE_VERSION } from "@/lib/scan/fact-sheet-kind";

const MODEL = "claude-haiku-4-5-20251001" as const;
/** Bound the per-call candidate count (2 batches covers the ~80-string worst case). */
const MAX_CANDIDATES_PER_CALL = 40;
/** How many of the subject's real category rankings to show the judge as context. */
const CONTEXT_RANKED = 10;

export type RelevanceVerdict = "category" | "niche" | "irrelevant";
/** keyword (lowercased, trimmed) → verdict. Absence of a key ⇒ "not judged" ⇒
 *  the pure functions fall back to token-overlap for that keyword. */
export type RelevanceVerdicts = Map<string, RelevanceVerdict>;

/** What the judge needs to know about the subject to rule on relevance. */
export interface RelevanceSubject {
  host: string;
  name?: string;
  categoryLabel: string;
  nicheLabel: string;
  /** The subject's genuine category rankings (highest-volume first) — the ground
   *  truth for "what this business actually is", so the judge rules against
   *  reality, not just the LLM's category label. */
  rankedTerms?: string[];
}

const VERDICTS: ReadonlySet<string> = new Set<RelevanceVerdict>(["category", "niche", "irrelevant"]);

function normCandidate(s: string): string {
  return s.toLowerCase().trim();
}

export function buildRelevancePrompt(subject: RelevanceSubject, candidates: string[]): string {
  const ranked = (subject.rankedTerms ?? []).slice(0, CONTEXT_RANKED).filter(Boolean);
  const rankedLine = ranked.length > 0 ? `\n- Genuinely ranks in search for: ${ranked.join(", ")}` : "";
  const list = candidates.map((c, i) => `${i}. ${c}`).join("\n");
  return `A business:
- Name: ${subject.name || subject.host}
- Site: ${subject.host}
- Category (its broad market): ${subject.categoryLabel}
- Niche (its specific focus): ${subject.nicheLabel}${rankedLine}

Below are candidate search keywords. For EACH, decide how it relates to THIS
specific business:
- "category": a search in this business's core market — the query its target
  buyers make when looking for what it offers.
- "niche": a narrower search specific to this business's particular focus/angle.
- "irrelevant": adjacent-sounding but NOT this business's market — a different
  product type, a different audience, or a broad/generic term that merely shares
  a word with the category.

CANDIDATES:
${list}

Return ONLY this JSON (no fences), one entry per candidate index:
{ "verdicts": [ { "i": 0, "v": "category" } ] }

Rules:
- Judge against what THIS business actually does (its category + the terms it
  ranks for), NOT surface word overlap. Example: "mobile app analytics" for a
  WEBSITE analytics tool is "irrelevant" — a different product.
- A broad/generic term that merely contains a shared word but names a much wider
  or different market ("data analytics tools" for a niche web-analytics tool) is
  "irrelevant".
- Default to "irrelevant" when unsure.`;
}

/**
 * Pure: align the LLM's index-keyed verdicts back onto the candidate strings.
 * Defensive (never throws); an unparseable/omitted/invalid entry yields NO map
 * key for that candidate → the caller falls back to token-overlap for it.
 */
export function parseRelevanceVerdicts(raw: string, candidates: string[]): RelevanceVerdicts {
  const out: RelevanceVerdicts = new Map();
  let byIndex = new Map<number, RelevanceVerdict>();
  try {
    const parsed = JSON.parse(extractJson(raw)) as { verdicts?: unknown };
    const rows = Array.isArray(parsed.verdicts) ? parsed.verdicts : [];
    for (const r of rows) {
      const o = r as { i?: unknown; v?: unknown };
      const i = Number(o.i);
      if (!Number.isInteger(i)) continue;
      const v = String(o.v ?? "").toLowerCase().trim();
      if (!VERDICTS.has(v)) continue;
      byIndex.set(i, v as RelevanceVerdict);
    }
  } catch {
    byIndex = new Map();
  }
  candidates.forEach((c, i) => {
    const v = byIndex.get(i);
    if (v) out.set(normCandidate(c), v);
  });
  return out;
}

/** Serialize/deserialize the cached verdict map (fact_sheets body). */
type VerdictBody = { verdicts?: Record<string, string> };
function bodyToMap(body: unknown): RelevanceVerdicts {
  const out: RelevanceVerdicts = new Map();
  const rec = (body as VerdictBody)?.verdicts;
  if (rec && typeof rec === "object") {
    for (const [k, v] of Object.entries(rec)) {
      const vv = String(v).toLowerCase().trim();
      if (VERDICTS.has(vv)) out.set(normCandidate(k), vv as RelevanceVerdict);
    }
  }
  return out;
}
function mapToBody(m: RelevanceVerdicts): VerdictBody {
  return { verdicts: Object.fromEntries(m) };
}

async function judgeBatch(
  subject: RelevanceSubject,
  candidates: string[],
  scanId: string | null,
): Promise<RelevanceVerdicts> {
  try {
    const { text } = await callModel({
      model: MODEL,
      system:
        "You classify whether a search keyword belongs to a specific business's market. Return only JSON.",
      prompt: buildRelevancePrompt(subject, candidates),
      scanId,
      stage: "critic",
    });
    return parseRelevanceVerdicts(text, candidates);
  } catch {
    return new Map();
  }
}

/**
 * Judge each candidate keyword's relevance to the subject's business.
 *
 * Reads the per-subject verdict cache, judges only the not-yet-cached candidates
 * (one Haiku call per ≤40-candidate batch, batches in parallel), merges + grows
 * the cache, and returns the full map for every candidate that got a verdict.
 * Fixtures-mode returns an empty map (→ full token-overlap degrade, deterministic
 * tests). Never throws; a total failure returns an empty map.
 */
export async function judgeRelevance(
  subject: RelevanceSubject,
  candidates: string[],
  opts: { scanId?: string | null; mode?: "ios" | "android" | "web" } = {},
): Promise<RelevanceVerdicts> {
  const uniq = [...new Set(candidates.map(normCandidate).filter(Boolean))];
  if (uniq.length === 0) return new Map();
  if (fixtures()) return new Map();

  const subjectType = factSheetSubjectType(opts.mode ?? "web");
  const subjectKey = subject.host;

  // Read the growing per-subject cache (version-invalidated on read-back).
  let cached: RelevanceVerdicts = new Map();
  try {
    const sheet = await getFreshFactSheet(subjectType, subjectKey, "relevance_verdicts");
    if (sheet) cached = bodyToMap(sheet.body);
  } catch {
    cached = new Map();
  }

  const missing = uniq.filter((k) => !cached.has(k));
  if (missing.length === 0) return cached;

  const batches: string[][] = [];
  for (let i = 0; i < missing.length; i += MAX_CANDIDATES_PER_CALL) {
    batches.push(missing.slice(i, i + MAX_CANDIDATES_PER_CALL));
  }
  const fresh = (await Promise.all(batches.map((b) => judgeBatch(subject, b, opts.scanId ?? null))))
    .reduce((acc, m) => {
      for (const [k, v] of m) acc.set(k, v);
      return acc;
    }, new Map() as RelevanceVerdicts);

  const merged: RelevanceVerdicts = new Map([...cached, ...fresh]);
  // Never cache an empty map (invariant #3); only write when we learned something new.
  if (fresh.size > 0 && merged.size > 0) {
    try {
      await upsertFactSheet({
        subjectType,
        subjectKey,
        kind: "relevance_verdicts",
        body: mapToBody(merged),
        modelVersion: `haiku-${RELEVANCE_JUDGE_VERSION}`,
      });
    } catch {
      // best-effort cache write; the verdicts are still returned this scan
    }
  }
  return merged;
}
