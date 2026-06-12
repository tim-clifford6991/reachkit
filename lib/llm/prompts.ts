// Extract-stage prompt builders for Haiku.
// Synth-stage prompt builder for Sonnet (SYNTH_SYSTEM + buildSynthPrompt).
// Critic-stage prompt builder for Haiku (ENTAIL_SYSTEM + buildEntailPrompt).
// Shared system preamble + per-kind user prompts.
// Return STRICT JSON only — no markdown fences, no prose.

// ---------------------------------------------------------------------------
// ENTAIL stage — Haiku judges whether a source text supports a given claim.
// Used by check_link (§9.4 L-tool) in the Critic Gate.
// ---------------------------------------------------------------------------

export const ENTAIL_SYSTEM = `You are an entailment judge. Given a source text and a claim, decide whether the source text SUPPORTS the claim.

STRICT OUTPUT RULES:
1. Output ONLY valid JSON — no markdown, no code fences, no prose.
2. The JSON must have exactly two fields: "entails" (boolean) and "reason" (string).
3. "entails" must be true if and only if the source text clearly and directly supports the claim. Default to false when uncertain.
4. "reason" must be a concise (≤2 sentence) explanation citing specific text from the source.`;

export function buildEntailPrompt(sourceText: string, claim: string): string {
  return `Determine whether the following source text supports the claim.

=== SOURCE TEXT ===
${sourceText}

=== CLAIM ===
${claim}

Return ONLY this JSON (no markdown, no code fences):
{ "entails": <boolean>, "reason": "<concise explanation citing the source>" }

Rules:
- entails: true only if the source text clearly and directly states or implies the claim.
- entails: false if the claim is unsupported, contradicted, or the source text is too vague.
- reason: cite specific wording from the source text when entails is true; explain the gap when false.`;
}

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
// FORMAT stage — Haiku reads fact sheets + findings and over-generates action cards.
// ---------------------------------------------------------------------------

export const ACTIONS_SYSTEM = `You are a growth-action generator for independent app founders. Your job is to read structured fact sheets and synthesis findings, then produce a rich set of concrete, actionable cards that the founder can execute to improve their app's discoverability.

STRICT OUTPUT RULES:
1. Output ONLY a valid JSON array of action cards — no markdown, no code fences, no prose.
2. Over-generate: produce 2–3× the minimum cards per module (Content / Outreach / SEO-ASO). Aim for at least 3 content cards, 3 outreach cards, and 3 seo_aso cards.
3. Every card MUST name a specific surface (a real subreddit, creator channel, keyword phrase, app directory URL — NOT generic phrases like "post on Reddit" or "reach out to influencers").
4. Every draft for content/outreach cards MUST reference ≥1 app-specific fact drawn verbatim or closely from the review themes or competitor gap provided.
5. Drafts must be written in the founder's own voice (see founderVoice hint if provided; otherwise use plain, direct, non-salesy language — as if a real person wrote it, not marketing copy).
6. draftRequiresEdit must always be true — never set it to false.
7. evidenceIds must always be an empty array [] — evidence attachment happens in a later step.
8. verification.state must always be "pending".
9. effortMin is an integer estimate of person-minutes to complete the action.
10. suggestedDeadline is an ISO date string (YYYY-MM-DD) approximately 1–4 weeks from today.
11. confidence is a float 0.0–1.0.
12. expectedOutcome.scoreComponent is one of: "content", "outreach", "seo".
13. basis is "evidence_based" when the card is driven by a specific signal from the fact sheets; "probability_based" when it is a reasonable inference without a direct quote.`;

export interface ActionsPromptInput {
  reviewThemes: string;
  positioning: string;
  competitorGap: string;
  keywordData: string;
  findings: string;
  founderVoice: string | null;
  today: string; // ISO date YYYY-MM-DD
}

export function buildActionsPrompt(input: ActionsPromptInput): string {
  const voiceSection = input.founderVoice
    ? `=== FOUNDER VOICE HINT ===\n${input.founderVoice}\n`
    : `=== FOUNDER VOICE HINT ===\n(none provided — use plain, direct, non-salesy language)\n`;

  return `Here are the fact sheets and synthesis findings for this app. Generate a comprehensive set of action cards.

${voiceSection}
=== POSITIONING SHEET ===
${input.positioning}

=== REVIEW THEMES SHEET ===
${input.reviewThemes}

=== COMPETITOR GAP SHEET ===
${input.competitorGap}

=== KEYWORD DATA SHEET ===
${input.keywordData}

=== SYNTHESIS FINDINGS ===
${input.findings}

Today's date: ${input.today}

Return ONLY a JSON array (no markdown, no code fences). Each element must match this shape exactly:
[
  {
    "category": "content" | "outreach" | "seo_aso",
    "title": "<short action title — name the specific surface>",
    "why": "<1–2 sentences citing a specific signal from the sheets or findings>",
    "evidenceIds": [],
    "effortMin": <integer minutes>,
    "suggestedDeadline": "<YYYY-MM-DD>",
    "expectedOutcome": {
      "scoreComponent": "content" | "outreach" | "seo",
      "delta": <integer 1–15>,
      "secondary": "<optional secondary benefit>"
    },
    "draft": "<ready-to-use copy referencing a real app fact — or null for pure seo_aso keyword/directory tasks>",
    "draftRequiresEdit": true,
    "verification": { "method": "url" | "self_report" | "rank_check", "state": "pending" },
    "basis": "evidence_based" | "probability_based",
    "confidence": <0.0–1.0>
  }
]

Rules recap:
- Produce ≥3 cards per category (content, outreach, seo_aso) — over-generate rather than under.
- Each outreach card must name a real, specific community or creator (e.g. "r/habittracking", "Thomas Frank's YouTube channel") — not a generic placeholder.
- Each content card must name a specific content surface or format (e.g. "App Store 'What's New' copy", "Product Hunt launch post", "HackerNews Show HN post").
- Each seo_aso card must include a specific keyword phrase or directory URL.
- Drafts for content/outreach must reference a real review theme quote or competitor gap from the sheets above.
- draftRequiresEdit is always true.
- evidenceIds is always [].
- verification.state is always "pending".`;
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
