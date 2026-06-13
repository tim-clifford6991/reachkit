import type { Platform } from "@/lib/scan/router";

export interface Competitor { name: string; url: string; source: string; rank: number; }
export interface Community { source: string; title: string; url: string; engagement: number; }
export interface ReviewItem { rating: number | null; title: string; body: string; at?: string; }
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
}
export interface Creator { name: string; url: string; audienceProxy: number; coveredCompetitor: string; }
export type ScanEventType = "artifact" | "facts" | "findings" | "report" | "done" | "error";
export interface ScanEvent { type: ScanEventType; payload: Record<string, unknown>; }
