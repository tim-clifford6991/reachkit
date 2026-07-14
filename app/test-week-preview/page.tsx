/**
 * /test-week-preview — fixture render of the dashboard's "This week's plan"
 * (WeekPlanPreview with a sample board; synthesis intel 401s on fixture pages
 * so this also exercises the board-only graceful state).
 */
import { WeekPlanPreview } from "@/components/app/intel/week-plan-preview";
import type { ActionBoard } from "@/lib/scan/action-board";

const BOARD: ActionBoard = {
  open: [
    { id: "a1", title: "Fix your meta description", category: "seo", why: "Buyers see a truncated pitch in results.", predictedDelta: 4, actualDelta: null, createdAt: "2026-07-01T00:00:00Z", verifiedAt: null, draft: "New meta: …", verifyUrl: "https://notably.app", effortMin: 15, target: null, scheduledFor: null },
    { id: "a2", title: "Submit to AlternativeTo", category: "outreach", why: "2 of 3 rivals are listed.", predictedDelta: 3, actualDelta: null, createdAt: "2026-07-02T00:00:00Z", verifiedAt: null, draft: null, verifyUrl: "https://alternativeto.net", effortMin: 15, target: null, scheduledFor: null },
  ],
  verifying: [],
  done: [],
  retry: [],
};

export default function TestWeekPreviewPage() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px", background: "var(--c-bg)" }}>
      <WeekPlanPreview board={BOARD} today={new Date(2026, 6, 8)} />
    </main>
  );
}
