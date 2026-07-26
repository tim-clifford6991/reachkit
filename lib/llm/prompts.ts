// Extract-stage prompt builders for Haiku.
// Synth-stage prompt builder for Sonnet (SYNTH_SYSTEM + buildSynthPrompt).
// Critic-stage prompt builder for Haiku (ENTAIL_SYSTEM + buildEntailPrompt).
// Shared system preamble + per-kind user prompts.
// Return STRICT JSON only — no markdown fences, no prose.

import type { ActionGrounding } from "@/lib/llm/grounding";

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
- Always respond in English, translating if the listing is in another language.
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
4. Every draft for content/outreach cards MUST reference ≥1 app-specific fact drawn verbatim or closely from the competitor gap provided.
5. Drafts must be written in the founder's own voice (see founderVoice hint if provided; otherwise use plain, direct, non-salesy language — as if a real person wrote it, not marketing copy).
6. draftRequiresEdit must always be true — never set it to false.
7. evidenceIds must always be an empty array [] — evidence attachment happens in a later step.
8. verification.state must always be "pending".
9. effortMin is an integer estimate of person-minutes to complete the action.
10. suggestedDeadline is an ISO date string (YYYY-MM-DD) approximately 1–4 weeks from today.
11. confidence is a float 0.0–1.0.
12. expectedOutcome.scoreComponent is one of: "content", "outreach", "seo".
13. basis is "evidence_based" when the card is driven by a specific signal from the fact sheets; "probability_based" when it is a reasonable inference without a direct quote.
14. evidence is an array of ≥2 items drawn from ≥2 distinct sourceTypes. Each item has: excerpt (verbatim quote from the fact sheets), source (the name of the fact sheet or URL if available), sourceType (one of: "app_store_rss", "dataforseo_serp", "communities", "dataforseo_keywords", "positioning", "competitor_gap", "keyword_data"). You MUST include at least 2 evidence items from at least 2 different sourceTypes per card.
15. BRAND-AMBIGUITY HARD RULE: generate actions ONLY for the subject product identified in the prompt (by its URL) and described by the fact sheets. NEVER introduce competitors, facts, acquisitions, or claims from outside/training knowledge — especially about other products whose names merely resemble the subject's. If it is not in the fact sheets, do not use it.
16. GROUNDING: every outreach card MUST set "target" to a REAL venue drawn from the COMMUNITIES list in the prompt — never invent a community. Use the exact label and URL given. If no suitable named venue exists, set target to null and do NOT fabricate one.
17. Every seo_aso comparison/alternative card MUST name a real competitor from the NAMED COMPETITORS list; if that list is empty, frame the action around the category keyword, not a made-up rival.
18. "target.channel" must be one of: community, creator, directory, media, podcast, newsletter, partner, x.
19. GROWTH-STAGE HONESTY (A4): the FOOTPRINT block states whether this is an ESTABLISHED product (already ranks for real keywords / has search presence) or a genuine pre-launch one. For an ESTABLISHED product, EVERY card must be a GROWTH move — win the keyword gaps it doesn't yet rank for, pursue the directories/communities/press its competitors are found in, relaunch on surfaces like Product Hunt where apt, deepen pages that under-rank. NEVER recommend pre-launch VALIDATION for an established product: no "ship a waitlist", no "validate demand first", no "decide whether to keep/pivot", no "run a landing-page test to see if anyone wants this". A live product with real users needs distribution and ranking wins, not proof it should exist.`;

export interface ActionsPromptInput {
  storeUrl: string;
  positioning: string;
  competitorGap: string;
  keywordData: string;
  findings: string;
  founderVoice: string | null;
  today: string; // ISO date YYYY-MM-DD
  grounding: ActionGrounding;
  /** A4 (2026-07-26): the subject's real search footprint, so the generator frames
   *  ESTABLISHED products with growth moves (never pre-launch validation). null =
   *  unknown → treated as established (a scanned live product is the common case;
   *  genuine pre-launch products route to the cold-start template, not here). */
  footprint?: { keywordsRanked: number | null };
}

export function buildActionsPrompt(input: ActionsPromptInput): string {
  const voiceSection = input.founderVoice
    ? `=== FOUNDER VOICE HINT ===\n${input.founderVoice}\n`
    : `=== FOUNDER VOICE HINT ===\n(none provided — use plain, direct, non-salesy language)\n`;

  // A4: state growth stage explicitly so rule 19 (growth-not-validation) binds.
  const ranked = input.footprint?.keywordsRanked ?? null;
  const footprintSection =
    ranked != null && ranked > 0
      ? `=== FOOTPRINT (growth stage) ===\nESTABLISHED product — already ranks for ${ranked.toLocaleString()} keyword${ranked === 1 ? "" : "s"} in search. Every card must be a GROWTH move (win gaps, pursue rivals' channels, relaunch where apt) — NEVER pre-launch validation (no waitlist / "validate demand" / "decide whether to pivot").\n`
      : `=== FOOTPRINT (growth stage) ===\nESTABLISHED product (a live, scanned site). Recommend growth moves — distribution + ranking wins — never pre-launch validation.\n`;

  const g = input.grounding;
  const competitorsBlock = g.competitors.length
    ? g.competitors.map((c) => `- ${c.name}${c.positioning ? ` — ${c.positioning}` : ""} (mentioned ${c.themMentions}× in tracked communities; you: ${c.youMentions}×)`).join("\n")
    : "(none discovered)";
  const communitiesBlock = g.communities.length
    ? g.communities.map((c) => `- ${c.title} [${c.source}] ${c.url} (engagement ${c.engagement})`).join("\n")
    : "(none discovered)";

  const groundingSection = `=== NAMED COMPETITORS (real, brand-validated — mention counts from tracked communities) ===
${competitorsBlock}

=== COMMUNITIES RANKED BY ENGAGEMENT (real venues to post in — use these exact names/URLs) ===
${communitiesBlock}
`;

  return `SUBJECT — generate actions ONLY for this product, and ignore any same-/similar-named product you may know of: ${input.storeUrl}

Here are the fact sheets and synthesis findings for this app. Generate a comprehensive set of action cards.

${voiceSection}
=== POSITIONING SHEET ===
${input.positioning}

=== COMPETITOR GAP SHEET ===
${input.competitorGap}

=== KEYWORD DATA SHEET ===
${input.keywordData}

=== SYNTHESIS FINDINGS ===
${input.findings}

${groundingSection}
${footprintSection}
Today's date: ${input.today}

Return ONLY a JSON array (no markdown, no code fences). Each element must match this shape exactly:
[
  {
    "category": "content" | "outreach" | "seo_aso",
    "title": "<short action title — name the specific surface>",
    "why": "<1–2 sentences citing a specific signal from the sheets or findings>",
    "evidenceIds": [],
    "evidence": [
      { "excerpt": "<verbatim quote from fact sheet>", "source": "<fact sheet name or URL>", "sourceType": "<one of: app_store_rss | dataforseo_serp | communities | dataforseo_keywords | positioning | competitor_gap | keyword_data>" },
      { "excerpt": "<verbatim quote from a DIFFERENT sourceType>", "source": "<fact sheet name or URL>", "sourceType": "<different sourceType from above>" }
    ],
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
    ,"target": { "channel": "community" | "creator" | "directory" | "media" | "podcast" | "newsletter" | "partner" | "x", "label": "<exact venue name from the grounding, e.g. 'r/productivity'>", "url": "<direct URL if known, else omit>" } | null
  }
]

Rules recap:
- Produce ≥3 cards per category (content, outreach, seo_aso) — over-generate rather than under.
- Each outreach card must name a real, specific community — use a venue from the COMMUNITIES list above — and set "target" to that exact venue; never use a generic placeholder.
- Each content card must name a specific content surface or format (e.g. "App Store 'What's New' copy", "Product Hunt launch post", "HackerNews Show HN post").
- Each seo_aso card must include a specific keyword phrase or directory URL.
- Drafts for content/outreach must reference a real competitor gap from the sheets above.
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
6. sampleAction.draft must be a realistic, ready-to-use copy snippet or outreach message that references real content from the fact sheets.
7. BRAND-AMBIGUITY HARD RULE: analyse ONLY the subject product identified in the prompt (by its URL) and described by the fact sheets. NEVER introduce facts, competitors, acquisitions, funding, or claims from outside/training knowledge — especially about other products whose names merely resemble the subject's. If it is not in the fact sheets, it does not exist for this analysis.`;

export function buildSynthPrompt(
  sheets: {
    positioning: string;
    competitorGap: string;
    keywordData: string;
  },
  identity: { storeUrl: string },
): string {
  return `SUBJECT — analyse ONLY this product, and ignore any same-/similar-named product you may know of: ${identity.storeUrl}

Here are the fact sheets for this app. Synthesise them into a SynthResult.

=== POSITIONING SHEET ===
${sheets.positioning}

=== COMPETITOR GAP SHEET ===
${sheets.competitorGap}

=== KEYWORD DATA SHEET ===
${sheets.keywordData}

Return ONLY this JSON (no markdown, no code fences):
{
  "positioningMirror": {
    "listingSays": "<1–2 sentences: what the listing claims or emphasises>",
    "reviewsValue": "<MUST always be the empty string \"\" — reviews are not collected for this product. NEVER infer reviews from the listing or invent them.>",
    "gap": "<1–2 sentences: the key disconnect between listing claims and the product's actual positioning. When the COMPETITOR GAP SHEET names competitors, name at least ONE of them and state the concrete angle where the subject wins or loses vs that rival>",
    "intendedAudience": ["<2–4 word audience descriptor the page is written FOR>", "..."],
    "actualAudience": ["<2–4 word audience the page actually reads AS>", "..."]
  },
  "categorySeeds": ["<a real search phrase a buyer would type for this PRODUCT CATEGORY>", "..."],
  "findings": [
    {
      "category": "content" | "outreach" | "seo_aso",
      "claim": "<1–2 sentence actionable finding>",
      "basis": "evidence_based",
      "confidence": <0.0–1.0>,
      "evidence": [
        { "excerpt": "<verbatim quote from a fact sheet>", "source": "positioning" | "competitor_gap" | "keyword_data" }
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
- positioningMirror.gap: prefer a concrete, named contrast — cite a competitor from the COMPETITOR GAP SHEET when one exists (never one you know from outside the sheets). Only fall back to a competitor-free disconnect when the sheet lists none.
- intendedAudience / actualAudience: 2–4 SHORT audience descriptors each (e.g. "indie SaaS founders", "data-driven acquirers"). These are PEOPLE, not features — never the brand name, a keyword, or a phrase like "updated hourly".
- categorySeeds: 3–5 SHORT, HIGH-VOLUME head category search terms — the common, broad way buyers search for a tool in this space, usually 2–3 words (e.g. "scheduling software", "appointment booking", "saas marketplace", "meeting assistant"). PREFER the broad head term ("scheduling software") over long-tail phrasings ("automated online meeting booking app") — head terms have real search volume, long-tail ones are near-zero. NOT the brand name, NOT a competitor's name, NOT a feature. If the category is genuinely unclear from the sheets, return fewer rather than guessing.
- Do not invent data not present in the fact sheets.`;
}

// ---------------------------------------------------------------------------
// SYNTH LITE — the FREE-tier teaser. The free report renders ONLY the positioning
// mirror + category seeds; the findings/sampleAction (which drive the PAID action
// plan) are regenerated by the deep pass on the full model. Generating only the
// two rendered fields cuts the output ~800 tokens → ~280, which is the real
// latency lever (generation time is linear in output tokens). Same grounding +
// brand-ambiguity rules as the full synth. Parsed by the SAME `parseSynthResult`
// (absent findings/sampleAction degrade to safe defaults — never rendered on free).
// ---------------------------------------------------------------------------

export const SYNTH_SYSTEM_LITE = `You are a product-growth strategist. You read structured fact sheets extracted from a product's listing and competitor data, and produce a concise positioning mirror plus two labeled market seeds: CATEGORY (the broad industry umbrella) and NICHE (the specific sub-space).

STRICT RULES:
1. Output ONLY valid JSON — no markdown, no code fences, no prose.
2. reviewsValue MUST always be the empty string "" — reviews are not collected for this product. NEVER infer reviews from the listing or invent them.
3. BRAND-AMBIGUITY HARD RULE: analyse ONLY the subject product identified by its URL and described by the fact sheets. NEVER introduce facts, competitors, acquisitions, or claims from outside/training knowledge — especially about other products whose names merely resemble the subject's. If it is not in the fact sheets, it does not exist for this analysis.`;

export function buildSynthPromptLite(
  sheets: { positioning: string; competitorGap: string },
  identity: { storeUrl: string },
): string {
  return `SUBJECT — analyse ONLY this product, and ignore any same-/similar-named product you may know of: ${identity.storeUrl}

Here are the fact sheets for this product. Produce a positioning mirror + category/niche market seeds.

=== POSITIONING SHEET ===
${sheets.positioning}

=== COMPETITOR GAP SHEET ===
${sheets.competitorGap}

Return ONLY this JSON (no markdown, no code fences):
{
  "positioningMirror": {
    "listingSays": "<1–2 sentences: what the listing claims or emphasises>",
    "reviewsValue": "<MUST always be the empty string \"\" — reviews are not collected for this product. NEVER infer reviews from the listing or invent them.>",
    "gap": "<1–2 sentences: the key disconnect between listing claims and the product's actual positioning. When the COMPETITOR GAP SHEET names competitors, name at least ONE of them and state the concrete angle where the subject wins or loses vs that rival>",
    "intendedAudience": ["<2–4 word audience descriptor the page is written FOR>", "..."],
    "actualAudience": ["<2–4 word audience the page actually reads AS>", "..."]
  },
  "category": {
    "label": "<2-4 word label for the BROAD INDUSTRY UMBRELLA this product sits in, e.g. 'SEO tooling', 'Scheduling software'>",
    "phrases": ["<5-8 DISTINCT category search terms buyers type, 2-3 words each, e.g. 'web analytics', 'website analytics', 'analytics software', 'google analytics alternative'>", "..."]
  },
  "niche": {
    "label": "<2-4 word label for the SPECIFIC sub-space this product actually competes in, e.g. 'SEO competitor tracking', 'Scheduling for consultants'>",
    "phrases": ["<4-8 BUYER-INTENT search phrases for this product's differentiation — competitor-alternative + differentiation attributes, e.g. 'google analytics alternative', 'cookieless analytics', 'gdpr compliant analytics'>", "..."]
  },
  "categoryLeaders": ["<a well-known LEADER domain in this category, e.g. 'ahrefs.com'>", "..."]
}

Rules:
- positioningMirror.gap: prefer a concrete, named contrast — cite a competitor from the COMPETITOR GAP SHEET when one exists (never one you know from outside the sheets). Only fall back to a competitor-free disconnect when the sheet lists none.
- intendedAudience / actualAudience: 2–4 SHORT audience descriptors each (e.g. "indie SaaS founders", "data-driven acquirers"). These are PEOPLE, not features — never the brand name, a keyword, or a phrase like "updated hourly".
- category: the BROAD INDUSTRY UMBRELLA this product belongs to — think "what section of a software directory would this be filed under", not "what exactly does this product do". label = 2–4 words naming that umbrella. phrases = a BASKET of 5–8 DISTINCT, high-volume category search terms buyers actually type (2–3 words each, e.g. for a web analytics tool: "web analytics", "website analytics", "analytics software", "web analytics tools", "site analytics", "google analytics alternative"). These are SUMMED to size the market, so name several DISTINCT queries (not re-phrasings of one) that together span the category — NOT a single broad word ("analytics", "website" alone are too broad and inflate the number), NOT the brand name, NOT a competitor's name, NOT a feature.
- niche: the SPECIFIC sub-space this product actually competes in, sized by HOW ITS BUYERS ACTUALLY SEARCH — not just the positioning label. label = 2–4 words. phrases = 4–8 BUYER-INTENT search phrases: competitor-alternative/switching queries ("google analytics alternative", "ga4 alternative"), the product's differentiation attributes as buyers search them ("cookieless analytics", "gdpr compliant analytics", "privacy focused analytics"), and specific use-cases. Every niche phrase MUST share a real topic word with the category (niche ⊆ category — "privacy tools" is NOT the niche of an analytics product; "cookieless analytics" IS). These are real, distinct queries with real volume — not a single narrow exact-match phrase nobody types.
- Both label fields are cosmetic names for the market, not search phrases themselves — do not put a label string into the phrases array.
- categoryLeaders: 2–3 real, well-known DOMAINS that clearly LEAD this category (bare hostnames, e.g. "ahrefs.com", "semrush.com" for SEO tools; "calendly.com" for scheduling). These size the real market — pick recognizable category leaders, NOT the subject itself, NOT a tiny/unknown site. If you are not confident of a real leader domain, return fewer or an empty array rather than guessing — a wrong domain sizes the wrong market. NEVER a made-up domain.
- If the category or niche is genuinely unclear from the sheets, return fewer phrases rather than guessing — NEVER volumes, NEVER the brand name, NEVER a competitor name.
- Do NOT output findings, sampleAction, or any other field — only positioningMirror, category, niche, and categoryLeaders.
- Do not invent data not present in the fact sheets.`;
}

// ---------------------------------------------------------------------------
// CRITIC stage — Sonnet reviews a single ActionCard for quality (§9.2)
// ---------------------------------------------------------------------------

export const CRITIC_SYSTEM = `You are a quality-control critic for indie-app growth action cards. Your job is to review a proposed action card and judge it on three LLM-checkable rules, then optionally revise it.

STRICT OUTPUT RULES:
1. Output ONLY valid JSON — no markdown, no code fences, no prose.
2. The JSON must have exactly these fields:
   - "specificityOk" (boolean): true if the card names a SPECIFIC, real surface (real subreddit like "r/habittracking", real creator name, exact keyword phrase, or exact directory URL) — false if it uses vague category-level language like "post on Reddit", "reach out to influencers", or "target productivity keywords".
   - "draftCitesFact" (boolean): true if the draft (or the "why" field for null-draft cards) cites a concrete, app-specific fact — a real review theme quote, a specific competitor name/gap, or a specific keyword with volume. False if the draft is generic marketing copy with no concrete app-specific anchor.
   - "audienceHonest" (boolean): true if the card is honest about audience dynamics — if the target community is newcomer-hostile (e.g. HN, indie communities where self-promotion is frowned upon), the card should use "participate first" / "share your learning" framing, NOT "post your app" / "promote your app". For communities that welcome app posts (e.g. Product Hunt, r/SideProject), true is fine for direct promotion. For creator outreach cards, true unless the pitch is purely transactional.
   - "revised" (optional ActionCard): if ANY of the three checks is false AND the card is fixable, include a revised version of the full action card that addresses the failures. Omit "revised" if all checks pass OR if the card is not fixable (e.g. the core concept is fundamentally non-specific and can't be rescued with wording changes).

3. When revising:
   - Fix specificityOk by naming a real, specific surface drawn from the fact context provided.
   - Fix draftCitesFact by adding a concrete app-specific fact (review quote, competitor name, keyword volume) to the draft.
   - Fix audienceHonest by reframing promotional language to participatory language.
   - Preserve all other fields (category, effortMin, evidenceIds, evidence, suggestedDeadline, expectedOutcome, draftRequiresEdit, verification, basis, confidence).
   - draftRequiresEdit must always remain true.`;

export interface CriticPromptInput {
  card: unknown; // The ActionCard JSON (serialised)
  factContext: string; // Relevant fact-sheet excerpts to ground revisions
}

export function buildCriticPrompt(input: CriticPromptInput): string {
  return `Review this action card and return the critic JSON.

=== ACTION CARD ===
${JSON.stringify(input.card, null, 2)}

=== FACT CONTEXT (use to ground any revisions) ===
${input.factContext}

Return ONLY this JSON (no markdown, no code fences):
{
  "specificityOk": <boolean>,
  "draftCitesFact": <boolean>,
  "audienceHonest": <boolean>,
  "revised": <optional full ActionCard — include only if at least one check is false AND the card is fixable>
}

Rules:
- specificityOk: true only if the card names a real, specific surface (not a category placeholder).
- draftCitesFact: true only if the draft (or why for null-draft cards) contains a concrete app-specific anchor — a verbatim review quote, a specific competitor name, or a keyword with a number.
- audienceHonest: true unless the card promotes in a community where self-promotion is unwelcome without prior participation.
- revised: include only when needed (at least one check false AND fixable). Omit when all pass or when not fixable.
- If you include revised, it must be a complete, valid ActionCard with draftRequiresEdit: true.`;
}
