import type { Competitor, KeywordRow } from "@/lib/scan/types";
import type { ReviewThemesSheet, PositioningSheet, CompetitorGapSheet, KeywordSheet, SynthResult } from "@/lib/llm/types";
import type { FactSheetKind } from "@/lib/scan/fact-sheets";
import { env } from "@/lib/config/env";

export function useFixtures(): boolean {
  return env.useFixtures;
}

// Realistic canned data so the funnel is demoable without keys.
export function fixtureSerp(productName: string): { competitors: Competitor[]; serpResultCount: number; raw: unknown } {
  return {
    competitors: [
      { name: `${productName} alternative — Habitify`, url: "https://habitify.me", source: "dataforseo_serp", rank: 1 },
      { name: `${productName} vs Streaks`, url: "https://streaksapp.com", source: "dataforseo_serp", rank: 2 },
    ],
    serpResultCount: 842000,
    raw: { fixture: true },
  };
}

export function fixtureTavily(productName: string): { competitors: Competitor[]; raw: unknown } {
  return {
    competitors: [{ name: `Top ${productName} alternatives`, url: "https://www.notion.so", source: "tavily", rank: 1 }],
    raw: { fixture: true },
  };
}

export function fixturePh(_productName: string): { selfUpvotes: number; neighbours: Competitor[]; raw: unknown } {
  return {
    selfUpvotes: 312,
    neighbours: [{ name: "Habitify", url: "https://habitify.me", source: "product_hunt", rank: 1 }],
    raw: { fixture: true },
  };
}

export function fixtureKeywords(seeds: string[]): { keywords: KeywordRow[]; raw: unknown } {
  return {
    keywords: seeds.slice(0, 5).map((k, i) => ({ keyword: k, volume: 1200 - i * 100, cpc: 1.2, competition: 0.4 })),
    raw: { fixture: true },
  };
}

// ---------------------------------------------------------------------------
// Extract-stage fixture providers — realistic bodies for the 4 fact-sheet kinds.
// Used by runExtract() when useFixtures()=true so the findings flow works with no Anthropic key.
// ---------------------------------------------------------------------------
const FIXTURE_REVIEW_THEMES: ReviewThemesSheet = {
  themes: [
    { theme: "Ease of use", sentiment: "positive", quote: "incredibly easy to get started", evidenceIds: [] },
    { theme: "Habit streaks", sentiment: "positive", quote: "the streak feature keeps me going", evidenceIds: [] },
    { theme: "Crashes on older iOS", sentiment: "negative", quote: "crashes every time on my iPhone 11", evidenceIds: [] },
    { theme: "Widget support", sentiment: "mixed", quote: "widget is nice but doesn't refresh reliably", evidenceIds: [] },
  ],
};

const FIXTURE_POSITIONING: PositioningSheet = {
  category: "Health & Fitness",
  claims: [
    "Build habits in 21 days",
    "Trusted by 500,000+ users",
    "Science-backed habit formation",
  ],
  valueProps: [
    "Daily habit streaks with visual progress",
    "Reminder notifications at custom times",
    "Minimalist, distraction-free interface",
  ],
};

const FIXTURE_COMPETITOR_GAP: CompetitorGapSheet = {
  competitors: [
    {
      name: "Habitify",
      positioning: "Data-rich habit analytics with beautiful charts",
      gap: "Simpler onboarding and lower cognitive load for new users",
    },
    {
      name: "Streaks",
      positioning: "Apple Watch-first with tight iOS integration",
      gap: "Cross-platform Android support and web access",
    },
    {
      name: "Finch",
      positioning: "Emotional wellness framing around a virtual pet",
      gap: "Direct, no-fluff habit tracking without gamification overhead",
    },
  ],
};

const FIXTURE_KEYWORD_SHEET: KeywordSheet = {
  clusters: [
    {
      theme: "Habit tracking",
      keywords: [
        { keyword: "habit tracker app", volume: 8100 },
        { keyword: "daily habit tracker", volume: 5400 },
        { keyword: "best habit tracker", volume: 3600 },
      ],
    },
    {
      theme: "Productivity",
      keywords: [
        { keyword: "daily routine app", volume: 4400 },
        { keyword: "productivity app ios", volume: 2900 },
      ],
    },
    {
      theme: "Wellness",
      keywords: [
        { keyword: "wellness habit app", volume: 1900 },
        { keyword: "mindfulness daily habits", volume: 1200 },
      ],
    },
  ],
};

export function fixtureExtract(
  kind: FactSheetKind,
): ReviewThemesSheet | PositioningSheet | CompetitorGapSheet | KeywordSheet {
  switch (kind) {
    case "review_themes":  return FIXTURE_REVIEW_THEMES;
    case "positioning":    return FIXTURE_POSITIONING;
    case "competitor_gap": return FIXTURE_COMPETITOR_GAP;
    case "keyword_data":   return FIXTURE_KEYWORD_SHEET;
  }
}

// ---------------------------------------------------------------------------
// Synth-stage fixture — a realistic SynthResult for demo/test without Anthropic key.
// 3 findings, each with ≥1 evidence excerpt drawn from the extract fixtures above.
// ---------------------------------------------------------------------------
export function fixtureSynth(): SynthResult {
  return {
    positioningMirror: {
      listingSays: "Build habits in 21 days with science-backed streaks, trusted by 500,000+ users",
      reviewsValue: "Users prize the streak feature for maintaining consistency, but report crashes on older iOS and widget reliability issues",
      gap: "The listing emphasises rapid habit formation (21 days) and social proof, but users actually value persistence tools (streaks, reminders) and reliable widgets — the stability issues undercut the premium promise",
    },
    findings: [
      {
        category: "content",
        claim: "The listing's '21-day' headline claim is unsupported in user reviews — reviewers focus on streak consistency, not timeline outcomes. Reframing the description around long-term streak maintenance would better match demonstrated user value.",
        basis: "evidence_based",
        confidence: 0.85,
        evidence: [
          { excerpt: "the streak feature keeps me going", source: "review_themes" },
          { excerpt: "Build habits in 21 days", source: "positioning" },
          { excerpt: "Daily habit streaks with visual progress", source: "positioning" },
        ],
      },
      {
        category: "seo_aso",
        claim: "The top-volume keyword cluster 'habit tracker' (8,100/mo + 5,400 'daily habit tracker') is not reflected in the current listing title or description — closing this gap is the single highest-ROI ASO action.",
        basis: "evidence_based",
        confidence: 0.92,
        evidence: [
          { excerpt: "habit tracker app", source: "keyword_data" },
          { excerpt: "daily habit tracker", source: "keyword_data" },
          { excerpt: "Minimalist, distraction-free interface", source: "positioning" },
        ],
      },
      {
        category: "outreach",
        claim: "Habitify positions on analytics complexity; Streaks positions on Apple Watch. Neither owns 'simple habit building' — the app's stated differentiator. This gap creates a clear narrative for creator outreach targeting productivity audiences who've churned from data-heavy tools.",
        basis: "evidence_based",
        confidence: 0.78,
        evidence: [
          { excerpt: "Simpler onboarding and lower cognitive load for new users", source: "competitor_gap" },
          { excerpt: "Data-rich habit analytics with beautiful charts", source: "competitor_gap" },
          { excerpt: "incredibly easy to get started", source: "review_themes" },
        ],
      },
    ],
    sampleAction: {
      category: "seo_aso",
      title: "Inject 'habit tracker' keyword cluster into listing title + first description paragraph",
      why: "8,100 monthly searches for 'habit tracker app' with no top competitor owning the phrase in title — a low-effort, high-visibility ASO win",
      draft: "HabitKit — Daily Habit Tracker\n\nBuild lasting habits with HabitKit, the simplest habit tracker app for iOS. Track your daily routines, maintain streaks, and see real progress — no analytics overwhelm, just the tools you need to show up every day.",
    },
  };
}
