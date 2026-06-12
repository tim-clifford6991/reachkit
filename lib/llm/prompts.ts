// Extract-stage prompt builders for Haiku.
// Synth-stage prompt builder for Sonnet (SYNTH_SYSTEM + buildSynthPrompt).
// Shared system preamble + per-kind user prompts.
// Return STRICT JSON only — no markdown fences, no prose.

export const EXTRACT_SYSTEM = `You are a data-extraction assistant. Your job is to read raw app-store and web evidence and compress it into structured JSON facts. Be concise and accurate. Output ONLY valid JSON — no markdown, no code fences, no explanations.`;

// --- review_themes ---
// Input: concatenated review text (title + body per review)
// Output: ReviewThemesSheet
export function reviewThemesPrompt(rawReviews: string): string {
  return `Extract the top recurring themes from these app reviews. For each theme identify whether sentiment is positive, negative, or mixed, and pick a short representative quote directly from the reviews.

Reviews:
${rawReviews}

Return ONLY this JSON (no markdown):
{
  "themes": [
    { "theme": "<string>", "sentiment": "positive"|"negative"|"mixed", "quote": "<verbatim short quote>", "evidenceIds": [] }
  ]
}

Rules:
- Include 3–8 themes.
- quote must be a verbatim excerpt (≤20 words) from the review text.
- evidenceIds: always an empty array (IDs are attached by the pipeline, not by you).
- If there are no reviews, return { "themes": [] }.`;
}

// --- positioning ---
// Input: app listing text (name, category, description)
// Output: PositioningSheet
export function positioningPrompt(rawListing: string): string {
  return `Extract the app's positioning from this listing data.

Listing:
${rawListing}

Return ONLY this JSON (no markdown):
{
  "category": "<App Store category or inferred category>",
  "claims": ["<marketing claim 1>", "..."],
  "valueProps": ["<value proposition 1>", "..."]
}

Rules:
- claims: explicit marketing statements made in the listing (2–6 items).
- valueProps: the functional benefits the app promises (2–6 items).
- If data is sparse, return short arrays; never invent content not supported by the text.`;
}

// --- competitor_gap ---
// Input: competitor search results (names, URLs, snippets)
// Output: CompetitorGapSheet
export function competitorGapPrompt(rawCompetitors: string): string {
  return `Identify the main competitors and the gap the target app fills versus each one.

Competitor data:
${rawCompetitors}

Return ONLY this JSON (no markdown):
{
  "competitors": [
    { "name": "<competitor name>", "positioning": "<1–2 sentence positioning summary>", "gap": "<1 sentence gap the target app fills vs this competitor>" }
  ]
}

Rules:
- Include up to 5 competitors.
- positioning: what the competitor emphasises based on the data.
- gap: what the target app offers that this competitor does not, inferred from the search results.
- If no competitor data, return { "competitors": [] }.`;
}

// --- keyword_data ---
// Input: keyword rows (keyword, volume, cpc, competition)
// Output: KeywordSheet
export function keywordDataPrompt(rawKeywords: string): string {
  return `Group these keywords into thematic clusters.

Keywords (keyword | monthly volume | cpc | competition):
${rawKeywords}

Return ONLY this JSON (no markdown):
{
  "clusters": [
    {
      "theme": "<cluster theme name>",
      "keywords": [
        { "keyword": "<keyword>", "volume": <number> }
      ]
    }
  ]
}

Rules:
- Produce 2–5 clusters.
- Each keyword belongs to exactly one cluster.
- Sort clusters by total cluster volume descending.
- If no keyword data, return { "clusters": [] }.`;
}

// ---------------------------------------------------------------------------
// SYNTH stage — Sonnet reads FACT SHEETS ONLY (§13), never raw text.
// ---------------------------------------------------------------------------

export const SYNTH_SYSTEM = `You are a product-growth strategist. You read structured fact sheets extracted from app-store listings, user reviews, competitor data, and keyword research. Your job is to synthesise these facts into actionable findings for a B2B SaaS client.

STRICT RULES:
1. Output ONLY valid JSON — no markdown, no code fences, no prose.
2. Every "claim" in a finding MUST be supported by at least one "evidence" excerpt drawn verbatim from the provided fact sheets.
3. Produce EXACTLY 3 findings and EXACTLY 1 sampleAction.
4. All findings use basis "evidence_based" — probability-based is reserved for when no supporting quote exists.
5. confidence is a float 0.0–1.0.
6. sampleAction.draft must be a realistic, ready-to-use copy snippet or outreach message that references real content from the fact sheets.`;

export function buildSynthPrompt(sheets: {
  reviewThemes: string;
  positioning: string;
  competitorGap: string;
  keywordData: string;
}): string {
  return `Here are the fact sheets for this app. Synthesise them into a SynthResult.

=== POSITIONING SHEET ===
${sheets.positioning}

=== REVIEW THEMES SHEET ===
${sheets.reviewThemes}

=== COMPETITOR GAP SHEET ===
${sheets.competitorGap}

=== KEYWORD DATA SHEET ===
${sheets.keywordData}

Return ONLY this JSON (no markdown, no code fences):
{
  "positioningMirror": {
    "listingSays": "<1–2 sentences: what the listing claims or emphasises>",
    "reviewsValue": "<1–2 sentences: what users actually praise or complain about in reviews>",
    "gap": "<1 sentence: the key disconnect between listing claims and review reality>"
  },
  "findings": [
    {
      "category": "content" | "outreach" | "seo_aso",
      "claim": "<1–2 sentence actionable finding>",
      "basis": "evidence_based",
      "confidence": <0.0–1.0>,
      "evidence": [
        { "excerpt": "<verbatim quote from a fact sheet>", "source": "review_themes" | "positioning" | "competitor_gap" | "keyword_data" }
      ]
    }
  ],
  "sampleAction": {
    "category": "content" | "outreach" | "seo_aso",
    "title": "<short action title>",
    "why": "<1 sentence rationale citing a specific signal from the sheets>",
    "draft": "<ready-to-use copy: App Store description snippet, outreach message, or keyword phrase>"
  }
}

Rules:
- findings: EXACTLY 3 items, one per growth category (content, outreach, seo_aso) where possible.
- Each finding must have ≥1 evidence item with a verbatim excerpt from the fact sheets above.
- sampleAction: EXACTLY 1 item, choose the highest-confidence category.
- Do not invent data not present in the fact sheets.`;
}
