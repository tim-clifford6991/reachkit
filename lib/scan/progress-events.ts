/**
 * buildProgressEvents — the pure "What changed" changelog builder shared by
 * the Progress page and (WS4) the dashboard recap. Extracted verbatim from
 * app/(app)/app/progress/page.tsx so both surfaces produce IDENTICAL
 * changelog output from the same inputs. No I/O — everything here is a pure
 * function over already-fetched data.
 *
 * Two event sources, merged and sorted newest-first:
 *   1. Verified-fix markers (score_snapshots with an action_id) → one event
 *      per marker, carrying the score delta the fix produced (vs. the prior
 *      history point) and a deep-link back into the plan.
 *   2. Week-over-week market alerts, computed only when exactly two
 *      consecutive `market_snapshots` rows exist (fewer/more → no alerts).
 */
import type { ScoreHistoryPoint } from "@/lib/scan/engagement";
import type { HistoryMarker } from "@/lib/scan/score-history-markers";
import { computeMarketAlerts } from "@/lib/scan/market";

export interface ProgressEvent {
  label: string;
  date: string;
  delta?: number;
  /** When set, "What changed" renders this row as a plan deep-link. */
  href?: string;
}

/** Score delta at a history index vs. the prior point, or null at index 0. */
function deltaAt(history: ScoreHistoryPoint[], idx: number): number | null {
  if (idx <= 0 || idx >= history.length) return null;
  return history[idx]!.total - history[idx - 1]!.total;
}

/** Every fix event deep-links to THE plan — one page for all categories. */
function hrefForCategory(_category: string | undefined): string {
  return "/app/plan";
}

/** Verified-fix markers → changelog events, each carrying the score delta the fix produced. */
function eventsFromMarkers(history: ScoreHistoryPoint[], markers: HistoryMarker[]): ProgressEvent[] {
  return markers.map((m) => {
    const idx = history.findIndex((p) => p.takenAt === m.takenAt);
    const delta = idx >= 0 ? deltaAt(history, idx) : null;
    return {
      label: m.label,
      date: m.takenAt,
      ...(delta !== null ? { delta } : {}),
      // Every fix event deep-links back into the plan it came from.
      href: hrefForCategory(m.category),
    };
  });
}

export function buildProgressEvents(args: {
  history: ScoreHistoryPoint[];
  markers: HistoryMarker[];
  marketSnapshots: { taken_at: string; summary: unknown }[];
}): ProgressEvent[] {
  const { history, markers, marketSnapshots } = args;

  const events: ProgressEvent[] = eventsFromMarkers(history, markers);

  // Week-over-week competitive alerts, when two consecutive snapshots exist.
  if (marketSnapshots.length === 2) {
    const [latest, prior] = marketSnapshots as [
      { taken_at: string; summary: unknown },
      { taken_at: string; summary: unknown },
    ];
    const alerts = computeMarketAlerts(
      prior.summary as unknown as Parameters<typeof computeMarketAlerts>[0],
      latest.summary as unknown as Parameters<typeof computeMarketAlerts>[1],
    );
    for (const alert of alerts) {
      events.push({ label: alert.message, date: latest.taken_at });
    }
  }

  // Newest first, matching the template's "What changed" ordering.
  events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return events;
}
