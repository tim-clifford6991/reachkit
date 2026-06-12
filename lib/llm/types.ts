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
// Frozen so callers cannot accidentally mutate the shared reference.
export const EMPTY_REVIEW_THEMES: ReviewThemesSheet = Object.freeze({ themes: [] as ReviewThemesSheet["themes"] });
export const EMPTY_POSITIONING: PositioningSheet = Object.freeze({ category: "", claims: [] as string[], valueProps: [] as string[] });
export const EMPTY_COMPETITOR_GAP: CompetitorGapSheet = Object.freeze({ competitors: [] as CompetitorGapSheet["competitors"] });
export const EMPTY_KEYWORD_SHEET: KeywordSheet = Object.freeze({ clusters: [] as KeywordSheet["clusters"] });

// ---------------------------------------------------------------------------
// FORMAT stage output types (Task 6) — §10.2 action cards
// ---------------------------------------------------------------------------

export interface ActionCard {
  category: "content" | "outreach" | "seo_aso";
  title: string;
  why: string;
  evidenceIds: number[];                 // populated later by the Critic/evidence step; [] from generation
  effortMin: number;
  suggestedDeadline: string;             // ISO date
  expectedOutcome: { scoreComponent: string; delta: number; secondary?: string };
  draft: string | null;                  // present for content/outreach; null for some seo
  draftRequiresEdit: boolean;            // §11: always true
  verification: { method: "url" | "self_report" | "rank_check"; state: "pending" };
  basis: "evidence_based" | "probability_based";
  confidence: number;                    // 0..1
}
