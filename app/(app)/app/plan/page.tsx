import { Suspense } from "react";
import { resolveIntelContext } from "@/lib/app/intel-context";
import { actionBoard } from "@/lib/scan/action-board";
import { scoreDelta } from "@/lib/scan/weekly-plan";
import { serverDb } from "@/lib/db/client";
import { CompetitorSetup } from "@/components/app/intel/competitor-setup";
import { PlanTimelineView } from "@/components/app/intel/plan-timeline-view";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({ title: "Plan", path: "/app/plan" });

/**
 * THE plan — the singular page where the founder sees every action laid out
 * over time, executes each one in place (drafts, prefilled composers, venue
 * links, coach checklists), and watches wins verify into the score.
 *
 * The tracked action board loads server-side (cheap Supabase read, same
 * pattern as the old queue page); the synthesis recommendations stream in
 * client-side through the intel layer (cached after first gather). The
 * content/distribution views remain as the analysis behind the plan.
 */
export default function PlanPage() {
  return (
    <Suspense fallback={null}>
      <PlanContent />
    </Suspense>
  );
}

async function PlanContent() {
  const ctx = await resolveIntelContext("/app/plan");
  if (!ctx.domain) return <p className="py-16 text-center text-sm text-neutral-400">Add your product URL in Settings to begin.</p>;
  if (ctx.competitors.length === 0) return <CompetitorSetup domain={ctx.domain} />;

  // Board + the two latest score snapshots (cheap reads) — the strip shows the
  // live score and its most recent movement right where the work happens.
  const [board, { data: snaps }] = await Promise.all([
    actionBoard(ctx.appId),
    serverDb()
      .from("score_snapshots")
      .select("total, taken_at")
      .eq("app_id", ctx.appId)
      .order("taken_at", { ascending: false, nullsFirst: false })
      .limit(2),
  ]);
  const latest = snaps?.[0];
  const score = latest ? { total: latest.total, delta: scoreDelta(snaps ?? []) } : null;

  return <PlanTimelineView board={board} domain={ctx.domain} score={score} />;
}
