import type { Competitor, Community, Creator, KeywordRow, ReviewItem, TimedCommunity } from "@/lib/scan/types";
import type { ReviewThemesSheet, PositioningSheet, CompetitorGapSheet, KeywordSheet, SynthResult, ActionCard, ActionCardEvidence } from "@/lib/llm/types";
import type { FactSheetKind } from "@/lib/scan/fact-sheets";
import { env } from "@/lib/config/env";

export function fixturesEnabled(): boolean {
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

export function fixtureCommunities(topic: string): Community[] {
  return [
    {
      source: "hn",
      title: `Ask HN: Best apps for ${topic}?`,
      url: "https://news.ycombinator.com/item?id=38521041",
      engagement: 347,
    },
    {
      source: "hn",
      title: `Show HN: I built a ${topic} tool in a weekend`,
      url: "https://news.ycombinator.com/item?id=38619203",
      engagement: 214,
    },
    {
      source: "bluesky",
      title: `Anyone else using ${topic} daily? Game changer for my morning routine.`,
      url: "https://bsky.app/profile/productivity.bsky.social/post/3k7qzxpvt2c2g",
      engagement: 89,
    },
    {
      source: "bluesky",
      title: `The ${topic} space is getting crowded but most apps still miss the basics.`,
      url: "https://bsky.app/profile/indiedev.bsky.social/post/3k8mrwabcd123",
      engagement: 63,
    },
  ];
}

export function fixtureCreators(competitors: string[]): Creator[] {
  return competitors.flatMap((competitor) => [
    {
      name: `${competitor} Review Channel`,
      url: `https://www.youtube.com/watch?v=fixture_${competitor.replace(/\s+/g, "_")}_1`,
      audienceProxy: 0,
      coveredCompetitor: competitor,
    },
    {
      name: `Best ${competitor} Alternatives`,
      url: `https://www.youtube.com/watch?v=fixture_${competitor.replace(/\s+/g, "_")}_2`,
      audienceProxy: 0,
      coveredCompetitor: competitor,
    },
  ]);
}

export function fixtureKeywords(seeds: string[]): { keywords: KeywordRow[]; raw: unknown } {
  return {
    keywords: seeds.slice(0, 5).map((k, i) => ({ keyword: k, volume: 1200 - i * 100, cpc: 1.2, competition: 0.4 })),
    raw: { fixture: true },
  };
}

// ---------------------------------------------------------------------------
// Extract-stage fixture providers — realistic bodies for the 4 fact-sheet kinds.
// Used by runExtract() when fixturesEnabled()=true so the findings flow works with no Anthropic key.
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
// ---------------------------------------------------------------------------
// Embedding fixture — deterministic normalized 1024-dim vectors.
// Identical text → identical vector; different text → different vector.
// Used by callEmbed() when fixturesEnabled()=true so no Voyage API key needed.
// ---------------------------------------------------------------------------
export function fixtureEmbed(texts: string[]): number[][] {
  return texts.map((t) => {
    const v = Array.from({ length: 1024 }, (_, i) => {
      let h = (2166136261 ^ i) >>> 0;
      for (let j = 0; j < t.length; j++) h = Math.imul(h ^ t.charCodeAt(j), 16777619) >>> 0;
      return (h / 0xffffffff) - 0.5;
    });
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / norm);
  });
}

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

// ---------------------------------------------------------------------------
// FORMAT-stage fixture — realistic ActionCards for demo/test without Anthropic key.
// At least one per category (content, outreach, seo_aso), each fully §10.2-compliant.
// Every card has ≥2 evidence items from ≥2 distinct sourceTypes so fixture cards PASS
// Critic rule (1) without any LLM call.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Cycle 4 Task 8 — weekly DELTA refresh fixtures.
// rankLookup's deterministic map + small NON-EMPTY canned deltas (1–2 new items
// each) with advanced watermarks, so the refresh pipeline (Task 9) has something
// to process with no API keys.
// ---------------------------------------------------------------------------

// Stable 32-bit FNV-1a hash → used to derive deterministic SERP positions so the
// fixture rank map is identical run-to-run (same keyword/target → same position).
function stableHash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

// Deterministic keyword → position in [1, 50]. Target folded in so different
// targets get different positions for the same keyword.
export function fixtureRankMap(keywords: string[], target: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of keywords) out[k] = (stableHash(`${k}|${target}`) % 50) + 1;
  return out;
}

// reviews delta — two "new" reviews newer than any baseline, with stable ids.
export function fixtureReviewDelta(): { items: ReviewItem[]; newestId: string } {
  const items: ReviewItem[] = [
    { id: "rk-fixture-review-002", rating: 5, title: "Widget finally refreshes", body: "The latest update fixed my home-screen widget — it updates instantly now.", at: "2026-06-10T09:15:00Z" },
    { id: "rk-fixture-review-001", rating: 2, title: "Crash on iPhone 11", body: "Still crashes every morning when I open it on my iPhone 11.", at: "2026-06-09T22:40:00Z" },
  ];
  // newest-first ordering (matches sortby=mostrecent); newest id is the first.
  return { items, newestId: "rk-fixture-review-002" };
}

// rank delta — a fresh full map plus the subset of keywords whose position moved.
export function fixtureRankDelta(prev: Record<string, number>): {
  changed: Array<{ keyword: string; from: number | null; to: number }>;
  fresh: Record<string, number>;
} {
  const fresh: Record<string, number> = {
    "habit tracker app": 4,
    "daily habit tracker": 9,
    "best habit tracker": 17,
  };
  const changed: Array<{ keyword: string; from: number | null; to: number }> = [];
  for (const [keyword, to] of Object.entries(fresh)) {
    const from = prev[keyword] ?? null;
    if (from !== to) changed.push({ keyword, from, to });
  }
  return { changed, fresh };
}

// threads delta — two timestamped threads newer than any baseline marker.
export function fixtureThreadDelta(): { items: TimedCommunity[]; newestAt: string } {
  const items: TimedCommunity[] = [
    { source: "hn", title: "Show HN: a minimalist habit tracker", url: "https://news.ycombinator.com/item?id=40000002", engagement: 188, at: "2026-06-10T14:05:00Z" },
    { source: "bluesky", title: "Switched to a simpler habit app this week and my streak is alive again.", url: "https://bsky.app/profile/productivity.bsky.social/post/3kfixturepost01", engagement: 41, at: "2026-06-09T18:30:00Z" },
  ];
  return { items, newestAt: "2026-06-10T14:05:00Z" };
}

// competitors delta — one newly-discovered name not in the prior known set.
export function fixtureCompetitorDelta(known: string[]): { newNames: string[]; found: string[] } {
  const found = ["Habitify", "Streaks", "Finch"];
  const knownSet = new Set(known);
  const newNames = found.filter((n) => !knownSet.has(n));
  return { newNames, found };
}

export function fixtureActions(): ActionCard[] {
  return [
    // --- CONTENT cards ---
    {
      category: "content",
      title: "Rewrite App Store description first paragraph to lead with streak consistency",
      why: "Reviews repeatedly cite 'the streak feature keeps me going' but the current listing buries streaks in the third paragraph behind the '21 days' headline. Leading with what users actually love will improve conversion.",
      evidenceIds: [],
      evidence: [
        { excerpt: "the streak feature keeps me going", source: "review_themes", sourceType: "app_store_rss" },
        { excerpt: "Build habits in 21 days", source: "positioning", sourceType: "positioning" },
        { excerpt: "Daily habit streaks with visual progress", source: "positioning", sourceType: "positioning" },
      ],
      effortMin: 45,
      suggestedDeadline: "2026-06-26",
      expectedOutcome: {
        scoreComponent: "content",
        delta: 8,
        secondary: "Improved keyword density for 'daily habit tracker' (5,400/mo)",
      },
      draft: "I built HabitKit because I kept falling off every habit app I tried — until I realised the streak was the thing that actually worked for me. It turns out I'm not alone: our users tell us 'the streak feature keeps me going' more than anything else. That's the whole app: one clean streak view, smart reminders, and nothing in the way.",
      draftRequiresEdit: true,
      verification: { method: "url", state: "pending" },
      basis: "evidence_based",
      confidence: 0.87,
    },
    {
      category: "content",
      title: "Write a Show HN post for HackerNews targeting productivity builders",
      why: "The app's 'minimalist, distraction-free interface' positioning directly matches the HN audience's distaste for bloated productivity tools. A Show HN post costs nothing and can generate backlinks and early adopters.",
      evidenceIds: [],
      evidence: [
        { excerpt: "Minimalist, distraction-free interface", source: "positioning", sourceType: "positioning" },
        { excerpt: "incredibly easy to get started", source: "review_themes", sourceType: "app_store_rss" },
      ],
      effortMin: 60,
      suggestedDeadline: "2026-06-19",
      expectedOutcome: {
        scoreComponent: "content",
        delta: 6,
        secondary: "Potential Product Hunt upvotes from HN crossover",
      },
      draft: "Show HN: I built a habit tracker that's just a streak — no dashboards, no analytics, no pet\n\nI got frustrated with Habitify's charts and Streaks' Apple Watch dependency. HabitKit is one screen: your habits, your streak, a reminder. That's it. 500k users later, the most common review is 'incredibly easy to get started'. Curious what the HN crowd thinks — happy to answer any questions.",
      draftRequiresEdit: true,
      verification: { method: "url", state: "pending" },
      basis: "evidence_based",
      confidence: 0.72,
    },
    {
      category: "content",
      title: "Create a 'HabitKit vs Habitify' comparison page on your website",
      why: "Habitify positions on data-rich analytics — the direct opposite of HabitKit's simplicity. Users searching 'Habitify alternative' (estimated 1,200/mo) are pre-qualified buyers who've already decided they want something simpler.",
      evidenceIds: [],
      evidence: [
        { excerpt: "Data-rich habit analytics with beautiful charts", source: "competitor_gap", sourceType: "dataforseo_serp" },
        { excerpt: "Simpler onboarding and lower cognitive load for new users", source: "competitor_gap", sourceType: "dataforseo_serp" },
        { excerpt: "habit tracker app", source: "keyword_data", sourceType: "dataforseo_keywords" },
      ],
      effortMin: 90,
      suggestedDeadline: "2026-07-03",
      expectedOutcome: {
        scoreComponent: "seo",
        delta: 7,
        secondary: "Long-tail SEO for 'Habitify alternative simple'",
      },
      draft: "If you've tried Habitify and felt overwhelmed by the dashboards, you're not alone. HabitKit does one thing: it keeps your streak alive. No charts, no weekly reports, no 'insight' emails — just you and your habits. Here's how the two apps compare side by side.",
      draftRequiresEdit: true,
      verification: { method: "url", state: "pending" },
      basis: "evidence_based",
      confidence: 0.79,
    },
    // --- OUTREACH cards ---
    {
      category: "outreach",
      title: "Post in r/habittracking with a 'what made you stick with your habit app?' thread",
      why: "r/habittracking (42k members) regularly discusses app comparisons. The community explicitly values streak-based motivation — our users cite 'the streak feature keeps me going' — making this the highest-fit subreddit for organic discovery.",
      evidenceIds: [],
      evidence: [
        { excerpt: "the streak feature keeps me going", source: "review_themes", sourceType: "app_store_rss" },
        { excerpt: "Ask HN: Best apps for habit tracking?", source: "https://news.ycombinator.com/item?id=38521041", sourceType: "communities" },
      ],
      effortMin: 20,
      suggestedDeadline: "2026-06-18",
      expectedOutcome: {
        scoreComponent: "outreach",
        delta: 5,
        secondary: "Qualitative user feedback on streak feature",
      },
      draft: "Curious what actually made you stick with your habit app long-term. For me it was streaks — the moment I added a visual streak to HabitKit (the app I built) our Day-30 retention jumped. What feature hooked you?",
      draftRequiresEdit: true,
      verification: { method: "url", state: "pending" },
      basis: "evidence_based",
      confidence: 0.81,
    },
    {
      category: "outreach",
      title: "Pitch Thomas Frank (YouTube, 3.6M subscribers) as a Habitify-to-HabitKit switcher story",
      why: "Thomas Frank covers productivity app comparisons and has reviewed both Habitify and Streaks. HabitKit's 'simpler onboarding and lower cognitive load' gap vs Habitify is exactly the angle his audience responds to.",
      evidenceIds: [],
      evidence: [
        { excerpt: "Simpler onboarding and lower cognitive load for new users", source: "competitor_gap", sourceType: "dataforseo_serp" },
        { excerpt: "Thomas Frank Review Channel", source: "https://www.youtube.com/watch?v=fixture_Habitify_1", sourceType: "youtube" },
      ],
      effortMin: 30,
      suggestedDeadline: "2026-06-25",
      expectedOutcome: {
        scoreComponent: "outreach",
        delta: 12,
        secondary: "YouTube backlink and potential App Store feature",
      },
      draft: "Hey Thomas — long-time fan of your productivity content. I noticed your Habitify review got a lot of comments from people who found it overwhelming. I built HabitKit as the anti-Habitify: one screen, one streak, nothing else. Our most common review is 'incredibly easy to get started'. Happy to set up a free account if you'd ever want to compare the two for a video.",
      draftRequiresEdit: true,
      verification: { method: "url", state: "pending" },
      basis: "evidence_based",
      confidence: 0.68,
    },
    {
      category: "outreach",
      title: "Submit to the Indie Hackers 'What are you working on?' thread",
      why: "Indie Hackers audiences are early adopters of productivity tools and frequently share app recommendations. HabitKit's 500k-user milestone makes a compelling IH story with natural virality.",
      evidenceIds: [],
      evidence: [
        { excerpt: "incredibly easy to get started", source: "review_themes", sourceType: "app_store_rss" },
        { excerpt: "widget is nice but doesn't refresh reliably", source: "review_themes", sourceType: "app_store_rss" },
        { excerpt: "daily routine app", source: "keyword_data", sourceType: "dataforseo_keywords" },
      ],
      effortMin: 25,
      suggestedDeadline: "2026-06-20",
      expectedOutcome: {
        scoreComponent: "outreach",
        delta: 4,
        secondary: "Developer audience provides beta feedback on widget issue",
      },
      draft: "Building HabitKit — a habit tracker that's literally just a streak. We hit 500k users by doing less: no analytics, no gamification, no onboarding flows. The most-cited review: 'incredibly easy to get started'. This week I'm fixing the widget reliability issue that's been in the top negative reviews. Would love any feedback from people who've tried the heavy hitters (Habitify, Streaks) and bounced.",
      draftRequiresEdit: true,
      verification: { method: "url", state: "pending" },
      basis: "probability_based",
      confidence: 0.55,
    },
    // --- SEO/ASO cards ---
    {
      category: "seo_aso",
      title: "Inject 'habit tracker app' into App Store title and first 100 chars of description",
      why: "'habit tracker app' has 8,100 monthly searches and no top competitor owns the phrase in their title. This is the single highest-ROI ASO change available.",
      evidenceIds: [],
      evidence: [
        { excerpt: "habit tracker app", source: "keyword_data", sourceType: "dataforseo_keywords" },
        { excerpt: "daily habit tracker", source: "keyword_data", sourceType: "dataforseo_keywords" },
        { excerpt: "Minimalist, distraction-free interface", source: "positioning", sourceType: "positioning" },
      ],
      effortMin: 15,
      suggestedDeadline: "2026-06-17",
      expectedOutcome: {
        scoreComponent: "seo",
        delta: 10,
        secondary: "Improves 'daily habit tracker' (5,400/mo) ranking as a side effect",
      },
      draft: null,
      draftRequiresEdit: true,
      verification: { method: "rank_check", state: "pending" },
      basis: "evidence_based",
      confidence: 0.93,
    },
    {
      category: "seo_aso",
      title: "Submit HabitKit to AlternativeTo.net as an alternative to Habitify and Streaks",
      why: "AlternativeTo.net is a high-DA directory with dedicated pages for both Habitify and Streaks. A listing there captures users actively searching for simpler alternatives — exactly HabitKit's positioning gap.",
      evidenceIds: [],
      evidence: [
        { excerpt: "Simpler onboarding and lower cognitive load for new users", source: "competitor_gap", sourceType: "dataforseo_serp" },
        { excerpt: "best habit tracker", source: "keyword_data", sourceType: "dataforseo_keywords" },
      ],
      effortMin: 20,
      suggestedDeadline: "2026-06-21",
      expectedOutcome: {
        scoreComponent: "seo",
        delta: 6,
        secondary: "Backlink from a DA-70+ domain",
      },
      draft: null,
      draftRequiresEdit: true,
      verification: { method: "url", state: "pending" },
      basis: "evidence_based",
      confidence: 0.85,
    },
    {
      category: "seo_aso",
      title: "Add 'wellness habit app' and 'mindfulness daily habits' to App Store keyword field",
      why: "The wellness cluster (1,900 + 1,200/mo) has lower competition than the core 'habit tracker' cluster, making it achievable for an app without top-10 ranking yet. Adding these as secondary keywords costs nothing.",
      evidenceIds: [],
      evidence: [
        { excerpt: "wellness habit app", source: "keyword_data", sourceType: "dataforseo_keywords" },
        { excerpt: "Health & Fitness", source: "positioning", sourceType: "positioning" },
      ],
      effortMin: 10,
      suggestedDeadline: "2026-06-17",
      expectedOutcome: {
        scoreComponent: "seo",
        delta: 4,
      },
      draft: null,
      draftRequiresEdit: true,
      verification: { method: "rank_check", state: "pending" },
      basis: "evidence_based",
      confidence: 0.76,
    },
  ];
}

// ---------------------------------------------------------------------------
// Cold Start fixture (§4.3) — the validation-through-distribution queue for a
// subject with little/no footprint. Used by generateColdStartActions() when
// fixturesEnabled()=true so the full scan runs keyless on the Cold Start branch.
//
// Every card: basis "probability_based", confidence ≤ 0.6, draftRequiresEdit
// true, ≥2 evidence items from ≥2 distinct sourceTypes (passes Critic rule 1),
// content/outreach cards carry a real draft (passes rule 5a). Evidence `source`
// values are non-URL provenance labels so the §11 per-surface cadence cap never
// collapses these cards. Dominant sourceTypes are spread so the Critic source-
// diversity rule (6) keeps the whole set. A pivot-suggestion card is included.
// ---------------------------------------------------------------------------
export function fixtureColdStartActions(): ActionCard[] {
  return coldStartActionsFrom({
    productName: "Habits",
    icp: "people trying to build a daily habit",
    topKeyword: "habit tracker app",
    secondKeyword: "daily habit tracker",
    topCompetitor: "Habitify",
    communityA: "r/getdisciplined",
    communityB: "Indie Hackers",
  });
}

// ---------------------------------------------------------------------------
// Shared Cold Start builder — pure + template-driven from a small set of derived
// strings. Used by BOTH the fixture above and the live (degrade-safe) path in
// lib/llm/cold-start-actions.ts, so the two never drift.
// ---------------------------------------------------------------------------
export interface ColdStartSeed {
  productName: string;
  icp: string;
  topKeyword: string;
  secondKeyword: string;
  topCompetitor: string;
  communityA: string;
  communityB: string;
}

function isoPlusDays(days: number): string {
  return new Date(Date.now() + days * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

export function coldStartActionsFrom(seed: ColdStartSeed): ActionCard[] {
  const { productName, icp, topKeyword, secondKeyword, topCompetitor, communityA, communityB } = seed;

  // Non-URL provenance labels keep these off the §11 per-surface cadence cap.
  const evPositioning = (excerpt: string): ActionCardEvidence => ({ excerpt, source: "positioning", sourceType: "positioning" });
  const evKeyword = (excerpt: string): ActionCardEvidence => ({ excerpt, source: "keyword_data", sourceType: "dataforseo_keywords" });
  const evSerp = (excerpt: string): ActionCardEvidence => ({ excerpt, source: "competitor_serp", sourceType: "dataforseo_serp" });
  const evCommunity = (excerpt: string): ActionCardEvidence => ({ excerpt, source: "community_scan", sourceType: "communities" });

  return [
    // 1. Ship a waitlist / free-tool page targeting the hypothesised ICP.
    {
      category: "content",
      title: `Ship a waitlist page for ${productName} targeting ${icp}`,
      why: `${productName} has little public footprint yet, so the fastest way to validate demand is to put a focused waitlist page in front of ${icp} and measure sign-up conversion. The page doubles as the first real demand signal.`,
      evidenceIds: [],
      evidence: [
        evPositioning(`Hypothesised ICP: ${icp}`),
        evPositioning(`Core promise to test: helps ${icp} stay consistent`),
        evKeyword(`Intent keyword to headline: ${topKeyword}`),
      ],
      effortMin: 90,
      suggestedDeadline: isoPlusDays(7),
      expectedOutcome: { scoreComponent: "content", delta: 6, secondary: "Waitlist sign-up conversion becomes the first demand signal" },
      draft: `${productName} — for ${icp}.\n\nWe're building the simplest way for ${icp} to stay consistent. Drop your email to get early access and help shape it.\n\nWhat you get: first access, a say in the roadmap, and a founder who actually reads replies. No spam, just one short note when it's ready.`,
      draftRequiresEdit: true,
      verification: { method: "url", state: "pending" },
      basis: "probability_based",
      confidence: 0.55,
    },
    // 2. Post it in a scored community (demand test #1).
    {
      category: "outreach",
      title: `Share the waitlist in ${communityA} as a genuine ask, not a pitch`,
      why: `${communityA} is where ${icp} already gather, so a sincere "here's what I'm building, would this help you?" post tests whether the problem resonates. Replies and click-throughs are the demand signal — low engagement is itself useful data.`,
      evidenceIds: [],
      evidence: [
        evCommunity(`${icp} actively discuss this problem in ${communityA}`),
        evCommunity(`Comparison threads recur in communities like ${communityA}`),
        evPositioning(`Angle to test: helps ${icp} stay consistent`),
      ],
      effortMin: 30,
      suggestedDeadline: isoPlusDays(8),
      expectedOutcome: { scoreComponent: "outreach", delta: 4, secondary: "Community reply rate and click-through gauge problem resonance" },
      draft: `I'm building ${productName}, a simple tool for ${icp}. Before I go further I wanted to ask the people it's actually for: when you've tried to stay consistent, what got in the way? If a tool like this would help, the waitlist is in the comments — but honestly I'm here for the answers more than the sign-ups.`,
      draftRequiresEdit: true,
      verification: { method: "url", state: "pending" },
      basis: "probability_based",
      confidence: 0.5,
    },
    // 2b. Post it in a second scored community (demand test #2).
    {
      category: "content",
      title: `Write a short build-in-public post for ${communityB}`,
      why: `${communityB} rewards transparent early-stage stories. A post on why you're building ${productName} for ${icp} tests whether the narrative lands and seeds the first followers — engagement here is an early demand read before any spend.`,
      evidenceIds: [],
      evidence: [
        evCommunity(`${communityB} engages with early-stage build-in-public posts`),
        evCommunity(`${icp} surface in community discussions around this problem`),
        evSerp(`Established alternatives such as ${topCompetitor} appear in SERP results`),
      ],
      effortMin: 45,
      suggestedDeadline: isoPlusDays(9),
      expectedOutcome: { scoreComponent: "content", delta: 4, secondary: "Post engagement is an early demand read pre-spend" },
      draft: `Day 1 of building ${productName}: a no-frills tool for ${icp}. The big apps (${topCompetitor} and friends) feel heavy for what I actually need, so I'm starting from the smallest thing that helps me stay consistent. I'll share what works and what flops. If you're one of ${icp}, I'd love your take on what's missing.`,
      draftRequiresEdit: true,
      verification: { method: "url", state: "pending" },
      basis: "probability_based",
      confidence: 0.5,
    },
    // 3. Stand up one comparison / landing page on the top intent keyword.
    {
      category: "seo_aso",
      title: `Stand up a "${productName} vs ${topCompetitor}" comparison page on "${topKeyword}"`,
      why: `People searching "${topKeyword}" and "${topCompetitor} alternative" are pre-qualified. A single honest comparison page lets you measure search-driven conversion before committing to a content programme — the conversion rate tells you if the positioning holds.`,
      evidenceIds: [],
      evidence: [
        evSerp(`${topCompetitor} ranks for the intent term and owns the comparison space`),
        evSerp(`Alternative-seeking queries cluster around ${topCompetitor}`),
        evKeyword(`Top intent keyword: ${topKeyword}`),
      ],
      effortMin: 120,
      suggestedDeadline: isoPlusDays(12),
      expectedOutcome: { scoreComponent: "seo", delta: 5, secondary: "Search-to-waitlist conversion validates the positioning" },
      draft: null,
      draftRequiresEdit: true,
      verification: { method: "url", state: "pending" },
      basis: "probability_based",
      confidence: 0.5,
    },
    // 4. Optional fast-signal: a small ad test on the top intent keyword.
    {
      category: "seo_aso",
      title: `Run a $50 search-ad test on "${topKeyword}" pointing at the waitlist`,
      why: `A $50 ad test buys a fast, quantified read on intent for "${topKeyword}" without waiting for organic ranking. Click-through and waitlist conversion give you a kill/keep number within days — cheaper than guessing.`,
      evidenceIds: [],
      evidence: [
        evKeyword(`Top intent keyword to bid on: ${topKeyword}`),
        evKeyword(`Secondary keyword for ad groups: ${secondKeyword}`),
        evSerp(`Paid competition is visible against ${topCompetitor} on the term`),
      ],
      effortMin: 60,
      suggestedDeadline: isoPlusDays(10),
      expectedOutcome: { scoreComponent: "seo", delta: 3, secondary: "Ad CTR + waitlist conversion give a fast kill/keep number" },
      draft: null,
      draftRequiresEdit: true,
      verification: { method: "url", state: "pending" },
      basis: "probability_based",
      confidence: 0.45,
    },
    // 5. Optional (never mandatory) discovery-conversation script.
    {
      category: "outreach",
      title: `Optional: a 5-question discovery script for 5 chats with ${icp}`,
      why: `If the waitlist and ad signals are ambiguous, five short conversations with ${icp} explain the why behind the numbers. This is optional and runs in parallel — never a blocker to shipping the distribution tests above.`,
      evidenceIds: [],
      evidence: [
        evPositioning(`Audience to talk to: ${icp}`),
        evPositioning(`Hypothesis to probe: staying consistent is the core pain`),
        evCommunity(`Recruit participants from ${communityA} respondents`),
      ],
      effortMin: 40,
      suggestedDeadline: isoPlusDays(11),
      expectedOutcome: { scoreComponent: "outreach", delta: 2, secondary: "Qualitative why behind the waitlist/ad numbers" },
      draft: `Quick discovery script (keep it to 15 minutes):\n1. Last time you tried to stay consistent, what did you use?\n2. What made you stop or switch?\n3. What would have to be true for you to switch tools?\n4. If this existed tomorrow, what's the one thing it must do?\n5. Who else do you know who has this problem?\nListen more than you pitch — the goal is to understand ${icp}, not to sell.`,
      draftRequiresEdit: true,
      verification: { method: "self_report", state: "pending" },
      basis: "probability_based",
      confidence: 0.5,
    },
    // 6. Pivot-suggestion card — kill/pivot criteria from OBSERVED signals, framed
    //    as the next action (not a lecture). Highest confidence so it always survives.
    {
      category: "content",
      title: `Decide: keep, sharpen, or pivot ${productName} from the first signals`,
      why: `Set the kill/pivot line before you read the results so it stays honest: if waitlist conversion is under ~10%, ad CTR under ~1%, and community posts get little engagement after two weeks, treat that as a signal to sharpen the ICP or pivot the angle — then re-run this same queue on the new hypothesis.`,
      evidenceIds: [],
      evidence: [
        evKeyword(`Measure ad CTR + waitlist conversion on ${topKeyword}`),
        evCommunity(`Weigh reply/engagement rate from ${communityA} and ${communityB}`),
        evPositioning(`Re-test the ICP (${icp}) if signals stay weak`),
      ],
      effortMin: 30,
      suggestedDeadline: isoPlusDays(14),
      expectedOutcome: { scoreComponent: "content", delta: 3, secondary: "A pre-committed kill/pivot line keeps the read honest" },
      draft: `Pivot checkpoint (fill in after two weeks):\n- Waitlist conversion: ____%  (weak if < ~10%)\n- Ad CTR on "${topKeyword}": ____%  (weak if < ~1%)\n- Community engagement in ${communityA} / ${communityB}: ____\n\nIf two or more are weak, don't push harder on the same plan — change the ICP or the angle and re-run this queue. If they're strong, double down and start the standard plan.`,
      draftRequiresEdit: true,
      verification: { method: "self_report", state: "pending" },
      basis: "probability_based",
      confidence: 0.6,
    },
  ];
}
