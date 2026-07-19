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
  // Part C — true when the site fetch was garbage (a JS-shell page) AND the
  // one Tavily Extract escalation also failed/was garbage. Web mode only;
  // false/absent for app mode and for a healthy fetch. Flows into
  // `report_payload.fetchDegraded` at assembly (report.ts). Optional so the
  // many hand-built PreliminaryFacts fixtures elsewhere don't all need
  // updating — `assembleFacts` (the one real construction site) always sets
  // it explicitly.
  fetchDegraded?: boolean;
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

export type ScanEventType =
  | "artifact"
  | "facts"
  | "findings"
  | "report"
  | "refresh"
  | "intel-spend" // interactive intel gather spent external USD (source-tagged)
  | "cost-alert" // a cost threshold was crossed (scope-tagged)
  | "done"
  | "error";
export interface ScanEvent { type: ScanEventType; payload: Record<string, unknown>; }

/** A progress checkpoint emitted by cold-compute gatherers. */
export interface StageEvent {
  key: string;
  label: string;
  /** Real data already available at this checkpoint, shown inline (e.g. "Found 4 competitors"). */
  detail?: string;
}
/** Optional progress callback threaded into gatherers. No-op when omitted. */
export type OnStageCallback = (s: StageEvent) => void;
