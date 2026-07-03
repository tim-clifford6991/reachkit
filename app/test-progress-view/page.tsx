/**
 * /test-progress-view — styled fixture preview for the Progress view (Score
 * history + "What changed"). Renders <ProgressView> against a realistic
 * hardcoded 8-week ramp (38 → 54) with 3 verified-fix markers and a handful
 * of "what changed" events, so the populated, styled UI can be reviewed
 * without auth or a live gather. Server component — no fetch, no auth gate.
 */
import { ProgressView } from "@/components/app/intel/progress-view";
import type { ScoreHistoryPoint } from "@/lib/scan/engagement";
import type { HistoryMarker } from "@/lib/scan/score-history-markers";

function iso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString();
}

// 8-week ramp, oldest first — each point also carries a plausible pillar
// breakdown (seo 30→40, content 45→58, outreach 40→60) so the overlay renders.
const SAMPLE_HISTORY: ScoreHistoryPoint[] = [
  { takenAt: iso(56), total: 38, breakdown: { content: 45, outreach: 40, seo: 30 } },
  { takenAt: iso(49), total: 40, breakdown: { content: 47, outreach: 43, seo: 32 } },
  { takenAt: iso(42), total: 39, breakdown: { content: 48, outreach: 41, seo: 33 } },
  { takenAt: iso(35), total: 44, breakdown: { content: 51, outreach: 48, seo: 35 } },
  { takenAt: iso(28), total: 46, breakdown: { content: 53, outreach: 51, seo: 36 } },
  { takenAt: iso(21), total: 49, breakdown: { content: 55, outreach: 55, seo: 38 } },
  { takenAt: iso(14), total: 51, breakdown: { content: 56, outreach: 58, seo: 39 } },
  { takenAt: iso(7), total: 54, breakdown: { content: 58, outreach: 60, seo: 40 } },
];

const SAMPLE_MARKERS: HistoryMarker[] = [
  { takenAt: iso(35), label: "Added schema markup + meta descriptions", actionId: "sample-action-1" },
  { takenAt: iso(14), label: "Listed on webcatalog.io directory", actionId: "sample-action-2" },
  { takenAt: iso(7), label: "Published 'How to share meeting notes'", actionId: "sample-action-3" },
];

const SAMPLE_EVENTS = [
  { label: "Published 'How to share meeting notes'", date: iso(7), delta: 3, href: "/app/plan/content" },
  { label: "Listed on webcatalog.io directory", date: iso(14), delta: 3, href: "/app/plan/content" },
  { label: "New competitor in your space: notionmeet.com", date: iso(21) },
  { label: "Added schema markup + meta descriptions", date: iso(35), delta: 2, href: "/app/plan/content" },
  { label: "Crossed from Invisible into Hard-to-find", date: iso(42) },
  { label: "First scan — baseline score 38", date: iso(56) },
];

export default function TestProgressViewPage() {
  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--c-ink)", marginBottom: 4 }}>
        Progress view — fixture preview
      </h1>
      <p style={{ fontSize: 13, color: "var(--c-muted)", marginBottom: 24 }}>
        Styled, populated <code>ProgressView</code> against a hardcoded 8-week score ramp — no auth, no live gather.
      </p>
      <ProgressView history={SAMPLE_HISTORY} markers={SAMPLE_MARKERS} events={SAMPLE_EVENTS} />
    </main>
  );
}
