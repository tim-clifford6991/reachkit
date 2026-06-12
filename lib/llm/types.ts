// Fact-sheet body shapes produced by the EXTRACT stage (Task 4) and consumed by SYNTH (Task 5).
// Keep these in sync with the prompts in lib/llm/prompts.ts.

// ---------------------------------------------------------------------------
// SYNTH stage output types (Task 5)
// ---------------------------------------------------------------------------

export interface FindingEvidence { excerpt: string; source: string; }
export interface Finding {
  category: "content" | "outreach" | "seo_aso";
  claim: string;
  basis: "evidence_based" | "probability_based";
  confidence: number;
  evidence: FindingEvidence[];
}
export interface PositioningMirror { listingSays: string; reviewsValue: string; gap: string; }
export interface SampleAction {
  category: "content" | "outreach" | "seo_aso";
  title: string;
  why: string;
  draft: string;
}
export interface SynthResult {
  positioningMirror: PositioningMirror;
  findings: Finding[];
  sampleAction: SampleAction;
}

// ---------------------------------------------------------------------------
// SCORE types (Task 5) — preliminary discoverability score
// ---------------------------------------------------------------------------
export interface ScoreResult {
  total: number;
  breakdown: { content: number; outreach: number; seo: number };
}

export interface ReviewThemesSheet {
  themes: Array<{
    theme: string;
    sentiment: "positive" | "negative" | "mixed";
    quote: string;
    evidenceIds: number[];
  }>;
}

export interface PositioningSheet {
  category: string;
  claims: string[];
  valueProps: string[];
}

export interface CompetitorGapSheet {
  competitors: Array<{
    name: string;
    positioning: string;
    gap: string;
  }>;
}

export interface KeywordSheet {
  clusters: Array<{
    theme: string;
    keywords: Array<{
      keyword: string;
      volume: number;
    }>;
  }>;
}

// Empty (degrade) sheet shapes — used when source is absent or model output is unparseable.
export const EMPTY_REVIEW_THEMES: ReviewThemesSheet = { themes: [] };
export const EMPTY_POSITIONING: PositioningSheet = { category: "", claims: [], valueProps: [] };
export const EMPTY_COMPETITOR_GAP: CompetitorGapSheet = { competitors: [] };
export const EMPTY_KEYWORD_SHEET: KeywordSheet = { clusters: [] };
