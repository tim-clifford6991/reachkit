import { Suspense } from "react";
import { resolveIntelContext } from "@/lib/app/intel-context";
import { actionBoard } from "@/lib/scan/action-board";
import { PlanBoardView } from "@/components/app/intel/plan-board-view";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Plan", path: "/app/plans" });

/**
 * Queue — the full central plan from the `actions` table, grouped by verify
 * lifecycle (open / verifying / verified) via lib/scan/action-board.ts.
 * Mirrors the progress page's server-read pattern (resolveIntelContext
 * gating, then cheap Supabase reads — no live gather here).
 */
export default function PlansPage() {
  return (
    <Suspense fallback={null}>
      <PlansContent />
    </Suspense>
  );
}

async function PlansContent() {
  const ctx = await resolveIntelContext("/app/plans");
  const board = await actionBoard(ctx.appId);
  return <PlanBoardView board={board} />;
}
