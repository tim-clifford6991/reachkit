/**
 * Action-completion markers for the score-history chart: the score_snapshots that
 * were triggered by a verified action (action_id set), with the action title for
 * the label. Lets the chart show "this fix → this bump".
 */

import { serverDb } from "@/lib/db/client";

export interface HistoryMarker {
  takenAt: string;
  label: string;
}

export async function scoreHistoryMarkers(appId: string): Promise<HistoryMarker[]> {
  const { data } = await serverDb()
    .from("score_snapshots")
    .select("taken_at, actions(title)")
    .eq("app_id", appId)
    .not("action_id", "is", null)
    .order("taken_at", { ascending: true });

  return (data ?? []).map((r) => ({
    takenAt: (r.taken_at as string | null) ?? "",
    label: (r.actions as { title?: string } | null)?.title ?? "Fix shipped",
  }));
}
