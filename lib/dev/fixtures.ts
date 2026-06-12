import type { Competitor, KeywordRow } from "@/lib/scan/types";
import type { ReviewThemesSheet, PositioningSheet, CompetitorGapSheet, KeywordSheet } from "@/lib/llm/types";
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
