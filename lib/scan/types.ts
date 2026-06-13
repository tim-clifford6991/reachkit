import type { Platform } from "@/lib/scan/router";

export interface Competitor { name: string; url: string; source: string; rank: number; }
export interface Community { source: string; title: string; url: string; engagement: number; }
// A Community carrying its publish timestamp (ISO) — used by the threads delta
// collector to keep only threads newer than the monitor's lastThreadAt watermark.
export interface TimedCommunity extends Community { at: string; }
export interface ReviewItem { id?: string; rating: number | null; title: string; body: string; at?: string; }
export interface ListingFacts { name: string; category: string | null; description: string | null; pricing?: string | null; }
export interface ThemeCount { term: string; count: number; }
export interface WebProxy { score: number; serpResultCount: number; phUpvotes: number; domainAgeYears: number | null; }
export interface KeywordRow { keyword: string; volume: number; cpc: number; competition: number; }
export interface PreliminaryFacts {
  mode: Platform;
  listing: ListingFacts;
  competitors: Competitor[];
  reviewVolume: number;
  ratingTrend: number | null;     // app mode: avg rating; null in web mode
  webProxy: WebProxy | null;      // web mode only
  themes: ThemeCount[];
  sourcesUsed: string[];
  // §4.3 Cold Start: true when the subject has little/no footprint (pre-revenue,
  // pre-launch) — flips the full scan onto the validation-through-distribution queue.
  // Computed by isColdStart() in lib/scan/cold-start.ts when facts are assembled.
  coldStart: boolean;
}
export interface Creator { name: string; url: string; audienceProxy: number; coveredCompetitor: string; }

// Monitors (Cycle 4 Task 7): one row per (app_id, kind); `watermark` (jsonb)
// holds the per-kind marker the weekly delta refresh advances on each run.
export type MonitorKind = "reviews" | "rank" | "threads" | "competitors";
export interface WatermarkBody {
  lastReviewId?: string | null;      // reviews monitor
  topRanks?: Record<string, number>; // rank monitor: keyword -> position
  lastThreadAt?: string | null;      // threads monitor (ISO)
  knownCompetitors?: string[];       // competitors monitor (names)
}

export type ScanEventType = "artifact" | "facts" | "findings" | "report" | "refresh" | "done" | "error";
export interface ScanEvent { type: ScanEventType; payload: Record<string, unknown>; }
