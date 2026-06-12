// Extract-stage prompt builders for Haiku.
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
