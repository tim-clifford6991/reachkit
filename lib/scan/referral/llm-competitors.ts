/**
 * LLM competitor fallback for the reverse-referral engine.
 *
 * The SERP/Tavily + honesty-bar path returns honest-empty for low-presence apps
 * (e.g. nudgi.ai). But an app is rarely in a category of one — for the referral
 * engine we need a competitor SEED, so we ask the model for the closest
 * same-category products AS DOMAINS (the existing `competitor-names` helper
 * returns names only). Grounded with the homepage title/description when fetchable.
 */
import { callModel } from "@/lib/llm/anthropic";
import { extractJson } from "@/lib/llm/json";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";
import { normalizeHost } from "./classify";

const MODEL = "claude-haiku-4-5-20251001" as const;

export interface LlmCompetitor {
  name: string;
  domain: string;
}

export interface LlmCompetitorResult {
  competitors: LlmCompetitor[];
  category: string;
  promptPreview: string;
  rawResponse: string;
  tokensIn: number;
  tokensOut: number;
  blurb: string;
}

/** Best-effort homepage title + meta description to ground the model. Empty on failure. */
export async function fetchSiteBlurb(host: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(`https://${host}`, { redirect: "follow" }, 8000);
    if (!res.ok) return "";
    const html = (await res.text()).slice(0, 200_000);
    const title = /<title[^>]*>([^<]{0,200})<\/title>/i.exec(html)?.[1]?.trim() ?? "";
    const desc =
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,300})["']/i.exec(html)?.[1]?.trim() ??
      /<meta[^>]+content=["']([^"']{0,300})["'][^>]+name=["']description["']/i.exec(html)?.[1]?.trim() ??
      "";
    return [title, desc].filter(Boolean).join(" — ");
  } catch {
    return "";
  }
}

export function buildPrompt(productName: string, host: string, blurb: string, hints: string): string {
  return `Identify the most DIRECT competitors of ONE product — products a user would realistically switch BETWEEN to do the same core job.

SUBJECT:
- Name: ${productName}
- Site: ${host}
- What it is: ${blurb || "(infer from the name/domain)"}
${hints ? `\nSearch snippets (MAY reference a DIFFERENT product with a similar name — ignore anything that is not the subject described above):\n${hints.slice(0, 2500)}` : ""}

Think step by step, then output JSON:
1. State the subject's SPECIFIC micro-category in a few words (e.g. "AI meeting-prep briefing assistant", not "productivity software").
2. List only products in THAT SAME micro-category that solve the SAME core job for the SAME user. Order by directness (closest substitute first).

Return ONLY this JSON (no markdown fences, no prose before/after):
{ "category": "<the micro-category>", "competitors": [ { "name": "<product>", "domain": "<root domain>" } ] }

Hard rules:
- DIRECT substitutes only. A product in an ADJACENT category is WRONG — e.g. for a meeting-prep assistant, do NOT return call-recording / sales-intelligence / CRM / note-taking tools unless they do the SAME prep job.
- "domain" MUST be the company's REAL, CURRENT root domain (lowercase, no protocol/path), e.g. "otter.ai".
- DOMAIN ACCURACY OVER QUANTITY: if you are not confident of a competitor's exact real domain, OMIT that competitor entirely. Never guess or invent a domain. A short list of correct domains beats a long list with wrong ones.
- Return 2–5 competitors. Never include ${productName} itself, ${host}, directories/marketplaces (g2.com, capterra.com, producthunt.com), or generic platforms (google, notion, slack) unless they are a true direct substitute.`;
}

export function parse(raw: string): { competitors: LlmCompetitor[]; category: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return { competitors: [], category: "" };
  }
  const category = String((parsed as { category?: unknown }).category ?? "").trim();
  const list = (parsed as { competitors?: unknown }).competitors;
  if (!Array.isArray(list)) return { competitors: [], category };
  const seen = new Set<string>();
  const out: LlmCompetitor[] = [];
  for (const c of list) {
    const name = String((c as { name?: unknown } | null)?.name ?? "").trim();
    const domain = normalizeHost(String((c as { domain?: unknown } | null)?.domain ?? "").trim());
    if (!name || !domain || !domain.includes(".")) continue;
    if (seen.has(domain)) continue;
    seen.add(domain);
    out.push({ name, domain });
    if (out.length >= 6) break;
  }
  return { competitors: out, category };
}

// ---------------------------------------------------------------------------
// Category-search grounding (preferred path): infer the micro-category, search
// THAT category, then keep only same-category product domains from real results.
// ---------------------------------------------------------------------------

export interface CategoryInference {
  category: string;
  queries: string[];
  blurb: string;
  promptPreview: string;
  rawResponse: string;
  tokensIn: number;
  tokensOut: number;
}

export function buildCategoryPrompt(productName: string, host: string, blurb: string): string {
  return `A product is described below. Identify its SPECIFIC micro-category and the search queries that would surface OTHER real products in that exact category.

PRODUCT:
- Name: ${productName}
- Site: ${host}
- What it is: ${blurb || "(infer from the name/domain)"}

Return ONLY this JSON (no fences):
{ "category": "<specific micro-category, e.g. 'AI meeting-prep briefing assistant'>", "queries": ["<query 1>", "<query 2>"] }

Rules:
- "category" must be SPECIFIC (the exact job-to-be-done), not a broad label like "productivity software".
- Each query should find DIRECT competitor products in that category (e.g. "best AI meeting prep assistant tools", "<category> software for sales reps"). Do NOT include the product's own name in the queries.`;
}

export function parseCategory(raw: string): { category: string; queries: string[] } {
  try {
    const p = JSON.parse(extractJson(raw)) as { category?: unknown; queries?: unknown };
    const category = String(p.category ?? "").trim();
    const queries = Array.isArray(p.queries)
      ? p.queries.map((q) => String(q).trim()).filter(Boolean).slice(0, 3)
      : [];
    return { category, queries };
  } catch {
    return { category: "", queries: [] };
  }
}

export async function inferCategoryAndQueries(args: { productName: string; host: string }): Promise<CategoryInference> {
  const blurb = await fetchSiteBlurb(args.host);
  const empty: CategoryInference = { category: "", queries: [], blurb, promptPreview: "", rawResponse: "", tokensIn: 0, tokensOut: 0 };
  try {
    const prompt = buildCategoryPrompt(args.productName, args.host, blurb);
    const { text, usage } = await callModel({
      model: MODEL,
      system: "You classify a product into its specific micro-category and write search queries that find its direct competitors. Return only JSON.",
      prompt,
      scanId: null,
      stage: "extract",
    });
    const { category, queries } = parseCategory(text);
    return { category, queries, blurb, promptPreview: prompt.slice(0, 1000), rawResponse: text.slice(0, 800), tokensIn: usage.inputTokens, tokensOut: usage.outputTokens };
  } catch {
    return empty;
  }
}

export interface CandidateSelection {
  competitors: LlmCompetitor[];
  promptPreview: string;
  rawResponse: string;
  tokensIn: number;
  tokensOut: number;
}

export function buildSelectPrompt(
  productName: string,
  host: string,
  category: string,
  candidates: { domain: string; title: string }[],
): string {
  const list = candidates.map((c, i) => `${i + 1}. ${c.domain} — ${c.title}`).join("\n");
  return `Subject product: ${productName} (${host}). Category: ${category}.

Below are domains found by searching that category. Keep ONLY the ones that are REAL PRODUCTS directly competing with the subject in that exact category — a user would choose between them and the subject.

CANDIDATES:
${list.slice(0, 4000)}

Return ONLY this JSON (no fences):
{ "competitors": [ { "name": "<product>", "domain": "<one of the candidate domains, verbatim>" } ] }

Rules:
- Use ONLY domains from the candidate list above (do not invent or alter domains).
- Keep 2–5 closest direct competitors. Drop the subject itself, directories/marketplaces (g2, capterra, getapp, producthunt), listicle/review/media sites, and anything in a different category.
- If none of the candidates are real same-category competitors, return { "competitors": [] }.`;
}

export async function selectCompetitorsFromCandidates(args: {
  productName: string;
  host: string;
  category: string;
  candidates: { domain: string; title: string }[];
}): Promise<CandidateSelection> {
  const empty: CandidateSelection = { competitors: [], promptPreview: "", rawResponse: "", tokensIn: 0, tokensOut: 0 };
  if (args.candidates.length === 0) return empty;
  try {
    const prompt = buildSelectPrompt(args.productName, args.host, args.category, args.candidates);
    const { text, usage } = await callModel({
      model: MODEL,
      system: "You keep only the real, direct, same-category product competitors from a candidate list, using their exact domains. Return only JSON.",
      prompt,
      scanId: null,
      stage: "extract",
    });
    const allowed = new Set(args.candidates.map((c) => c.domain));
    const picked = parse(text).competitors.filter((c) => allowed.has(c.domain)); // never accept off-list domains
    return { competitors: picked, promptPreview: prompt.slice(0, 1000), rawResponse: text.slice(0, 800), tokensIn: usage.inputTokens, tokensOut: usage.outputTokens };
  } catch {
    return empty;
  }
}

// ---------------------------------------------------------------------------
// Closeness ranking — for the "top competitors to learn from" list (distinct from
// the size-banded referral cohort). Ranks candidates by how DIRECTLY they compete
// (same core job, same user), keeping the strongest direct rivals even if bigger.
// ---------------------------------------------------------------------------

export interface RankedCompetitor {
  domain: string;
  name: string;
  /** 1–5: 5 = near-identical offering for the same user; 1 = loosely adjacent. */
  closeness: number;
  reason: string;
}

export interface ClosenessResult {
  ranked: RankedCompetitor[];
  promptPreview: string;
  rawResponse: string;
  tokensIn: number;
  tokensOut: number;
}

export function buildClosenessPrompt(
  productName: string,
  host: string,
  blurb: string,
  category: string,
  candidates: { domain: string; title: string }[],
): string {
  const list = candidates.map((c, i) => `${i + 1}. ${c.domain} — ${c.title}`).join("\n");
  return `Rank how DIRECTLY each candidate competes with this product.

SUBJECT:
- Name: ${productName}
- Site: ${host}
- Category: ${category}
- What it does: ${blurb || "(infer from name/domain)"}

A DIRECT competitor solves the SAME core job for the SAME user — a buyer would seriously evaluate it instead of the subject. Strongest direct rivals belong at the top EVEN IF they are larger.

CANDIDATES:
${list.slice(0, 6000)}

Return ONLY a JSON array sorted by closeness (highest first), using ONLY candidate domains:
[ { "domain": "<candidate domain>", "name": "<product>", "closeness": 1-5, "reason": "<≤12 words: what makes it the same/different>" } ]

Scoring:
- 5 = same core job + same user (near-identical offering)
- 4 = same job, slightly different user or feature focus
- 3 = overlapping job, adjacent positioning
- 1–2 = loosely related / different category (exclude these)
Drop the subject itself, directories/marketplaces, listicles, and pure media.`;
}

export function parseCloseness(raw: string, allowed: Set<string>): RankedCompetitor[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return [];
  }
  const arr = Array.isArray(parsed) ? parsed : [];
  const seen = new Set<string>();
  const out: RankedCompetitor[] = [];
  for (const item of arr) {
    const o = item as Record<string, unknown>;
    const domain = normalizeHost(String(o["domain"] ?? "").trim());
    if (!domain || !allowed.has(domain) || seen.has(domain)) continue;
    const closeness = Math.max(1, Math.min(5, Math.round(Number(o["closeness"] ?? 0))));
    seen.add(domain);
    out.push({ domain, name: String(o["name"] ?? domain).trim(), closeness, reason: String(o["reason"] ?? "").trim() });
  }
  return out.sort((a, b) => b.closeness - a.closeness);
}

export async function rankClosestCompetitors(args: {
  productName: string;
  host: string;
  blurb: string;
  category: string;
  candidates: { domain: string; title: string }[];
}): Promise<ClosenessResult> {
  const empty: ClosenessResult = { ranked: [], promptPreview: "", rawResponse: "", tokensIn: 0, tokensOut: 0 };
  if (args.candidates.length === 0) return empty;
  try {
    const prompt = buildClosenessPrompt(args.productName, args.host, args.blurb, args.category, args.candidates);
    const { text, usage } = await callModel({
      model: MODEL,
      system: "You rank how directly products compete with one subject product. Keep the strongest direct rivals even if larger. Return only a JSON array.",
      prompt,
      scanId: null,
      stage: "extract",
    });
    const allowed = new Set(args.candidates.map((c) => c.domain));
    return { ranked: parseCloseness(text, allowed), promptPreview: prompt.slice(0, 1200), rawResponse: text.slice(0, 1500), tokensIn: usage.inputTokens, tokensOut: usage.outputTokens };
  } catch {
    return empty;
  }
}

/** Ask the model for same-category competitor domains. Never throws → empty on failure. */
export async function llmCompetitorDomains(args: {
  productName: string;
  host: string;
  hints?: string;
}): Promise<LlmCompetitorResult> {
  const empty: LlmCompetitorResult = {
    competitors: [],
    category: "",
    promptPreview: "",
    rawResponse: "",
    tokensIn: 0,
    tokensOut: 0,
    blurb: "",
  };
  try {
    const blurb = await fetchSiteBlurb(args.host);
    const prompt = buildPrompt(args.productName, args.host, blurb, args.hints ?? "");
    const { text, usage } = await callModel({
      model: MODEL,
      system:
        "You identify ONLY the direct, same-micro-category competitors of one product and give their real, current root domains. Omit any competitor whose exact domain you are unsure of. Return only JSON.",
      prompt,
      scanId: null,
      stage: "extract",
    });
    const { competitors, category } = parse(text);
    return {
      competitors,
      category,
      promptPreview: prompt.slice(0, 1200),
      rawResponse: text.slice(0, 1200),
      tokensIn: usage.inputTokens,
      tokensOut: usage.outputTokens,
      blurb,
    };
  } catch {
    return empty;
  }
}
